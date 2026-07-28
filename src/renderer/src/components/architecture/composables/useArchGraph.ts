import { ref, readonly } from 'vue'
import {
  useVueFlow,
  MarkerType,
  type Node,
  type Edge,
} from '@vue-flow/core'
import type { ArchGraphJSON, ArchNodeJSON, ArchEdgeJSON, AnyNodeData, ArchEdgeData } from '../types/arch.types'

// ─── useArchGraph ─────────────────────────────────────────────────────────────
// Central composable that manages the Architecture Graph state.
// Provides load/save/agent-mutation APIs.
// Must be called within a component that has a parent <VueFlow> context,
// OR with the same flowId passed to <VueFlow id="arch-canvas">.
// ─────────────────────────────────────────────────────────────────────────────

export function useArchGraph() {
  const { addNodes, addEdges, removeNodes, removeEdges, updateNode, findNode, getNodes, getEdges, setNodes, setEdges, fitView } =
    useVueFlow({ id: 'arch-canvas' })

  const isLoading = ref(false)
  const title = ref('Untitled Architecture')

  // ── Load a full JSON graph ──────────────────────────────────────────────────
  function loadGraph(json: ArchGraphJSON) {
    isLoading.value = true
    try {
      if (json.meta?.title) title.value = json.meta.title

      const nodes: Node<AnyNodeData>[] = json.nodes.map((n: ArchNodeJSON) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
        parentNode: n.parentId,
        style: n.style,
        // Groups should not be draggable out of position without children
        selectable: true,
        draggable: true,
      }))

      const edges: Edge<ArchEdgeData>[] = json.edges.map((e: ArchEdgeJSON) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        data: e.data,
        label: e.data?.label,
        type: e.data?.direction === 'bidirectional' ? 'bidirectional' : 'smoothstep',
        animated: e.data?.animated ?? false,
        style: { stroke: 'rgba(255,255,255,0.18)', strokeWidth: 1.5 },
        labelStyle: { fill: 'rgba(255,255,255,0.4)', fontSize: '11px' },
        labelBgStyle: { fill: '#141420', fillOpacity: 0.8 },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(255,255,255,0.25)' },
      }))

      setNodes(nodes)
      setEdges(edges)

      setTimeout(() => {
        fitView({ padding: 0.15, duration: 500 })
        isLoading.value = false
      }, 100)
    } catch (e) {
      isLoading.value = false
      console.error('[useArchGraph] Failed to load graph:', e)
    }
  }

  // ── Serialize current graph to JSON ─────────────────────────────────────────
  function toJSON(): ArchGraphJSON {
    return {
      nodes: getNodes.value.map(n => ({
        id: n.id,
        type: n.type as any,
        position: n.position,
        data: n.data as AnyNodeData,
        parentId: n.parentNode,
      })),
      edges: getEdges.value.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        data: e.data,
      })),
      meta: {
        title: title.value,
        savedAt: new Date().toISOString(),
        version: '1.0',
      },
    }
  }

  // ── Agent Mutation API ───────────────────────────────────────────────────────
  function agentAddNode(node: ArchNodeJSON) {
    const vfNode: Node<AnyNodeData> = {
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
      parentNode: node.parentId,
      selectable: true,
      draggable: true,
    }
    addNodes([vfNode])
  }

  function agentAddEdge(edge: ArchEdgeJSON) {
    const vfEdge: Edge<ArchEdgeData> = {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      data: edge.data,
      label: edge.data?.label,
      type: 'smoothstep',
      animated: edge.data?.animated ?? false,
      style: { stroke: 'rgba(255,255,255,0.18)', strokeWidth: 1.5 },
      labelStyle: { fill: 'rgba(255,255,255,0.4)', fontSize: '11px' },
      labelBgStyle: { fill: '#141420', fillOpacity: 0.8 },
      markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(255,255,255,0.25)' },
    }
    addEdges([vfEdge])
  }

  function agentUpdateNode(id: string, data: Partial<AnyNodeData>) {
    const node = findNode(id)
    if (node) {
      updateNode(id, { data: { ...node.data, ...data } as AnyNodeData })
    }
  }

  function agentRemoveNode(id: string) {
    removeNodes([id])
  }

  function agentRemoveEdge(id: string) {
    removeEdges([id])
  }

  function clearGraph() {
    setNodes([])
    setEdges([])
  }

  return {
    title,
    isLoading: readonly(isLoading),
    // Core actions
    loadGraph,
    toJSON,
    clearGraph,
    fitView: () => fitView({ padding: 0.15, duration: 400 }),
    // Agent mutation API
    agentAddNode,
    agentAddEdge,
    agentUpdateNode,
    agentRemoveNode,
    agentRemoveEdge,
    // Raw access for advanced use
    getNodes,
    getEdges,
  }
}
