import type { ArchEdge, ArchModel, ArchNode, ArchNodeKind } from './types'
import { KIND_DEFAULT_LABEL } from './types'
import { layoutHierarchical } from './layout'

// ── Compile model → Mermaid ───────────────────────────────────────────────────

function mermaidId(id: string): string {
  const cleaned = id.replace(/[^a-zA-Z0-9_]/g, '_')
  return /^[0-9]/.test(cleaned) ? `n_${cleaned}` : cleaned || `n_${Math.random().toString(36).slice(2, 7)}`
}

function escapeLabel(label: string): string {
  return label.replace(/"/g, "'").replace(/\n/g, ' ').trim() || 'Node'
}

function nodeShape(kind: ArchNodeKind, id: string, label: string): string {
  const mid = mermaidId(id)
  const text = escapeLabel(label)
  switch (kind) {
    case 'database':
      return `${mid}[("${text}")]`
    case 'queue':
      return `${mid}[["${text}"]]`
    case 'external':
      return `${mid}("${text}")`
    case 'client':
      return `${mid}(["${text}"])`
    case 'service':
    default:
      return `${mid}["${text}"]`
  }
}

/** Emit flowchart in top-down order (by y, then x) — hierarchy-friendly, no kind subgraphs. */
export function modelToMermaid(model: ArchModel): string {
  const lines: string[] = ['flowchart TB']

  if (model.nodes.length === 0) {
    lines.push('  empty["Add nodes from the toolbar"]')
    return `${lines.join('\n')}\n`
  }

  const sorted = [...model.nodes].sort((a, b) => a.y - b.y || a.x - b.x)
  for (const n of sorted) {
    lines.push(`  ${nodeShape(n.kind, n.id, n.label)}`)
  }

  for (const e of model.edges) {
    const from = mermaidId(e.source)
    const to = mermaidId(e.target)
    if (e.label?.trim()) {
      lines.push(`  ${from} -->|"${escapeLabel(e.label)}"| ${to}`)
    } else {
      lines.push(`  ${from} --> ${to}`)
    }
  }

  return `${lines.join('\n')}\n`
}

// ── Parse Mermaid → model ─────────────────────────────────────────────────────

const NODE_RE =
  /^\s*([A-Za-z][\w]*)\s*(?:\[\(\s*"?([^"\]]+?)"?\s*\)\]|\[\["?([^"\]]+?)"?\]\]|\(\s*"?([^")]+?)"?\s*\)|\(\[\s*"?([^"\]]+?)"?\s*\]\)|\[\s*"?([^"\]]+?)"?\s*\])/

const EDGE_RE =
  /^\s*([A-Za-z][\w]*)\s*-->\s*(?:\|"?([^"|]+?)"?\|\s*)?([A-Za-z][\w]*)/

function inferKind(matched: RegExpMatchArray, label: string): ArchNodeKind {
  if (matched[2] != null) {
    // Cylinder shape — database unless name hints queue
    const l = label.toLowerCase()
    if (l.includes('redis') || l.includes('queue') || l.includes('kafka') || l.includes('mq')) {
      return 'queue'
    }
    return 'database'
  }
  if (matched[3] != null) return 'queue'
  if (matched[4] != null) return 'external'
  if (matched[5] != null) return 'client'
  return 'service'
}

function labelFromMatch(m: RegExpMatchArray): string {
  return (m[2] ?? m[3] ?? m[4] ?? m[5] ?? m[6] ?? 'Node').trim()
}

export function mermaidToModel(source: string): ArchModel {
  const nodes = new Map<string, ArchNode>()
  const edges: ArchEdge[] = []

  const ensureNode = (id: string, kind: ArchNodeKind, label: string) => {
    if (nodes.has(id)) {
      const existing = nodes.get(id)!
      if (label && label !== id) {
        existing.label = label
        existing.kind = kind
      }
      return
    }
    nodes.set(id, {
      id,
      kind,
      label: label || KIND_DEFAULT_LABEL[kind],
      x: 0,
      y: 0,
    })
  }

  // Pass 1: node definitions
  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('%%') || line.startsWith('flowchart') || line.startsWith('graph')) continue
    if (line.startsWith('subgraph') || line === 'end') continue
    if (EDGE_RE.test(line)) continue

    const node = line.match(NODE_RE)
    if (node) {
      const id = node[1]
      const label = labelFromMatch(node)
      ensureNode(id, inferKind(node, label), label)
    }
  }

  // Pass 2: edges
  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim()
    const edge = line.match(EDGE_RE)
    if (!edge) continue
    const sourceId = edge[1]
    const targetId = edge[3]
    const label = edge[2]?.trim()
    if (!nodes.has(sourceId)) ensureNode(sourceId, 'service', sourceId)
    if (!nodes.has(targetId)) ensureNode(targetId, 'service', targetId)
    edges.push({
      id: `e-${sourceId}-${targetId}-${edges.length}`,
      source: sourceId,
      target: targetId,
      label: label || undefined,
    })
  }

  // Hierarchical layout — never leave a flat random grid
  return layoutHierarchical({
    nodes: Array.from(nodes.values()),
    edges,
  })
}

export function createEmptyModel(): ArchModel {
  return { nodes: [], edges: [] }
}

export function newNodeId(kind: ArchNodeKind): string {
  return `${kind}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`
}

export function newEdgeId(source: string, target: string): string {
  return `e_${source}_${target}_${Date.now().toString(36)}`
}
