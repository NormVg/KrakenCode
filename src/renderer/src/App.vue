<script setup lang="ts">
import { ref, nextTick, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useConfigStore } from './stores/config'
import ChatMessage from './components/ChatMessage.vue'
import SettingsModal from './components/SettingsModal.vue'
import ProjectsSidebar from './components/ProjectsSidebar.vue'
import RightSidebar from './components/RightSidebar.vue'
import { PanelLeft, PanelRight, Settings2, ChevronRight, Plus, Lock, Mic, Github, ChevronDown } from 'lucide-vue-next'
import './assets/main.css'

// Configuration State via Pinia
const configStore = useConfigStore()
const { isSetup, provider, model } = storeToRefs(configStore)
const isSettingsOpen = ref(false)
const isRightSidebarOpen = ref(true)
const isLeftSidebarOpen = ref(true)

// Ensure Settings opens if we somehow lose setup state
watch(isSetup, (newVal) => {
  if (!newVal) isSettingsOpen.value = true
})

// Chat State
const prompt = ref('')
const isLoading = ref(false)

interface ChatMsg {
  id?: string;
  role: 'user' | 'agent';
  content: string;
  isStreaming?: boolean;
}
const messages = ref<ChatMsg[]>([])

// Auto-initialize if possible
onMounted(async () => {
  if (!isSetup.value) {
    try {
      const success = await configStore.initializeAgent()
      if (!success) {
        isSettingsOpen.value = true
      }
    } catch (e) {
      console.error("Auto-init failed", e)
      isSettingsOpen.value = true
    }
  }
})

// DOM Ref for auto-scroll
const chatHistoryRef = ref<HTMLElement | null>(null)

const scrollToBottom = async () => {
  await nextTick()
  if (chatHistoryRef.value) {
    chatHistoryRef.value.scrollTop = chatHistoryRef.value.scrollHeight
  }
}

const handleChat = async () => {
  const text = prompt.value.trim()
  if (!text || isLoading.value || !isSetup.value) return
  
  messages.value.push({ role: 'user', content: text })
  prompt.value = ''
  scrollToBottom()
  
  isLoading.value = true
  const msgId = Date.now().toString()
  const agentMsg = { id: msgId, role: 'agent', content: '', isStreaming: true } as ChatMsg
  messages.value.push(agentMsg)
  
  window.api.onChatChunk(msgId, (chunk) => {
    agentMsg.content += chunk
    scrollToBottom()
  })

  window.api.onChatEnd(msgId, () => {
    agentMsg.isStreaming = false
    isLoading.value = false
    window.api.removeChatListeners(msgId)
  })

  window.api.onChatError(msgId, (err) => {
    agentMsg.content += `\n**Error:** ${err}`
    agentMsg.isStreaming = false
    isLoading.value = false
    window.api.removeChatListeners(msgId)
  })

  window.api.streamChat(msgId, text)
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleChat()
  }
}

// Window Controls
const minimizeWindow = () => window.api.minimizeWindow()
const maximizeWindow = () => window.api.maximizeWindow()
const closeWindow = () => window.api.closeWindow()
</script>

<template>
  <div class="layout-container">
    <div class="invisible-drag-area"></div>
    <div class="layout">
      
      <!-- Left Sidebar (Projects) -->
      <aside class="left-sidebar no-drag" v-if="isLeftSidebarOpen">
        <ProjectsSidebar />
      </aside>

      <!-- Main Content (Island) -->
      <main class="main-content no-drag">
      
      <!-- Settings Modal via component -->
      <SettingsModal 
        v-if="isSettingsOpen" 
        @close="isSettingsOpen = false" 
      />

      <!-- Empty Conversation State -->
      <div v-if="isSetup && messages.length === 0" class="empty-conversation-state">
        <div class="centered-composer">
          <textarea 
            v-model="prompt" 
            placeholder="Plan, Build, / for skills, @ for context"
            rows="3"
            @keydown="handleKeydown"
            :disabled="!isSetup || isLoading"
          ></textarea>
          <div class="composer-toolbar">
            <div class="toolbar-left">
              <button class="add-btn">
                <Plus :size="14" />
              </button>
              <button class="model-badge" @click="isSettingsOpen = true">
                {{ model || 'Select Model' }} <ChevronDown :size="12" class="model-icon" />
              </button>
            </div>
            <div class="toolbar-right">
              <button class="mic-btn">
                <Mic :size="14" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Chat History -->
      <div class="chat-history" ref="chatHistoryRef" v-else>
        <div class="chat-container">
          <div v-if="!isSetup" class="welcome-screen">
            <img src="./assets/banner.png" alt="Kraken Logo" class="welcome-banner" />
            <p>Please configure the agent to start.</p>
          </div>
          <template v-else-if="messages.length > 0">
            <!-- Spacer to push content down below traffic lights -->
            <div class="top-spacer" style="height: 60px;"></div>
            <ChatMessage 
              v-for="(msg, index) in messages" 
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

      <!-- Agent Input Pill (Floating above focus bar) -->
      <div class="floating-input-container" v-if="isSetup && messages.length > 0">
        <div class="input-pill no-drag">
          <textarea 
            v-model="prompt" 
            placeholder="Can you code me a multi threaded logger"
            rows="1"
            @keydown="handleKeydown"
            :disabled="!isSetup || isLoading"
          ></textarea>
        </div>
      </div>
    </main>

    <!-- Right Sidebar -->
    <aside class="right-sidebar" v-if="isRightSidebarOpen">
      <RightSidebar />
    </aside>
    </div>
  </div>
</template>

<style scoped>
.no-drag {
  -webkit-app-region: no-drag;
}

.layout-container {
  display: flex;
  height: 100vh;
  width: 100vw;
  background-color: var(--bg-dark); /* #0A0D18 */
  position: relative;
}

.invisible-drag-area {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 30px;
  -webkit-app-region: drag;
  z-index: 9999;
}

.layout {
  flex: 1;
  display: flex;
  min-height: 0;
  position: relative;
  overflow: hidden;
  padding: 8px; /* Reduced margin so traffic lights sit fully on the island */
  gap: 8px;
}

/* Left Sidebar */
.left-sidebar {
  width: 260px;
  background-color: var(--bg-dark);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  padding-top: 12px;
}

/* Main Content (The Island) */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  min-width: 0;
  background-color: var(--bg-panel); /* #1C1C2A */
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

/* Chat History */
.chat-history {
  flex: 1;
  overflow-y: auto;
  scroll-behavior: smooth;
  display: flex;
  flex-direction: column;
  padding-bottom: 140px; 
}

.chat-container {
  max-width: 800px;
  width: 100%;
  padding: 0 40px 20px 40px;
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
  gap: 24px;
  margin-top: 10vh;
}

.welcome-banner {
  max-width: 300px;
  width: 100%;
  opacity: 0.2;
  filter: grayscale(100%);
  transition: opacity 0.3s;
}

.welcome-banner:hover {
  opacity: 0.5;
}

/* Empty Conversation State */
.empty-conversation-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  width: 100%;
}

.centered-composer {
  width: 90%;
  max-width: 650px;
  background-color: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.centered-composer textarea {
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-main);
  resize: none;
  outline: none;
  font-size: 0.95em;
  line-height: 1.5;
  padding: 16px;
  min-height: 80px;
}

.centered-composer textarea::placeholder {
  color: var(--text-muted);
}

.composer-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.02);
}

.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.add-btn {
  background: rgba(255, 255, 255, 0.05);
  border: none;
  color: var(--text-muted);
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.add-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-main);
}

.model-badge {
  background: transparent;
  border: none;
  font-size: 0.85em;
  font-weight: 500;
  color: #B4B9EB; /* Soft purple matching the screenshot */
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background-color 0.2s;
}

.model-badge:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.model-icon {
  opacity: 0.7;
}

.mic-btn {
  background: #fff;
  border: none;
  color: #000;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s;
}

.mic-btn:hover {
  transform: scale(1.05);
}

/* Floating Input Area */
.floating-input-container {
  position: absolute;
  bottom: 70px; /* Above focus bar */
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  pointer-events: none;
  z-index: 20;
}

.input-pill {
  pointer-events: auto;
  display: flex;
  align-items: center;
  background-color: rgba(10, 13, 24, 0.6); /* Translucent dark #0A0D18 */
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 30px;
  padding: 12px 24px;
  width: 90%;
  max-width: 650px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3), 0 0 30px rgba(255, 255, 255, 0.02); 
  /* Maya-design: segmented animation for feel */
  transition: box-shadow 0.6s cubic-bezier(0.16, 1, 0.3, 1), 
              border-color 0.4s ease-out,
              transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.input-pill:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 45px rgba(0, 0, 0, 0.35), 0 0 35px rgba(255, 255, 255, 0.04);
}

.input-pill:focus-within {
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-4px) scale(1.01);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45), 0 0 40px rgba(255, 255, 255, 0.08);
}

.input-pill textarea {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-main);
  resize: none;
  outline: none;
  font-size: 0.95em;
  line-height: 1.5;
  max-height: 200px;
  min-height: 24px;
  padding: 0;
}

.input-pill textarea::placeholder {
  color: var(--text-muted);
}

/* Right Sidebar wrapper */
.right-sidebar {
  width: 300px;
  background-color: transparent; /* Blends with layout-container bg-dark */
  display: flex;
  flex-direction: column;
  z-index: 10;
}

/* Loading */
.loading-indicator {
  padding: 0 12px;
}

.typing-dots {
  display: flex;
  gap: 4px;
  color: var(--text-muted);
  font-size: 1.2em;
}
.typing-dots span {
  animation: bounce 1.4s infinite;
}
.typing-dots span:nth-child(2) { animation-delay: 0.2s; }
.typing-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes bounce {
  0%, 100% { opacity: 0.4; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-2px); }
}
</style>
