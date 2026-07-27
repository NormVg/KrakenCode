<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useConfigStore } from '../stores/config'
import { ChevronDown, Check } from 'lucide-vue-next'

const configStore = useConfigStore()
const { model } = storeToRefs(configStore)

const isOpen = ref(false)

const availableModels = [
  'gemma4:31b-cloud',
  'llama3',
  'mistral',
  'phi3',
  'gemma'
]

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
}

const selectModel = (m: string) => {
  model.value = m
  isOpen.value = false
}

// Close when clicking outside
const closeDropdown = (e: Event) => {
  if (!isOpen.value) return
  const target = e.target as HTMLElement
  if (!target.closest('.model-selector-container')) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', closeDropdown)
})
onUnmounted(() => {
  document.removeEventListener('click', closeDropdown)
})
</script>

<template>
  <div class="model-selector-container">
    <button class="model-badge" @click="toggleDropdown">
      {{ model || 'Select Model' }} <ChevronDown :size="12" class="model-icon" />
    </button>
    
    <div v-if="isOpen" class="model-dropdown">
      <div 
        v-for="m in availableModels" 
        :key="m"
        :class="['model-option', { active: model === m }]"
        @click="selectModel(m)"
      >
        <span>{{ m }}</span>
        <Check v-if="model === m" :size="14" class="check-icon" />
      </div>
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

.model-dropdown {
  position: absolute;
  bottom: calc(100% + 8px); /* Open upwards to prevent clipping */
  left: 0;
  background-color: var(--bg-panel);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 4px;
  min-width: 180px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  z-index: 100;
  display: flex;
  flex-direction: column;
  animation: dropdownIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes dropdownIn {
  from { opacity: 0; transform: translateY(4px); } /* Slide up slightly on appear */
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
</style>
