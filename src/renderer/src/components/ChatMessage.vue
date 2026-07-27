<script setup lang="ts">
import MarkdownRender from 'markstream-vue'
import { Copy, ThumbsUp, ThumbsDown, ChevronRight, FileCode } from 'lucide-vue-next'
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
        <button class="action-btn" title="Thumbs Up"><ThumbsUp :size="14" /></button>
        <button class="action-btn" title="Thumbs Down"><ThumbsDown :size="14" /></button>
      </div>
    </div>
    
    <!-- Agent Message (Box-less) -->
    <div v-else class="agent-wrapper">
      <div class="agent-meta">
        <span class="worked-text">Worked for 1m <ChevronRight :size="12" class="chevron" /></span>
      </div>
      
      <div class="markdown-body">
        <MarkdownRender 
          mode="chat" 
          :content="props.content" 
          :final="!props.isStreaming" 
          :is-dark="true" 
          :code-block-props="{ theme: { dark: 'vitesse-dark', light: 'vitesse-light' } }"
        />
      </div>
      
      <!-- Mock File Changes (Only show for long messages just to simulate the screenshot) -->
      <div class="agent-footer" v-if="content.length > 50">
        <div class="file-changes-row">
          <div class="changes-pill">
            <span>2 files changed</span>
            <span class="additions">+145</span>
            <span class="deletions">-27</span>
            <ChevronRight :size="12" class="chevron" />
          </div>
          <button class="review-btn">
            <FileCode :size="12" style="margin-right:6px"/> Review
          </button>
        </div>
      </div>
      
      <div class="message-actions agent-actions">
        <button class="action-btn" title="Copy"><Copy :size="14" /></button>
        <button class="action-btn" title="Thumbs Up"><ThumbsUp :size="14" /></button>
        <button class="action-btn" title="Thumbs Down"><ThumbsDown :size="14" /></button>
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
}

.agent-meta {
  margin-bottom: 12px;
}

.worked-text {
  font-size: 0.85em;
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: color 0.2s;
}

.worked-text:hover {
  color: var(--text-main);
}

.markdown-body {
  color: var(--text-main);
  line-height: 1.6;
  font-size: 0.95em;
}

/* Footer / File changes */
.agent-footer {
  margin-top: 24px;
}

.file-changes-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.changes-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85em;
  color: var(--text-muted);
  background: transparent;
  cursor: pointer;
  transition: color 0.2s;
}

.changes-pill:hover {
  color: var(--text-main);
}

.additions { color: #10b981; }
.deletions { color: #ef4444; }

.review-btn {
  background-color: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  color: var(--text-main);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.85em;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all 0.2s;
}

.review-btn:hover {
  background-color: rgba(255, 255, 255, 0.08);
}

.chevron {
  opacity: 0.5;
}
</style>
