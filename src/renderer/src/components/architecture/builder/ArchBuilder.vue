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
const connectSourceId = ref<string | null>(null)
const stageRef = ref<HTMLElement | null>(null)
const editingId = ref<string | null>(null)
const editLabel = ref('')
const editTech = ref('')

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

function fitView() {
  zoom.value = 1
  pan.value = { x: 0, y: 0 }
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
    selectedIds.value = []
    connectSourceId.value = null
    fitView()
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
  if (model.value.edges.length > 0) {
    model.value = layoutHierarchical(model.value)
  }
  selectedIds.value = [node.id]
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
  if (!kind) return
  const world = screenToWorld(e.clientX, e.clientY)
  addNode(kind, world.x - NODE_W / 2, world.y - NODE_H / 2)
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
      model.value.edges.push({
        id: newEdgeId(connectSourceId.value, id),
        source: connectSourceId.value,
        target: id,
      })
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
  if (spaceHeld) return

  const node = model.value.nodes.find((n) => n.id === id)
  if (!node) return
  if (!selectedIds.value.includes(id)) selectedIds.value = [id]

  nodeDrag = {
    id,
    startX: e.clientX,
    startY: e.clientY,
    originX: node.x,
    originY: node.y,
  }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onStagePointerDown(e: PointerEvent) {
  // Middle mouse, space+drag, or empty-stage drag → pan
  const onEmpty = e.target === stageRef.value || (e.target as HTMLElement).classList?.contains('world')
  const wantPan =
    e.button === 1 ||
    spaceHeld ||
    (e.button === 0 && onEmpty && !nodeDrag && activeTool.value !== 'connect')

  if (!wantPan) return
  e.preventDefault()
  isPanning.value = true
  panDrag = {
    startX: e.clientX,
    startY: e.clientY,
    originX: pan.value.x,
    originY: pan.value.y,
  }
  stageRef.value?.setPointerCapture(e.pointerId)
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
    try {
      stageRef.value?.releasePointerCapture(e.pointerId)
    } catch {
      /* noop */
    }
  }
  nodeDrag = null
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
  if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) {
    spaceHeld = true
  }
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
  if (e.key === 'Escape') clearSelection()
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
  pointer-events: none;
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
  top: 40%;
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
