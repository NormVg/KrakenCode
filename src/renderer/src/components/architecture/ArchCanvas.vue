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
import { MiniMap } from '@vue-flow/minimap'
import { Controls } from '@vue-flow/controls'

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

import ServiceNode  from './nodes/ServiceNode.vue'
import DatabaseNode from './nodes/DatabaseNode.vue'
import QueueNode    from './nodes/QueueNode.vue'
import GroupNode    from './nodes/GroupNode.vue'
import ExternalNode from './nodes/ExternalNode.vue'
import NodeEditModal from './NodeEditModal.vue'
import { useAutoLayout } from './composables/useAutoLayout'

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
  fitView,
} = useVueFlow({ id: 'arch-canvas' })

const { recompute } = useAutoLayout()

const nodeTypes = {
  service:  ServiceNode,
  database: DatabaseNode,
  queue:    QueueNode,
  group:    GroupNode,
  external: ExternalNode,
}

// ─── Canvas ref ───────────────────────────────────────────────────────────────
const canvasRef = ref<HTMLElement | null>(null)

// ─── Edit modal state ─────────────────────────────────────────────────────────
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

// ─── Drop from NodePalette ────────────────────────────────────────────────────
function onDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  const type = e.dataTransfer?.getData('application/kraken-arch-node-type')
  if (!type || !canvasRef.value) return

  const rect = canvasRef.value.getBoundingClientRect()
  const pos  = project({ x: e.clientX - rect.left, y: e.clientY - rect.top })

  addNodes([{
    id:       nextId(),
    type,
    position: pos,
    data:     defaultData(type),
  }])
}

// ─── Double-click on empty pane → create service node ────────────────────────
function onPaneDblClick(e: MouseEvent) {
  if (!canvasRef.value) return
  const rect = canvasRef.value.getBoundingClientRect()
  const pos  = project({ x: e.clientX - rect.left, y: e.clientY - rect.top })

  addNodes([{
    id:       nextId(),
    type:     'service',
    position: pos,
    data:     defaultData('service'),
  }])
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

// ─── Keyboard delete ──────────────────────────────────────────────────────────
function onKeyDown(e: KeyboardEvent) {
  if (editing.value) return  // don't delete while editing
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

  if (e.key === 'Delete' || e.key === 'Backspace') {
    const nodes = getSelectedNodes.value.map(n => n.id)
    const edges = getSelectedEdges.value.map(e => e.id)
    if (nodes.length) removeNodes(nodes)
    if (edges.length) removeEdges(edges)
  }
}

onMounted(() => { document.addEventListener('keydown', onKeyDown) })
onUnmounted(() => { document.removeEventListener('keydown', onKeyDown) })
</script>

<template>
  <div
    ref="canvasRef"
    class="arch-canvas-container"
    @dragover="onDragOver"
    @drop="onDrop"
  >
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
      fit-view-on-init
      class="kraken-arch-flow"
      @pane-dbl-click="onPaneDblClick"
      @node-double-click="onNodeDblClick"
      @connect="onConnect"
    >
      <Background pattern-color="rgba(170, 32, 90, 0.5)" :gap="24" :size="1" />

      <Controls position="top-left" class="arch-controls" />

      <MiniMap
        position="top-right"
        class="arch-minimap"
        :node-color="(node) => {
          if (node.type === 'database') return '#3B82F6'
          if (node.type === 'service')  return '#9374BE'
          if (node.type === 'queue')    return '#0EA5E9'
          if (node.type === 'group')    return 'rgba(255,255,255,0.1)'
          return '#444'
        }"
      />

      <!-- Floating action bar: Auto Layout + Fit View + Clear -->
      <div class="floating-toolbar">
          <button class="fab" title="Fit View" @click="fitView({ padding: 0.15, duration: 400 })">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>
            </svg>
          </button>
          <div class="fab-divider" />
          <button class="fab fab-primary" title="Auto Layout" @click="recompute()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
            Auto Layout
          </button>
        </div>
    </VueFlow>

    <!-- Double-click to create hint -->
    <div class="canvas-hint">
      Double-click canvas to add a node · Drag from panel · Drag handles to connect
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
  position: relative;
  background: transparent;
}

.kraken-arch-flow {
  background-color: transparent;
}

/* Floating toolbar – bottom-center */
.floating-toolbar {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(14, 14, 24, 0.88);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 6px 10px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  z-index: 10;
  pointer-events: all;
}

.fab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.55);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.fab:hover {
  background: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.9);
}

.fab-primary {
  color: rgba(255,255,255,0.75);
}

.fab-primary:hover {
  background: rgba(147, 116, 190, 0.2);
  color: #9374BE;
}

.fab-divider {
  width: 1px;
  height: 18px;
  background: rgba(255,255,255,0.1);
  margin: 0 2px;
}

/* Canvas hint */
.canvas-hint {
  position: absolute;
  bottom: 20px;
  right: 20px;
  font-size: 10px;
  color: rgba(255,255,255,0.18);
  pointer-events: none;
  letter-spacing: 0.02em;
}

/* Controls */
:deep(.arch-controls) {
  background: rgba(20, 20, 32, 0.85);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

:deep(.arch-controls button) {
  background: transparent;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);
  fill: rgba(255,255,255,0.7);
}

:deep(.arch-controls button:hover) {
  background: rgba(255, 255, 255, 0.08);
}

:deep(.arch-controls button:last-child) {
  border-bottom: none;
}

/* Minimap */
:deep(.arch-minimap) {
  background: rgba(20, 20, 32, 0.85);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  width: 120px !important;
  height: 80px !important;
}

:deep(.arch-minimap .vue-flow__minimap-mask) {
  fill: rgba(0, 0, 0, 0.6);
}

/* Node handle styling – make handles visible on hover */
:deep(.vue-flow__handle) {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  border: 1.5px solid rgba(255,255,255,0.35);
  transition: all 0.15s ease;
}

:deep(.vue-flow__handle:hover) {
  background: var(--accent, #FF5F5F);
  border-color: var(--accent, #FF5F5F);
  transform: scale(1.4);
  box-shadow: 0 0 8px var(--accent, #FF5F5F);
}

/* Edge styles */
:deep(.vue-flow__edge-path) {
  stroke: rgba(255,255,255,0.2);
}

:deep(.vue-flow__edge.selected .vue-flow__edge-path) {
  stroke: var(--accent, #FF5F5F);
}

/* Connection line while dragging */
:deep(.vue-flow__connection-path) {
  stroke: var(--accent, #FF5F5F) !important;
  stroke-width: 2 !important;
  stroke-dasharray: 5 3 !important;
}

/* Selection box */
:deep(.vue-flow__selection) {
  background: rgba(147, 116, 190, 0.08);
  border: 1px solid rgba(147, 116, 190, 0.4);
  border-radius: 4px;
}
</style>
