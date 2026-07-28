<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { VueMonacoEditor, loader } from '@guolao/vue-monaco-editor'
import * as monaco from 'monaco-editor'
import { Code2, Eye } from 'lucide-vue-next'
import { useProjectsStore } from '../../stores/projects'
import MermaidPreview from '../architecture/MermaidPreview.vue'
import { useDebouncedValue } from '../architecture/composables/useArchDiagram'
import { DEFAULT_ARCH_DIAGRAM } from '../architecture/templates'

type ArchMode = 'preview' | 'code'

const projectsStore = useProjectsStore()
const { activeProject, isLoaded } = storeToRefs(projectsStore)

const mode = ref<ArchMode>('preview')
const localSource = ref(DEFAULT_ARCH_DIAGRAM)
const debouncedSource = useDebouncedValue(localSource, 300)
const previewError = ref<string | null>(null)
const previewRef = ref<InstanceType<typeof MermaidPreview> | null>(null)

let syncingFromStore = false
let saveTimer: ReturnType<typeof setTimeout> | null = null

loader.config({ monaco })
monaco.editor.defineTheme('kraken-arch', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '71738E', fontStyle: 'italic' },
    { token: 'keyword', foreground: '9374BE', fontStyle: 'bold' },
    { token: 'string', foreground: '08C371' },
    { token: 'number', foreground: 'FF5F5F' },
  ],
  colors: {
    'editor.background': '#1C1C2A',
    'editor.foreground': '#E2E8F0',
    'editorLineNumber.foreground': '#71738E',
    'editorCursor.foreground': '#E2E8F0',
    'editor.selectionBackground': '#313244',
    'editor.lineHighlightBackground': '#181825',
  },
})

const editorOptions = {
  automaticLayout: true,
  minimap: { enabled: false },
  theme: 'kraken-arch',
  fontFamily: 'JetBrains Mono, Menlo, Monaco, "Courier New", monospace',
  fontSize: 13,
  lineHeight: 22,
  padding: { top: 16, bottom: 16 },
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  wordWrap: 'on' as const,
  lineNumbers: 'on' as const,
  renderLineHighlight: 'line' as const,
  tabSize: 2,
  folding: true,
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  scrollbar: {
    verticalScrollbarSize: 6,
    horizontalScrollbarSize: 6,
  },
}

function setMode(next: ArchMode) {
  mode.value = next
  if (next === 'preview') {
    nextTick(() => previewRef.value?.fitView())
  }
}

function loadFromProject() {
  const stored = activeProject.value?.architecture
  const next = stored?.trim() ? stored : DEFAULT_ARCH_DIAGRAM
  if (next === localSource.value) return
  syncingFromStore = true
  localSource.value = next
  previewError.value = null
  nextTick(() => {
    syncingFromStore = false
    if (mode.value === 'preview') previewRef.value?.fitView()
  })
}

function scheduleSave() {
  if (syncingFromStore) return
  if (!activeProject.value || !isLoaded.value) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    if (syncingFromStore || !activeProject.value) return
    if (activeProject.value.architecture === localSource.value) return
    projectsStore.setProjectArchitecture(activeProject.value.id, localSource.value)
  }, 450)
}

watch(
  () => activeProject.value?.id,
  () => {
    loadFromProject()
  },
  { immediate: true },
)

watch(
  () => activeProject.value?.architecture,
  (arch) => {
    if (arch == null) return
    if (arch === localSource.value) return
    loadFromProject()
  },
)

watch(localSource, () => {
  scheduleSave()
})

function onKeyDown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault()
    if (activeProject.value) {
      projectsStore.setProjectArchitecture(activeProject.value.id, localSource.value)
    }
  }
  // Toggle modes with Cmd/Ctrl+E when focused in graph (avoid inputs)
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e') {
    const t = e.target as HTMLElement | null
    if (t?.closest?.('.monaco-editor')) {
      // allow while editing code too
    }
    e.preventDefault()
    setMode(mode.value === 'preview' ? 'code' : 'preview')
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  if (saveTimer) clearTimeout(saveTimer)
})
</script>

<template>
  <div class="arch-view">
    <header class="arch-top-panel no-drag">
      <div class="mode-switch" role="tablist" aria-label="Architecture view mode">
        <button
          type="button"
          role="tab"
          class="mode-btn"
          :class="{ active: mode === 'preview' }"
          :aria-selected="mode === 'preview'"
          title="Preview"
          @click="setMode('preview')"
        >
          <Eye :size="14" />
          <span>Preview</span>
        </button>
        <button
          type="button"
          role="tab"
          class="mode-btn"
          :class="{ active: mode === 'code' }"
          :aria-selected="mode === 'code'"
          title="Code"
          @click="setMode('code')"
        >
          <Code2 :size="14" />
          <span>Code</span>
        </button>
      </div>
    </header>

    <div class="arch-body">
      <MermaidPreview
        v-if="mode === 'preview'"
        ref="previewRef"
        :source="debouncedSource"
        @error="previewError = $event"
      />

      <div v-else class="code-pane">
        <VueMonacoEditor
          v-model:value="localSource"
          language="markdown"
          :options="editorOptions"
          class="arch-monaco"
        />
        <p v-if="previewError" class="code-error">{{ previewError }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.arch-view {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--bg-panel);
}

.arch-top-panel {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  padding: 0 12px;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border-color);
  z-index: 5;
}

.mode-switch {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 10px;
  background: rgba(10, 13, 24, 0.55);
  border: 1px solid var(--border-color);
}

.mode-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  min-width: 40px;
  padding: 0 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted-dark);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 140ms ease-out, color 140ms ease-out, transform 120ms ease-out;
}

.mode-btn:hover {
  color: var(--text-main);
  background: rgba(255, 255, 255, 0.05);
}

.mode-btn:active {
  transform: scale(0.96);
}

.mode-btn.active {
  color: var(--text-main);
  background: rgba(255, 255, 255, 0.08);
}

.arch-body {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.code-pane {
  position: relative;
  width: 100%;
  height: 100%;
  padding-bottom: var(--bottom-bar-clearance);
  background: var(--bg-panel);
}

.arch-monaco {
  width: 100%;
  height: 100%;
}

.code-error {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: calc(var(--bottom-bar-clearance) + 8px);
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(255, 95, 95, 0.1);
  border: 1px solid rgba(255, 95, 95, 0.22);
  color: var(--text-muted);
  font-size: 11px;
  font-family: var(--font-code);
  line-height: 1.4;
  pointer-events: none;
}

:deep(.monaco-editor),
:deep(.monaco-editor .margin),
:deep(.monaco-editor-background) {
  background-color: var(--bg-panel) !important;
}
</style>
