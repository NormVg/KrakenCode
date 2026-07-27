<script setup lang="ts">
import { ref, shallowRef, watch, computed } from 'vue'
import { VueMonacoEditor, loader } from '@guolao/vue-monaco-editor'
import * as monaco from 'monaco-editor'
import { X, FileCode2, FileJson } from 'lucide-vue-next'
import { useProjectsStore } from '../../stores/projects'
import { storeToRefs } from 'pinia'

const projectsStore = useProjectsStore()
const { openFiles, activeFileId } = storeToRefs(projectsStore)

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

monaco.editor.defineTheme('kraken-theme', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '71738E', fontStyle: 'italic' },
    { token: 'keyword', foreground: '9374BE', fontStyle: 'bold' },
    { token: 'string', foreground: '08C371' },
    { token: 'number', foreground: 'FF5F5F' },
    { token: 'type', foreground: 'FED31D' },
    { token: 'class', foreground: 'FED31D', fontStyle: 'bold' },
    { token: 'function', foreground: 'AA205A' },
  ],
  colors: {
    'editor.background': '#1C1C2A',
    'editor.foreground': '#cdd6f4',
    'editorLineNumber.foreground': '#45475a',
    'editorCursor.foreground': '#f5e0dc',
    'editor.selectionBackground': '#313244',
    'editor.lineHighlightBackground': '#181825',
  }
})

const MONACO_EDITOR_OPTIONS = {
  automaticLayout: true,
  formatOnType: true,
  formatOnPaste: true,
  minimap: { enabled: false },
  theme: 'kraken-theme',
  fontFamily: 'JetBrains Mono, Menlo, Monaco, "Courier New", monospace',
  fontSize: 14,
  lineHeight: 24,
  padding: { top: 8, bottom: 8 },
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  cursorBlinking: 'smooth',
  cursorSmoothCaretAnimation: 'on'
}

const editorRef = shallowRef()

// Local code state bindings
const code = ref('')
const language = ref('plaintext')

const activeFile = computed(() => openFiles.value.find(f => f.id === activeFileId.value))

// When active file changes, load its content into the editor
watch(activeFile, (newFile) => {
  if (newFile) {
    if (code.value !== newFile.content) {
      code.value = newFile.content
    }
    language.value = newFile.language
  } else {
    code.value = ''
    language.value = 'plaintext'
  }
}, { immediate: true })

let saveTimeout: any = null

// When user types in the editor, update store and auto-save
const handleEditorChange = (value: string) => {
  if (!activeFileId.value) return
  
  projectsStore.updateFileContent(activeFileId.value, value)
  
  // Debounced Auto-Save
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    projectsStore.saveFile(activeFileId.value as string)
  }, 1000)
}

const selectTab = (id: string) => {
  activeFileId.value = id
}

const closeTab = (id: string, event: Event) => {
  event.stopPropagation()
  projectsStore.closeFile(id)
}

const handleMount = (editor: any) => {
  editorRef.value = editor
  
  // Add Cmd+S save hotkey
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
    if (activeFileId.value) {
      projectsStore.saveFile(activeFileId.value)
    }
  })
}
</script>

<template>
  <div class="editor-view">
    <!-- Editor Tabs Header -->
    <div class="editor-tabs-header no-drag">
      <div class="tabs-scroll-area">
        <div 
          v-for="tab in openFiles" 
          :key="tab.id"
          class="editor-tab"
          :class="{ 'active': activeFileId === tab.id, 'is-modified': tab.isModified }"
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
        v-if="activeFileId"
        v-model:value="code"
        :language="language"
        :options="MONACO_EDITOR_OPTIONS"
        @mount="handleMount"
        @update:value="handleEditorChange"
      />
      <div v-else class="empty-editor-state">
        <span class="muted">No file opened. Double click a file in the explorer.</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background-color: transparent;
}

/* Tabs Header */
.editor-tabs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: transparent;
  padding: 4px 12px;
  user-select: none;
  -webkit-app-region: drag;
}

:global(.left-sidebar-closed) .editor-tabs-header {
  padding-left: 80px; /* Make room for traffic lights */
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
  -webkit-app-region: no-drag;
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
  background-color: rgba(255, 255, 255, 0.06);
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

/* Only show close button on hover, or when active AND not modified. Always hide dot on hover. */
.editor-tab:hover .modified-dot {
  display: none;
}

.editor-tab:hover .close-tab-btn,
.editor-tab.active:not(.is-modified) .close-tab-btn {
  display: flex;
}

.editor-container {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.empty-editor-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
  color: var(--text-muted);
  font-size: 0.9em;
}

/* Ensure Monaco takes full height */
:deep(.monaco-editor) {
  height: 100%;
}
</style>
