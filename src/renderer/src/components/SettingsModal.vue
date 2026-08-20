<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useConfigStore } from '../stores/config.store'
import { ArrowLeft, Check, Search, Cpu, Cloud, HardDrive } from 'lucide-vue-next'

const emit = defineEmits(['close'])

const configStore = useConfigStore()
const { provider, model, apiKey, setupError, isSetup } = storeToRefs(configStore)
const { initializeAgent } = configStore

const searchQuery = ref('')

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
  { id: 'qwen2.5-coder:32b', name: 'Qwen 2.5 Coder 32B (Cloud)', size: 'Hosted', description: 'Best coding model via Ollama Cloud. No local GPU needed.', tags: ['coding', 'recommended'] },
  { id: 'llama3.1:70b', name: 'Llama 3.1 70B (Cloud)', size: 'Hosted', description: 'Large general-purpose model with strong reasoning.', tags: ['general', 'reasoning'] },
  { id: 'deepseek-r1:32b', name: 'DeepSeek R1 32B (Cloud)', size: 'Hosted', description: 'Reasoning-focused model with chain-of-thought.', tags: ['reasoning', 'coding'] },
  { id: 'qwen2.5:32b', name: 'Qwen 2.5 32B (Cloud)', size: 'Hosted', description: 'Large general-purpose model with strong multilingual support.', tags: ['general'] },
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
  // Reset model selection when switching provider
  const first = (p === 'ollama-cloud' ? cloudModels : localModels)[0]
  if (first) {
    selectedModelId.value = first.id
    model.value = first.id
  }
}
</script>

<template>
  <div class="settings-page">
    <!-- Header -->
    <header class="settings-header no-drag">
      <button class="back-btn" @click="emit('close')">
        <ArrowLeft :size="18" />
      </button>
      <div class="header-text">
        <h1>Models</h1>
        <p>Choose the model that powers your agent</p>
      </div>
    </header>

    <div class="settings-body">
      <!-- Provider Toggle -->
      <div class="provider-section">
        <div class="provider-cards">
          <button
            :class="['provider-card', { active: provider === 'ollama-local' }]"
            @click="setProvider('ollama-local')"
          >
            <HardDrive :size="20" class="provider-icon" />
            <div class="provider-info">
              <span class="provider-name">Local</span>
              <span class="provider-desc">Runs on your machine via Ollama</span>
            </div>
          </button>

          <button
            :class="['provider-card', { active: provider === 'ollama-cloud' }]"
            @click="setProvider('ollama-cloud')"
          >
            <Cloud :size="20" class="provider-icon" />
            <div class="provider-info">
              <span class="provider-name">Cloud</span>
              <span class="provider-desc">Hosted via Ollama Cloud</span>
            </div>
          </button>
        </div>

        <!-- API Key for cloud -->
        <div v-if="provider === 'ollama-cloud'" class="api-key-section">
          <label>API Key</label>
          <input v-model="apiKey" type="password" placeholder="Enter your Ollama Cloud API key" />
        </div>
      </div>

      <!-- Search -->
      <div class="search-section">
        <Search :size="16" class="search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search models..."
          class="search-input"
        />
      </div>

      <!-- Model List -->
      <div class="model-list">
        <button
          v-for="m in availableModels"
          :key="m.id"
          :class="['model-item', { selected: selectedModelId === m.id }]"
          @click="selectModel(m.id)"
        >
          <div class="model-item-main">
            <div class="model-item-header">
              <Cpu :size="16" class="model-icon" />
              <span class="model-name">{{ m.name }}</span>
              <span class="model-size">{{ m.size }}</span>
            </div>
            <p class="model-desc">{{ m.description }}</p>
            <div class="model-tags">
              <span
                v-for="tag in m.tags"
                :key="tag"
                :class="['tag', `tag-${tag}`]"
              >{{ tag }}</span>
            </div>
          </div>
          <div v-if="selectedModelId === m.id" class="model-check">
            <Check :size="18" />
          </div>
        </button>

        <div v-if="availableModels.length === 0" class="empty-models">
          No models found matching "{{ searchQuery }}"
        </div>
      </div>

      <!-- Footer -->
      <div class="settings-footer">
        <div v-if="setupError" class="error-msg">{{ setupError }}</div>
        <button class="save-btn" @click="handleSave">
          {{ isSetup ? 'Save' : 'Initialize Agent' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  position: absolute;
  inset: 0;
  background-color: var(--bg-dark);
  z-index: 100;
  display: flex;
  flex-direction: column;
  animation: pageIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes pageIn {
  0% { opacity: 0; transform: translateY(8px); }
  100% { opacity: 1; transform: translateY(0); }
}

/* Header */
.settings-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 32px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.back-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.back-btn:hover {
  background-color: rgba(255, 255, 255, 0.05);
  color: var(--text-main);
}

.header-text h1 {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-main);
}

.header-text p {
  font-size: 0.85rem;
  margin: 2px 0 0 0;
  color: var(--text-muted);
}

/* Body */
.settings-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 720px;
  width: 100%;
  margin: 0 auto;
}

/* Provider Cards */
.provider-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.provider-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.provider-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background-color: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.provider-card:hover {
  background-color: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
}

.provider-card.active {
  background-color: rgba(147, 116, 190, 0.08);
  border-color: rgba(147, 116, 190, 0.3);
}

.provider-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.provider-card.active .provider-icon {
  color: var(--accent-purple);
}

.provider-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.provider-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-main);
}

.provider-desc {
  font-size: 0.8rem;
  color: var(--text-muted);
}

/* API Key */
.api-key-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.api-key-section label {
  font-size: 0.85rem;
  color: var(--text-muted);
  font-weight: 500;
}

.api-key-section input {
  width: 100%;
  background-color: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: var(--text-main);
  padding: 10px 14px;
  border-radius: 8px;
  outline: none;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.api-key-section input:focus {
  border-color: rgba(147, 116, 190, 0.3);
  background-color: rgba(255, 255, 255, 0.04);
}

/* Search */
.search-section {
  display: flex;
  align-items: center;
  gap: 10px;
  background-color: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 0 14px;
  transition: all 0.2s;
}

.search-section:focus-within {
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
  padding: 12px 0;
  font-size: 0.9rem;
}

.search-input::placeholder {
  color: var(--text-muted-dark);
}

/* Model List */
.model-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.model-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px;
  background-color: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.model-item:hover {
  background-color: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
}

.model-item.selected {
  background-color: rgba(147, 116, 190, 0.06);
  border-color: rgba(147, 116, 190, 0.25);
}

.model-item-main {
  flex: 1;
  min-width: 0;
}

.model-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.model-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.model-item.selected .model-icon {
  color: var(--accent-purple);
}

.model-name {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-main);
}

.model-size {
  font-size: 0.75rem;
  color: var(--text-muted-dark);
  background-color: rgba(255, 255, 255, 0.04);
  padding: 2px 8px;
  border-radius: 4px;
}

.model-desc {
  font-size: 0.82rem;
  color: var(--text-muted);
  margin: 0 0 8px 0;
  line-height: 1.4;
}

.model-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tag {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
  background-color: rgba(255, 255, 255, 0.04);
  color: var(--text-muted-dark);
}

.tag-recommended {
  background-color: rgba(8, 195, 113, 0.1);
  color: var(--accent-green);
}

.tag-coding {
  background-color: rgba(147, 116, 190, 0.1);
  color: var(--accent-purple);
}

.tag-fast {
  background-color: rgba(255, 184, 77, 0.1);
  color: #FFB84D;
}

.tag-reasoning {
  background-color: rgba(94, 234, 212, 0.1);
  color: #5EEAD4;
}

.tag-general {
  background-color: rgba(255, 255, 255, 0.04);
  color: var(--text-muted);
}

.model-check {
  color: var(--accent-purple);
  flex-shrink: 0;
  margin-left: 12px;
  margin-top: 2px;
}

.empty-models {
  text-align: center;
  color: var(--text-muted);
  font-size: 0.9rem;
  padding: 40px 0;
}

/* Footer */
.settings-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  padding-top: 20px;
  border-top: 1px solid var(--border-color);
  margin-top: 8px;
}

.error-msg {
  color: var(--accent);
  font-size: 0.85rem;
}

.save-btn {
  background-color: var(--text-main);
  color: var(--bg-dark);
  border: none;
  padding: 10px 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.save-btn:hover {
  background-color: #fff;
  transform: translateY(-1px);
}

.save-btn:active {
  transform: translateY(0);
}
</style>
