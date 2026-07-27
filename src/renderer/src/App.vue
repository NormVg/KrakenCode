<script setup lang="ts">
import { ref, nextTick, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useConfigStore } from './stores/config'
import ChatMessage from './components/ChatMessage.vue'
import SettingsModal from './components/SettingsModal.vue'
import ProjectsSidebar from './components/ProjectsSidebar.vue'
import RightSidebar from './components/RightSidebar.vue'
import ModelSelector from './components/ModelSelector.vue'
import ChatInput from './components/ChatInput.vue'
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
        <img src="./assets/banner.png" alt="Kraken Logo" class="empty-banner" />
        <div class="centered-composer">
          <ChatInput 
            v-model="prompt"
            @submit="handleChat"
            :disabled="!isSetup || isLoading"
            placeholder="Plan, Build, / for skills, @ for context"
          />
        </div>
      </div>

      <!-- Chat History -->
      <div class="chat-header no-drag" v-if="isSetup && messages.length > 0">
        <div class="chat-breadcrumbs">
          <span class="muted">kraken</span>
          <span class="divider">/</span>
          <span>Codebase And Skills Analysis</span>
        </div>
      </div>

      <div class="chat-history" ref="chatHistoryRef" v-if="isSetup && messages.length > 0">
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

      <!-- Agent Input (Floating at bottom) -->
      <div class="floating-input-container" v-if="isSetup && messages.length > 0">
        <div class="floating-composer-wrapper no-drag">
          <ChatInput 
            v-model="prompt"
            @submit="handleChat"
            :disabled="!isSetup || isLoading"
            :rows="1"
            placeholder="Ask a follow-up question..."
          />
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
  background-color: var(--bg-panel);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.chat-breadcrumbs {
  font-size: 0.85em;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 8px;
}

.chat-breadcrumbs .muted {
  color: var(--text-muted);
}

.chat-breadcrumbs .divider {
  color: var(--text-muted);
  opacity: 0.5;
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
  padding: 24px;
}

.empty-banner {
  width: 240px;
  max-width: 100%;
  opacity: 0.8;
  margin: auto 0; /* Pushes composer to bottom and centers banner */
}

.centered-composer {
  width: 100%;
  max-width: 800px;
  padding: 0 40px; /* Match chat-container padding */
}

/* Floating Input Area */
.floating-input-container {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 800px;
  padding: 0 40px; /* Match chat-container padding */
  display: flex;
  justify-content: center;
  z-index: 10;
}

.floating-composer-wrapper {
  width: 100%;
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
