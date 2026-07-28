// Structured architecture model — compiles to Mermaid (source of truth).

export type ArchNodeKind =
  | 'service'
  | 'database'
  | 'queue'
  | 'external'
  | 'client'
  | 'text'

export interface ArchNode {
  id: string
  kind: ArchNodeKind
  label: string
  tech?: string
  /** Accent color (border / label). Hex e.g. #8B7AA8 */
  color?: string
  /** Canvas position in builder (px). */
  x: number
  y: number
}

export interface ArchEdge {
  id: string
  source: string
  target: string
  label?: string
  /** Stroke color for the arrow. Hex e.g. #8B90C4 */
  color?: string
}

export interface ArchModel {
  nodes: ArchNode[]
  edges: ArchEdge[]
}

export interface PaletteItem {
  kind: ArchNodeKind
  label: string
  description: string
}

export const PALETTE_ITEMS: PaletteItem[] = [
  { kind: 'service', label: 'Service', description: 'API, worker, service' },
  { kind: 'database', label: 'Database', description: 'SQL, NoSQL, store' },
  { kind: 'queue', label: 'Queue', description: 'Pub/sub, broker' },
  { kind: 'external', label: 'External', description: '3rd party, SaaS' },
  { kind: 'client', label: 'Client', description: 'Web, mobile, CLI' },
  { kind: 'text', label: 'Text', description: 'Note or label' },
]

export const KIND_DEFAULT_LABEL: Record<ArchNodeKind, string> = {
  service: 'New Service',
  database: 'New Database',
  queue: 'New Queue',
  external: 'External API',
  client: 'Client App',
  text: 'Double-click to edit',
}

/** Muted accents — readable on dark chrome, not neon */
export const KIND_COLORS: Record<ArchNodeKind, string> = {
  service: '#8B7AA8',
  database: '#6B8CB8',
  queue: '#6A9AAA',
  external: '#A8926E',
  client: '#6B9B88',
  text: '#7A7E9A',
}

export const DEFAULT_EDGE_COLOR = '#7A7E9A'

/** Picker swatches for nodes + arrows (muted, on-brand) */
export const ARCH_COLOR_SWATCHES: Array<{ id: string; label: string; value: string }> = [
  { id: 'slate', label: 'Slate', value: '#7A7E9A' },
  { id: 'purple', label: 'Purple', value: '#8B7AA8' },
  { id: 'blue', label: 'Blue', value: '#6B8CB8' },
  { id: 'teal', label: 'Teal', value: '#6A9AAA' },
  { id: 'green', label: 'Green', value: '#6B9B88' },
  { id: 'amber', label: 'Amber', value: '#A8926E' },
  { id: 'rose', label: 'Rose', value: '#A87A86' },
  { id: 'coral', label: 'Coral', value: '#B07A72' },
]

export function resolveNodeColor(node: { kind: ArchNodeKind; color?: string }): string {
  return node.color || KIND_COLORS[node.kind]
}

export function resolveEdgeColor(edge: { color?: string }): string {
  return edge.color || DEFAULT_EDGE_COLOR
}
