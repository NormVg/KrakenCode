<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import ChatMessage from './components/ChatMessage.vue'
import './assets/main.css'

// Configuration State
const provider = ref('ollama-local')
const model = ref('gemma4:31b-cloud')
const apiKey = ref('')
const isSetup = ref(false)
const setupError = ref('')
const isSidebarOpen = ref(true)

// Chat State
const prompt = ref('')
const isLoading = ref(false)
const messages = ref<{role: 'user' | 'agent', content: string}[]>([])

// DOM Ref for auto-scroll
const chatHistoryRef = ref<HTMLElement | null>(null)

const scrollToBottom = async () => {
  await nextTick()
  if (chatHistoryRef.value) {
    chatHistoryRef.value.scrollTop = chatHistoryRef.value.scrollHeight
  }
}

const handleSetup = async () => {
  setupError.value = ''
  const result = await window.api.setModel({
    provider: provider.value,
    model: model.value,
    apiKey: apiKey.value
  })
  
  if (result.success) {
    isSetup.value = true
    isSidebarOpen.value = false // Collapse sidebar on success to focus on chat
    if (messages.value.length === 0) {
      messages.value.push({ role: 'agent', content: `Hello! I am your AI agent running on \`${provider.value}\` with \`${model.value}\`. How can I help you code today?` })
    }
  } else {
    setupError.value = result.error || 'Failed to setup model'
  }
}

const handleChat = async () => {
  const text = prompt.value.trim()
  if (!text || isLoading.value) return
  
  messages.value.push({ role: 'user', content: text })
  prompt.value = ''
  scrollToBottom()
  
  isLoading.value = true
  
  try {
    const res = await window.api.chat(text)
    messages.value.push({ role: 'agent', content: res })
  } catch (err: any) {
    messages.value.push({ role: 'agent', content: `**Error:** ${err.message || String(err)}` })
  } finally {
    isLoading.value = false
    scrollToBottom()
  }
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleChat()
  }
}

onMounted(() => {
  // Check if we can auto-setup (optional, depending on default config)
})
</script>

<template>
  <div class="layout">
    <!-- Sidebar -->
    <aside :class="['sidebar', { 'open': isSidebarOpen }]">
      <div class="sidebar-header">
        <div class="logo-container">
          <svg class="logo-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2v20"></path>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
          <span class="logo-text">Kraken AI</span>
        </div>
        <button class="icon-btn close-sidebar-btn" @click="isSidebarOpen = false" v-if="isSetup">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
      </div>

      <div class="sidebar-content">
        <h3 class="section-title">Configuration</h3>
        
        <div class="form-group">
          <label>Provider</label>
          <div class="input-wrapper">
            <select v-model="provider">
              <option value="ollama-local">Ollama (Local)</option>
              <option value="ollama-cloud">Ollama (Cloud)</option>
            </select>
          </div>
        </div>
        
        <div class="form-group">
          <label>Model</label>
          <div class="input-wrapper">
            <select v-model="model">
              <option value="gemma4:31b-cloud">gemma4:31b-cloud</option>
              <option value="llama3">llama3</option>
              <option value="mistral">mistral</option>
              <option value="phi3">phi3</option>
              <option value="gemma">gemma</option>
            </select>
          </div>
        </div>
        
        <div class="form-group" v-if="provider === 'ollama-cloud'">
          <label>API Key</label>
          <div class="input-wrapper">
            <input v-model="apiKey" type="password" placeholder="Enter Ollama Cloud API Key" />
          </div>
        </div>
        
        <button class="primary-btn" @click="handleSetup">
          {{ isSetup ? 'Update Configuration' : 'Initialize Agent' }}
        </button>
        <div v-if="setupError" class="error-msg">{{ setupError }}</div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Topbar -->
      <header class="topbar">
        <button class="icon-btn" @click="isSidebarOpen = !isSidebarOpen">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
        <div class="connection-status">
          <span :class="['status-dot', isSetup ? 'connected' : 'disconnected']"></span>
          {{ isSetup ? `${provider} / ${model}` : 'Not Connected' }}
        </div>
      </header>

      <!-- Chat History -->
      <div class="chat-history" ref="chatHistoryRef">
        <div v-if="!isSetup" class="welcome-screen">
          <div class="glow-orb"></div>
          <h2>Welcome to Kraken</h2>
          <p>Initialize the agent in the sidebar to start coding.</p>
        </div>
        <template v-else>
          <ChatMessage 
            v-for="(msg, index) in messages" 
            :key="index" 
            :role="msg.role" 
            :content="msg.content" 
          />
          <div v-if="isLoading" class="message agent loading-indicator">
            <div class="message-avatar">
              <div class="avatar agent-avatar pulse">...</div>
            </div>
            <div class="message-content">
              <div class="message-sender">Eve</div>
              <div class="typing-dots">
                <span>.</span><span>.</span><span>.</span>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Input Area -->
      <div class="input-container" :class="{ 'disabled': !isSetup }">
        <div class="input-wrapper glass">
          <textarea 
            v-model="prompt" 
            placeholder="Ask Kraken to write code, debug, or explain..."
            rows="1"
            @keydown="handleKeydown"
            :disabled="!isSetup || isLoading"
          ></textarea>
          <button class="send-btn" @click="handleChat" :disabled="!isSetup || !prompt.trim() || isLoading">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </button>
        </div>
        <div class="input-hint">Press <span>Enter</span> to send, <span>Shift + Enter</span> for new line</div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  background-color: var(--bg-dark);
}

/* Sidebar */
.sidebar {
  width: 280px;
  background-color: var(--bg-panel);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 10;
}

.sidebar:not(.open) {
  margin-left: -280px;
}

.sidebar-header {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 1px solid var(--border-color);
}

.logo-container {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-main);
  font-weight: 700;
  font-size: 1.1em;
}

.logo-icon {
  width: 24px;
  height: 24px;
  color: var(--accent);
}

.sidebar-content {
  padding: 20px;
  flex: 1;
  overflow-y: auto;
}

.section-title {
  font-size: 0.8em;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-muted);
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 0.85em;
  margin-bottom: 8px;
  color: var(--text-muted);
}

.input-wrapper input,
.input-wrapper select {
  width: 100%;
  background-color: var(--bg-input);
  border: 1px solid var(--border-color);
  color: var(--text-main);
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 0.9em;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.input-wrapper input:focus,
.input-wrapper select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.primary-btn {
  width: 100%;
  background-color: var(--accent);
  color: white;
  border: none;
  padding: 12px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s, transform 0.1s;
}

.primary-btn:hover {
  background-color: var(--accent-hover);
}

.primary-btn:active {
  transform: scale(0.98);
}

.error-msg {
  color: #ef4444;
  font-size: 0.85em;
  margin-top: 12px;
  background: rgba(239, 68, 68, 0.1);
  padding: 8px;
  border-radius: 4px;
}

/* Main Content */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.topbar {
  height: 60px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  border-bottom: 1px solid var(--border-color);
  gap: 16px;
}

.icon-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s, color 0.2s;
}

.icon-btn:hover {
  background-color: var(--bg-input);
  color: var(--text-main);
}

.connection-status {
  font-size: 0.85em;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #ef4444;
}

.status-dot.connected {
  background-color: #10b981;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
}

/* Chat History */
.chat-history {
  flex: 1;
  overflow-y: auto;
  scroll-behavior: smooth;
}

.welcome-screen {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  text-align: center;
}

.glow-orb {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--accent) 0%, transparent 70%);
  opacity: 0.3;
  animation: pulse 4s infinite ease-in-out;
  margin-bottom: 20px;
}

/* Input Area */
.input-container {
  padding: 20px;
  background: linear-gradient(to top, var(--bg-dark) 50%, transparent);
}

.input-container.disabled {
  opacity: 0.5;
}

.input-wrapper.glass {
  display: flex;
  background: rgba(35, 39, 54, 0.7);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 12px 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.input-wrapper.glass:focus-within {
  border-color: rgba(59, 130, 246, 0.5);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(59, 130, 246, 0.5);
}

.input-wrapper textarea {
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
}

.send-btn {
  background: var(--accent);
  color: white;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.1s, background-color 0.2s;
  align-self: flex-end;
}

.send-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

.send-btn:disabled {
  background: var(--border-color);
  color: var(--text-muted);
  cursor: not-allowed;
}

.input-hint {
  text-align: center;
  font-size: 0.75em;
  color: var(--text-muted);
  margin-top: 12px;
}

.input-hint span {
  background: var(--bg-input);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
}

/* Loading state */
.loading-indicator {
  padding: 24px;
  display: flex;
  gap: 16px;
}

.typing-dots {
  display: flex;
  gap: 4px;
  font-size: 1.5em;
  line-height: 1;
  color: var(--text-muted);
}

.typing-dots span {
  animation: bounce 1.4s infinite ease-in-out both;
}

.typing-dots span:nth-child(1) { animation-delay: -0.32s; }
.typing-dots span:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

.pulse {
  animation: pulse 2s infinite ease-in-out;
}
</style>
