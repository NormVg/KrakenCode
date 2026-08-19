<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useConfigStore } from '../../stores/config.store'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { useSessionStore } from '../../stores/session.store'
import { ChatService } from '../../services/chat.service'
import ChatMessage from '../ChatMessage.vue'
import ChatInput from '../ChatInput.vue'
import QueuedMessages from '../QueuedMessages.vue'
import {
  buildArchitectureSystemPrompt,
  extractArchitectureUpdate,
} from '../../utils/architectureAgent'

const configStore = useConfigStore()
const { isSetup } = storeToRefs(configStore)
const workspaceStore = useWorkspaceStore()
const sessionStore = useSessionStore()

const prompt = ref('')
const isLoading = ref(false)
const queuedMessages = ref<string[]>([])
const chatHistoryRef = ref<HTMLElement | null>(null)

const scrollToBottom = async () => {
  await nextTick()
  if (chatHistoryRef.value) {
    chatHistoryRef.value.scrollTop = chatHistoryRef.value.scrollHeight
  }
}

const processNextMessage = async () => {
  if (queuedMessages.value.length === 0 || isLoading.value || !isSetup.value) return
  const text = queuedMessages.value.shift()
  if (text) {
    await executeMessage(text)
  }
}

/** Apply architecture-mermaid fences from the finished agent reply. */
const applyArchitectureFromAgentReply = async () => {
  const last = sessionStore.messages.at(-1)
  if (!last || last.role !== 'agent' || !last.content) return

  const { displayContent, mermaidSource, didUpdate } = extractArchitectureUpdate(last.content)
  if (!didUpdate || !mermaidSource) return

  await workspaceStore.setArchitecture(mermaidSource)
  await sessionStore.replaceMessageContent(last.id, displayContent)
}

const executeMessage = async (text: string) => {
  if (workspaceStore.workspaces.length === 0) {
    const proj = await workspaceStore.addWorkspace()
    if (!proj) return // User cancelled directory selection
  }

  if (!sessionStore.activeSession) {
    await sessionStore.createSession()
  }

  await sessionStore.addMessage('user', text)
  scrollToBottom()

  isLoading.value = true
  const agentMsg = await sessionStore.addMessage('agent', '', true)
  if (!agentMsg) return

  const project = workspaceStore.activeWorkspace
  const system = buildArchitectureSystemPrompt({
    projectName: project?.name,
    projectPath: project?.path,
    architecture: project?.architecture ?? undefined,
  })

  ChatService.streamMessage({
    id: agentMsg.id,
    message: text,
    system,
    onChunk: (chunk) => {
      sessionStore.appendToMessage(agentMsg.id, chunk)
      scrollToBottom()
    },
    onEnd: () => {
      sessionStore.finalizeMessage(agentMsg.id)
      applyArchitectureFromAgentReply()
      isLoading.value = false
      processNextMessage()
    },
    onError: (err) => {
      sessionStore.appendErrorToMessage(agentMsg.id, err)
      isLoading.value = false
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
          :disabled="!isSetup || isLoading"
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
          />
          <div v-if="isLoading" class="message agent loading-indicator">
            <div class="typing-dots">
              <span>.</span><span>.</span><span>.</span>
            </div>
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
          :disabled="!isSetup"
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
  scroll-behavior: smooth;
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
  gap: 24px;
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
}

.typing-dots {
  display: flex;
  gap: 4px;
  color: var(--text-muted);
}
</style>
