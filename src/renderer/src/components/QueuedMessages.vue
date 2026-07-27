<script setup lang="ts">
import { ref } from 'vue'
import { ChevronUp, ChevronDown, Trash2, ArrowRight, Pencil } from 'lucide-vue-next'

const props = defineProps<{
  messages: string[]
}>()

const emit = defineEmits<{
  (e: 'remove', index: number): void
}>()

const isExpanded = ref(false)

const toggleExpand = () => {
  if (props.messages.length > 0) {
    isExpanded.value = !isExpanded.value
  }
}
</script>

<template>
  <div class="queued-messages-container" v-if="messages.length > 0">
    <div class="queued-header" @click="toggleExpand">
      <div class="header-left">
        <span class="title">Queued Messages</span>
        <span class="badge">{{ messages.length }}</span>
        <span class="subtitle">Sends after agent finishes working</span>
      </div>
      <div class="header-right">
        <ChevronDown v-if="isExpanded" :size="16" class="chevron" />
        <ChevronUp v-else :size="16" class="chevron" />
      </div>
    </div>
    
    <div v-if="isExpanded" class="queued-list">
      <div 
        v-for="(msg, index) in messages" 
        :key="index"
        class="queued-item"
      >
        <div class="thumbnail">
          <span class="mock-model-text">b-cloud</span>
        </div>
        <span class="msg-text">{{ msg }}</span>
        
        <div class="item-actions">
          <button class="action-btn" title="Run Now"><ArrowRight :size="14" /></button>
          <button class="action-btn" title="Edit"><Pencil :size="14" /></button>
          <button class="action-btn delete-btn" title="Remove" @click.stop="emit('remove', index)"><Trash2 :size="14" /></button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.queued-messages-container {
  background-color: var(--bg-dark);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.queued-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  cursor: pointer;
  user-select: none;
  background-color: transparent;
  transition: background-color 0.2s;
}

.queued-header:hover {
  background-color: rgba(255, 255, 255, 0.02);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title {
  font-size: 0.85em;
  font-weight: 600;
  color: var(--text-main);
}

.badge {
  background-color: #1c1c2a; /* Darker badge */
  color: var(--text-main);
  font-size: 0.75em;
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: 500;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.subtitle {
  font-size: 0.85em;
  color: var(--text-muted);
}

.header-right {
  display: flex;
  align-items: center;
  color: var(--text-muted);
}

.queued-list {
  display: flex;
  flex-direction: column;
}

.queued-item {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  gap: 12px;
  transition: background-color 0.2s;
  position: relative;
}

.queued-item:hover {
  background-color: rgba(255, 255, 255, 0.03);
}

.thumbnail {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background-color: #12121a; /* Even darker square */
  border: 1px solid rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.mock-model-text {
  font-size: 0.45em;
  color: #3b82f6;
  font-weight: bold;
}

.msg-text {
  flex: 1;
  font-size: 0.9em;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-actions {
  display: flex;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}

.queued-item:hover .item-actions {
  opacity: 1;
}

.action-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-main);
}

.delete-btn:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}
</style>
