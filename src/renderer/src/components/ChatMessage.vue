<script setup lang="ts">
import { ref } from 'vue'
import MarkdownRender from 'markstream-vue'
import { Copy, Check } from 'lucide-vue-next'
import 'markstream-vue/index.css'

const props = defineProps<{
  role: 'user' | 'agent'
  content: string
  isStreaming?: boolean
}>()

const isCopied = ref(false)

const copyToClipboard = () => {
  navigator.clipboard.writeText(props.content)
  isCopied.value = true
  setTimeout(() => {
    isCopied.value = false
  }, 2000)
}
</script>

<template>
  <div :class="['message', role]">
    <!-- User Message Bubble -->
    <div v-if="role === 'user'" class="user-bubble">
      <div class="text-content">
        {{ content }}
      </div>
      
      <button class="copy-btn" :title="isCopied ? 'Copied!' : 'Copy'" @click="copyToClipboard">
        <Check v-if="isCopied" :size="13" class="icon-success" />
        <Copy v-else :size="13" />
      </button>
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
          :fade="props.isStreaming"
          :smooth-streaming="props.isStreaming"
        />
      </div>
      
      <button class="copy-btn" :title="isCopied ? 'Copied!' : 'Copy'" @click="copyToClipboard">
        <Check v-if="isCopied" :size="13" class="icon-success" />
        <Copy v-else :size="13" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.message {
  width: 100%;
  display: flex;
  flex-direction: column;
  margin-bottom: 16px;
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* User Message */
.user-bubble {
  position: relative;
  background-color: var(--bg-dark); /* #0A0D18 */
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 16px 20px;
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

/* Copy Button — bottom-right overlay, visible on hover */
.copy-btn {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: var(--text-muted);
  opacity: 0;
  cursor: pointer;
  padding: 5px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s ease, background-color 0.15s ease;
  z-index: 2;
}

.copy-btn .icon-success {
  color: #10B981; /* teal/green */
}

.message:hover .copy-btn {
  opacity: 0.6;
}

.copy-btn:hover {
  opacity: 1 !important;
  background-color: rgba(255, 255, 255, 0.08);
  color: var(--text-main);
}

/* Agent Message */
.agent-wrapper {
  position: relative;
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
