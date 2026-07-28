// Default and starter Mermaid diagrams for the Architecture view.

export const DEFAULT_ARCH_DIAGRAM = `%%{init: {"theme": "dark", "themeVariables": {
  "primaryColor": "#1C1C2A",
  "primaryTextColor": "#E2E8F0",
  "primaryBorderColor": "#9374BE",
  "lineColor": "#9DA1D3",
  "secondaryColor": "#141420",
  "tertiaryColor": "#0A0D18",
  "fontFamily": "Inter, system-ui, sans-serif"
}}}%%
flowchart TB
  subgraph Clients
    WEB[Web App]
    MOB[Mobile]
  end

  subgraph Edge
    GW[API Gateway]
  end

  subgraph Core
    AUTH[Auth Service]
    API[App API]
    WORK[Background Worker]
  end

  subgraph Data
    DB[(PostgreSQL)]
    REDIS[(Redis Queue)]
  end

  WEB --> GW
  MOB --> GW
  GW --> AUTH
  GW --> API
  API --> DB
  API --> WORK
  WORK --> REDIS
  AUTH --> DB
`

export interface ArchTemplate {
  id: string
  label: string
  description: string
  source: string
}

export const ARCH_TEMPLATES: ArchTemplate[] = [
  {
    id: 'system',
    label: 'System',
    description: 'Service topology',
    source: DEFAULT_ARCH_DIAGRAM,
  },
  {
    id: 'sequence',
    label: 'Sequence',
    description: 'Request flow',
    source: `sequenceDiagram
  actor User
  participant Web as Web App
  participant GW as API Gateway
  participant Auth as Auth Service
  participant DB as Database

  User->>Web: Login
  Web->>GW: POST /auth
  GW->>Auth: Verify credentials
  Auth->>DB: Lookup user
  DB-->>Auth: User row
  Auth-->>GW: JWT
  GW-->>Web: 200 + token
  Web-->>User: Session ready
`,
  },
  {
    id: 'c4',
    label: 'Context',
    description: 'C4-style context',
    source: `C4Context
  title System Context — Kraken

  Person(dev, "Developer", "Uses the local coding agent")
  System(kraken, "Kraken", "Desktop AI coding agent")
  System_Ext(ollama, "Ollama", "Local / remote LLM runtime")
  System_Ext(fs, "Filesystem", "Project workspace on disk")

  Rel(dev, kraken, "Chats, edits, runs tools")
  Rel(kraken, ollama, "Streams completions")
  Rel(kraken, fs, "Reads / writes code")
`,
  },
  {
    id: 'er',
    label: 'Data',
    description: 'Entity relationships',
    source: `erDiagram
  PROJECT ||--o{ CHAT : has
  CHAT ||--o{ MESSAGE : contains
  PROJECT ||--o| ARCHITECTURE : documents

  PROJECT {
    string id
    string name
    string path
  }
  CHAT {
    string id
    string title
  }
  MESSAGE {
    string role
    string content
  }
  ARCHITECTURE {
    string mermaidSource
  }
`,
  },
]
