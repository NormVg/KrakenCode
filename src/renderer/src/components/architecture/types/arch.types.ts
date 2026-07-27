// ─── Architecture Graph Type Definitions ───────────────────────────────────
// All node/edge data types used throughout the Architecture View.

export type NodeKind = 'service' | 'database' | 'queue' | 'group' | 'external' | 'client'

export type NodeStatus = 'healthy' | 'degraded' | 'offline' | 'unknown'

export interface BaseNodeData {
  label: string
  kind: NodeKind
  description?: string
  status?: NodeStatus
  tech?: string          // e.g. "PostgreSQL", "Redis", "Express"
  port?: number
  tags?: string[]
}

export interface ServiceNodeData extends BaseNodeData {
  kind: 'service'
  endpoints?: string[]
}

export interface DatabaseNodeData extends BaseNodeData {
  kind: 'database'
  dbType?: 'relational' | 'document' | 'key-value' | 'graph' | 'vector'
}

export interface QueueNodeData extends BaseNodeData {
  kind: 'queue'
  pattern?: 'pub-sub' | 'point-to-point' | 'fanout'
}

export interface GroupNodeData extends BaseNodeData {
  kind: 'group'
  color?: string
}

export interface ExternalNodeData extends BaseNodeData {
  kind: 'external'
  url?: string
}

export interface ClientNodeData extends BaseNodeData {
  kind: 'client'
  platform?: 'web' | 'mobile' | 'desktop' | 'cli'
}

export type AnyNodeData =
  | ServiceNodeData
  | DatabaseNodeData
  | QueueNodeData
  | GroupNodeData
  | ExternalNodeData
  | ClientNodeData

export interface ArchEdgeData {
  label?: string
  protocol?: 'HTTP' | 'HTTPS' | 'gRPC' | 'WebSocket' | 'TCP' | 'AMQP' | 'MQ' | string
  direction?: 'one-way' | 'bidirectional'
  animated?: boolean
}

// The serializable JSON format for saving/loading/agent-context
export interface ArchGraphJSON {
  nodes: ArchNodeJSON[]
  edges: ArchEdgeJSON[]
  meta?: {
    title?: string
    description?: string
    savedAt?: string
    version?: string
  }
}

export interface ArchNodeJSON {
  id: string
  type: NodeKind
  position: { x: number; y: number }
  data: AnyNodeData
  parentId?: string
  style?: Record<string, string>
}

export interface ArchEdgeJSON {
  id: string
  source: string
  target: string
  data?: ArchEdgeData
}
