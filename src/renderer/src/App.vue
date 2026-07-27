<script setup lang="ts">
import { ref, nextTick, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useConfigStore } from './stores/config'
import ChatMessage from './components/ChatMessage.vue'
import SettingsModal from './components/SettingsModal.vue'
import './assets/main.css'

// Configuration State via Pinia
const configStore = useConfigStore()
const { isSetup, provider, model } = storeToRefs(configStore)
const isSettingsOpen = ref(false)
const isSidebarOpen = ref(true)

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

// Default greeting when setup completes for the first time
watch(isSetup, (newVal) => {
  if (newVal && messages.value.length === 0) {
    messages.value.push({ 
      role: 'agent', 
      content: `Hello! I am your AI agent running on \`${provider.value}\` with \`${model.value}\`. How can I help you code today?` 
    })
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
  <div class="layout">
    
    <!-- Invisible drag region at the top -->
    <div class="draggable-header"></div>

    <!-- Main Content -->
    <main class="main-content">
      
      <!-- Settings Modal via component -->
      <SettingsModal 
        v-if="isSettingsOpen" 
        @close="isSettingsOpen = false" 
        class="no-drag"
      />

      <!-- Chat History -->
      <div class="chat-history no-drag" ref="chatHistoryRef">
        <div class="chat-container">
          <div v-if="!isSetup" class="welcome-screen">
            <img src="./assets/banner.png" alt="Kraken Logo" class="welcome-banner" />
            <p>Please configure the agent to start.</p>
          </div>
          <template v-else>
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
      <div class="floating-input-container no-drag">
        <div class="input-pill">
          <textarea 
            v-model="prompt" 
            placeholder="Can you code me a multi threaded logger"
            rows="1"
            @keydown="handleKeydown"
            :disabled="!isSetup || isLoading"
          ></textarea>
        </div>
      </div>

      <!-- Bottom Focus Bar -->
      <div class="focus-bar no-drag">
        <div class="focus-tabs">
          <div class="focus-tab active">
            <span>agent_chat</span>
            <button class="tab-close-btn">×</button>
          </div>
        </div>
        <div class="focus-actions">
          <button class="focus-icon-btn" title="Settings" @click="isSettingsOpen = true">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          </button>
          <button class="focus-icon-btn" title="Toggle Sidebar" @click="isSidebarOpen = !isSidebarOpen">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="15" y1="3" x2="15" y2="21"></line></svg>
          </button>
        </div>
      </div>
    </main>

    <!-- Right Sidebar -->
    <aside class="right-sidebar no-drag" v-if="isSidebarOpen">
      <div class="sidebar-content">
        <div class="sidebar-placeholder">
          <h3>File Explorer</h3>
          <p class="muted">Agent workspace files will appear here.</p>
        </div>
      </div>
      
      <div class="sidebar-tabs">
        <div class="sidebar-tab active">FileExplorer</div>
        <div class="sidebar-tab">Tools</div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.no-drag {
  -webkit-app-region: no-drag;
}

.layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  background-color: var(--bg-dark);
  position: relative;
}

/* Invisible Drag Header */
.draggable-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 48px;
  -webkit-app-region: drag;
  z-index: 100;
}

/* Main Content */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  min-width: 0;
}

/* Chat History */
.chat-history {
  flex: 1;
  overflow-y: auto;
  scroll-behavior: smooth;
  display: flex;
  flex-direction: column;
  /* Add padding to bottom to prevent overlap with floating input and focus bar */
  padding-bottom: 140px; 
}

.chat-container {
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
  padding: 40px 20px 20px 20px;
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

/* Floating Input Area */
.floating-input-container {
  position: absolute;
  bottom: 60px; /* Above focus bar */
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
  background-color: rgba(28, 28, 42, 0.85); /* var(--bg-panel) with opacity */
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  padding: 10px 24px;
  width: 100%;
  max-width: 600px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(147, 116, 190, 0.1); /* Subtle glowing shadow */
  transition: box-shadow 0.3s, border-color 0.3s;
}

.input-pill:focus-within {
  border-color: var(--accent-purple);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 30px rgba(147, 116, 190, 0.2);
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

/* Focus Bar */
.focus-bar {
  position: absolute;
  bottom: 12px;
  left: 12px;
  right: 12px;
  height: 36px;
  background-color: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  z-index: 10;
}

.focus-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 100%;
}

.focus-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  background-color: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  font-size: 0.8em;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.focus-tab:hover {
  background-color: rgba(255, 255, 255, 0.08);
  color: var(--text-main);
}

.focus-tab.active {
  background-color: var(--accent-purple);
  color: #fff;
}

.tab-close-btn {
  background: transparent;
  border: none;
  color: inherit;
  font-size: 1.1em;
  line-height: 1;
  padding: 0;
  cursor: pointer;
  opacity: 0.7;
}
.tab-close-btn:hover {
  opacity: 1;
}

.focus-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.focus-icon-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.focus-icon-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: var(--text-main);
}

/* Right Sidebar */
.right-sidebar {
  width: 280px;
  background-color: var(--bg-panel);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  z-index: 10;
}

.sidebar-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.sidebar-placeholder {
  text-align: center;
  margin-top: 50px;
}
.sidebar-placeholder h3 {
  font-size: 1em;
  margin-bottom: 8px;
  color: var(--text-main);
}
.sidebar-placeholder .muted {
  font-size: 0.85em;
  color: var(--text-muted);
}

.sidebar-tabs {
  display: flex;
  border-top: 1px solid var(--border-color);
  padding: 8px;
  gap: 4px;
}

.sidebar-tab {
  flex: 1;
  text-align: center;
  padding: 8px 0;
  font-size: 0.8em;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}

.sidebar-tab:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.sidebar-tab.active {
  background-color: var(--text-main);
  color: var(--bg-dark);
  font-weight: 600;
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
