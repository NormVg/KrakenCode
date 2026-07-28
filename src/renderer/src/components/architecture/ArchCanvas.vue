<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import {
  VueFlow,
  useVueFlow,
  type NodeMouseEvent,
  type EdgeMouseEvent,
  type Connection,
  MarkerType,
  ConnectionMode,
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
import { useAutoLayout } from './composables/useAutoLayout'

// ─── VueFlow composable ───────────────────────────────────────────────────────
const {
  addNodes, addEdges,
  removeNodes, removeEdges,
  getSelectedNodes, getSelectedEdges,
  findNode, updateNode,
  getEdges, setEdges,
  project, fitView,
  zoomIn, zoomOut,
} = useVueFlow({ id: 'arch-canvas' })

const { recompute } = useAutoLayout()

const nodeTypes = {
  service:  ServiceNode,
  database: DatabaseNode,
  queue:    QueueNode,
  group:    GroupNode,
  external: ExternalNode,
}

// ─── State ────────────────────────────────────────────────────────────────────
const canvasRef     = ref<HTMLElement | null>(null)
const activeTool    = ref<string>('pointer')   // pointer | service | database | queue | external | group

interface EditState { nodeId: string; label: string; tech: string; x: number; y: number }
const editing = ref<EditState | null>(null)

// ─── Node factory ─────────────────────────────────────────────────────────────
let counter = 1
function nextId() { return `node-${Date.now()}-${counter++}` }

function defaultData(type: string): Record<string, unknown> {
  const bases: Record<string, Record<string, unknown>> = {
    service:  { kind: 'service',  label: 'New Service',  status: 'unknown' },
    database: { kind: 'database', label: 'New Database', dbType: 'relational' },
    queue:    { kind: 'queue',    label: 'New Queue',    pattern: 'pub-sub' },
    group:    { kind: 'group',    label: 'New Group' },
    external: { kind: 'external', label: 'External API' },
  }
  return bases[type] ?? { kind: type, label: 'Node' }
}

// ─── Tool selection ───────────────────────────────────────────────────────────
function selectTool(tool: string) {
  activeTool.value = tool
}

// ─── Canvas click: place node if tool is active ───────────────────────────────
function onPaneClick(e: MouseEvent) {
  if (activeTool.value === 'pointer' || !canvasRef.value) return
  const rect = canvasRef.value.getBoundingClientRect()
  const pos  = project({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  addNodes([{ id: nextId(), type: activeTool.value, position: pos, data: defaultData(activeTool.value) }])
  activeTool.value = 'pointer'
}

// ─── Double-click node → open label editor ───────────────────────────────────
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
  if (node) updateNode(id, { data: { ...node.data, label, tech } })
  editing.value = null
}

// ─── Edge click: toggle dashed/animated ──────────────────────────────────────
function onEdgeClick({ edge }: EdgeMouseEvent) {
  const updated = getEdges.value.map(e =>
    e.id === edge.id ? { ...e, animated: !e.animated } : e
  )
  setEdges(updated)
}

// ─── Connect nodes ────────────────────────────────────────────────────────────
function onConnect(connection: Connection) {
  addEdges([{
    id:           `e-${connection.source}-${connection.target}-${Date.now()}`,
    source:       connection.source!,
    target:       connection.target!,
    sourceHandle: connection.sourceHandle ?? undefined,
    targetHandle: connection.targetHandle ?? undefined,
    type:         'smoothstep',
    animated:     false,
    markerEnd:    { type: MarkerType.ArrowClosed, color: 'rgba(170,32,90,0.8)' },
    style:        { stroke: 'rgba(170,32,90,0.5)', strokeWidth: 1.5 },
    label:        '',
    labelStyle:   { fill: 'rgba(255,255,255,0.5)', fontSize: '11px' },
    labelBgStyle: { fill: '#141420', fillOpacity: 0.85 },
  }])
}

// ─── Keyboard shortcuts ───────────────────────────────────────────────────────
const toolHotkeys: Record<string, string> = {
  '1': 'pointer', '2': 'service', '3': 'database',
  '4': 'queue',   '5': 'external', '6': 'group',
}

function onKeyDown(e: KeyboardEvent) {
  if (editing.value) return
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

  if (toolHotkeys[e.key]) {
    activeTool.value = toolHotkeys[e.key]
    return
  }
  if (e.key === 'Escape') { activeTool.value = 'pointer'; return }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const nodes = getSelectedNodes.value.map(n => n.id)
    const edges = getSelectedEdges.value.map(ed => ed.id)
    if (nodes.length) removeNodes(nodes)
    if (edges.length) removeEdges(edges)
  }
}

onMounted(() => document.addEventListener('keydown', onKeyDown))
onUnmounted(() => document.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <div
    ref="canvasRef"
    class="arch-canvas-root"
    :class="`cursor-${activeTool}`"
  >
    <!-- ═══════════════════════════════════════════════════════════ TOP TOOLBAR -->
    <div class="arch-toolbar">
      <!-- Pointer -->
      <button
        class="tool-btn"
        :class="{ active: activeTool === 'pointer' }"
        title="Select / Move  (1)"
        @click="selectTool('pointer')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 3l14 9-7 1-4 7z"/>
        </svg>
      </button>

      <div class="tool-divider" />

      <!-- Service -->
      <button
        class="tool-btn"
        :class="{ active: activeTool === 'service' }"
        title="Service / API  (2)"
        @click="selectTool('service')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/>
          <line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
        </svg>
      </button>

      <!-- Database -->
      <button
        class="tool-btn"
        :class="{ active: activeTool === 'database' }"
        title="Database  (3)"
        @click="selectTool('database')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
        </svg>
      </button>

      <!-- Queue -->
      <button
        class="tool-btn"
        :class="{ active: activeTool === 'queue' }"
        title="Queue / Pub-Sub  (4)"
        @click="selectTool('queue')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
          <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
      </button>

      <!-- External -->
      <button
        class="tool-btn"
        :class="{ active: activeTool === 'external' }"
        title="External API / CDN  (5)"
        @click="selectTool('external')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      </button>

      <!-- Group -->
      <button
        class="tool-btn"
        :class="{ active: activeTool === 'group' }"
        title="Group / Zone  (6)"
        @click="selectTool('group')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
      </button>

      <div class="tool-divider" />

      <!-- Auto Layout -->
      <button class="tool-btn" title="Auto Layout" @click="recompute()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        </svg>
      </button>

      <!-- Fit View -->
      <button class="tool-btn" title="Fit View" @click="fitView({ padding: 0.15, duration: 400 })">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
        </svg>
      </button>
    </div>

    <!-- ═══════════════════════════════════════════════════════ ACTIVE TOOL TIP -->
    <div v-if="activeTool !== 'pointer'" class="tool-hint">
      Click anywhere on the canvas to place a <strong>{{ activeTool }}</strong> · <kbd>Esc</kbd> to cancel
    </div>

    <!-- ════════════════════════════════════════════════════════════════ CANVAS -->
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
      :connection-mode="ConnectionMode.Loose"
      fit-view-on-init
      class="kraken-flow"
      @pane-click="onPaneClick"
      @node-double-click="onNodeDblClick"
      @edge-click="onEdgeClick"
      @connect="onConnect"
    >
      <Background
        variant="dots"
        pattern-color="rgba(255,255,255,0.06)"
        :gap="24"
        :size="1.5"
      />

    </VueFlow>

    <!-- ═══════════════════════════════════════════════════ ZOOM CONTROLS (BL) -->
    <div class="zoom-controls">
      <button class="zoom-btn" title="Zoom Out" @click="() => zoomOut({ duration: 200 })">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
      <div class="zoom-divider" />
      <button class="zoom-btn" title="Zoom In" @click="() => zoomIn({ duration: 200 })">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
    </div>

    <!-- Edge toggle hint -->


    <!-- ════════════════════════════════════════════════════════════ EDIT MODAL -->
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
/* ─── Root ─────────────────────────────────────────────────────────────────── */
.arch-canvas-root {
  position: relative;
  width: 100%;
  height: 100%;
  background: #0d0d14;
  overflow: hidden;
}

.arch-canvas-root.cursor-service,
.arch-canvas-root.cursor-database,
.arch-canvas-root.cursor-queue,
.arch-canvas-root.cursor-external,
.arch-canvas-root.cursor-group {
  cursor: crosshair;
}

/* ─── VueFlow ──────────────────────────────────────────────────────────────── */
.kraken-flow {
  width: 100%;
  height: 100%;
  background: transparent;
}

/* ─── Top Toolbar ──────────────────────────────────────────────────────────── */
.arch-toolbar {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 2px;
  background: rgba(15, 14, 25, 0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 14px;
  padding: 6px 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(0,0,0,0.4);
}

.tool-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  outline: none;
}

.tool-btn:hover {
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.85);
  transform: translateY(-1px);
}

.tool-btn.active {
  background: rgba(147, 116, 190, 0.2);
  color: #b89fe8;
  box-shadow: 0 0 0 1px rgba(147, 116, 190, 0.4);
}

.tool-divider {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.08);
  margin: 0 4px;
  border-radius: 1px;
}

/* ─── Active tool hint ─────────────────────────────────────────────────────── */
.tool-hint {
  position: absolute;
  top: 68px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  background: rgba(147, 116, 190, 0.15);
  border: 1px solid rgba(147, 116, 190, 0.3);
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
  pointer-events: none;
  backdrop-filter: blur(8px);
  animation: slideDown 0.2s ease;
}

.tool-hint strong {
  color: #b89fe8;
  text-transform: capitalize;
}

.tool-hint kbd {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 10px;
  font-family: inherit;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateX(-50%) translateY(-6px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}

/* ─── Zoom Controls (top-left, below toolbar) ─────────────────────────────── */
.zoom-controls {
  position: absolute;
  top: 72px;
  left: 16px;
  z-index: 20;
  display: flex;
  flex-direction: row;
  align-items: center;
  background: rgba(15, 14, 25, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
}

.zoom-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  outline: none;
}

.zoom-btn:hover {
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.9);
}

.zoom-divider {
  width: 1px;
  height: 18px;
  background: rgba(255, 255, 255, 0.08);
}



/* ─── MiniMap ──────────────────────────────────────────────────────────────── */
:deep(.arch-minimap) {
  background: rgba(15, 14, 25, 0.9) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 10px !important;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  margin: 0 16px 16px 0;
}

/* ─── VueFlow handle overrides ─────────────────────────────────────────────── */
:deep(.vue-flow__handle) {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  border: 1.5px solid rgba(255, 255, 255, 0.25);
  transition: all 0.15s ease;
}

:deep(.vue-flow__handle:hover),
:deep(.vue-flow__handle.connecting) {
  background: #9374BE;
  border-color: #b89fe8;
  transform: scale(1.5);
  box-shadow: 0 0 10px rgba(147, 116, 190, 0.7);
}

/* ─── Edge overrides ───────────────────────────────────────────────────────── */
:deep(.vue-flow__edge-path) {
  stroke-width: 1.5;
}

:deep(.vue-flow__edge.selected .vue-flow__edge-path) {
  stroke: #9374BE !important;
  filter: drop-shadow(0 0 4px rgba(147, 116, 190, 0.5));
}

:deep(.vue-flow__connection-path) {
  stroke: #9374BE !important;
  stroke-width: 2 !important;
  stroke-dasharray: 5 3 !important;
}

/* ─── Selection box ────────────────────────────────────────────────────────── */
:deep(.vue-flow__selection) {
  background: rgba(147, 116, 190, 0.06);
  border: 1px solid rgba(147, 116, 190, 0.35);
  border-radius: 4px;
}

/* ─── VueFlow pane (no white attribution bar) ──────────────────────────────── */
:deep(.vue-flow__attribution) {
  display: none;
}
</style>
