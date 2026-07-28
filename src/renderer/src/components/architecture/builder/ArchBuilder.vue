<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from 'vue'
import type { ArchModel, ArchNode, ArchNodeKind } from './types'
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
  tool?: 'select' | 'connect'
}>()

const emit = defineEmits<{
  (e: 'update:source', value: string): void
  (e: 'viewport', payload: { zoom: number }): void
}>()

const model = ref<ArchModel>({ nodes: [], edges: [] })
const selectedIds = ref<string[]>([])
const selectedEdgeId = ref<string | null>(null)
const connectSourceId = ref<string | null>(null)
const stageRef = ref<HTMLElement | null>(null)
const editingId = ref<string | null>(null)

/** Viewport */
const zoom = ref(1)
const pan = ref({ x: 0, y: 0 })
const isPanning = ref(false)
const zoomPercent = computed(() => Math.round(zoom.value * 100))

const activeTool = computed(() => props.tool ?? 'select')

let nodeDrag: {
  id: string
  startX: number
  startY: number
  originX: number
  originY: number
} | null = null

let panDrag: {
  startX: number
  startY: number
  originX: number
  originY: number
} | null = null

let suppressEmit = false
let emitTimer: ReturnType<typeof setTimeout> | null = null
let spaceHeld = false
/** Last Mermaid we pushed up — ignore when it echoes back so we never re-parse/re-layout */
let lastEmittedSource = ''

function normalizeSource(s: string): string {
  return s.replace(/\r\n/g, '\n').trim()
}

const edgePaths = computed(() => {
  return model.value.edges
    .map((e) => {
      const s = model.value.nodes.find((n) => n.id === e.source)
      const t = model.value.nodes.find((n) => n.id === e.target)
      if (!s || !t) return null
      const { d, mx, my } = edgePath(s, t)
      return { id: e.id, d, label: e.label, lx: mx, ly: my }
    })
    .filter(Boolean) as Array<{
    id: string
    d: string
    label?: string
    lx: number
    ly: number
  }>
})

const worldStyle = computed(() => ({
  transform: `translate(${pan.value.x}px, ${pan.value.y}px) scale(${zoom.value})`,
}))

function emitViewport() {
  emit('viewport', { zoom: zoom.value })
}

function zoomBy(delta: number) {
  zoom.value = Math.min(2.5, Math.max(0.35, Number((zoom.value + delta).toFixed(2))))
  emitViewport()
}

function setZoom(next: number) {
  zoom.value = Math.min(2.5, Math.max(0.35, Number(next.toFixed(2))))
  emitViewport()
}

/** Bounding box of all nodes in world space */
function contentBounds() {
  const nodes = model.value.nodes
  if (!nodes.length) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of nodes) {
    minX = Math.min(minX, n.x)
    minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x + NODE_W)
    maxY = Math.max(maxY, n.y + NODE_H)
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  }
}

/**
 * Fit & center the graph in the visible stage.
 * Auto-layout alone packs to the left of world space; this pans so content sits in the middle.
 */
function fitView() {
  const el = stageRef.value
  const bounds = contentBounds()
  if (!el || !bounds) {
    zoom.value = 1
    pan.value = { x: 0, y: 0 }
    emitViewport()
    return
  }

  const vw = el.clientWidth
  const vh = el.clientHeight
  // Leave room for floating toolbar (top) and app bottom bar
  const padX = 64
  const padY = 88
  const availW = Math.max(120, vw - padX * 2)
  const availH = Math.max(120, vh - padY * 2)

  const scaleX = availW / Math.max(bounds.width, 1)
  const scaleY = availH / Math.max(bounds.height, 1)
  // Prefer 1:1 when it fits; only shrink if needed
  const nextZoom = Math.min(1, scaleX, scaleY, 2.5)
  const z = Math.max(0.35, Number(nextZoom.toFixed(3)))

  // Center content in viewport: pan = viewCenter - worldCenter * zoom
  pan.value = {
    x: vw / 2 - bounds.cx * z,
    y: vh / 2 - bounds.cy * z + 8, // slight optical bias below toolbar
  }
  zoom.value = z
  emitViewport()
}

function screenToWorld(clientX: number, clientY: number) {
  const el = stageRef.value
  if (!el) return { x: 0, y: 0 }
  const rect = el.getBoundingClientRect()
  return {
    x: (clientX - rect.left - pan.value.x) / zoom.value,
    y: (clientY - rect.top - pan.value.y) / zoom.value,
  }
}

function autoLayout() {
  model.value = layoutHierarchical(model.value)
  nextTick(() => fitView())
}

function loadFromSource(src: string) {
  suppressEmit = true
  try {
    model.value = mermaidToModel(src)
    // Sync echo-guard to post-parse compile so we don't bounce
    lastEmittedSource = modelToMermaid(model.value)
    selectedIds.value = []
    selectedEdgeId.value = null
    connectSourceId.value = null
    editingId.value = null
    nextTick(() => fitView())
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
    const mermaid = modelToMermaid(model.value)
    lastEmittedSource = mermaid
    emit('update:source', mermaid)
  }, 120)
}

watch(
  () => props.source,
  (src, prev) => {
    if (src === prev) return
    // Our own edit/drag emit coming back — keep positions, do NOT re-layout
    if (normalizeSource(src) === normalizeSource(lastEmittedSource)) return
    if (normalizeSource(src) === normalizeSource(modelToMermaid(model.value))) {
      lastEmittedSource = src
      return
    }
    // External change (project switch, agent, code mode edit)
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

function addNode(kind: ArchNodeKind, x?: number, y?: number) {
  let px = x
  let py = y
  if (px == null || py == null) {
    const maxY = model.value.nodes.reduce((m, n) => Math.max(m, n.y), 40)
    const bottom = model.value.nodes.filter((n) => n.y >= maxY - 10)
    px = 56 + bottom.length * (NODE_W + 48)
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
  // Never auto-layout on add — only the layout button rearranges
  selectedIds.value = [node.id]
  nextTick(() => {
    editingId.value = node.id
  })
}

function onCanvasDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}

function onCanvasDrop(e: DragEvent) {
  e.preventDefault()
  const kind = e.dataTransfer?.getData('application/kraken-arch-kind') as ArchNodeKind
  if (!kind) return
  const world = screenToWorld(e.clientX, e.clientY)
  addNode(kind, world.x - NODE_W / 2, world.y - NODE_H / 2)
}

function selectNode(id: string, additive: boolean) {
  selectedEdgeId.value = null
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
      model.value.edges.push({
        id: newEdgeId(connectSourceId.value, id),
        source: connectSourceId.value,
        target: id,
      })
      // Keep user's positions — layout is manual via toolbar only
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

function selectEdge(id: string) {
  if (editingId.value) return
  selectedIds.value = []
  connectSourceId.value = null
  selectedEdgeId.value = id
}

function clearSelection() {
  if (editingId.value) return
  selectedIds.value = []
  selectedEdgeId.value = null
  connectSourceId.value = null
}

function onNodePointerDown(id: string, e: PointerEvent) {
  if (e.button !== 0) return
  if (activeTool.value === 'connect') return
  if (spaceHeld) return
  if (editingId.value === id) return

  const node = model.value.nodes.find((n) => n.id === id)
  if (!node) return

  e.preventDefault()
  e.stopPropagation()

  selectedEdgeId.value = null
  if (!selectedIds.value.includes(id)) selectedIds.value = [id]

  nodeDrag = {
    id,
    startX: e.clientX,
    startY: e.clientY,
    originX: node.x,
    originY: node.y,
  }

  // Capture on the stage so move/up always arrive (not lost to SVG/labels)
  try {
    stageRef.value?.setPointerCapture(e.pointerId)
  } catch {
    /* noop */
  }
}

function onStagePointerDown(e: PointerEvent) {
  // Don't pan if a node drag just started
  if (nodeDrag) return

  const target = e.target as HTMLElement | null
  // Ignore node cards and edge hits
  if (target?.closest?.('.builder-node')) return
  if (target?.classList?.contains('edge-hit') || target?.classList?.contains('edge-path')) return

  const onEmpty =
    target === stageRef.value ||
    target?.classList?.contains('world') ||
    target?.classList?.contains('builder-stage')

  const wantPan =
    e.button === 1 ||
    spaceHeld ||
    (e.button === 0 && onEmpty && activeTool.value !== 'connect')

  if (!wantPan) return
  e.preventDefault()
  isPanning.value = true
  panDrag = {
    startX: e.clientX,
    startY: e.clientY,
    originX: pan.value.x,
    originY: pan.value.y,
  }
  try {
    stageRef.value?.setPointerCapture(e.pointerId)
  } catch {
    /* noop */
  }
}

function onStagePointerMove(e: PointerEvent) {
  if (panDrag) {
    pan.value = {
      x: panDrag.originX + (e.clientX - panDrag.startX),
      y: panDrag.originY + (e.clientY - panDrag.startY),
    }
    return
  }
  if (!nodeDrag) return
  const node = model.value.nodes.find((n) => n.id === nodeDrag!.id)
  if (!node) return
  const dx = (e.clientX - nodeDrag.startX) / zoom.value
  const dy = (e.clientY - nodeDrag.startY) / zoom.value
  node.x = Math.max(8, nodeDrag.originX + dx)
  node.y = Math.max(8, nodeDrag.originY + dy)
}

function onStagePointerUp(e: PointerEvent) {
  if (panDrag) {
    panDrag = null
    isPanning.value = false
    emitViewport()
  }
  nodeDrag = null
  try {
    if (stageRef.value?.hasPointerCapture(e.pointerId)) {
      stageRef.value.releasePointerCapture(e.pointerId)
    }
  } catch {
    /* noop */
  }
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  if (e.ctrlKey || e.metaKey) {
    const delta = e.deltaY > 0 ? -0.08 : 0.08
    // Zoom toward cursor
    const el = stageRef.value
    if (el) {
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const prev = zoom.value
      const next = Math.min(2.5, Math.max(0.35, Number((prev + delta).toFixed(2))))
      const ratio = next / prev
      pan.value = {
        x: cx - (cx - pan.value.x) * ratio,
        y: cy - (cy - pan.value.y) * ratio,
      }
      zoom.value = next
      emitViewport()
    } else {
      zoomBy(delta)
    }
    return
  }
  // Trackpad / scroll → pan
  pan.value = {
    x: pan.value.x - e.deltaX,
    y: pan.value.y - e.deltaY,
  }
  emitViewport()
}

function startEdit(id: string) {
  const node = model.value.nodes.find((n) => n.id === id)
  if (!node) return
  selectedIds.value = [id]
  editingId.value = id
}

function commitEdit(id: string, label: string, tech?: string) {
  const node = model.value.nodes.find((n) => n.id === id)
  if (node) {
    // Label/tech only — never touch x/y or run layout
    if (node.label !== label) node.label = label
    if (node.tech !== tech) node.tech = tech
  }
  if (editingId.value === id) editingId.value = null
}

function cancelEdit() {
  editingId.value = null
}

function deleteSelection() {
  if (editingId.value) return
  // Delete selected connection first
  if (selectedEdgeId.value) {
    model.value.edges = model.value.edges.filter((e) => e.id !== selectedEdgeId.value)
    selectedEdgeId.value = null
    return
  }
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
  if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
    spaceHeld = true
  }
  if (
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLTextAreaElement ||
    (e.target as HTMLElement)?.isContentEditable
  ) {
    return
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    deleteSelection()
  }
  if (e.key === 'Escape') {
    if (editingId.value) cancelEdit()
    else clearSelection()
  }
  if (e.key === 'Enter' || e.key === 'F2') {
    const id = selectedIds.value[0]
    if (id && !editingId.value) {
      e.preventDefault()
      startEdit(id)
    }
  }
  if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
    e.preventDefault()
    zoomBy(0.1)
  }
  if ((e.metaKey || e.ctrlKey) && (e.key === '-' || e.key === '_')) {
    e.preventDefault()
    zoomBy(-0.1)
  }
  if ((e.metaKey || e.ctrlKey) && e.key === '0') {
    e.preventDefault()
    fitView()
  }
}

function onKeyUp(e: KeyboardEvent) {
  if (e.code === 'Space') spaceHeld = false
}

onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup', onKeyUp)
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('keyup', onKeyUp)
  if (emitTimer) clearTimeout(emitTimer)
})

defineExpose({
  addNode,
  autoLayout,
  zoomBy,
  setZoom,
  fitView,
  zoom,
  zoomPercent,
})
</script>

<template>
  <div class="arch-builder">
    <div
      ref="stageRef"
      class="builder-stage"
      :class="{
        connecting: activeTool === 'connect',
        panning: isPanning || spaceHeld,
      }"
      @wheel="onWheel"
      @pointerdown="onStagePointerDown"
      @pointermove="onStagePointerMove"
      @pointerup="onStagePointerUp"
      @pointercancel="onStagePointerUp"
      @dragover="onCanvasDragOver"
      @drop="onCanvasDrop"
      @click.self="clearSelection"
      @dblclick.self="fitView"
    >
      <div class="world" :style="worldStyle" @click.self="clearSelection">
        <svg class="edge-layer">
          <defs>
            <marker
              id="arch-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#8B90C4" />
            </marker>
            <marker
              id="arch-arrow-selected"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#c4b0e8" />
            </marker>
          </defs>
          <g v-for="edge in edgePaths" :key="edge.id">
            <!-- Wide invisible hit target -->
            <path
              :d="edge.d"
              class="edge-hit"
              @pointerdown.stop
              @click.stop="selectEdge(edge.id)"
            />
            <path
              :d="edge.d"
              class="edge-path"
              :class="{ selected: selectedEdgeId === edge.id }"
              :marker-end="selectedEdgeId === edge.id ? 'url(#arch-arrow-selected)' : 'url(#arch-arrow)'"
              @pointerdown.stop
              @click.stop="selectEdge(edge.id)"
            />
          </g>
        </svg>

        <BuilderNodeCard
          v-for="node in model.nodes"
          :key="node.id"
          :node="node"
          :selected="selectedIds.includes(node.id)"
          :connect-from="connectSourceId === node.id"
          :editing="editingId === node.id"
          @select="selectNode"
          @pointerdown="(id, ev) => onNodePointerDown(id, ev)"
          @start-edit="startEdit"
          @commit-edit="commitEdit"
          @cancel-edit="cancelEdit"
        />

        <div v-if="model.nodes.length === 0" class="empty-canvas">
          Click a type in the top bar to add a node · double-click to edit
        </div>
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

.builder-stage {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #1C1C2A;
  background-image: radial-gradient(rgba(255, 255, 255, 0.09) 1.2px, transparent 1.2px);
  background-size: 22px 22px;
  touch-action: none;
  cursor: default;
}

.builder-stage.connecting {
  cursor: crosshair;
}

.builder-stage.panning {
  cursor: grab;
}

.builder-stage.panning:active {
  cursor: grabbing;
}

.world {
  position: absolute;
  inset: 0;
  transform-origin: 0 0;
  will-change: transform;
}

.edge-layer {
  position: absolute;
  left: 0;
  top: 0;
  width: 4000px;
  height: 4000px;
  overflow: visible;
  z-index: 1;
  pointer-events: none;
}

.edge-hit {
  fill: none;
  stroke: transparent;
  stroke-width: 14;
  pointer-events: stroke;
  cursor: pointer;
}

.edge-path {
  fill: none;
  stroke: #8B90C4;
  stroke-width: 1.75;
  pointer-events: stroke;
  cursor: pointer;
  transition: stroke 140ms ease-out, stroke-width 140ms ease-out;
}

.edge-path.selected {
  stroke: #c4b0e8;
  stroke-width: 2.5;
  filter: drop-shadow(0 0 4px rgba(147, 116, 190, 0.55));
}

.edge-path:hover:not(.selected) {
  stroke: #a8add4;
  stroke-width: 2.1;
}

.empty-canvas {
  position: absolute;
  left: 50%;
  top: 40%;
  transform: translate(-50%, -50%);
  color: rgba(255, 255, 255, 0.3);
  font-size: 13px;
  text-align: center;
  pointer-events: none;
  max-width: 280px;
  line-height: 1.5;
}
</style>
