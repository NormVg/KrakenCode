<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import { VueMonacoEditor, loader } from '@guolao/vue-monaco-editor'
import * as monaco from 'monaco-editor'
import { X, FileCode2, FileJson } from 'lucide-vue-next'

// Configure Vite Web Workers for Monaco
import editorWorker from 'monaco-editor/editor/editor.worker.js?worker'
import jsonWorker from 'monaco-editor/language/json/json.worker.js?worker'
import cssWorker from 'monaco-editor/language/css/css.worker.js?worker'
import htmlWorker from 'monaco-editor/language/html/html.worker.js?worker'
import tsWorker from 'monaco-editor/language/typescript/ts.worker.js?worker'

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

// Mock open tabs
const openTabs = ref([
  { id: '1', name: 'untitled.js', language: 'javascript', isModified: true, isActive: true },
  { id: '2', name: 'App.vue', language: 'html', isModified: false, isActive: false },
  { id: '3', name: 'package.json', language: 'json', isModified: false, isActive: false }
])

const selectTab = (id: string) => {
  openTabs.value.forEach(tab => {
    tab.isActive = (tab.id === id)
  })
}

const closeTab = (id: string, event: Event) => {
  event.stopPropagation()
  openTabs.value = openTabs.value.filter(tab => tab.id !== id)
  if (openTabs.value.length > 0 && !openTabs.value.some(t => t.isActive)) {
    openTabs.value[0].isActive = true
  }
}

const handleMount = (editor: any) => {
  editorRef.value = editor
}
</script>

<template>
  <div class="editor-view">
    <!-- Editor Tabs Header -->
    <div class="editor-tabs-header no-drag">
      <div class="tabs-scroll-area">
        <div 
          v-for="tab in openTabs" 
          :key="tab.id"
          class="editor-tab"
          :class="{ 'active': tab.isActive }"
          @click="selectTab(tab.id)"
        >
          <FileCode2 v-if="tab.language !== 'json'" :size="14" class="tab-icon" :class="tab.language" />
          <FileJson v-else :size="14" class="tab-icon json" />
          
          <span class="tab-title">{{ tab.name }}</span>
          
          <div class="tab-actions">
            <span v-if="tab.isModified" class="modified-dot"></span>
            <button class="close-tab-btn" @click="(e) => closeTab(tab.id, e)">
              <X :size="14" />
            </button>
          </div>
        </div>
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

/* Tabs Header */
.editor-tabs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: #1e1e1e; /* Same as editor background */
  padding: 8px 12px;
  user-select: none;
}

.tabs-scroll-area {
  display: flex;
  align-items: center;
  overflow-x: auto;
  overflow-y: hidden;
  gap: 6px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none; /* Firefox */
  flex: 1;
}

.tabs-scroll-area::-webkit-scrollbar {
  display: none; /* Hide scrollbar for Chrome/Safari/Webkit */
}

/* Individual Tab */
.editor-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 10px 0 12px;
  background-color: transparent;
  border-radius: 8px; /* Chip style */
  cursor: pointer;
  color: var(--text-muted-dark);
  transition: all 0.2s ease;
  min-width: 120px;
  max-width: 200px;
  flex-shrink: 0;
}

.editor-tab:hover {
  background-color: rgba(255, 255, 255, 0.04);
  color: var(--text-muted);
}

.editor-tab.active {
  background-color: rgba(255, 255, 255, 0.08);
  color: var(--text-main);
}

/* Tab Icon Colors */
.tab-icon {
  opacity: 0.7;
}
.tab-icon.javascript { color: #f1e05a; }
.tab-icon.typescript { color: #3178c6; }
.tab-icon.html { color: #e34c26; }
.tab-icon.json { color: #cb3837; }
.editor-tab.active .tab-icon {
  opacity: 1;
}

/* Tab Title */
.tab-title {
  font-family: var(--font-primary);
  font-size: 0.85em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

/* Tab Actions */
.tab-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
}

.modified-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #4A90E2;
}

.close-tab-btn {
  background: transparent;
  border: none;
  color: inherit;
  padding: 2px;
  border-radius: 4px;
  cursor: pointer;
  display: none;
  align-items: center;
  justify-content: center;
}

.close-tab-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

/* Only show close button on hover, or hide dot on hover to show close button */
.editor-tab:hover .modified-dot {
  display: none;
}
.editor-tab:hover .close-tab-btn,
.editor-tab.active .close-tab-btn {
  display: flex;
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
