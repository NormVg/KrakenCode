<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { VueMonacoEditor, loader } from '@guolao/vue-monaco-editor'
import * as monaco from 'monaco-editor'
import { useProjectsStore } from '../../stores/projects'
import MermaidPreview from '../architecture/MermaidPreview.vue'
import { useDebouncedValue } from '../architecture/composables/useArchDiagram'
import { DEFAULT_ARCH_DIAGRAM } from '../architecture/templates'

const projectsStore = useProjectsStore()
const { activeProject, isLoaded } = storeToRefs(projectsStore)

const localSource = ref(DEFAULT_ARCH_DIAGRAM)
const debouncedSource = useDebouncedValue(localSource, 300)
const previewError = ref<string | null>(null)
const splitRatio = ref(40)
const isDraggingSplit = ref(false)
const rootRef = ref<HTMLElement | null>(null)
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

function loadFromProject() {
  const stored = activeProject.value?.architecture
  const next = stored?.trim() ? stored : DEFAULT_ARCH_DIAGRAM
  if (next === localSource.value) return
  syncingFromStore = true
  localSource.value = next
  previewError.value = null
  previewRef.value?.fitView()
  nextTick(() => {
    syncingFromStore = false
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

function onSplitPointerDown(e: PointerEvent) {
  isDraggingSplit.value = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onSplitPointerMove(e: PointerEvent) {
  if (!isDraggingSplit.value || !rootRef.value) return
  const rect = rootRef.value.getBoundingClientRect()
  const pct = ((e.clientX - rect.left) / rect.width) * 100
  splitRatio.value = Math.min(70, Math.max(22, pct))
}

function onSplitPointerUp(e: PointerEvent) {
  if (!isDraggingSplit.value) return
  isDraggingSplit.value = false
  try {
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  } catch {
    /* noop */
  }
}

function onKeyDown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault()
    if (activeProject.value) {
      projectsStore.setProjectArchitecture(activeProject.value.id, localSource.value)
    }
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
  <div ref="rootRef" class="arch-view" :class="{ resizing: isDraggingSplit }">
    <section class="editor-pane" :style="{ width: `${splitRatio}%` }">
      <VueMonacoEditor
        v-model:value="localSource"
        language="markdown"
        :options="editorOptions"
        class="arch-monaco"
      />
      <p v-if="previewError" class="editor-error">{{ previewError }}</p>
    </section>

    <div
      class="split-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panes"
      @pointerdown="onSplitPointerDown"
      @pointermove="onSplitPointerMove"
      @pointerup="onSplitPointerUp"
      @pointercancel="onSplitPointerUp"
    />

    <section class="preview-pane">
      <MermaidPreview
        ref="previewRef"
        :source="debouncedSource"
        @error="previewError = $event"
      />
    </section>
  </div>
</template>

<style scoped>
.arch-view {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--bg-panel);
  position: relative;
}

.arch-view.resizing {
  cursor: col-resize;
  user-select: none;
}

.editor-pane,
.preview-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  background: var(--bg-panel);
}

.editor-pane {
  flex: 0 0 auto;
  border-right: 1px solid var(--border-color);
  position: relative;
  /* Keep last lines above global bottom bar */
  padding-bottom: var(--bottom-bar-clearance);
}

.preview-pane {
  flex: 1 1 auto;
}

.arch-monaco {
  flex: 1;
  width: 100%;
  min-height: 0;
}

.editor-error {
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

.split-handle {
  width: 5px;
  flex: 0 0 5px;
  cursor: col-resize;
  position: relative;
  z-index: 4;
  background: transparent;
}

.split-handle::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 2px;
  width: 1px;
  background: var(--border-color);
  transition: background 140ms ease-out;
}

.split-handle:hover::after,
.resizing .split-handle::after {
  background: rgba(157, 161, 211, 0.35);
}

:deep(.monaco-editor),
:deep(.monaco-editor .margin),
:deep(.monaco-editor-background) {
  background-color: var(--bg-panel) !important;
}
</style>
