<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import { VueMonacoEditor } from '@guolao/vue-monaco-editor'

const MONACO_EDITOR_OPTIONS = {
  automaticLayout: true,
  formatOnType: true,
  formatOnPaste: true,
  minimap: { enabled: false },
  theme: 'vs-dark',
  fontFamily: 'JetBrains Mono, Menlo, Monaco, "Courier New", monospace',
  fontSize: 14,
  lineHeight: 24,
  padding: { top: 16, bottom: 16 },
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  cursorBlinking: 'smooth',
  cursorSmoothCaretAnimation: 'on'
}

const code = ref(`// Welcome to Kraken Editor
// You can start typing here...

function helloWorld() {
  console.log("Hello, Kraken!");
}
`)

const language = ref('javascript')
const editorRef = shallowRef()

const handleMount = (editor: any) => {
  editorRef.value = editor
}
</script>

<template>
  <div class="editor-view">
    <div class="editor-header no-drag">
      <div class="file-info">
        <span class="file-name">untitled.js</span>
        <span class="file-status modified"></span>
      </div>
      <div class="editor-actions">
        <!-- Actions could go here -->
      </div>
    </div>
    
    <div class="editor-container no-drag">
      <vue-monaco-editor
        v-model:value="code"
        :language="language"
        :options="MONACO_EDITOR_OPTIONS"
        @mount="handleMount"
      />
    </div>
  </div>
</template>

<style scoped>
.editor-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background-color: #1e1e1e; /* VS Code dark theme default background */
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background-color: var(--bg-panel);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.file-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-name {
  font-size: 0.9em;
  color: var(--text-main);
  font-family: monospace;
}

.file-status.modified {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #4A90E2;
}

.editor-container {
  flex: 1;
  position: relative;
  overflow: hidden;
}

/* Ensure Monaco takes full height */
:deep(.monaco-editor) {
  height: 100%;
}
</style>
