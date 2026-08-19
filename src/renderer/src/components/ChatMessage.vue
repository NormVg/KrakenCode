<script setup lang="ts">
import MarkdownRender from 'markstream-vue'
import { Copy } from 'lucide-vue-next'
import 'markstream-vue/index.css'

const props = defineProps<{
  role: 'user' | 'agent'
  content: string
  isStreaming?: boolean
}>()
</script>

<template>
  <div :class="['message', role]">
    <!-- User Message Bubble -->
    <div v-if="role === 'user'" class="user-bubble">
      <div class="text-content">
        {{ content }}
      </div>
      
      <div class="message-actions">
        <button class="action-btn" title="Copy"><Copy :size="14" /></button>
      </div>
    </div>
    
    <!-- Agent Message (Box-less) -->
    <div v-else class="agent-wrapper">
      <div class="markdown-body">
        <MarkdownRender 
          mode="chat" 
          :content="props.content" 
          :final="!props.isStreaming" 
          :is-dark="true"
          code-renderer="shiki"
          :code-block-props="{
            showHeader: true,
            showCopyButton: true,
            showExpandButton: true,
            themes: ['vitesse-dark', 'vitesse-light'],
          }"
          :mermaid-props="{
            showHeader: true,
            showCopyButton: true,
            showExportButton: true,
            showFullscreenButton: true,
            showZoomControls: true,
            enableWheelZoom: true,
            enableMermaidInteractions: true,
            showModeToggle: true,
          }"
          :show-tooltips="true"
          :fade="true"
          :smooth-streaming="true"
        />
      </div>
      
      <div class="message-actions agent-actions">
        <button class="action-btn" title="Copy"><Copy :size="14" /></button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.message {
  width: 100%;
  display: flex;
  flex-direction: column;
  margin-bottom: 32px;
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* User Message */
.user-bubble {
  background-color: var(--bg-dark); /* #0A0D18 */
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  /* Maya-design */
  transition: border-color 0.2s;
}

.user-bubble:hover {
  border-color: rgba(255, 255, 255, 0.1);
}

.text-content {
  color: var(--text-muted);
  font-size: 0.95em;
  line-height: 1.5;
  white-space: pre-wrap;
}

/* Action Buttons */
.message-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.agent-actions {
  margin-top: 16px;
}

.action-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  opacity: 0.3;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.message:hover .action-btn {
  opacity: 0.6;
}

.action-btn:hover {
  opacity: 1 !important;
  background-color: rgba(255, 255, 255, 0.05);
  color: var(--text-main);
}

/* Agent Message */
.agent-wrapper {
  display: flex;
  flex-direction: column;
  padding: 0 8px;
  align-self: flex-start;
  width: 100%;
}

.markdown-body {
  color: var(--text-main);
  line-height: 1.6;
  font-size: 0.95em;
}
</style>
