<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { VueMonacoEditor, loader } from '@guolao/vue-monaco-editor'
import * as monaco from 'monaco-editor'
import {
  Code2,
  Eye,
  Minus,
  Plus,
  Maximize2,
  Copy,
  Check,
  Hand,
  MousePointer2,
  Link2,
  Server,
  Database,
  ListOrdered,
  Globe,
  Smartphone,
} from 'lucide-vue-next'
import { useProjectsStore } from '../../stores/projects'
import MermaidPreview from '../architecture/MermaidPreview.vue'
import ArchBuilder from '../architecture/builder/ArchBuilder.vue'
import { useDebouncedValue } from '../architecture/composables/useArchDiagram'
import { DEFAULT_ARCH_DIAGRAM } from '../architecture/templates'
import type { ArchNodeKind } from '../architecture/builder/types'
import { KIND_COLORS } from '../architecture/builder/types'

type ArchMode = 'builder' | 'preview' | 'code'
type BuilderTool = 'select' | 'connect'

const NODE_TOOLS: Array<{ kind: ArchNodeKind; label: string; icon: typeof Server }> = [
  { kind: 'service', label: 'Service', icon: Server },
  { kind: 'database', label: 'Database', icon: Database },
  { kind: 'queue', label: 'Queue', icon: ListOrdered },
  { kind: 'external', label: 'External', icon: Globe },
  { kind: 'client', label: 'Client', icon: Smartphone },
]

const projectsStore = useProjectsStore()
const { activeProject, isLoaded } = storeToRefs(projectsStore)

const mode = ref<ArchMode>('builder')
const localSource = ref(DEFAULT_ARCH_DIAGRAM)
const debouncedSource = useDebouncedValue(localSource, 300)
const previewError = ref<string | null>(null)
const previewRef = ref<InstanceType<typeof MermaidPreview> | null>(null)
const builderRef = ref<InstanceType<typeof ArchBuilder> | null>(null)
const builderTool = ref<BuilderTool>('select')
const zoomLabel = ref(100)
const panTool = ref(true)
const copied = ref(false)

let syncingFromStore = false
let saveTimer: ReturnType<typeof setTimeout> | null = null
let copyTimer: ReturnType<typeof setTimeout> | null = null

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
  padding: { top: 56, bottom: 16 },
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

const showZoomTools = computed(() => mode.value === 'preview')
const showBuilderTools = computed(() => mode.value === 'builder')

function setMode(next: ArchMode) {
  mode.value = next
  if (next === 'preview') {
    nextTick(() => {
      previewRef.value?.fitView()
      syncZoomLabel()
    })
  }
  if (next === 'builder') {
    builderTool.value = 'select'
  }
}

function onBuilderSource(src: string) {
  localSource.value = src
}

function addNode(kind: ArchNodeKind) {
  builderRef.value?.addNode(kind)
}

function onPaletteDragStart(e: DragEvent, kind: ArchNodeKind) {
  if (!e.dataTransfer) return
  e.dataTransfer.setData('application/kraken-arch-kind', kind)
  e.dataTransfer.effectAllowed = 'copy'
}

function syncZoomLabel() {
  const preview = previewRef.value
  if (!preview) {
    zoomLabel.value = 100
    return
  }
  const z = preview.zoomPercent as number | { value: number } | undefined
  zoomLabel.value = typeof z === 'number' ? z : (z?.value ?? 100)
}

function onViewport(payload: { zoom: number }) {
  zoomLabel.value = Math.round(payload.zoom * 100)
}

function zoomIn() {
  previewRef.value?.zoomBy(0.1)
  nextTick(syncZoomLabel)
}

function zoomOut() {
  previewRef.value?.zoomBy(-0.1)
  nextTick(syncZoomLabel)
}

function fitView() {
  previewRef.value?.fitView()
  nextTick(syncZoomLabel)
}

async function copySource() {
  try {
    await navigator.clipboard.writeText(localSource.value)
    copied.value = true
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copied.value = false
    }, 1400)
  } catch (e) {
    console.error('Copy failed', e)
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
    if (mode.value === 'preview') {
      previewRef.value?.fitView()
      syncZoomLabel()
    }
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
  if (mode.value !== 'preview') return
  if ((e.key === '=' || e.key === '+') && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    zoomIn()
  }
  if ((e.key === '-' || e.key === '_') && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    zoomOut()
  }
  if (e.key === '0' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    fitView()
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  if (saveTimer) clearTimeout(saveTimer)
  if (copyTimer) clearTimeout(copyTimer)
})
</script>

<template>
  <div class="arch-view">
    <div class="arch-toolbar no-drag">
      <div class="tool-group" role="tablist" aria-label="View mode">
        <button
          type="button"
          class="tool-btn"
          :class="{ active: mode === 'builder' }"
          title="Build"
          aria-label="Build"
          @click="setMode('builder')"
        >
          <MousePointer2 :size="15" />
        </button>
        <button
          type="button"
          class="tool-btn"
          :class="{ active: mode === 'preview' }"
          title="Preview"
          aria-label="Preview"
          @click="setMode('preview')"
        >
          <Eye :size="15" />
        </button>
        <button
          type="button"
          class="tool-btn"
          :class="{ active: mode === 'code' }"
          title="Code"
          aria-label="Code"
          @click="setMode('code')"
        >
          <Code2 :size="15" />
        </button>
      </div>

      <!-- Builder: icons only + native tooltips -->
      <template v-if="showBuilderTools">
        <div class="tool-divider" />

        <div class="tool-group" aria-label="Add node">
          <button
            v-for="item in NODE_TOOLS"
            :key="item.kind"
            type="button"
            class="tool-btn kind-btn"
            :title="item.label"
            :aria-label="`Add ${item.label}`"
            :style="{ '--kind': KIND_COLORS[item.kind] }"
            draggable="true"
            @click="addNode(item.kind)"
            @dragstart="onPaletteDragStart($event, item.kind)"
          >
            <component :is="item.icon" :size="15" class="kind-icon" />
          </button>
        </div>

        <div class="tool-divider" />

        <div class="tool-group" aria-label="Builder tools">
          <button
            type="button"
            class="tool-btn"
            :class="{ active: builderTool === 'select' }"
            title="Move"
            aria-label="Move"
            @click="builderTool = 'select'"
          >
            <MousePointer2 :size="15" />
          </button>
          <button
            type="button"
            class="tool-btn"
            :class="{ active: builderTool === 'connect' }"
            title="Connect"
            aria-label="Connect"
            @click="builderTool = 'connect'"
          >
            <Link2 :size="15" />
          </button>
        </div>
      </template>

      <template v-if="showZoomTools">
        <div class="tool-divider" />

        <div class="tool-group" aria-label="Zoom">
          <button type="button" class="tool-btn" title="Zoom out" @click="zoomOut">
            <Minus :size="14" />
          </button>
          <span class="zoom-readout">{{ zoomLabel }}%</span>
          <button type="button" class="tool-btn" title="Zoom in" @click="zoomIn">
            <Plus :size="14" />
          </button>
          <button type="button" class="tool-btn" title="Fit view" @click="fitView">
            <Maximize2 :size="14" />
          </button>
        </div>

        <div class="tool-divider" />

        <div class="tool-group">
          <button
            type="button"
            class="tool-btn"
            :class="{ active: panTool }"
            title="Pan"
            @click="panTool = !panTool"
          >
            <Hand :size="14" />
          </button>
        </div>
      </template>

      <div class="tool-divider" />

      <div class="tool-group">
        <button
          type="button"
          class="tool-btn"
          :title="copied ? 'Copied' : 'Copy Mermaid'"
          @click="copySource"
        >
          <Check v-if="copied" :size="14" />
          <Copy v-else :size="14" />
        </button>
      </div>
    </div>

    <ArchBuilder
      v-if="mode === 'builder'"
      ref="builderRef"
      :source="localSource"
      :tool="builderTool"
      @update:source="onBuilderSource"
    />

    <MermaidPreview
      v-else-if="mode === 'preview'"
      ref="previewRef"
      :source="debouncedSource"
      :pan-enabled="panTool"
      @error="previewError = $event"
      @viewport="onViewport"
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
</template>

<style scoped>
.arch-view {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #1C1C2A;
}

.arch-toolbar {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  border-radius: 12px;
  background-color: #0A0D18;
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.28);
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.tool-divider {
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 1px;
}

.tool-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted-dark);
  cursor: pointer;
  transition: background 140ms ease-out, color 140ms ease-out, transform 120ms ease-out;
}

.tool-btn:hover {
  color: var(--text-main);
  background: rgba(255, 255, 255, 0.06);
}

.tool-btn:active {
  transform: scale(0.96);
}

.tool-btn.active {
  color: var(--text-main);
  background: rgba(255, 255, 255, 0.08);
}

.kind-btn .kind-icon {
  color: var(--kind);
}

.kind-btn:hover {
  background: color-mix(in srgb, var(--kind) 14%, transparent);
}

.zoom-readout {
  min-width: 40px;
  text-align: center;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  font-family: var(--font-code);
  color: var(--text-muted-dark);
  user-select: none;
}

.code-pane {
  position: relative;
  width: 100%;
  height: 100%;
  padding-bottom: var(--bottom-bar-clearance);
  background: #1C1C2A;
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
  background-color: #1C1C2A !important;
}
</style>
