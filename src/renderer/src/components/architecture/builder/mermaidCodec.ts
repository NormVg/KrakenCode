import type { ArchEdge, ArchModel, ArchNode, ArchNodeKind } from './types'
import { KIND_DEFAULT_LABEL } from './types'

// ── Compile model → Mermaid ───────────────────────────────────────────────────

function mermaidId(id: string): string {
  // Mermaid node ids: letters/numbers/underscore only
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

export function modelToMermaid(model: ArchModel): string {
  const lines: string[] = ['flowchart TB']

  if (model.nodes.length === 0) {
    lines.push('  empty["Drop nodes from the palette"]')
    return lines.join('\n') + '\n'
  }

  // Group lightly by kind for readability (optional subgraphs)
  const byKind = new Map<ArchNodeKind, ArchNode[]>()
  for (const n of model.nodes) {
    const list = byKind.get(n.kind) ?? []
    list.push(n)
    byKind.set(n.kind, list)
  }

  const kindOrder: ArchNodeKind[] = ['client', 'service', 'queue', 'database', 'external']
  for (const kind of kindOrder) {
    const nodes = byKind.get(kind)
    if (!nodes?.length) continue
    if (nodes.length >= 2) {
      const title = kind.charAt(0).toUpperCase() + kind.slice(1) + 's'
      lines.push(`  subgraph ${mermaidId(`sg_${kind}`)}["${title}"]`)
      for (const n of nodes) {
        lines.push(`    ${nodeShape(n.kind, n.id, n.label)}`)
      }
      lines.push('  end')
    } else {
      for (const n of nodes) {
        lines.push(`  ${nodeShape(n.kind, n.id, n.label)}`)
      }
    }
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

  return lines.join('\n') + '\n'
}

// ── Parse Mermaid → model (best-effort subset) ───────────────────────────────

const NODE_RE =
  /^\s*([A-Za-z][\w]*)\s*(?:\[\(\s*"?([^"\]]+?)"?\s*\)\]|\[\["?([^"\]]+?)"?\]\]|\(\s*"?([^")]+?)"?\s*\)|\(\[\s*"?([^"\]]+?)"?\s*\]\)|\[\s*"?([^"\]]+?)"?\s*\])/

const EDGE_RE =
  /^\s*([A-Za-z][\w]*)\s*-->\s*(?:\|"?([^"|]+?)"?\|\s*)?([A-Za-z][\w]*)/

function inferKind(matched: RegExpMatchArray): ArchNodeKind {
  // Order of capture groups in NODE_RE
  if (matched[2] != null) return 'database' // [()]
  if (matched[3] != null) return 'queue' // [[]]
  if (matched[4] != null) return 'external' // ()
  if (matched[5] != null) return 'client' // ([])
  return 'service'
}

function labelFromMatch(m: RegExpMatchArray): string {
  return (m[2] ?? m[3] ?? m[4] ?? m[5] ?? m[6] ?? 'Node').trim()
}

export function mermaidToModel(source: string): ArchModel {
  const nodes = new Map<string, ArchNode>()
  const edges: ArchEdge[] = []
  let col = 0
  let row = 0

  const place = () => {
    const x = 48 + (col % 4) * 200
    const y = 48 + Math.floor(col / 4) * 120 + row * 8
    col++
    return { x, y }
  }

  const ensureNode = (id: string, kind: ArchNodeKind, label: string) => {
    if (nodes.has(id)) {
      const existing = nodes.get(id)!
      if (label && label !== id) existing.label = label
      return
    }
    const pos = place()
    nodes.set(id, {
      id,
      kind,
      label: label || KIND_DEFAULT_LABEL[kind],
      x: pos.x,
      y: pos.y,
    })
  }

  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('%%') || line.startsWith('flowchart') || line.startsWith('graph')) continue
    if (line.startsWith('subgraph') || line === 'end') continue

    const edge = line.match(EDGE_RE)
    if (edge) {
      const sourceId = edge[1]
      const targetId = edge[3]
      const label = edge[2]?.trim()
      ensureNode(sourceId, 'service', sourceId)
      ensureNode(targetId, 'service', targetId)
      edges.push({
        id: `e-${sourceId}-${targetId}-${edges.length}`,
        source: sourceId,
        target: targetId,
        label: label || undefined,
      })
      continue
    }

    const node = line.match(NODE_RE)
    if (node) {
      const id = node[1]
      const kind = inferKind(node)
      ensureNode(id, kind, labelFromMatch(node))
    }
  }

  return {
    nodes: Array.from(nodes.values()),
    edges,
  }
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
