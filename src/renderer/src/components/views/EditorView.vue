<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import { VueMonacoEditor, loader } from '@guolao/vue-monaco-editor'
import * as monaco from 'monaco-editor'

// Configure Vite Web Workers for Monaco
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') return new jsonWorker()
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker()
    if (label === 'typescript' || label === 'javascript') return new tsWorker()
    return new editorWorker()
  }
}

// Tell the wrapper to use our local monaco instance instead of fetching from CDN
loader.config({ monaco })

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
