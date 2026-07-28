<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from 'vue'
import type { ArchEdge, ArchModel, ArchNode, ArchNodeKind } from './types'
import { KIND_DEFAULT_LABEL, KIND_COLORS, PALETTE_ITEMS } from './types'
import {
  mermaidToModel,
  modelToMermaid,
  newEdgeId,
  newNodeId,
} from './mermaidCodec'
import BuilderNodeCard from './BuilderNodeCard.vue'

const props = defineProps<{
  /** Current Mermaid source (synced from parent) */
  source: string
}>()

const emit = defineEmits<{
  (e: 'update:source', value: string): void
}>()

const model = ref<ArchModel>({ nodes: [], edges: [] })
const selectedIds = ref<string[]>([])
const connectSourceId = ref<string | null>(null)
const tool = ref<'select' | 'connect'>('select')
const canvasRef = ref<HTMLElement | null>(null)
const editingId = ref<string | null>(null)
const editLabel = ref('')
const editTech = ref('')

let dragState: {
  id: string
  startX: number
  startY: number
  originX: number
  originY: number
} | null = null

let suppressEmit = false
let emitTimer: ReturnType<typeof setTimeout> | null = null

const selectedId = computed(() =>
  selectedIds.value.length === 1 ? selectedIds.value[0] : null,
)

const selectedNode = computed(() =>
  model.value.nodes.find((n) => n.id === selectedId.value) ?? null,
)

// SVG edges between node centers
const edgePaths = computed(() => {
  const NODE_W = 168
  const NODE_H = 72
  return model.value.edges
    .map((e) => {
      const s = model.value.nodes.find((n) => n.id === e.source)
      const t = model.value.nodes.find((n) => n.id === e.target)
      if (!s || !t) return null
      const x1 = s.x + NODE_W / 2
      const y1 = s.y + NODE_H / 2
      const x2 = t.x + NODE_W / 2
      const y2 = t.y + NODE_H / 2
      // Simple curved path
      const mx = (x1 + x2) / 2
      const my = (y1 + y2) / 2 - 24
      return {
        id: e.id,
        d: `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`,
        label: e.label,
        lx: mx,
        ly: my,
      }
    })
    .filter(Boolean) as Array<{
    id: string
    d: string
    label?: string
    lx: number
    ly: number
  }>
})

function loadFromSource(src: string) {
  suppressEmit = true
  try {
    model.value = mermaidToModel(src)
    selectedIds.value = []
    connectSourceId.value = null
  } finally {
    nextTick(() => {
      suppressEmit = false
    })
  }
}

function scheduleEmit() {
  if (suppressEmit) return
  if (emitTimer) clearTimeout(emitTimer)
  emitTimer = setTimeout(() => {
    emit('update:source', modelToMermaid(model.value))
  }, 120)
}

watch(
  () => props.source,
  (src, prev) => {
    // Only re-parse when parent source changed externally (not our own emit)
    if (src === prev) return
    const compiled = modelToMermaid(model.value)
    if (src.trim() === compiled.trim()) return
    loadFromSource(src)
  },
  { immediate: true },
)

watch(model, () => scheduleEmit(), { deep: true })

// ── Palette drop ─────────────────────────────────────────────────────────────
function onPaletteDragStart(e: DragEvent, kind: ArchNodeKind) {
  if (!e.dataTransfer) return
  e.dataTransfer.setData('application/kraken-arch-kind', kind)
  e.dataTransfer.effectAllowed = 'copy'
}

function onCanvasDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}

function onCanvasDrop(e: DragEvent) {
  e.preventDefault()
  const kind = e.dataTransfer?.getData('application/kraken-arch-kind') as ArchNodeKind
  if (!kind || !canvasRef.value) return
  const rect = canvasRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left + canvasRef.value.scrollLeft - 84
  const y = e.clientY - rect.top + canvasRef.value.scrollTop - 32
  addNode(kind, Math.max(16, x), Math.max(16, y))
}

function addNode(kind: ArchNodeKind, x: number, y: number) {
  const node: ArchNode = {
    id: newNodeId(kind),
    kind,
    label: KIND_DEFAULT_LABEL[kind],
    x,
    y,
  }
  model.value.nodes.push(node)
  selectedIds.value = [node.id]
  editingId.value = node.id
  editLabel.value = node.label
  editTech.value = ''
}

// ── Select / connect ─────────────────────────────────────────────────────────
function selectNode(id: string, additive: boolean) {
  if (tool.value === 'connect') {
    if (!connectSourceId.value) {
      connectSourceId.value = id
      selectedIds.value = [id]
      return
    }
    if (connectSourceId.value === id) {
      connectSourceId.value = null
      return
    }
    // Create edge if missing
    const exists = model.value.edges.some(
      (e) => e.source === connectSourceId.value && e.target === id,
    )
    if (!exists && connectSourceId.value) {
      const edge: ArchEdge = {
        id: newEdgeId(connectSourceId.value, id),
        source: connectSourceId.value,
        target: id,
      }
      model.value.edges.push(edge)
    }
    connectSourceId.value = null
    selectedIds.value = [id]
    return
  }

  if (additive) {
    if (selectedIds.value.includes(id)) {
      selectedIds.value = selectedIds.value.filter((x) => x !== id)
    } else {
      selectedIds.value = [...selectedIds.value, id]
    }
  } else {
    selectedIds.value = [id]
  }
}

function clearSelection() {
  selectedIds.value = []
  connectSourceId.value = null
  editingId.value = null
}

// ── Drag nodes ───────────────────────────────────────────────────────────────
function onNodePointerDown(id: string, e: PointerEvent) {
  if (e.button !== 0) return
  if (tool.value === 'connect') return

  const node = model.value.nodes.find((n) => n.id === id)
  if (!node) return

  if (!selectedIds.value.includes(id)) {
    selectedIds.value = [id]
  }

  dragState = {
    id,
    startX: e.clientX,
    startY: e.clientY,
    originX: node.x,
    originY: node.y,
  }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onCanvasPointerMove(e: PointerEvent) {
  if (!dragState) return
  const node = model.value.nodes.find((n) => n.id === dragState!.id)
  if (!node) return
  const dx = e.clientX - dragState.startX
  const dy = e.clientY - dragState.startY
  node.x = Math.max(8, dragState.originX + dx)
  node.y = Math.max(8, dragState.originY + dy)
}

function onCanvasPointerUp() {
  dragState = null
}

// ── Edit ─────────────────────────────────────────────────────────────────────
function startEdit(id: string) {
  const node = model.value.nodes.find((n) => n.id === id)
  if (!node) return
  editingId.value = id
  editLabel.value = node.label
  editTech.value = node.tech ?? ''
  tool.value = 'select'
}

function applyEdit() {
  if (!editingId.value) return
  const node = model.value.nodes.find((n) => n.id === editingId.value)
  if (node) {
    node.label = editLabel.value.trim() || KIND_DEFAULT_LABEL[node.kind]
    node.tech = editTech.value.trim() || undefined
  }
  editingId.value = null
}

function cancelEdit() {
  editingId.value = null
}

// ── Delete ───────────────────────────────────────────────────────────────────
function deleteSelection() {
  if (editingId.value) return
  const ids = new Set(selectedIds.value)
  if (!ids.size) return
  model.value.nodes = model.value.nodes.filter((n) => !ids.has(n.id))
  model.value.edges = model.value.edges.filter(
    (e) => !ids.has(e.source) && !ids.has(e.target),
  )
  selectedIds.value = []
  connectSourceId.value = null
}

function onKeyDown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
    if (e.key === 'Enter' && editingId.value) {
      e.preventDefault()
      applyEdit()
    }
    if (e.key === 'Escape' && editingId.value) cancelEdit()
    return
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    deleteSelection()
  }
  if (e.key === 'Escape') {
    clearSelection()
    tool.value = 'select'
  }
  if (e.key === 'c' && !e.metaKey && !e.ctrlKey) {
    tool.value = tool.value === 'connect' ? 'select' : 'connect'
    connectSourceId.value = null
  }
}

onMounted(() => document.addEventListener('keydown', onKeyDown))
onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  if (emitTimer) clearTimeout(emitTimer)
})
</script>

<template>
  <div class="arch-builder">
    <!-- Left palette -->
    <aside class="palette no-drag">
      <div class="palette-title">Elements</div>
      <p class="palette-hint">Drag onto canvas</p>
      <div
        v-for="item in PALETTE_ITEMS"
        :key="item.kind"
        class="palette-item"
        draggable="true"
        :style="{ '--accent': KIND_COLORS[item.kind] }"
        @dragstart="onPaletteDragStart($event, item.kind)"
      >
        <span class="palette-dot" />
        <div class="palette-meta">
          <span class="palette-label">{{ item.label }}</span>
          <span class="palette-desc">{{ item.description }}</span>
        </div>
      </div>

      <div class="palette-footer">
        <div class="tool-row">
          <button
            type="button"
            class="mini-btn"
            :class="{ active: tool === 'select' }"
            @click="tool = 'select'; connectSourceId = null"
          >
            Move
          </button>
          <button
            type="button"
            class="mini-btn"
            :class="{ active: tool === 'connect' }"
            @click="tool = 'connect'; connectSourceId = null"
          >
            Connect
          </button>
        </div>
        <p class="shortcut-hint">
          <kbd>C</kbd> connect · <kbd>Del</kbd> delete · dbl-click edit
        </p>
      </div>
    </aside>

    <!-- Canvas -->
    <div
      ref="canvasRef"
      class="builder-canvas"
      :class="{ connecting: tool === 'connect' }"
      @dragover="onCanvasDragOver"
      @drop="onCanvasDrop"
      @pointermove="onCanvasPointerMove"
      @pointerup="onCanvasPointerUp"
      @pointerleave="onCanvasPointerUp"
      @click.self="clearSelection"
    >
      <svg class="edge-layer" aria-hidden="true">
        <defs>
          <marker
            id="arch-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#8B90C4" />
          </marker>
        </defs>
        <path
          v-for="edge in edgePaths"
          :key="edge.id"
          :d="edge.d"
          class="edge-path"
          marker-end="url(#arch-arrow)"
        />
      </svg>

      <BuilderNodeCard
        v-for="node in model.nodes"
        :key="node.id"
        :node="node"
        :selected="selectedIds.includes(node.id)"
        :connect-from="connectSourceId === node.id"
        @select="selectNode"
        @pointerdown="onNodePointerDown"
        @dblclick="startEdit"
      />

      <div v-if="model.nodes.length === 0" class="empty-canvas">
        Drag a service, database, or queue from the left
      </div>
    </div>

    <!-- Inline edit popover -->
    <div v-if="editingId && selectedNode" class="edit-popover no-drag" @keydown.stop>
      <label class="field">
        <span>Label</span>
        <input v-model="editLabel" type="text" autofocus @keydown.enter="applyEdit" />
      </label>
      <label class="field">
        <span>Tech</span>
        <input v-model="editTech" type="text" placeholder="optional" @keydown.enter="applyEdit" />
      </label>
      <div class="edit-actions">
        <button type="button" class="mini-btn" @click="cancelEdit">Cancel</button>
        <button type="button" class="mini-btn primary" @click="applyEdit">Apply</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.arch-builder {
  position: relative;
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #1C1C2A;
}

.palette {
  width: 180px;
  flex: 0 0 180px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 56px 10px 16px;
  background: #0A0D18;
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  overflow-y: auto;
  z-index: 5;
}

.palette-title {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.35);
  padding: 0 4px;
  margin: 0;
}

.palette-hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.25);
  margin: 0 0 6px;
  padding: 0 4px;
}

.palette-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
  cursor: grab;
  transition: border-color 140ms ease-out, background 140ms ease-out, transform 120ms ease-out;
}

.palette-item:hover {
  border-color: color-mix(in srgb, var(--accent) 50%, transparent);
  background: rgba(255, 255, 255, 0.04);
}

.palette-item:active {
  cursor: grabbing;
  transform: scale(0.98);
}

.palette-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
  flex-shrink: 0;
}

.palette-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.palette-label {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
}

.palette-desc {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.palette-footer {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tool-row {
  display: flex;
  gap: 4px;
}

.mini-btn {
  flex: 1;
  height: 32px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.45);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: background 140ms ease-out, color 140ms ease-out, transform 120ms ease-out;
}

.mini-btn:hover {
  color: #E2E8F0;
  background: rgba(255, 255, 255, 0.05);
}

.mini-btn:active {
  transform: scale(0.96);
}

.mini-btn.active {
  color: #E2E8F0;
  background: rgba(255, 255, 255, 0.08);
}

.mini-btn.primary {
  background: rgba(147, 116, 190, 0.2);
  border-color: rgba(147, 116, 190, 0.35);
  color: #c4b0e8;
}

.shortcut-hint {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.28);
  margin: 0;
  line-height: 1.5;
}

.shortcut-hint kbd {
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  font-family: inherit;
}

.builder-canvas {
  position: relative;
  flex: 1;
  min-width: 0;
  overflow: auto;
  background-color: #1C1C2A;
  background-image: radial-gradient(rgba(255, 255, 255, 0.09) 1.2px, transparent 1.2px);
  background-size: 22px 22px;
  padding-bottom: var(--bottom-bar-clearance);
  /* Room for floating top toolbar */
  padding-top: 4px;
}

.builder-canvas.connecting {
  cursor: crosshair;
}

.edge-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
  z-index: 1;
}

.edge-path {
  fill: none;
  stroke: #8B90C4;
  stroke-width: 1.75;
}

.empty-canvas {
  position: absolute;
  left: 50%;
  top: 45%;
  transform: translate(-50%, -50%);
  color: rgba(255, 255, 255, 0.3);
  font-size: 13px;
  text-align: center;
  pointer-events: none;
  max-width: 260px;
  line-height: 1.5;
}

.edit-popover {
  position: absolute;
  top: 64px;
  right: 16px;
  width: 220px;
  padding: 12px;
  border-radius: 12px;
  background: #0A0D18;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 30;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field span {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.35);
}

.field input {
  height: 34px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: #1C1C2A;
  color: #E2E8F0;
  font-size: 13px;
  outline: none;
}

.field input:focus {
  border-color: rgba(147, 116, 190, 0.45);
}

.edit-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}
</style>
