<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useConfigStore } from '../stores/config.store'
import { ChevronDown, Check, Loader2 } from 'lucide-vue-next'

const configStore = useConfigStore()
const { model, provider } = storeToRefs(configStore)

const isOpen = ref(false)
const isLoading = ref(false)
const fetchError = ref('')
const models = ref<string[]>([])

async function fetchModels() {
  isLoading.value = true
  fetchError.value = ''
  const result = await window.api.ollama.listModels()
  if (result.success && result.models) {
    models.value = result.models.map((m) => m.name)
  } else {
    fetchError.value = result.error || 'Failed to fetch'
    models.value = []
  }
  isLoading.value = false
}

const availableModels = computed(() => models.value)

const toggleDropdown = () => {
  if (!isOpen.value && models.value.length === 0 && !isLoading.value) {
    fetchModels()
  }
  isOpen.value = !isOpen.value
}

const selectModel = (m: string) => {
  model.value = m
  isOpen.value = false
}

const closeDropdown = (e: Event) => {
  if (!isOpen.value) return
  const target = e.target as HTMLElement
  if (!target.closest('.model-selector-container')) {
    isOpen.value = false
  }
}

// Re-fetch when provider changes
watch(provider, () => {
  models.value = []
  if (isOpen.value) fetchModels()
})

onMounted(() => {
  document.addEventListener('click', closeDropdown)
  fetchModels()
})
onUnmounted(() => {
  document.removeEventListener('click', closeDropdown)
})
</script>

<template>
  <div class="model-selector-container">
    <button class="model-badge" @click="toggleDropdown">
      {{ model || 'Select Model' }}
      <Loader2 v-if="isLoading" :size="12" class="model-icon spin" />
      <ChevronDown v-else :size="12" class="model-icon" />
    </button>
    
    <div v-if="isOpen" class="model-dropdown">
      <div v-if="isLoading" class="dropdown-loading">
        <Loader2 :size="14" class="spin" />
        <span>Loading models...</span>
      </div>
      <div v-else-if="fetchError" class="dropdown-error">
        <span>{{ fetchError }}</span>
        <button class="retry-link" @click="fetchModels">Retry</button>
      </div>
      <div v-else-if="availableModels.length === 0" class="dropdown-empty">
        No models found
      </div>
      <template v-else>
        <div 
          v-for="m in availableModels" 
          :key="m"
          :class="['model-option', { active: model === m }]"
          @click="selectModel(m)"
        >
          <span>{{ m }}</span>
          <Check v-if="model === m" :size="14" class="check-icon" />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.model-selector-container {
  position: relative;
}

.model-badge {
  background: transparent;
  border: none;
  font-size: 0.85em;
  font-weight: 500;
  color: #B4B9EB;
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

.model-icon.spin {
  animation: spin 1.2s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.model-dropdown {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  background-color: var(--bg-panel);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 4px;
  min-width: 220px;
  max-height: 320px;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  z-index: 100;
  display: flex;
  flex-direction: column;
  animation: dropdownIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes dropdownIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.model-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  font-size: 0.85em;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 6px;
  transition: background-color 0.2s, color 0.2s;
}

.model-option:hover {
  background-color: rgba(255, 255, 255, 0.05);
  color: var(--text-main);
}

.model-option.active {
  color: var(--text-main);
  background-color: rgba(255, 255, 255, 0.08);
}

.check-icon {
  color: var(--accent-purple);
}

.dropdown-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  font-size: 0.82em;
  color: var(--text-muted);
}

.dropdown-loading .spin {
  animation: spin 1.2s linear infinite;
}

.dropdown-error {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  font-size: 0.82em;
  color: var(--accent);
}

.retry-link {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-main);
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.85em;
  cursor: pointer;
  transition: all 0.2s;
}

.retry-link:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.dropdown-empty {
  padding: 12px;
  font-size: 0.82em;
  color: var(--text-muted-dark);
  text-align: center;
}
</style>
