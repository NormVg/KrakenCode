<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useConfigStore } from '../stores/config.store'
import {
  ArrowLeft, Check, Search, Cpu, Cloud, HardDrive, Settings, Palette,
  Zap, Brain, Code, Loader2, AlertCircle, RefreshCw, ServerCrash
} from 'lucide-vue-next'

const emit = defineEmits(['close'])

const configStore = useConfigStore()
const { provider, model, apiKey, setupError, isSetup } = storeToRefs(configStore)
const { initializeAgent } = configStore

const activeTab = ref('models')
const searchQuery = ref('')
const hoveredModelId = ref<string | null>(null)

const tabs = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'models', label: 'Models', icon: Cpu },
  { id: 'customizations', label: 'Customizations', icon: Palette },
]

// ─── Model fetching ──────────────────────────────────────────────────────────

interface FetchedModel {
  name: string
  size: number
  parameterSize: string
  quantization: string
  family: string
}

type FetchState = 'idle' | 'loading' | 'success' | 'error'

const localFetchState = ref<FetchState>('idle')
const localModels = ref<FetchedModel[]>([])
const localError = ref('')

const cloudFetchState = ref<FetchState>('idle')
const cloudModels = ref<FetchedModel[]>([])
const cloudError = ref('')

/** Format bytes into a human-readable string */
function formatSize(bytes: number): string {
  if (bytes === 0) return 'Cloud'
  if (bytes < 1e9) return `${(bytes / 1e6).toFixed(0)} MB`
  return `${(bytes / 1e9).toFixed(1)} GB`
}

/** Guess capability scores from model metadata */
function guessCapabilities(m: FetchedModel): { coding: number; speed: number; reasoning: number } {
  const name = m.name.toLowerCase()
  const params = m.parameterSize.toLowerCase()

  // Coding models
  if (name.includes('coder') || name.includes('code')) {
    return { coding: 5, speed: params.includes('7b') ? 5 : params.includes('14b') ? 3 : 2, reasoning: 3 }
  }

  // Reasoning models
  if (name.includes('r1') || name.includes('reason') || name.includes('deepseek')) {
    return { coding: 3, speed: 2, reasoning: 5 }
  }

  // Fast small models
  if (params.includes('3b') || params.includes('7b') || params.includes('8b')) {
    return { coding: 2, speed: 5, reasoning: 2 }
  }

  // Large general models
  if (params.includes('70b') || params.includes('120b') || params.includes('235b')) {
    return { coding: 3, speed: 1, reasoning: 5 }
  }

  // Medium general models
  if (params.includes('14b') || params.includes('9b') || params.includes('27b') || params.includes('32b')) {
    return { coding: 3, speed: 3, reasoning: 4 }
  }

  // Default
  return { coding: 2, speed: 3, reasoning: 3 }
}

/** Guess tags from model metadata */
function guessTags(m: FetchedModel): string[] {
  const name = m.name.toLowerCase()
  const tags: string[] = []
  if (name.includes('coder') || name.includes('code')) tags.push('coding')
  if (name.includes('r1') || name.includes('reason') || name.includes('deepseek')) tags.push('reasoning')
  const params = m.parameterSize.toLowerCase()
  if (params.includes('3b') || params.includes('7b') || params.includes('8b')) tags.push('fast')
  if (tags.length === 0) tags.push('general')
  return tags
}

/** Guess description from model metadata */
function guessDescription(m: FetchedModel): string {
  const name = m.name.toLowerCase()
  const family = m.family
  const params = m.parameterSize || 'unknown'

  if (name.includes('coder') || name.includes('code')) {
    return `Coding model (${family}, ${params}). Strong at code generation and debugging.`
  }
  if (name.includes('r1') || name.includes('reason')) {
    return `Reasoning model (${family}, ${params}). Chain-of-thought for complex problems.`
  }
  if (name.includes('deepseek')) {
    return `DeepSeek model (${family}, ${params}). Multi-language coding with strong reasoning.`
  }
  if (name.includes('llama')) {
    return `Meta Llama model (${family}, ${params}). General-purpose with good instruction following.`
  }
  if (name.includes('gemma')) {
    return `Google Gemma model (${family}, ${params}). Efficient general-purpose model.`
  }
  if (name.includes('mistral') || name.includes('ministral')) {
    return `Mistral model (${family}, ${params}). Fast and efficient.`
  }
  if (name.includes('qwen')) {
    return `Qwen model (${family}, ${params}). Strong multilingual support.`
  }
  if (name.includes('gpt-oss')) {
    return `Open GPT model (${family}, ${params}). Open-source large model.`
  }
  return `${family} model, ${params}.`
}

async function fetchLocalModels() {
  localFetchState.value = 'loading'
  localError.value = ''
  const result = await window.api.ollama.listModels()
  if (result.success && result.models) {
    localModels.value = result.models
    localFetchState.value = 'success'
  } else {
    localError.value = result.error || 'Failed to fetch models'
    localFetchState.value = 'error'
  }
}

async function fetchCloudModels() {
  cloudFetchState.value = 'loading'
  cloudError.value = ''
  // Cloud models are fetched from the same Ollama API — they show up
  // as models with size 0 (hosted, not local). We filter them out.
  const result = await window.api.ollama.listModels()
  if (result.success && result.models) {
    // Cloud models are those with 0 size (hosted)
    cloudModels.value = result.models.filter((m) => m.size === 0)
    cloudFetchState.value = 'success'
  } else {
    cloudError.value = result.error || 'Failed to fetch models'
    cloudFetchState.value = 'error'
  }
}

const currentFetchState = computed(() =>
  provider.value === 'ollama-cloud' ? cloudFetchState.value : localFetchState.value
)

const currentError = computed(() =>
  provider.value === 'ollama-cloud' ? cloudError.value : localError.value
)

const currentModels = computed(() =>
  provider.value === 'ollama-cloud' ? cloudModels.value : localModels.value
)

interface DisplayModel {
  id: string
  name: string
  size: string
  description: string
  tags: string[]
  coding: number
  speed: number
  reasoning: number
}

const availableModels = computed<DisplayModel[]>(() => {
  const list = currentModels.value.map((m) => {
    const caps = guessCapabilities(m)
    return {
      id: m.name,
      name: m.name,
      size: formatSize(m.size),
      description: guessDescription(m),
      tags: guessTags(m),
      coding: caps.coding,
      speed: caps.speed,
      reasoning: caps.reasoning
    }
  })
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
  // Pick first model from the new provider's list
  const list = p === 'ollama-cloud' ? cloudModels.value : localModels.value
  if (list.length > 0) {
    selectedModelId.value = list[0].name
    model.value = list[0].name
  }
}

const refreshModels = () => {
  if (provider.value === 'ollama-cloud') {
    fetchCloudModels()
  } else {
    fetchLocalModels()
  }
}

/** Render capability dots for a score 0-5 */
const capabilityDots = (score: number): boolean[] => {
  return Array.from({ length: 5 }, (_, i) => i < score)
}

// Fetch models on mount
onMounted(() => {
  fetchLocalModels()
  fetchCloudModels()
})

// Re-fetch when switching to a provider that hasn't loaded yet
watch(provider, (p) => {
  if (p === 'ollama-local' && localFetchState.value === 'idle') fetchLocalModels()
  if (p === 'ollama-cloud' && cloudFetchState.value === 'idle') fetchCloudModels()
})
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
            <h1>Models</h1>
            <p>Choose the model that powers your agent</p>
          </div>

          <!-- Provider Segmented Control -->
          <div class="provider-section">
            <div class="segmented-control">
              <div class="segment-indicator" :class="{ 'is-cloud': provider === 'ollama-cloud' }" />
              <button
                :class="['segment-btn', { active: provider === 'ollama-local' }]"
                @click="setProvider('ollama-local')"
              >
                <HardDrive :size="14" stroke-width="2" />
                <span>Ollama Local</span>
              </button>
              <button
                :class="['segment-btn', { active: provider === 'ollama-cloud' }]"
                @click="setProvider('ollama-cloud')"
              >
                <Cloud :size="14" stroke-width="2" />
                <span>Ollama Cloud</span>
              </button>
            </div>
            <p class="provider-hint">
              {{ provider === 'ollama-local' ? 'Runs on your machine via Ollama' : 'Hosted via Ollama Cloud' }}
            </p>
          </div>

          <!-- API Key (cloud only) -->
          <div class="field-group" v-if="provider === 'ollama-cloud'">
            <label class="field-label">API Key</label>
            <input v-model="apiKey" type="password" placeholder="Enter your Ollama Cloud API key" class="text-input" />
          </div>

          <!-- Search + Refresh -->
          <div class="search-row">
            <div class="search-box">
              <Search :size="14" stroke-width="2" class="search-icon" />
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search models..."
                class="search-input"
              />
            </div>
            <button class="refresh-btn" title="Refresh models" @click="refreshModels">
              <RefreshCw :size="14" stroke-width="2" :class="{ 'spin': currentFetchState === 'loading' }" />
            </button>
          </div>

          <!-- Loading State -->
          <div v-if="currentFetchState === 'loading'" class="state-container">
            <Loader2 :size="20" stroke-width="2" class="state-icon spin" />
            <p class="state-text">Fetching models from Ollama...</p>
          </div>

          <!-- Error State -->
          <div v-else-if="currentFetchState === 'error'" class="state-container error">
            <ServerCrash :size="20" stroke-width="2" class="state-icon error" />
            <p class="state-title">Cannot connect to Ollama</p>
            <p class="state-text">{{ currentError }}</p>
            <button class="retry-btn" @click="refreshModels">
              <RefreshCw :size="13" stroke-width="2" />
              <span>Retry</span>
            </button>
          </div>

          <!-- Model Grid -->
          <div v-else-if="currentFetchState === 'success'" class="model-grid">
            <button
              v-for="m in availableModels"
              :key="m.id"
              :class="[
                'model-card',
                { selected: selectedModelId === m.id, recommended: m.tags.includes('recommended') }
              ]"
              @click="selectModel(m.id)"
              @mouseenter="hoveredModelId = m.id"
              @mouseleave="hoveredModelId = null"
            >
              <!-- Selected indicator (left accent bar) -->
              <div class="card-accent" />

              <div class="card-top">
                <div class="card-name-row">
                  <span class="card-name">{{ m.name }}</span>
                  <div v-if="selectedModelId === m.id" class="card-check">
                    <Check :size="14" stroke-width="2.5" />
                  </div>
                </div>
                <span class="card-size">{{ m.size }}</span>
              </div>

              <p class="card-desc">{{ m.description }}</p>

              <!-- Capability bars -->
              <div class="capabilities">
                <div class="capability">
                  <Code :size="11" stroke-width="2" class="cap-icon" />
                  <div class="cap-dots">
                    <span
                      v-for="(filled, i) in capabilityDots(m.coding)"
                      :key="i"
                      :class="['dot', { filled }]"
                    />
                  </div>
                  <span class="cap-label">Code</span>
                </div>
                <div class="capability">
                  <Zap :size="11" stroke-width="2" class="cap-icon" />
                  <div class="cap-dots">
                    <span
                      v-for="(filled, i) in capabilityDots(m.speed)"
                      :key="i"
                      :class="['dot', { filled }]"
                    />
                  </div>
                  <span class="cap-label">Speed</span>
                </div>
                <div class="capability">
                  <Brain :size="11" stroke-width="2" class="cap-icon" />
                  <div class="cap-dots">
                    <span
                      v-for="(filled, i) in capabilityDots(m.reasoning)"
                      :key="i"
                      :class="['dot', { filled }]"
                    />
                  </div>
                  <span class="cap-label">Reason</span>
                </div>
              </div>

              <!-- Recommended badge -->
              <div v-if="m.tags.includes('recommended')" class="recommended-badge">
                Recommended
              </div>
            </button>
          </div>

          <!-- Empty search results -->
          <div v-if="currentFetchState === 'success' && availableModels.length === 0" class="empty-models">
            <p v-if="searchQuery.trim()">No models found matching "{{ searchQuery }}"</p>
            <p v-else>No models available. Run <code>ollama pull <model></code> to add one.</p>
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
        <div v-if="setupError" class="error-msg">
          <AlertCircle :size="13" stroke-width="2" />
          <span>{{ setupError }}</span>
        </div>
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
  animation: pageIn 0.2s ease-out;
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
  width: 100%;
}

.page-header {
  margin-bottom: 28px;
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

/* Provider Segmented Control */
.provider-section {
  margin-bottom: 28px;
}

.segmented-control {
  position: relative;
  display: flex;
  background-color: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 3px;
  width: fit-content;
}

.segment-indicator {
  position: absolute;
  top: 3px;
  left: 3px;
  width: calc(50% - 3px);
  height: calc(100% - 6px);
  background-color: rgba(255, 255, 255, 0.08);
  border-radius: 7px;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.25s;
}

.segment-indicator.is-cloud {
  transform: translateX(100%);
  background-color: rgba(147, 116, 190, 0.12);
}

.segment-btn {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 20px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 0.85rem;
  cursor: pointer;
  transition: color 0.2s;
  min-width: 120px;
  justify-content: center;
}

.segment-btn.active {
  color: var(--text-main);
  font-weight: 500;
}

.provider-hint {
  margin: 8px 0 0 0;
  font-size: 0.78rem;
  color: var(--text-muted-dark);
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

/* Search + Refresh */
.search-row {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
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

.refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  color: var(--text-muted);
  padding: 0 12px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.refresh-btn:hover {
  background-color: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
  color: var(--text-main);
}

/* Loading/Error States */
.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  gap: 8px;
}

.state-container.error {
  gap: 6px;
}

.state-icon {
  color: var(--text-muted);
  margin-bottom: 4px;
}

.state-icon.spin {
  animation: spin 1.2s linear infinite;
}

.state-icon.error {
  color: var(--accent);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.state-title {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-main);
  margin: 0;
}

.state-text {
  font-size: 0.82rem;
  color: var(--text-muted);
  margin: 0;
  max-width: 320px;
  line-height: 1.4;
}

.retry-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background-color: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--text-main);
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 8px;
}

.retry-btn:hover {
  background-color: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.12);
}

/* Model Grid */
.model-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.model-card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 16px;
  background-color: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  overflow: hidden;
}

.model-card:hover {
  background-color: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
  transform: translateY(-1px);
}

.model-card.selected {
  background-color: rgba(147, 116, 190, 0.05);
  border-color: rgba(147, 116, 190, 0.2);
}

.model-card.recommended:not(.selected):hover {
  border-color: rgba(8, 195, 113, 0.15);
}

/* Accent bar on left side of selected card */
.card-accent {
  position: absolute;
  top: 16px;
  bottom: 16px;
  left: 0;
  width: 2px;
  background: var(--accent-purple);
  border-radius: 0 2px 2px 0;
  opacity: 0;
  transition: opacity 0.2s;
}

.model-card.selected .card-accent {
  opacity: 1;
}

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 8px;
}

.card-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.card-name {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-check {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: var(--accent-purple);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  animation: checkPop 0.2s ease-out;
}

@keyframes checkPop {
  0% { transform: scale(0); }
  60% { transform: scale(1.15); }
  100% { transform: scale(1); }
}

.card-size {
  font-size: 0.7rem;
  color: var(--text-muted-dark);
  background-color: rgba(255, 255, 255, 0.04);
  padding: 2px 7px;
  border-radius: 4px;
  flex-shrink: 0;
  margin-left: 8px;
}

.card-desc {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin: 0 0 12px 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Capabilities */
.capabilities {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: auto;
}

.capability {
  display: flex;
  align-items: center;
  gap: 6px;
}

.cap-icon {
  color: var(--text-muted-dark);
  flex-shrink: 0;
}

.cap-dots {
  display: flex;
  gap: 3px;
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.08);
  transition: background-color 0.3s;
}

.dot.filled {
  background-color: var(--text-muted);
}

.model-card.selected .dot.filled {
  background-color: var(--accent-purple);
}

.cap-label {
  font-size: 0.68rem;
  color: var(--text-muted-dark);
  margin-left: 2px;
}

/* Recommended badge */
.recommended-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
  color: var(--accent-green);
  background-color: rgba(8, 195, 113, 0.08);
  padding: 2px 7px;
  border-radius: 3px;
  opacity: 0.8;
}

.model-card.selected .recommended-badge {
  opacity: 0;
}

.empty-models {
  text-align: center;
  color: var(--text-muted);
  font-size: 0.85rem;
  padding: 32px 0;
}

.empty-models code {
  font-family: var(--font-code);
  background-color: rgba(255, 255, 255, 0.04);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8rem;
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
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--accent);
  font-size: 0.82rem;
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

/* Responsive — single column on narrow */
@media (max-width: 560px) {
  .model-grid {
    grid-template-columns: 1fr;
  }
}
</style>
