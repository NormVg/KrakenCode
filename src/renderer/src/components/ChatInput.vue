<script setup lang="ts">
import { Plus, Mic } from 'lucide-vue-next'
import ModelSelector from './ModelSelector.vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: 'Plan, Build, / for skills, @ for context'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  rows: {
    type: Number,
    default: 3
  }
})

const emit = defineEmits(['update:modelValue', 'submit'])

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    emit('submit')
  }
}
</script>

<template>
  <div class="chat-input-container">
    <textarea 
      :value="modelValue"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      :placeholder="placeholder"
      :rows="rows"
      @keydown="handleKeydown"
      :disabled="disabled"
    ></textarea>
    <div class="composer-toolbar">
      <div class="toolbar-left">
        <button class="add-btn">
          <Plus :size="14" />
        </button>
        <ModelSelector />
      </div>
      <div class="toolbar-right">
        <button class="mic-btn">
          <Mic :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-input-container {
  width: 100%;
  background-color: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(20px);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.chat-input-container:focus-within {
  border-color: rgba(255, 255, 255, 0.15);
  box-shadow: 0 15px 50px rgba(0, 0, 0, 0.4);
}

textarea {
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-main);
  resize: none;
  outline: none;
  font-size: 0.95em;
  line-height: 1.5;
  padding: 16px;
  min-height: 24px;
  max-height: 300px;
}

textarea::placeholder {
  color: var(--text-muted);
}

.composer-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.02);
}

.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.add-btn {
  background: rgba(255, 255, 255, 0.05);
  border: none;
  color: var(--text-muted);
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.add-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-main);
}

.mic-btn {
  background: #fff;
  border: none;
  color: #000;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s;
}

.mic-btn:hover {
  transform: scale(1.05);
}
</style>
