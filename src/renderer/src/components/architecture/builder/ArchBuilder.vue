<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from 'vue'
import type { ArchEdge, ArchModel, ArchNode, ArchNodeKind } from './types'
import { KIND_DEFAULT_LABEL } from './types'
import {
  mermaidToModel,
  modelToMermaid,
  newEdgeId,
  newNodeId,
} from './mermaidCodec'
import { edgePath, layoutHierarchical, NODE_H, NODE_W } from './layout'
import BuilderNodeCard from './BuilderNodeCard.vue'

const props = defineProps<{
  source: string
  /** select = drag/move, connect = link two nodes */
  tool?: 'select' | 'connect'
}>()

const emit = defineEmits<{
  (e: 'update:source', value: string): void
}>()

const model = ref<ArchModel>({ nodes: [], edges: [] })
const selectedIds = ref<string[]>([])
const connectSourceId = ref<string | null>(null)
const canvasRef = ref<HTMLElement | null>(null)
const editingId = ref<string | null>(null)
const editLabel = ref('')
const editTech = ref('')

const activeTool = computed(() => props.tool ?? 'select')

let dragState: {
  id: string
  startX: number
  startY: number
  originX: number
  originY: number
} | null = null

let suppressEmit = false
let emitTimer: ReturnType<typeof setTimeout> | null = null

const selectedNode = computed(() => {
  if (selectedIds.value.length !== 1) return null
  return model.value.nodes.find((n) => n.id === selectedIds.value[0]) ?? null
})

const edgePaths = computed(() => {
  return model.value.edges
    .map((e) => {
      const s = model.value.nodes.find((n) => n.id === e.source)
      const t = model.value.nodes.find((n) => n.id === e.target)
      if (!s || !t) return null
      const { d, mx, my } = edgePath(s, t)
      return {
        id: e.id,
        d,
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

/** Re-run hierarchy layout (toolbar can call via expose) */
function autoLayout() {
  model.value = layoutHierarchical(model.value)
}

function loadFromSource(src: string) {
  suppressEmit = true
  try {
    model.value = mermaidToModel(src) // includes hierarchical layout
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
    if (src === prev) return
    const compiled = modelToMermaid(model.value)
    if (src.trim() === compiled.trim()) return
    loadFromSource(src)
  },
  { immediate: true },
)

watch(
  () => props.tool,
  () => {
    connectSourceId.value = null
  },
)

watch(model, () => scheduleEmit(), { deep: true })

/** Place a new node — append at bottom rank center, then optional manual drag */
function addNode(kind: ArchNodeKind, x?: number, y?: number) {
  let px = x
  let py = y
  if (px == null || py == null) {
    const maxY = model.value.nodes.reduce((m, n) => Math.max(m, n.y), 40)
    const bottom = model.value.nodes.filter((n) => n.y >= maxY - 10)
    const count = bottom.length
    px = 56 + count * (NODE_W + 48)
    py = model.value.nodes.length === 0 ? 72 : maxY + NODE_H + 72
  }
  const node: ArchNode = {
    id: newNodeId(kind),
    kind,
    label: KIND_DEFAULT_LABEL[kind],
    x: Math.max(16, px),
    y: Math.max(16, py),
  }
  model.value.nodes.push(node)
  // Keep hierarchy tidy after each add when graph has edges
  if (model.value.edges.length > 0) {
    model.value = layoutHierarchical(model.value)
    const placed = model.value.nodes.find((n) => n.id === node.id)
    if (placed) {
      selectedIds.value = [placed.id]
    }
  } else {
    selectedIds.value = [node.id]
  }
  editingId.value = node.id
  editLabel.value = node.label
  editTech.value = ''
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

function selectNode(id: string, additive: boolean) {
  if (activeTool.value === 'connect') {
    if (!connectSourceId.value) {
      connectSourceId.value = id
      selectedIds.value = [id]
      return
    }
    if (connectSourceId.value === id) {
      connectSourceId.value = null
      return
    }
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
      // Re-flow hierarchy so the new link reads top-down
      model.value = layoutHierarchical(model.value)
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

function onNodePointerDown(id: string, e: PointerEvent) {
  if (e.button !== 0) return
  if (activeTool.value === 'connect') return

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

function startEdit(id: string) {
  const node = model.value.nodes.find((n) => n.id === id)
  if (!node) return
  editingId.value = id
  editLabel.value = node.label
  editTech.value = node.tech ?? ''
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
  }
}

onMounted(() => document.addEventListener('keydown', onKeyDown))
onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  if (emitTimer) clearTimeout(emitTimer)
})

defineExpose({ addNode, autoLayout })
</script>

<template>
  <div class="arch-builder">
    <div
      ref="canvasRef"
      class="builder-canvas"
      :class="{ connecting: activeTool === 'connect' }"
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
        Click a type in the top bar to add a node
      </div>
    </div>

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
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #1C1C2A;
}

.builder-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: auto;
  background-color: #1C1C2A;
  background-image: radial-gradient(rgba(255, 255, 255, 0.09) 1.2px, transparent 1.2px);
  background-size: 22px 22px;
  padding-bottom: var(--bottom-bar-clearance);
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
  max-width: 280px;
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

.mini-btn {
  height: 32px;
  padding: 0 12px;
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

.mini-btn.primary {
  background: rgba(147, 116, 190, 0.2);
  border-color: rgba(147, 116, 190, 0.35);
  color: #c4b0e8;
}
</style>
