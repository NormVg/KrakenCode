<script setup lang="ts">
import MarkdownRender from 'markstream-vue'
import 'markstream-vue/index.css'

const props = defineProps<{
  role: 'user' | 'agent'
  content: string
  isStreaming?: boolean
}>()
</script>

<template>
  <div :class="['message', role]">
    <div class="message-avatar">
      <div v-if="role === 'agent'" class="avatar agent-avatar">
        <img src="../assets/icon-nobg.png" alt="Kraken" class="agent-icon" />
      </div>
      <div v-else class="avatar user-avatar">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </div>
    </div>
    
    <div class="message-content">
      <div class="message-sender">{{ role === 'agent' ? 'Kraken' : 'You' }}</div>
      <div class="markdown-body">
        <MarkdownRender 
          mode="chat" 
          :content="props.content" 
          :final="!props.isStreaming" 
          :is-dark="true" 
          :code-block-props="{ theme: { dark: 'vitesse-dark', light: 'vitesse-light' } }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.message {
  display: flex;
  gap: 16px;
  padding-bottom: 24px;
  animation: fadeIn 0.3s ease-out;
}

.message:last-child {
  padding-bottom: 0;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.agent-avatar {
  background: transparent;
  border: none;
}

.agent-icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 8px;
}

.user-avatar {
  background: var(--bg-input);
  color: var(--text-muted);
  border: 1px solid var(--border-color);
}

.message-content {
  flex: 1;
  min-width: 0; /* Prevents overflow in flexbox */
}

.message-sender {
  font-weight: 600;
  margin-bottom: 8px;
  font-size: 0.9em;
  color: var(--text-muted);
  text-transform: capitalize;
}

/* Markdown container */
.markdown-body {
  color: var(--text-main);
  line-height: 1.6;
  font-size: 0.95em;
}
</style>
