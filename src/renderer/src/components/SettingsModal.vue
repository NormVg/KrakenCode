<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useConfigStore } from '../stores/config.store'
import { ArrowLeft, Check, Search, Cpu, Cloud, HardDrive, Settings, Palette } from 'lucide-vue-next'

const emit = defineEmits(['close'])

const configStore = useConfigStore()
const { provider, model, apiKey, setupError, isSetup } = storeToRefs(configStore)
const { initializeAgent } = configStore

const activeTab = ref('models')
const searchQuery = ref('')

const tabs = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'models', label: 'Models', icon: Cpu },
  { id: 'customizations', label: 'Customizations', icon: Palette },
]

interface ModelOption {
  id: string
  name: string
  size: string
  description: string
  tags: string[]
}

const localModels: ModelOption[] = [
  { id: 'qwen2.5-coder:32b', name: 'Qwen 2.5 Coder 32B', size: '19.8 GB', description: 'Best coding model. Strong at code generation, refactoring, and debugging.', tags: ['coding', 'recommended'] },
  { id: 'qwen2.5-coder:14b', name: 'Qwen 2.5 Coder 14B', size: '8.9 GB', description: 'Lighter coding model. Good balance of speed and capability.', tags: ['coding', 'fast'] },
  { id: 'qwen2.5-coder:7b', name: 'Qwen 2.5 Coder 7B', size: '4.4 GB', description: 'Fast coding model for quick edits and simple tasks.', tags: ['coding', 'fast'] },
  { id: 'deepseek-coder-v2:16b', name: 'DeepSeek Coder V2 16B', size: '8.9 GB', description: 'Strong multi-language coding model with good reasoning.', tags: ['coding', 'reasoning'] },
  { id: 'deepseek-coder-v2:6b', name: 'DeepSeek Coder V2 6B', size: '3.6 GB', description: 'Compact coding model for rapid iteration.', tags: ['coding', 'fast'] },
  { id: 'llama3.2:3b', name: 'Llama 3.2 3B', size: '1.9 GB', description: 'General-purpose model. Good for chat and simple tasks.', tags: ['general', 'fast'] },
  { id: 'phi3:14b', name: 'Phi 3 14B', size: '7.9 GB', description: 'Microsoft small language model with strong reasoning.', tags: ['reasoning'] },
  { id: 'gemma2:9b', name: 'Gemma 2 9B', size: '5.4 GB', description: 'Google general-purpose model with good instruction following.', tags: ['general'] },
  { id: 'mistral:7b', name: 'Mistral 7B', size: '4.1 GB', description: 'Fast general-purpose model. Good for quick answers.', tags: ['general', 'fast'] },
]

const cloudModels: ModelOption[] = [
  { id: 'qwen2.5-coder:32b', name: 'Qwen 2.5 Coder 32B', size: 'Cloud', description: 'Best coding model via Ollama Cloud. No local GPU needed.', tags: ['coding', 'recommended'] },
  { id: 'llama3.1:70b', name: 'Llama 3.1 70B', size: 'Cloud', description: 'Large general-purpose model with strong reasoning.', tags: ['general', 'reasoning'] },
  { id: 'deepseek-r1:32b', name: 'DeepSeek R1 32B', size: 'Cloud', description: 'Reasoning-focused model with chain-of-thought.', tags: ['reasoning', 'coding'] },
  { id: 'qwen2.5:32b', name: 'Qwen 2.5 32B', size: 'Cloud', description: 'Large general-purpose model with strong multilingual support.', tags: ['general'] },
]

const availableModels = computed(() => {
  const list = provider.value === 'ollama-cloud' ? cloudModels : localModels
  if (!searchQuery.value.trim()) return list
  const q = searchQuery.value.toLowerCase()
  return list.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q) ||
      m.tags.some((t) => t.includes(q))
  )
})

const selectedModelId = ref(model.value)

const selectModel = (m: string) => {
  selectedModelId.value = m
  model.value = m
}

const handleSave = async () => {
  const success = await initializeAgent()
  if (success) {
    emit('close')
  }
}

const setProvider = (p: 'ollama-local' | 'ollama-cloud') => {
  provider.value = p
  const first = (p === 'ollama-cloud' ? cloudModels : localModels)[0]
  if (first) {
    selectedModelId.value = first.id
    model.value = first.id
  }
}
</script>

<template>
  <div class="settings-page">
    <!-- Sidebar -->
    <aside class="settings-sidebar">
      <button class="back-btn" @click="emit('close')">
        <ArrowLeft :size="16" stroke-width="2" />
        <span>Back</span>
      </button>

      <div class="sidebar-section">
        <div class="section-label">Settings</div>
        <nav class="tab-nav">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            :class="['tab-btn', { active: activeTab === tab.id }]"
            @click="activeTab = tab.id"
          >
            <component :is="tab.icon" :size="15" stroke-width="2" />
            <span>{{ tab.label }}</span>
          </button>
        </nav>
      </div>
    </aside>

    <!-- Content -->
    <main class="settings-content">
      <div class="scroll-area">
        <!-- Models Tab -->
        <template v-if="activeTab === 'models'">
          <div class="page-header">
            <h1>Agent Configuration</h1>
            <p>Configure the LLM provider and model for Kraken.</p>
          </div>

          <!-- Provider -->
          <div class="field-group">
            <label class="field-label">Provider</label>
            <div class="provider-row">
              <button
                :class="['provider-pill', { active: provider === 'ollama-local' }]"
                @click="setProvider('ollama-local')"
              >
                <HardDrive :size="14" stroke-width="2" />
                <span>Ollama (Local)</span>
              </button>
              <button
                :class="['provider-pill', { active: provider === 'ollama-cloud' }]"
                @click="setProvider('ollama-cloud')"
              >
                <Cloud :size="14" stroke-width="2" />
                <span>Ollama (Cloud)</span>
              </button>
            </div>
          </div>

          <!-- API Key (cloud only) -->
          <div class="field-group" v-if="provider === 'ollama-cloud'">
            <label class="field-label">API Key</label>
            <input v-model="apiKey" type="password" placeholder="Enter API Key" class="text-input" />
          </div>

          <!-- Model Search -->
          <div class="field-group">
            <label class="field-label">Model</label>
            <div class="search-box">
              <Search :size="14" stroke-width="2" class="search-icon" />
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search models..."
                class="search-input"
              />
            </div>
          </div>

          <!-- Model List -->
          <div class="model-list">
            <button
              v-for="m in availableModels"
              :key="m.id"
              :class="['model-row', { selected: selectedModelId === m.id }]"
              @click="selectModel(m.id)"
            >
              <div class="model-row-content">
                <div class="model-row-top">
                  <span class="model-row-name">{{ m.name }}</span>
                  <span class="model-row-size">{{ m.size }}</span>
                </div>
                <p class="model-row-desc">{{ m.description }}</p>
                <div class="model-row-tags">
                  <span
                    v-for="tag in m.tags"
                    :key="tag"
                    :class="['tag', `tag-${tag}`]"
                  >{{ tag }}</span>
                </div>
              </div>
              <Check v-if="selectedModelId === m.id" :size="16" stroke-width="2" class="model-check" />
            </button>

            <div v-if="availableModels.length === 0" class="empty-models">
              No models found matching "{{ searchQuery }}"
            </div>
          </div>
        </template>

        <!-- General Tab -->
        <template v-else-if="activeTab === 'general'">
          <div class="page-header">
            <h1>General</h1>
            <p>Basic application settings.</p>
          </div>
          <div class="empty-tab">No general settings yet.</div>
        </template>

        <!-- Customizations Tab -->
        <template v-else-if="activeTab === 'customizations'">
          <div class="page-header">
            <h1>Customizations</h1>
            <p>Customize the appearance and behavior.</p>
          </div>
          <div class="empty-tab">No customization options yet.</div>
        </template>
      </div>

      <!-- Footer -->
      <div class="settings-footer">
        <div v-if="setupError" class="error-msg">{{ setupError }}</div>
        <button class="save-btn" @click="handleSave">
          {{ isSetup ? 'Save Configuration' : 'Initialize Agent' }}
        </button>
      </div>
    </main>
  </div>
</template>

<style scoped>
.settings-page {
  position: absolute;
  inset: 0;
  background-color: var(--bg-dark);
  z-index: 100;
  display: flex;
  animation: pageIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes pageIn {
  0% { opacity: 0; }
  100% { opacity: 1; }
}

/* Sidebar */
.settings-sidebar {
  width: 220px;
  background-color: var(--bg-panel);
  padding: 20px 12px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  flex-shrink: 0;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  width: 100%;
}

.back-btn:hover {
  background-color: rgba(255, 255, 255, 0.05);
  color: var(--text-main);
}

.sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  color: var(--text-muted-dark);
  font-weight: 600;
  letter-spacing: 0.06em;
  padding: 0 12px;
  margin-bottom: 4px;
}

.tab-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  color: var(--text-muted);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  background-color: rgba(255, 255, 255, 0.04);
  color: var(--text-main);
}

.tab-btn.active {
  background-color: rgba(255, 255, 255, 0.08);
  color: var(--text-main);
  font-weight: 500;
}

/* Content */
.settings-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  min-width: 0;
}

.scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 48px 48px 24px;
  max-width: 640px;
  width: 100%;
}

.page-header {
  margin-bottom: 32px;
}

.page-header h1 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: var(--text-main);
}

.page-header p {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}

/* Fields */
.field-group {
  margin-bottom: 24px;
}

.field-label {
  display: block;
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-bottom: 8px;
  font-weight: 500;
}

.text-input {
  width: 100%;
  background-color: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: var(--text-main);
  padding: 10px 12px;
  border-radius: 8px;
  outline: none;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.text-input:focus {
  border-color: rgba(255, 255, 255, 0.15);
  background-color: rgba(255, 255, 255, 0.04);
}

.text-input::placeholder {
  color: var(--text-muted-dark);
}

/* Provider pills */
.provider-row {
  display: flex;
  gap: 8px;
}

.provider-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background-color: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  color: var(--text-muted);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.provider-pill:hover {
  background-color: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
  color: var(--text-main);
}

.provider-pill.active {
  background-color: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
  color: var(--text-main);
}

/* Search */
.search-box {
  display: flex;
  align-items: center;
  gap: 10px;
  background-color: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 0 12px;
  transition: all 0.2s;
}

.search-box:focus-within {
  border-color: rgba(255, 255, 255, 0.12);
}

.search-icon {
  color: var(--text-muted-dark);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-main);
  padding: 10px 0;
  font-size: 0.9rem;
}

.search-input::placeholder {
  color: var(--text-muted-dark);
}

/* Model list */
.model-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.model-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px 14px;
  background-color: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
  width: 100%;
}

.model-row:hover {
  background-color: rgba(255, 255, 255, 0.03);
}

.model-row.selected {
  background-color: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.06);
}

.model-row-content {
  flex: 1;
  min-width: 0;
}

.model-row-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.model-row-name {
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--text-main);
}

.model-row-size {
  font-size: 0.72rem;
  color: var(--text-muted-dark);
}

.model-row-desc {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin: 0 0 6px 0;
  line-height: 1.4;
}

.model-row-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tag {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 2px 6px;
  border-radius: 3px;
  font-weight: 500;
  background-color: rgba(255, 255, 255, 0.04);
  color: var(--text-muted-dark);
}

.tag-recommended { background-color: rgba(8, 195, 113, 0.08); color: var(--accent-green); }
.tag-coding { background-color: rgba(147, 116, 190, 0.08); color: var(--accent-purple); }
.tag-fast { background-color: rgba(255, 184, 77, 0.08); color: #FFB84D; }
.tag-reasoning { background-color: rgba(94, 234, 212, 0.08); color: #5EEAD4; }
.tag-general { background-color: rgba(255, 255, 255, 0.04); color: var(--text-muted); }

.model-check {
  color: var(--accent-purple);
  flex-shrink: 0;
  margin-left: 12px;
  margin-top: 2px;
}

.empty-models {
  text-align: center;
  color: var(--text-muted);
  font-size: 0.85rem;
  padding: 32px 0;
}

.empty-tab {
  color: var(--text-muted);
  font-size: 0.9rem;
  padding: 20px 0;
}

/* Footer */
.settings-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  padding: 16px 48px;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

.error-msg {
  color: var(--accent);
  font-size: 0.85rem;
}

.save-btn {
  background-color: var(--text-main);
  color: var(--bg-dark);
  border: none;
  padding: 8px 20px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.save-btn:hover {
  background-color: #fff;
}
</style>
