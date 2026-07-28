import { useVueFlow, type Node } from '@vue-flow/core'
import ELK from 'elkjs/lib/elk.bundled.js'

// ─── useAutoLayout ────────────────────────────────────────────────────────────
// Integrates elkjs for automatic hierarchical graph layout.
// After loading a graph or adding nodes, call `recompute()` to re-position
// all nodes cleanly in a top-down layered hierarchy.
// ─────────────────────────────────────────────────────────────────────────────

const elk = new ELK()

const defaultElkOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.layered.spacing.nodeNodeBetweenLayers': '80',
  'elk.spacing.nodeNode': '50',
  'elk.edgeRouting': 'SPLINES',
  'elk.layered.unnecessaryBendpoints': 'true',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
}

export function useAutoLayout() {
  const { getNodes, getEdges, setNodes, fitView } = useVueFlow({ id: 'arch-canvas' })

  async function recompute(direction: 'DOWN' | 'RIGHT' = 'DOWN') {
    const nodes = getNodes.value
    const edges = getEdges.value

    if (!nodes.length) return

    const elkGraph = {
      id: 'root',
      layoutOptions: {
        ...defaultElkOptions,
        'elk.direction': direction,
      },
      children: nodes
        .filter(n => !n.parentNode) // Only top-level nodes; groups handle children
        .map((n: Node) => ({
          id: n.id,
          width: getNodeWidth(n.type),
          height: getNodeHeight(n.type),
          layoutOptions: (n.type === 'group'
            ? { 'elk.padding': '[top=40,left=16,bottom=16,right=16]' }
            : {}) as Record<string, string>,
          children: nodes
            .filter(child => child.parentNode === n.id)
            .map(child => ({
              id: child.id,
              width: getNodeWidth(child.type),
              height: getNodeHeight(child.type),
            })),
        })),
      edges: edges.map(e => ({
        id: e.id,
        sources: [e.source],
        targets: [e.target],
      })),
    }

    try {
      const layout = await elk.layout(elkGraph)

      // Apply computed positions back to Vue Flow nodes
      const updatedNodes = nodes.map(node => {
        const layoutNode = layout.children?.find(n => n.id === node.id)
        if (layoutNode) {
          return { ...node, position: { x: layoutNode.x ?? 0, y: layoutNode.y ?? 0 } }
        }
        // Try in group children
        for (const group of layout.children ?? []) {
          const child = group.children?.find(c => c.id === node.id)
          if (child) {
            return { ...node, position: { x: (child as any).x ?? 0, y: (child as any).y ?? 0 } }
          }
        }
        return node
      })

      setNodes(updatedNodes)

      setTimeout(() => {
        fitView({ padding: 0.15, duration: 500 })
      }, 50)
    } catch (err) {
      console.error('[useAutoLayout] elkjs layout failed:', err)
    }
  }

  return { recompute }
}

// ── Node dimension hints for elkjs layout calculation ──────────────────────
function getNodeWidth(type?: string): number {
  switch (type) {
    case 'group':    return 280
    case 'database': return 160
    case 'queue':    return 180
    default:         return 200
  }
}

function getNodeHeight(type?: string): number {
  switch (type) {
    case 'group':    return 220
    case 'database': return 100
    case 'queue':    return 90
    default:         return 80
  }
}
