<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { VueMonacoEditor, loader } from '@guolao/vue-monaco-editor'
import * as monaco from 'monaco-editor'
import {
  RotateCcw,
  Copy,
  Check,
  Columns2,
  PanelLeft,
  Eye,
  Code2,
} from 'lucide-vue-next'
import { useProjectsStore } from '../../stores/projects'
import MermaidPreview from '../architecture/MermaidPreview.vue'
import { useArchDiagram, useDebouncedValue } from '../architecture/composables/useArchDiagram'
import { ARCH_TEMPLATES, DEFAULT_ARCH_DIAGRAM } from '../architecture/templates'

const projectsStore = useProjectsStore()
const { activeProject, isLoaded } = storeToRefs(projectsStore)

// Local source — synced to the active project
const localSource = ref(DEFAULT_ARCH_DIAGRAM)
const {
  lineCount,
  isEmpty,
  applyTemplate: applyArchTemplate,
  resetToDefault,
} = useArchDiagram(localSource)
const debouncedSource = useDebouncedValue(localSource, 300)

const previewError = ref<string | null>(null)
const copied = ref(false)
const splitRatio = ref(42) // percent for editor pane
const layoutMode = ref<'split' | 'editor' | 'preview'>('split')
const isDraggingSplit = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const previewRef = ref<InstanceType<typeof MermaidPreview> | null>(null)

let copyTimer: ReturnType<typeof setTimeout> | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null

// Monaco theme (shared name with EditorView; redefine is safe)
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
    'editor.background': '#12121C',
    'editor.foreground': '#cdd6f4',
    'editorLineNumber.foreground': '#45475a',
    'editorCursor.foreground': '#f5e0dc',
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
  padding: { top: 12, bottom: 12 },
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

const projectLabel = computed(() => activeProject.value?.name ?? 'No project')
const statusLabel = computed(() => {
  if (previewError.value) return 'Error'
  if (isEmpty.value) return 'Empty'
  return 'Live'
})

// ── Load / persist per project ────────────────────────────────────────────────
function loadFromProject() {
  const stored = activeProject.value?.architecture
  localSource.value = stored?.trim() ? stored : DEFAULT_ARCH_DIAGRAM
  previewError.value = null
  previewRef.value?.fitView()
}

function scheduleSave() {
  if (!activeProject.value || !isLoaded.value) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    projectsStore.setProjectArchitecture(activeProject.value!.id, localSource.value)
  }, 450)
}

watch(
  () => activeProject.value?.id,
  () => {
    loadFromProject()
  },
  { immediate: true },
)

watch(localSource, () => {
  scheduleSave()
})

// ── Actions ───────────────────────────────────────────────────────────────────
function applyTemplate(id: string) {
  const t = ARCH_TEMPLATES.find((x) => x.id === id)
  if (!t) return
  applyArchTemplate(t.source)
}

async function copySource() {
  try {
    await navigator.clipboard.writeText(localSource.value)
    copied.value = true
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copied.value = false
    }, 1600)
  } catch (e) {
    console.error('Failed to copy architecture source', e)
  }
}

function resetDiagram() {
  if (!confirm('Reset diagram to the default system template?')) return
  resetToDefault()
}

function cycleLayout() {
  const order: Array<'split' | 'editor' | 'preview'> = ['split', 'editor', 'preview']
  const i = order.indexOf(layoutMode.value)
  layoutMode.value = order[(i + 1) % order.length]
}

function onSplitPointerDown(e: PointerEvent) {
  if (layoutMode.value !== 'split') return
  isDraggingSplit.value = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onSplitPointerMove(e: PointerEvent) {
  if (!isDraggingSplit.value || !rootRef.value) return
  const rect = rootRef.value.getBoundingClientRect()
  const pct = ((e.clientX - rect.left) / rect.width) * 100
  splitRatio.value = Math.min(70, Math.max(24, pct))
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
  if (copyTimer) clearTimeout(copyTimer)
  if (saveTimer) clearTimeout(saveTimer)
})
</script>

<template>
  <div ref="rootRef" class="arch-view" :class="[`layout-${layoutMode}`, { resizing: isDraggingSplit }]">
    <!-- ── Toolbar ─────────────────────────────────────────────────────────── -->
    <header class="arch-toolbar">
      <div class="toolbar-left">
        <div class="title-block">
          <span class="eyebrow">Architecture</span>
          <span class="title">{{ projectLabel }}</span>
        </div>
        <span class="status-pill" :class="{ error: !!previewError, empty: isEmpty && !previewError }">
          <span class="status-dot" />
          {{ statusLabel }}
        </span>
      </div>

      <div class="toolbar-center" role="tablist" aria-label="Diagram templates">
        <button
          v-for="t in ARCH_TEMPLATES"
          :key="t.id"
          type="button"
          class="template-chip"
          :title="t.description"
          @click="applyTemplate(t.id)"
        >
          {{ t.label }}
        </button>
      </div>

      <div class="toolbar-right">
        <button type="button" class="tool-btn" title="Toggle layout" @click="cycleLayout">
          <Columns2 v-if="layoutMode === 'split'" :size="15" />
          <PanelLeft v-else-if="layoutMode === 'editor'" :size="15" />
          <Eye v-else :size="15" />
        </button>
        <button type="button" class="tool-btn" :title="copied ? 'Copied' : 'Copy Mermaid'" @click="copySource">
          <Check v-if="copied" :size="15" />
          <Copy v-else :size="15" />
        </button>
        <button type="button" class="tool-btn danger" title="Reset to default" @click="resetDiagram">
          <RotateCcw :size="15" />
        </button>
      </div>
    </header>

    <!-- ── Body ────────────────────────────────────────────────────────────── -->
    <div class="arch-body">
      <section
        v-show="layoutMode !== 'preview'"
        class="editor-pane"
        :style="layoutMode === 'split' ? { width: `${splitRatio}%` } : undefined"
      >
        <div class="pane-label">
          <Code2 :size="12" />
          <span>Mermaid source</span>
          <span class="meta">{{ lineCount }} lines</span>
        </div>
        <div class="editor-wrap">
          <VueMonacoEditor
            v-model:value="localSource"
            language="markdown"
            :options="editorOptions"
            class="arch-monaco"
          />
        </div>
      </section>

      <div
        v-if="layoutMode === 'split'"
        class="split-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize editor and preview"
        @pointerdown="onSplitPointerDown"
        @pointermove="onSplitPointerMove"
        @pointerup="onSplitPointerUp"
        @pointercancel="onSplitPointerUp"
      />

      <section
        v-show="layoutMode !== 'editor'"
        class="preview-pane"
        :style="layoutMode === 'split' ? { width: `${100 - splitRatio}%` } : undefined"
      >
        <div class="pane-label">
          <Eye :size="12" />
          <span>Live preview</span>
          <span class="meta">auto-updates</span>
        </div>
        <div class="preview-wrap">
          <MermaidPreview
            ref="previewRef"
            :source="debouncedSource"
            @error="previewError = $event"
          />
        </div>
      </section>
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
  background: #0d0d14;
  position: relative;
}

.arch-view.resizing {
  cursor: col-resize;
  user-select: none;
}

/* ── Toolbar ──────────────────────────────────────────────────────────────── */
.arch-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.02) 0%, transparent 100%),
    rgba(18, 18, 28, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  z-index: 5;
  min-height: 52px;
}

.toolbar-left,
.toolbar-right,
.toolbar-center {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-left {
  min-width: 0;
  flex-shrink: 1;
}

.toolbar-center {
  flex: 1;
  justify-content: center;
  gap: 6px;
  flex-wrap: wrap;
}

.toolbar-right {
  flex-shrink: 0;
  margin-left: auto;
}

.title-block {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.eyebrow {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.32);
  margin: 0;
}

.title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 500;
  color: hsl(152, 60%, 70%);
  background: hsla(152, 60%, 50%, 0.12);
  border: 1px solid hsla(152, 58%, 44%, 0.28);
  white-space: nowrap;
}

.status-pill.error {
  color: hsl(0, 65%, 76%);
  background: hsla(0, 65%, 60%, 0.12);
  border-color: hsla(0, 65%, 60%, 0.35);
}

.status-pill.empty {
  color: rgba(255, 255, 255, 0.45);
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.08);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 8px currentColor;
}

.template-chip {
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.55);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 140ms ease-out, color 140ms ease-out, border-color 140ms ease-out, transform 120ms ease-out;
}

.template-chip:hover {
  background: rgba(147, 116, 190, 0.12);
  border-color: rgba(147, 116, 190, 0.35);
  color: #b89fe8;
}

.template-chip:active {
  transform: scale(0.96);
}

.tool-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 140ms ease-out, color 140ms ease-out, transform 120ms ease-out;
}

.tool-btn:hover {
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.9);
}

.tool-btn:active {
  transform: scale(0.96);
}

.tool-btn.danger:hover {
  background: hsla(0, 65%, 60%, 0.14);
  color: hsl(0, 65%, 76%);
}

/* ── Body / split ─────────────────────────────────────────────────────────── */
.arch-body {
  flex: 1;
  display: flex;
  min-height: 0;
  position: relative;
}

.layout-editor .editor-pane,
.layout-preview .preview-pane {
  width: 100% !important;
  flex: 1;
}

.editor-pane,
.preview-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
}

.layout-split .editor-pane {
  flex: 0 0 auto;
}

.layout-split .preview-pane {
  flex: 1 1 auto;
}

.pane-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.32);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(0, 0, 0, 0.15);
}

.pane-label .meta {
  margin-left: auto;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  color: rgba(255, 255, 255, 0.22);
  font-variant-numeric: tabular-nums;
}

.editor-wrap,
.preview-wrap {
  flex: 1;
  min-height: 0;
  position: relative;
}

.editor-wrap {
  background: #12121c;
}

.arch-monaco {
  width: 100%;
  height: 100%;
}

.split-handle {
  width: 6px;
  flex: 0 0 6px;
  cursor: col-resize;
  position: relative;
  z-index: 4;
  background: transparent;
  transition: background 140ms ease-out;
}

.split-handle::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 2px;
  width: 1px;
  background: rgba(255, 255, 255, 0.06);
  transition: background 140ms ease-out, box-shadow 140ms ease-out;
}

.split-handle:hover::after,
.resizing .split-handle::after {
  background: rgba(147, 116, 190, 0.55);
  box-shadow: 0 0 12px rgba(147, 116, 190, 0.35);
}

:deep(.monaco-editor),
:deep(.monaco-editor .margin),
:deep(.monaco-editor-background) {
  background-color: #12121c !important;
}
</style>
