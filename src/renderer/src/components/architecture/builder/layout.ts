import type { ArchModel, ArchNode } from './types'

/** Shared geometry for builder canvas + edges */
export const NODE_W = 176
export const NODE_H = 70
export const H_GAP = 48
export const V_GAP = 72
export const PAD_X = 56
export const PAD_Y = 72

/**
 * Layered top-down hierarchy layout (Sugiyama-style ranks).
 * Roots at the top, dependents below — proper architecture hierarchy.
 */
export function layoutHierarchical(model: ArchModel): ArchModel {
  const nodes = model.nodes.map((n) => ({ ...n }))
  const edges = model.edges
  if (nodes.length === 0) return { nodes, edges }

  const ids = new Set(nodes.map((n) => n.id))
  const outgoing = new Map<string, string[]>()
  const incoming = new Map<string, string[]>()
  for (const id of ids) {
    outgoing.set(id, [])
    incoming.set(id, [])
  }
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) continue
    if (e.source === e.target) continue
    outgoing.get(e.source)!.push(e.target)
    incoming.get(e.target)!.push(e.source)
  }

  // Rank = longest path from roots (nodes with no in-edges)
  const rank = new Map<string, number>()
  for (const n of nodes) rank.set(n.id, 0)

  // Topological order for longest-path ranking
  const topo: string[] = []
  const indeg2 = new Map<string, number>()
  for (const id of ids) indeg2.set(id, 0)
  for (const e of edges) {
    if (ids.has(e.source) && ids.has(e.target) && e.source !== e.target) {
      indeg2.set(e.target, (indeg2.get(e.target) ?? 0) + 1)
    }
  }
  const tq = nodes.filter((n) => (indeg2.get(n.id) ?? 0) === 0).map((n) => n.id)
  while (tq.length) {
    const u = tq.shift()!
    topo.push(u)
    for (const v of outgoing.get(u) ?? []) {
      indeg2.set(v, (indeg2.get(v) ?? 1) - 1)
      if (indeg2.get(v) === 0) tq.push(v)
    }
  }
  for (const n of nodes) {
    if (!topo.includes(n.id)) topo.push(n.id)
  }

  for (const id of topo) {
    const preds = incoming.get(id) ?? []
    if (preds.length === 0) {
      rank.set(id, 0)
    } else {
      let maxR = 0
      for (const p of preds) {
        maxR = Math.max(maxR, (rank.get(p) ?? 0) + 1)
      }
      rank.set(id, maxR)
    }
  }

  // Layers
  const layers = new Map<number, string[]>()
  let maxRank = 0
  for (const n of nodes) {
    const r = rank.get(n.id) ?? 0
    maxRank = Math.max(maxRank, r)
    const list = layers.get(r) ?? []
    list.push(n.id)
    layers.set(r, list)
  }

  // Barycenter ordering to reduce crossings (2 passes)
  for (let pass = 0; pass < 2; pass++) {
    for (let r = 1; r <= maxRank; r++) {
      const layer = layers.get(r)
      if (!layer || layer.length < 2) continue
      const prev = layers.get(r - 1) ?? []
      const prevIndex = new Map(prev.map((id, i) => [id, i]))
      layer.sort((a, b) => {
        const ba = barycenter(a, incoming, prevIndex)
        const bb = barycenter(b, incoming, prevIndex)
        return ba - bb
      })
      layers.set(r, layer)
    }
  }

  // Kind-based secondary sort within layer for stable look (clients left, data right)
  const kindWeight: Record<string, number> = {
    client: 0,
    external: 1,
    service: 2,
    queue: 3,
    database: 4,
    text: 5,
  }
  for (const [r, layer] of layers) {
    layer.sort((a, b) => {
      const na = nodes.find((n) => n.id === a)!
      const nb = nodes.find((n) => n.id === b)!
      const wa = kindWeight[na.kind] ?? 2
      const wb = kindWeight[nb.kind] ?? 2
      if (wa !== wb) return wa - wb
      return a.localeCompare(b)
    })
    layers.set(r, layer)
  }

  // Position
  const byId = new Map(nodes.map((n) => [n.id, n]))
  let maxLayerWidth = 0
  for (const layer of layers.values()) {
    maxLayerWidth = Math.max(maxLayerWidth, layer.length)
  }
  const totalWidth = maxLayerWidth * NODE_W + (maxLayerWidth - 1) * H_GAP

  for (let r = 0; r <= maxRank; r++) {
    const layer = layers.get(r) ?? []
    const layerWidth = layer.length * NODE_W + Math.max(0, layer.length - 1) * H_GAP
    const offsetX = PAD_X + Math.max(0, (totalWidth - layerWidth) / 2)
    layer.forEach((id, i) => {
      const node = byId.get(id)
      if (!node) return
      node.x = Math.round(offsetX + i * (NODE_W + H_GAP))
      node.y = Math.round(PAD_Y + r * (NODE_H + V_GAP))
    })
  }

  return { nodes: Array.from(byId.values()), edges: [...edges] }
}

function barycenter(
  id: string,
  incoming: Map<string, string[]>,
  prevIndex: Map<string, number>,
): number {
  const preds = (incoming.get(id) ?? []).filter((p) => prevIndex.has(p))
  if (!preds.length) return prevIndex.size / 2
  let sum = 0
  for (const p of preds) sum += prevIndex.get(p) ?? 0
  return sum / preds.length
}

type Side = 'top' | 'bottom' | 'left' | 'right'

function anchor(n: ArchNode, side: Side) {
  switch (side) {
    case 'top':
      return { x: n.x + NODE_W / 2, y: n.y }
    case 'bottom':
      return { x: n.x + NODE_W / 2, y: n.y + NODE_H }
    case 'left':
      return { x: n.x, y: n.y + NODE_H / 2 }
    case 'right':
      return { x: n.x + NODE_W, y: n.y + NODE_H / 2 }
  }
}

/**
 * Orthogonal (square) edge routing — right angles only.
 * Cleaner for architecture diagrams than bezier curves.
 */
export function edgePath(
  s: ArchNode,
  t: ArchNode,
): { d: string; mx: number; my: number } {
  const scx = s.x + NODE_W / 2
  const scy = s.y + NODE_H / 2
  const tcx = t.x + NODE_W / 2
  const tcy = t.y + NODE_H / 2
  const dx = tcx - scx
  const dy = tcy - scy

  let fromSide: Side
  let toSide: Side
  if (Math.abs(dy) >= Math.abs(dx) * 0.55) {
    fromSide = dy >= 0 ? 'bottom' : 'top'
    toSide = dy >= 0 ? 'top' : 'bottom'
  } else {
    fromSide = dx >= 0 ? 'right' : 'left'
    toSide = dx >= 0 ? 'left' : 'right'
  }

  const a = anchor(s, fromSide)
  const b = anchor(t, toSide)
  const x1 = a.x
  const y1 = a.y
  const x2 = b.x
  const y2 = b.y

  // Straight line when already aligned (within 1px)
  if (Math.abs(x1 - x2) < 1.5) {
    return { d: `M ${x1} ${y1} L ${x2} ${y2}`, mx: x1, my: (y1 + y2) / 2 }
  }
  if (Math.abs(y1 - y2) < 1.5) {
    return { d: `M ${x1} ${y1} L ${x2} ${y2}`, mx: (x1 + x2) / 2, my: y1 }
  }

  // Elbow: vertical-first for hierarchy, horizontal-first for side links
  let midX: number
  let midY: number
  let d: string

  if (fromSide === 'bottom' || fromSide === 'top') {
    // V → H → V  (or simple mid-Y elbow)
    midY = (y1 + y2) / 2
    d = `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`
    midX = (x1 + x2) / 2
  } else {
    // H → V → H
    midX = (x1 + x2) / 2
    d = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`
    midY = (y1 + y2) / 2
  }

  return { d, mx: midX, my: midY }
}
