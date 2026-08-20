<script setup lang="ts">
import { ref, nextTick, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useConfigStore } from '../../stores/config.store'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { useSessionStore } from '../../stores/session.store'
import { ChatService } from '../../services/chat.service'
import ChatMessage from '../ChatMessage.vue'
import ChatInput from '../ChatInput.vue'
import QueuedMessages from '../QueuedMessages.vue'
import PixelLoader from '../PixelLoader.vue'
import type { ToolCall } from '../ToolCallBlock.vue'
import {
  extractArchitectureUpdate,
} from '../../utils/architectureAgent'

const configStore = useConfigStore()
const { isSetup } = storeToRefs(configStore)
const workspaceStore = useWorkspaceStore()
const sessionStore = useSessionStore()

const prompt = ref('')
const isLoading = ref(false)
/** Tracks what the agent is currently doing — drives PixelLoader variant */
const loadPhase = ref<'thinking' | 'streaming' | 'tooling'>('thinking')
const queuedMessages = ref<string[]>([])
const chatHistoryRef = ref<HTMLElement | null>(null)
let resizeObserver: ResizeObserver | null = null
/** Tracks the number of in-flight tool calls to toggle the tooling phase */
let activeToolCount = 0
/** Tool calls for the currently streaming agent message, keyed by message ID */
const messageToolCalls = ref<Record<string, ToolCall[]>>({})

const scrollToBottom = async () => {
  await nextTick()
  if (chatHistoryRef.value) {
    chatHistoryRef.value.scrollTop = chatHistoryRef.value.scrollHeight
  }
}

// Watch for DOM mount to attach the observer
watch(chatHistoryRef, (el) => {
  if (resizeObserver) resizeObserver.disconnect()
  if (el) {
    const innerContainer = el.querySelector('.chat-container')
    if (innerContainer) {
      resizeObserver = new ResizeObserver(() => {
        // Only auto-scroll if we are currently streaming/loading
        // This prevents fighting the user if they scroll up to read history
        if (isLoading.value) {
          scrollToBottom()
        }
      })
      resizeObserver.observe(innerContainer)
    }
  }
})

/**
 * Ensure the eve dev server is running for the active workspace.
 *
 * The server is normally started by App.vue on app launch and when
 * the active workspace changes. This is a fallback for edge cases
 * (e.g. the server crashed or wasn't ready yet).
 */
const ensureEveServer = async (): Promise<{ ok: boolean; error?: string }> => {
  const workspace = workspaceStore.activeWorkspace
  if (!workspace) return { ok: false, error: 'No workspace is open.' }

  // Always call start — the main process will return the existing server
  // if the workspace matches, or restart it if the workspace changed.
  const result = await window.api.eve.start({
    workspacePath: workspace.path,
    modelProvider: configStore.provider,
    modelName: configStore.model,
    apiKey: configStore.apiKey || undefined
  })

  if (!result.success) {
    console.error('[agent] Failed to start eve server:', result.error)
    return { ok: false, error: result.error || 'Unknown server startup error.' }
  }

  return { ok: true }
}

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect()
})

const processNextMessage = async () => {
  if (queuedMessages.value.length === 0 || isLoading.value || !isSetup.value) return
  const text = queuedMessages.value.shift()
  if (text) {
    await executeMessage(text)
  }
}

/** Apply architecture-mermaid fences from the finished agent reply. */
const applyArchitectureFromAgentReply = () => {
  const last = sessionStore.messages.at(-1)
  if (!last || last.role !== 'agent' || !last.content) return

  const { displayContent, mermaidSource, didUpdate } = extractArchitectureUpdate(last.content)
  if (!didUpdate || !mermaidSource) return

  const activeWs = workspaceStore.activeWorkspace
  if (activeWs) {
    workspaceStore.setArchitecture(mermaidSource)
  }
  sessionStore.replaceMessageContent(last.id, displayContent)
}

const executeMessage = async (text: string) => {
  if (workspaceStore.workspaces.length === 0) {
    const proj = await workspaceStore.addWorkspace()
    if (!proj) return // User cancelled directory selection
  }

  // Ensure the eve server is running for this workspace
  const serverReady = await ensureEveServer()
  if (!serverReady.ok) {
    // Show a user-visible error instead of silently dropping the message
    await sessionStore.addMessage('user', text)
    await sessionStore.addMessage('agent', `I couldn't start the agent server.\n\n**Reason:** ${serverReady.error}\n\nTry restarting the app, or check that Ollama is running.`)
    return
  }

  if (!sessionStore.activeSession) {
    await sessionStore.createSession()
  }

  await sessionStore.addMessage('user', text)
  scrollToBottom()

  isLoading.value = true
  sessionStore.loadingSessionId = sessionStore.activeSession?.id ?? null
  loadPhase.value = 'thinking'
  activeToolCount = 0
  const agentMsg = await sessionStore.addMessage('agent', '', true)
  if (!agentMsg) return

  ChatService.streamMessage({
    id: agentMsg.id,
    message: text,
    onChunk: (chunk) => {
      // First chunk transitions from "thinking" to "streaming"
      if (loadPhase.value === 'thinking') {
        loadPhase.value = 'streaming'
      }
      sessionStore.appendToMessage(agentMsg.id, chunk)
      scrollToBottom()
    },
    onTool: (event) => {
      if (event.phase === 'start') {
        activeToolCount++
        loadPhase.value = 'tooling'
        // Add the tool call as 'running'
        if (!messageToolCalls.value[agentMsg.id]) {
          messageToolCalls.value[agentMsg.id] = []
        }
        messageToolCalls.value[agentMsg.id] = [
          ...messageToolCalls.value[agentMsg.id],
          {
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            status: 'running' as const,
            input: event.input
          }
        ]
      } else {
        activeToolCount = Math.max(0, activeToolCount - 1)
        // Update the tool call status
        const calls = messageToolCalls.value[agentMsg.id]
        if (calls) {
          messageToolCalls.value[agentMsg.id] = calls.map((c) =>
            c.toolCallId === event.toolCallId
              ? {
                  ...c,
                  status: event.status === 'failed' ? 'failed' as const : event.status === 'rejected' ? 'rejected' as const : 'completed' as const,
                  output: event.output ?? c.output
                }
              : c
          )
        }
        // Return to streaming if text was already flowing and no tools remain
        if (activeToolCount === 0 && loadPhase.value === 'tooling') {
          loadPhase.value = 'streaming'
        }
      }
      scrollToBottom()
    },
    onEnd: () => {
      sessionStore.finalizeMessage(agentMsg.id)
      applyArchitectureFromAgentReply()
      isLoading.value = false
      sessionStore.loadingSessionId = null
      loadPhase.value = 'thinking'
      activeToolCount = 0
      processNextMessage()
    },
    onError: (err) => {
      // Format the error into a user-friendly message
      let friendly = err
      if (err.includes('lookup') && err.includes('no such host')) {
        friendly = 'Cannot reach the model provider. If using Ollama Cloud, check your internet connection. If using Ollama Local, make sure it is running on port 11434.'
      } else if (err.includes('ECONNREFUSED') || err.includes('connection refused')) {
        friendly = 'Cannot connect to Ollama. Make sure it is running locally on port 11434, or check your cloud API key in Settings.'
      } else if (err.includes('timed out') || err.includes('timeout')) {
        friendly = 'The model took too long to respond. Try again, or use a smaller model.'
      } else if (err.includes('not found') && err.includes('model')) {
        friendly = `The model "${configStore.model}" was not found. Pull it first with \`ollama pull ${configStore.model}\`, or pick a different model in Settings.`
      }

      sessionStore.appendErrorToMessage(agentMsg.id, friendly)
      isLoading.value = false
      sessionStore.loadingSessionId = null
      loadPhase.value = 'thinking'
      activeToolCount = 0
      // Mark any running tools as failed
      const calls = messageToolCalls.value[agentMsg.id]
      if (calls) {
        messageToolCalls.value[agentMsg.id] = calls.map((c) =>
          c.status === 'running' ? { ...c, status: 'failed' as const } : c
        )
      }
      processNextMessage()
    }
  })
}

const handleChat = async () => {
  const text = prompt.value.trim()
  if (!text || !isSetup.value) return
  
  if (isLoading.value) {
    queuedMessages.value.push(text)
    prompt.value = ''
    return
  }

  prompt.value = ''
  await executeMessage(text)
}

const removeQueuedMessage = (index: number) => {
  queuedMessages.value.splice(index, 1)
}

const handleStop = async () => {
  await ChatService.cancelChat()
  isLoading.value = false
  sessionStore.loadingSessionId = null
  loadPhase.value = 'thinking'
  activeToolCount = 0
  queuedMessages.value = []
}
</script>

<template>
  <div class="agent-view">
    <!-- Empty Conversation State -->
    <div v-if="isSetup && (!sessionStore.activeSession || sessionStore.messages.length === 0)" class="empty-conversation-state">
      <img src="../../assets/banner.png" alt="Kraken Logo" class="empty-banner" />
      <div class="centered-composer composer-width">
        <ChatInput 
          v-model="prompt"
          @submit="handleChat"
          @stop="handleStop"
          :disabled="!isSetup || isLoading"
          :is-loading="isLoading"
          placeholder="Plan, Build, / for skills, @ for context"
        />
      </div>
    </div>

    <!-- Chat History -->
    <div class="chat-history" ref="chatHistoryRef" v-if="isSetup && sessionStore.activeSession && sessionStore.messages.length > 0">
      <div class="chat-container">
        <template v-if="sessionStore.activeSession && sessionStore.messages.length > 0">
          <div class="top-spacer" style="height: 60px;"></div>
          <ChatMessage 
            v-for="(msg, index) in sessionStore.messages" 
            :key="msg.id || index" 
            :role="msg.role" 
            :content="msg.content"
            :is-streaming="msg.isStreaming"
            :tool-calls="msg.role === 'agent' ? messageToolCalls[msg.id] : undefined"
          />
          <div v-if="isLoading && sessionStore.loadingSessionId === sessionStore.activeSession?.id" class="message agent loading-indicator">
            <PixelLoader :variant="loadPhase" :size="5" />
            <span class="loading-label">{{ loadPhase === 'thinking' ? 'Thinking...' : loadPhase === 'streaming' ? 'Writing...' : 'Using tools...' }}</span>
          </div>
        </template>
      </div>
    </div>

    <!-- Floating Input Container -->
    <div
      v-if="isSetup && sessionStore.activeSession && sessionStore.messages.length > 0"
      class="floating-input-container composer-width no-drag"
    >
      <div class="floating-composer-wrapper no-drag">
        <QueuedMessages 
          :messages="queuedMessages"
          @remove="removeQueuedMessage"
        />
        <ChatInput 
          v-model="prompt"
          @submit="handleChat"
          @stop="handleStop"
          :disabled="!isSetup"
          :is-loading="isLoading"
          :rows="1"
          placeholder="Ask a follow-up question..."
        />
      </div>
    </div>

    <div v-if="!isSetup" class="welcome-screen">
      <img src="../../assets/banner.png" alt="Kraken Logo" class="welcome-banner" />
      <p>Please configure the agent to start.</p>
    </div>
  </div>
</template>

<style scoped>
.agent-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  position: relative;
}

.empty-conversation-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}

.empty-banner {
  width: 240px;
  opacity: 0.8;
  margin-bottom: 32px;
}

.centered-composer {
  position: absolute;
  bottom: calc(var(--bottom-bar-clearance) + var(--composer-stack-gap));
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: var(--composer-stack-gap);
}

.chat-history {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-bottom: 140px;
}

.chat-container {
  max-width: 800px;
  width: 100%;
  padding: 0 16px 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.welcome-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 0.9em;
}

.welcome-banner {
  width: 120px;
  margin-bottom: 24px;
  opacity: 0.5;
}

.floating-input-container {
  position: absolute;
  bottom: calc(var(--bottom-bar-clearance) + var(--composer-stack-gap));
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  justify-content: center;
  z-index: 10;
}

.floating-composer-wrapper {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.loading-indicator {
  padding: 0 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 24px;
}

.loading-label {
  font-size: 0.82em;
  font-weight: 400;
  letter-spacing: 0.04em;
  opacity: 0.8;
  transition: color 0.3s ease;
}

/* Phase-specific label colors — match the PixelLoader variant tones */
.loading-indicator:has(.pixel-loader--thinking) .loading-label { color: #B197D9; }
.loading-indicator:has(.pixel-loader--streaming) .loading-label { color: #5EEAD4; }
.loading-indicator:has(.pixel-loader--tooling) .loading-label { color: #FFB84D; }
</style>
