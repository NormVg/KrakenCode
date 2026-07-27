<script setup lang="ts">
import { ref, nextTick, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useConfigStore } from './stores/config'
import { useProjectsStore } from './stores/projects'
import ChatMessage from './components/ChatMessage.vue'
import SettingsModal from './components/SettingsModal.vue'
import ProjectsSidebar from './components/ProjectsSidebar.vue'
import RightSidebar from './components/RightSidebar.vue'
import ModelSelector from './components/ModelSelector.vue'
import ChatInput from './components/ChatInput.vue'
import QueuedMessages from './components/QueuedMessages.vue'
import { PanelLeft, PanelRight } from 'lucide-vue-next'
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
const queuedMessages = ref<string[]>([])

// Projects State
const projectsStore = useProjectsStore()

// Auto-initialize if possible
onMounted(async () => {
  await projectsStore.loadData()
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

const processNextMessage = async () => {
  if (queuedMessages.value.length === 0 || isLoading.value || !isSetup.value) return
  const text = queuedMessages.value.shift()
  if (text) {
    await executeMessage(text)
  }
}

const executeMessage = async (text: string) => {
  // If no project exists, create a default one
  if (projectsStore.projects.length === 0) {
    const proj = {
      id: crypto.randomUUID(),
      name: 'Default Project',
      path: '',
      items: []
    }
    projectsStore.projects.push(proj)
    projectsStore.activeProjectId = proj.id
    projectsStore.saveData()
  }
  
  // If no chat is active, create one
  if (!projectsStore.activeChat) {
    projectsStore.createChat(projectsStore.activeProjectId!)
  }
  
  projectsStore.addMessageToActiveChat({ role: 'user', content: text })
  scrollToBottom()
  
  isLoading.value = true
  const msgId = Date.now().toString()
  projectsStore.addMessageToActiveChat({ id: msgId, role: 'agent', content: '', isStreaming: true })
  
  window.api.onChatChunk(msgId, (chunk) => {
    projectsStore.updateActiveChatStreamingMessage(chunk)
    scrollToBottom()
  })

  window.api.onChatEnd(msgId, () => {
    projectsStore.endActiveChatStreamingMessage()
    isLoading.value = false
    window.api.removeChatListeners(msgId)
    processNextMessage()
  })

  window.api.onChatError(msgId, (err) => {
    projectsStore.appendErrorToActiveChat(err)
    isLoading.value = false
    window.api.removeChatListeners(msgId)
    processNextMessage()
  })

  window.api.streamChat(msgId, text)
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
      <Transition name="slide-left">
        <aside class="left-sidebar no-drag" v-if="isLeftSidebarOpen">
          <ProjectsSidebar @open-settings="isSettingsOpen = true" />
        </aside>
      </Transition>

      <!-- Main Content (Island) -->
      <main class="main-content no-drag">
      
      <!-- Settings Modal via component -->
      <SettingsModal 
        v-if="isSettingsOpen" 
        @close="isSettingsOpen = false" 
      />

      <!-- Empty Conversation State -->
      <div v-if="isSetup && (!projectsStore.activeChat || projectsStore.activeChat.messages.length === 0)" class="empty-conversation-state">
        <img src="./assets/banner.png" alt="Kraken Logo" class="empty-banner" />
        <div class="centered-composer">
          <ChatInput 
            v-model="prompt"
            @submit="handleChat"
            :disabled="!isSetup || isLoading"
            placeholder="Plan, Build, / for skills, @ for context"
          />
          <div class="floating-bottom-bar">
            <div class="header-left-group">
              <button class="icon-btn" @click="isLeftSidebarOpen = !isLeftSidebarOpen" title="Toggle Sidebar">
                <PanelLeft :size="16" />
              </button>
              <div class="chat-breadcrumbs">
                <span class="muted">{{ projectsStore.activeProject?.name || 'No Project' }}</span>
                <span class="divider">/</span>
                <span>{{ projectsStore.activeChat?.title || 'New Chat' }}</span>
              </div>
            </div>
            <button class="icon-btn" @click="isRightSidebarOpen = !isRightSidebarOpen" title="Toggle Tools">
              <PanelRight :size="16" />
            </button>
          </div>
        </div>
      </div>

      <div class="chat-history" ref="chatHistoryRef" v-if="isSetup && projectsStore.activeChat && projectsStore.activeChat.messages.length > 0">
        <div class="chat-container">
          <div v-if="!isSetup" class="welcome-screen">
            <img src="./assets/banner.png" alt="Kraken Logo" class="welcome-banner" />
            <p>Please configure the agent to start.</p>
          </div>
          <template v-else-if="projectsStore.activeChat && projectsStore.activeChat.messages.length > 0">
            <!-- Spacer to push content down below traffic lights -->
            <div class="top-spacer" style="height: 60px;"></div>
            <ChatMessage 
              v-for="(msg, index) in projectsStore.activeChat.messages" 
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
      <div class="floating-input-container" v-if="isSetup && projectsStore.activeChat && projectsStore.activeChat.messages.length > 0">
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
          <div class="floating-bottom-bar">
            <div class="header-left-group">
              <button class="icon-btn" @click="isLeftSidebarOpen = !isLeftSidebarOpen" title="Toggle Sidebar">
                <PanelLeft :size="16" />
              </button>
              <div class="chat-breadcrumbs">
                <span class="muted">{{ projectsStore.activeProject?.name || 'No Project' }}</span>
                <span class="divider">/</span>
                <span>{{ projectsStore.activeChat?.title || 'New Chat' }}</span>
              </div>
            </div>
            <button class="icon-btn" @click="isRightSidebarOpen = !isRightSidebarOpen" title="Toggle Tools">
              <PanelRight :size="16" />
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- Right Sidebar -->
    <Transition name="slide-right">
      <aside class="right-sidebar" v-if="isRightSidebarOpen">
        <RightSidebar />
      </aside>
    </Transition>
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

.floating-bottom-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background-color: var(--bg-dark); /* #0A0D18 */
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 8px 12px;
}

.chat-breadcrumbs {
  font-size: 0.85em;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-left-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.icon-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.icon-btn:hover {
  background-color: rgba(255, 255, 255, 0.05);
  color: var(--text-main);
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
  padding: 24px;
  position: relative; /* For absolute composer */
}

.empty-banner {
  width: 240px;
  max-width: 100%;
  opacity: 0.8;
  /* Centered perfectly in the container */
}

.centered-composer {
  position: absolute;
  bottom: 24px;
  width: 100%;
  max-width: 800px;
  padding: 0 16px; /* Match chat-container padding */
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Floating Input Area */
.floating-input-container {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 800px;
  padding: 0 16px; /* Match chat-container padding */
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
  animation: typing 1.4s infinite;
}
.typing-dots span:nth-child(2) { animation-delay: 0.2s; }
.typing-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
  0%, 100% { opacity: 0.2; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-2px); }
}

/* Sidebar Animations */
.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
  white-space: nowrap; /* prevent wrapping during shrink */
}
.slide-left-enter-from,
.slide-left-leave-to {
  width: 0 !important;
  opacity: 0;
  transform: translateX(-40px);
  padding-left: 0 !important;
  padding-right: 0 !important;
  margin-left: 0 !important;
  margin-right: -8px !important; /* cancel flex gap */
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
  white-space: nowrap;
}
.slide-right-enter-from,
.slide-right-leave-to {
  width: 0 !important;
  opacity: 0;
  transform: translateX(40px);
  padding-left: 0 !important;
  padding-right: 0 !important;
  margin-left: -8px !important; /* cancel flex gap */
  margin-right: 0 !important;
}
</style>
