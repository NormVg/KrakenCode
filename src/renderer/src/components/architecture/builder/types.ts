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
  /** Canvas position in builder (px). */
  x: number
  y: number
}

export interface ArchEdge {
  id: string
  source: string
  target: string
  label?: string
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

export const KIND_COLORS: Record<ArchNodeKind, string> = {
  service: '#9374BE',
  database: '#3B82F6',
  queue: '#0EA5E9',
  external: '#F59E0B',
  client: '#10B981',
  text: '#9DA1D3',
}
