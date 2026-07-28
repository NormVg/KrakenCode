<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import {
  VueFlow,
  useVueFlow,
  MarkerType,
  type NodeMouseEvent,
  type Connection,
} from '@vue-flow/core'
import { Background } from '@vue-flow/background'

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

import ServiceNode  from './nodes/ServiceNode.vue'
import DatabaseNode from './nodes/DatabaseNode.vue'
import QueueNode    from './nodes/QueueNode.vue'
import GroupNode    from './nodes/GroupNode.vue'
import ExternalNode from './nodes/ExternalNode.vue'
import NodeEditModal from './NodeEditModal.vue'

// ─── Composables ─────────────────────────────────────────────────────────────
const {
  addNodes,
  addEdges,
  removeNodes,
  removeEdges,
  getSelectedNodes,
  getSelectedEdges,
  findNode,
  updateNode,
  project,
  zoomIn,
  zoomOut,
} = useVueFlow({ id: 'arch-canvas' })

const nodeTypes = {
  service:  ServiceNode,
  database: DatabaseNode,
  queue:    QueueNode,
  group:    GroupNode,
  external: ExternalNode,
}

// ─── State ───────────────────────────────────────────────────────────────────
const canvasRef = ref<HTMLElement | null>(null)
const activeTool = ref<string>('select') // 'select', 'service', 'database', 'queue', 'external', 'group'

interface EditState {
  nodeId: string
  label: string
  tech: string
  x: number
  y: number
}
const editing = ref<EditState | null>(null)

// ─── Node ID counter ─────────────────────────────────────────────────────────
let nodeCounter = 1
function nextId() { return `node-${Date.now()}-${nodeCounter++}` }

// ─── Default data per type ───────────────────────────────────────────────────
function defaultData(type: string): Record<string, any> {
  const bases: Record<string, Record<string, any>> = {
    service:  { kind: 'service',  label: 'New Service',  status: 'unknown' },
    database: { kind: 'database', label: 'New Database', dbType: 'relational' },
    queue:    { kind: 'queue',    label: 'New Queue',    pattern: 'pub-sub' },
    group:    { kind: 'group',    label: 'New Group' },
    external: { kind: 'external', label: 'External API' },
    client:   { kind: 'client',   label: 'Client',       platform: 'web' },
  }
  return bases[type] ?? { kind: type, label: 'Node' }
}

// ─── Click to place nodes (Excalidraw style) ─────────────────────────────────
function onPaneClick(e: MouseEvent) {
  if (activeTool.value === 'select') {
    // Regular selection behavior (handled by vue-flow natively)
    return
  }

  // A tool is active, place the node!
  if (!canvasRef.value) return
  const rect = canvasRef.value.getBoundingClientRect()
  const pos  = project({ x: e.clientX - rect.left, y: e.clientY - rect.top })

  addNodes([{
    id:       nextId(),
    type:     activeTool.value,
    position: pos,
    data:     defaultData(activeTool.value),
  }])

  // Revert back to pointer after placing
  activeTool.value = 'select'
}

// ─── Double-click on node → open edit modal ───────────────────────────────────
function onNodeDblClick({ node, event }: NodeMouseEvent) {
  editing.value = {
    nodeId: node.id,
    label:  (node.data?.label as string) ?? '',
    tech:   (node.data?.tech  as string) ?? '',
    x:      (event as MouseEvent).clientX ?? 0,
    y:      (event as MouseEvent).clientY ?? 0,
  }
}

function confirmEdit(id: string, label: string, tech: string) {
  const node = findNode(id)
  if (node) {
    updateNode(id, { data: { ...node.data, label, tech } })
  }
  editing.value = null
}

// ─── Edge created by user dragging between handles ───────────────────────────
function onConnect(connection: Connection) {
  addEdges([{
    id:        `e-${connection.source}-${connection.target}-${Date.now()}`,
    source:    connection.source!,
    target:    connection.target!,
    type:      'smoothstep',
    animated:  false,
    markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(255,255,255,0.35)' },
    style:     { stroke: 'rgba(255,255,255,0.25)', strokeWidth: 1.5 },
    label:     '',
    labelStyle: { fill: 'rgba(255,255,255,0.4)', fontSize: '11px' },
    labelBgStyle: { fill: '#141420', fillOpacity: 0.8 },
  }])
}

// ─── Keyboard interactions ────────────────────────────────────────────────────
function onKeyDown(e: KeyboardEvent) {
  if (editing.value) return  // don't delete/switch tools while editing
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

  // Delete
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const nodes = getSelectedNodes.value.map(n => n.id)
    const edges = getSelectedEdges.value.map(e => e.id)
    if (nodes.length) removeNodes(nodes)
    if (edges.length) removeEdges(edges)
  }

  // Quick switch to pointer (Escape)
  if (e.key === 'Escape') {
    activeTool.value = 'select'
  }
  
  // Excalidraw-like hotkeys (1, 2, 3...)
  if (e.key === '1') activeTool.value = 'select'
  if (e.key === '2') activeTool.value = 'service'
  if (e.key === '3') activeTool.value = 'database'
  if (e.key === '4') activeTool.value = 'queue'
  if (e.key === '5') activeTool.value = 'external'
  if (e.key === '6') activeTool.value = 'group'
}

onMounted(() => { document.addEventListener('keydown', onKeyDown) })
onUnmounted(() => { document.removeEventListener('keydown', onKeyDown) })
</script>

<template>
  <div ref="canvasRef" class="arch-canvas-container" :class="{ 'crosshair-cursor': activeTool !== 'select' }">
    <!-- Vue Flow Canvas -->
    <VueFlow
      id="arch-canvas"
      :node-types="nodeTypes as any"
      :default-viewport="{ zoom: 1 }"
      :min-zoom="0.1"
      :max-zoom="4"
      :snap-to-grid="true"
      :snap-grid="[16, 16]"
      :connect-on-click="false"
      :nodes-connectable="true"
      :elements-selectable="true"
      :multi-selection-key-code="'Shift'"
      :pan-on-drag="activeTool === 'select'"
      :selection-on-drag="activeTool === 'select'"
      fit-view-on-init
      class="kraken-arch-flow"
      @pane-click="onPaneClick"
      @node-double-click="onNodeDblClick"
      @connect="onConnect"
    >
      <!-- Extremely subtle background dots to match Excalidraw dark theme -->
      <Background pattern-color="rgba(255, 255, 255, 0.03)" :gap="24" :size="1" />
    </VueFlow>

    <!-- Excalidraw-Style Top Floating Toolbar -->
    <div class="excalidraw-toolbar">
      <div class="toolbar-group">
        <button class="tool-btn" :class="{ active: activeTool === 'select' }" @click="activeTool = 'select'" title="Selection (1)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path>
            <path d="M13 13l6 6"></path>
          </svg>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <button class="tool-btn" :class="{ active: activeTool === 'service' }" @click="activeTool = 'service'" title="Service (2)">
          <div class="tool-icon hexagon">⬡</div>
        </button>
        <button class="tool-btn" :class="{ active: activeTool === 'database' }" @click="activeTool = 'database'" title="Database (3)">
          <div class="tool-icon">⬟</div>
        </button>
        <button class="tool-btn" :class="{ active: activeTool === 'queue' }" @click="activeTool = 'queue'" title="Queue (4)">
          <div class="tool-icon">◈</div>
        </button>
        <button class="tool-btn" :class="{ active: activeTool === 'external' }" @click="activeTool = 'external'" title="External (5)">
          <div class="tool-icon">◎</div>
        </button>
        <button class="tool-btn" :class="{ active: activeTool === 'group' }" @click="activeTool = 'group'" title="Group (6)">
          <div class="tool-icon">⬜</div>
        </button>
      </div>
    </div>

    <!-- Excalidraw-Style Bottom Left Zoom Controls -->
    <div class="excalidraw-zoom-controls">
      <button class="zoom-btn" @click="() => zoomOut()">-</button>
      <button class="zoom-btn" @click="() => zoomIn()">+</button>
    </div>

    <!-- Top Left Menu Mock (Visual only for now) -->
    <div class="excalidraw-menu-btn">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    </div>

    <!-- Node Edit Modal -->
    <NodeEditModal
      :node-id="editing?.nodeId ?? null"
      :initial-label="editing?.label ?? ''"
      :initial-tech="editing?.tech ?? ''"
      :x="editing?.x ?? 0"
      :y="editing?.y ?? 0"
      @confirm="confirmEdit"
      @cancel="editing = null"
    />
  </div>
</template>

<style scoped>
.arch-canvas-container {
  width: 100%;
  height: 100%;
  position: absolute;
  inset: 0;
  background: #121212; /* Excalidraw dark theme */
}

.kraken-arch-flow {
  background-color: transparent;
}

/* Change cursor to crosshair when a tool is selected */
.crosshair-cursor :deep(.vue-flow__pane) {
  cursor: crosshair !important;
}

/* ─── Top Floating Toolbar ────────────────────────────────────────── */
.excalidraw-toolbar {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  background: #232329;
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05);
  z-index: 10;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.toolbar-divider {
  width: 1px;
  height: 24px;
  background: rgba(255,255,255,0.1);
  margin: 0 8px;
}

.tool-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #a0a0a0;
  cursor: pointer;
  transition: all 0.1s ease;
  position: relative;
}

.tool-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #e0e0e0;
}

/* Active State (Indigo) */
.tool-btn.active {
  background: rgba(166, 124, 255, 0.2);
  color: #a67cff;
}

.tool-icon {
  font-size: 16px;
  line-height: 1;
}
.tool-icon.hexagon {
  font-size: 18px; /* Optical adjustment */
}

/* ─── Bottom Left Zoom Controls ──────────────────────────────────────── */
.excalidraw-zoom-controls {
  position: absolute;
  bottom: 16px;
  left: 16px;
  display: flex;
  background: #232329;
  border-radius: 6px;
  padding: 2px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05);
  z-index: 10;
}

.zoom-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: #a0a0a0;
  cursor: pointer;
  border-radius: 4px;
  font-size: 18px;
  line-height: 1;
}
.zoom-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #e0e0e0;
}

/* ─── Top Left Menu Button ──────────────────────────────────────────── */
.excalidraw-menu-btn {
  position: absolute;
  top: 16px;
  left: 16px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #232329;
  border-radius: 6px;
  color: #a0a0a0;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05);
  cursor: pointer;
  z-index: 10;
}

.excalidraw-menu-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #e0e0e0;
}

/* ─── Base Overrides ────────────────────────────────────────────────── */
:deep(.vue-flow__handle) {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #121212;
  border: 1.5px solid rgba(255,255,255,0.5);
  transition: all 0.15s ease;
}

:deep(.vue-flow__handle:hover) {
  background: #a67cff;
  border-color: #a67cff;
  transform: scale(1.4);
}

:deep(.vue-flow__edge-path) {
  stroke: rgba(255,255,255,0.25);
}

:deep(.vue-flow__edge.selected .vue-flow__edge-path) {
  stroke: #a67cff;
}

:deep(.vue-flow__connection-path) {
  stroke: #a67cff !important;
  stroke-width: 2 !important;
  stroke-dasharray: 5 3 !important;
}

:deep(.vue-flow__selection) {
  background: rgba(166, 124, 255, 0.1);
  border: 1px solid rgba(166, 124, 255, 0.5);
  border-radius: 4px;
}
</style>
