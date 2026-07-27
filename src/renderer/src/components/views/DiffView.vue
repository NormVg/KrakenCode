<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import { VueMonacoDiffEditor } from '@guolao/vue-monaco-editor'

const originalValue = ref(`function hello() {
  console.log("Hello, world!");
  return true;
}

// Add more code here
`)

const modifiedValue = ref(`function hello(name: string) {
  console.log(\`Hello, \${name}!\`);
  return true;
}

// Added an amazing new feature!
`)

const diffEditorRef = shallowRef()
const handleMount = (diffEditorInstance: any) => {
  diffEditorRef.value = diffEditorInstance
}

const MONACO_DIFF_OPTIONS = {
  automaticLayout: true,
  renderSideBySide: true,
  readOnly: false,
  minimap: { enabled: false },
  fontFamily: 'JetBrains Mono, Menlo, Monaco, "Courier New", monospace',
  fontSize: 14,
  lineHeight: 24,
  padding: { top: 8, bottom: 8 },
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  cursorBlinking: 'smooth',
  cursorSmoothCaretAnimation: 'on',
  formatOnPaste: true,
  theme: 'kraken-theme',
}
</script>

<template>
  <div class="diff-container">
    <div class="diff-header">
      <div class="header-title">Changes</div>
    </div>
    <div class="diff-editor-wrapper">
      <vue-monaco-diff-editor
        :original="originalValue"
        :modified="modifiedValue"
        language="javascript"
        :options="MONACO_DIFF_OPTIONS"
        @mount="handleMount"
      />
    </div>
  </div>
</template>

<style scoped>
.diff-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background-color: transparent;
}

.diff-header {
  display: flex;
  align-items: center;
  padding: 4px 12px;
  background-color: transparent;
  border-bottom: 1px solid var(--border-color);
  -webkit-app-region: drag;
}

.header-title {
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 500;
}

.diff-editor-wrapper {
  flex: 1;
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}
</style>
