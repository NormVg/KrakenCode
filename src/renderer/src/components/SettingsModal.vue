<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useConfigStore } from '../stores/config'

const emit = defineEmits(['close'])
const activeTab = ref('models')

const configStore = useConfigStore()
const { provider, model, apiKey, setupError, isSetup } = storeToRefs(configStore)
const { initializeAgent } = configStore

const tabs = [
  { id: 'general', label: 'General' },
  { id: 'models', label: 'Models' },
  { id: 'customizations', label: 'Customizations' }
]

const handleSave = async () => {
  const success = await initializeAgent()
  if (success) {
    emit('close')
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="isSetup ? emit('close') : null">
    <div class="settings-modal">
      <!-- Sidebar -->
      <aside class="settings-sidebar">
        <div class="sidebar-section">
          <div class="section-title">Settings</div>
          <button 
            v-for="tab in tabs" 
            :key="tab.id"
            :class="['tab-btn', { active: activeTab === tab.id }]"
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </div>
      </aside>

      <!-- Content -->
      <main class="settings-content">
        <button v-if="isSetup" class="icon-btn close-btn" @click="emit('close')">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>

        <div class="scroll-area">
          <template v-if="activeTab === 'models'">
            <div class="settings-card">
              <div class="card-header">
                <h3>Agent Configuration</h3>
                <p>Configure the LLM provider and model for Kraken.</p>
              </div>
              
              <div class="form-group">
                <label>Provider</label>
                <select v-model="provider">
                  <option value="ollama-local">Ollama (Local)</option>
                  <option value="ollama-cloud">Ollama (Cloud)</option>
                </select>
              </div>
              
              <div class="form-group">
                <label>Model</label>
                <select v-model="model">
                  <option value="gemma4:31b-cloud">gemma4:31b-cloud</option>
                  <option value="llama3">llama3</option>
                  <option value="mistral">mistral</option>
                  <option value="phi3">phi3</option>
                  <option value="gemma">gemma</option>
                </select>
              </div>
              
              <div class="form-group" v-if="provider === 'ollama-cloud'">
                <label>API Key</label>
                <input v-model="apiKey" type="password" placeholder="Enter API Key" />
              </div>
              
              <div class="action-row">
                <div v-if="setupError" class="error-msg">{{ setupError }}</div>
                <button class="primary-btn" @click="handleSave">
                  {{ isSetup ? 'Save Configuration' : 'Initialize Agent' }}
                </button>
              </div>
            </div>
          </template>

          <template v-else-if="activeTab === 'general'">
            <div class="settings-card">
              <div class="card-header">
                <h3>General Settings</h3>
                <p>Configure basic editor settings.</p>
              </div>
              <div class="empty-state">No general settings yet.</div>
            </div>
          </template>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
}

.settings-modal {
  background-color: var(--bg-dark);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  width: 900px;
  height: 600px;
  display: flex;
  overflow: hidden;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.6);
  animation: modalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modalIn {
  0% { opacity: 0; transform: scale(0.95); }
  100% { opacity: 1; transform: scale(1); }
}

/* Sidebar */
.settings-sidebar {
  width: 240px;
  background-color: var(--bg-panel);
  border-right: 1px solid var(--border-color);
  padding: 24px 12px;
}

.section-title {
  font-size: 0.75em;
  text-transform: uppercase;
  color: var(--text-muted);
  font-weight: 600;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
  padding: 0 12px;
}

.tab-btn {
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  color: var(--text-muted);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.9em;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 4px;
}

.tab-btn:hover {
  background-color: rgba(255, 255, 255, 0.05);
  color: var(--text-main);
}

.tab-btn.active {
  background-color: rgba(255, 255, 255, 0.1);
  color: var(--text-main);
  font-weight: 500;
}

/* Content */
.settings-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-dark);
  position: relative;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
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
  transition: all 0.2s;
}

.icon-btn:hover {
  background-color: var(--bg-panel);
  color: var(--text-main);
}

.scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 64px 32px 32px 32px;
}

.settings-card {
  max-width: 600px;
  /* Removed background, border, and padding so it sits flush on the surface */
}

.card-header {
  margin-bottom: 24px;
}

.card-header h3 {
  font-size: 1em;
  font-weight: 600;
  margin: 0 0 4px 0;
}

.card-header p {
  margin: 0;
  font-size: 0.85em;
  color: var(--text-muted);
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 0.85em;
  color: var(--text-muted);
  margin-bottom: 8px;
  font-weight: 500;
}

.form-group select,
.form-group input {
  width: 100%;
  background-color: var(--bg-input);
  border: 1px solid var(--border-color);
  color: var(--text-main);
  padding: 10px 12px;
  border-radius: 6px;
  outline: none;
  font-size: 0.9em;
  transition: border-color 0.2s;
}

.form-group select:focus,
.form-group input:focus {
  border-color: var(--text-muted);
}

.action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--border-color);
}

.primary-btn {
  background-color: var(--text-main);
  color: var(--bg-dark);
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.9em;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-left: auto;
}

.primary-btn:hover {
  background-color: #fff;
}

.error-msg {
  color: #ef4444;
  font-size: 0.85em;
}

.empty-state {
  color: var(--text-muted);
  font-size: 0.9em;
  padding: 20px 0;
}
</style>
