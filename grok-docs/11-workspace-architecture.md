# Kraken Workspace Architecture

> The data model, SQLite schema, and folder structure for workspace-isolated state.

## Core Concepts

### Workspace = Project Folder

A **workspace** is a project folder the user chooses. It is the root isolation boundary:

- Each workspace has its own **sessions** (chats)
- Each workspace has its own **active view** (agent, editor, terminal, web, diff, graph)
- Each workspace has its own **editor state** (open files, active file)
- Each workspace has its own **terminal state** (PTY sessions)
- Each workspace has its own **right panel state** (scratchpad, tools, versions)
- Multiple workspaces can be open simultaneously
- Switching between workspaces restores that workspace's full state

### Session = Chat

A **session** is a conversation inside a workspace:

- Belongs to exactly one workspace
- Has messages (user + agent)
- Has a title (auto-derived from first message or user-set)
- Only one session is active per workspace at a time

## Data Model

```
Workspace
├── id: string (UUID)
├── name: string
├── path: string (filesystem path)
├── architecture: string (Mermaid source, nullable)
├── activeView: ViewType
├── activeSessionId: string (nullable)
├── leftSidebarOpen: boolean
├── rightSidebarOpen: boolean
├── rightSidebarWidth: number
├── createdAt: number (epoch ms)
├── lastOpenedAt: number (epoch ms)
│
├── Session[]
│   ├── id: string (UUID)
│   ├── workspaceId: string (FK → Workspace)
│   ├── title: string
│   ├── createdAt: number
│   ├── updatedAt: number
│   │
│   └── Message[]
│       ├── id: string (UUID)
│       ├── sessionId: string (FK → Session)
│       ├── role: 'user' | 'agent'
│       ├── content: string
│       ├── isStreaming: boolean
│       ├── createdAt: number
│
├── OpenFile[]
│   ├── id: string (path-based)
│   ├── workspaceId: string (FK → Workspace)
│   ├── path: string
│   ├── name: string
│   ├── language: string
│   ├── content: string
│   ├── isModified: boolean
│   ├── isActive: boolean
│   ├── openedAt: number
│
└── TerminalSession[]
    ├── id: string (UUID)
    ├── workspaceId: string (FK → Workspace)
    ├── ptyId: string
    ├── cwd: string
    ├── isActive: boolean
    ├── createdAt: number
```

## SQLite Schema

```sql
-- Workspaces (project folders)
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  architecture TEXT,
  active_view TEXT NOT NULL DEFAULT 'agent',
  active_session_id TEXT,
  left_sidebar_open INTEGER NOT NULL DEFAULT 1,
  right_sidebar_open INTEGER NOT NULL DEFAULT 1,
  right_sidebar_width INTEGER NOT NULL DEFAULT 300,
  created_at INTEGER NOT NULL,
  last_opened_at INTEGER NOT NULL,
  FOREIGN KEY (active_session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

-- Sessions (chats inside a workspace)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Chat',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);

-- Messages (inside sessions)
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'agent')),
  content TEXT NOT NULL DEFAULT '',
  is_streaming INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

-- Open files (per-workspace editor state)
CREATE TABLE IF NOT EXISTS open_files (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  path TEXT NOT NULL,
  name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'plaintext',
  content TEXT NOT NULL DEFAULT '',
  is_modified INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 0,
  opened_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE(workspace_id, path)
);

CREATE INDEX IF NOT EXISTS idx_open_files_workspace ON open_files(workspace_id);

-- Terminal sessions (per-workspace terminal state)
CREATE TABLE IF NOT EXISTS terminal_sessions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  pty_id TEXT NOT NULL,
  cwd TEXT,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_terminals_workspace ON terminal_sessions(workspace_id);

-- App-level config (model provider, API keys, etc.)
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

## Folder Structure

```
src/
├── main/
│   ├── index.ts                        # App entry — window creation only
│   ├── database/
│   │   ├── connection.ts               # SQLite connection singleton
│   │   ├── schema.ts                   # Schema creation + migrations
│   │   └── migrations/                 # Future schema migrations
│   ├── ipc/
│   │   ├── index.ts                    # Registers all IPC handlers
│   │   ├── workspace.ipc.ts            # Workspace CRUD
│   │   ├── session.ipc.ts              # Session CRUD
│   │   ├── message.ipc.ts             # Message CRUD
│   │   ├── agent.ipc.ts                # AI streaming, model setup
│   │   ├── pty.ipc.ts                  # PTY lifecycle
│   │   ├── fs.ipc.ts                   # Filesystem operations
│   │   └── editor.ipc.ts               # Open file state persistence
│   ├── services/
│   │   ├── workspace.service.ts        # Workspace business logic
│   │   ├── session.service.ts          # Session business logic
│   │   ├── message.service.ts          # Message business logic
│   │   ├── agent.service.ts            # AI model + streaming
│   │   ├── pty.service.ts              # PTY session registry
│   │   └── filesystem.service.ts       # File operations
│   └── lib/
│       ├── shell-env.ts                # Shell environment resolver
│       └── paths.ts                    # App data paths
│
├── preload/
│   ├── index.ts                        # contextBridge exposure
│   └── api/
│       ├── workspace.api.ts            # Workspace API surface
│       ├── session.api.ts              # Session API surface
│       ├── message.api.ts              # Message API surface
│       ├── agent.api.ts               # Agent API surface
│       ├── pty.api.ts                  # PTY API surface
│       ├── fs.api.ts                   # Filesystem API surface
│       └── window.api.ts              # Window controls
│
├── shared/
│   ├── types/
│   │   ├── index.ts                    # Barrel export
│   │   ├── workspace.ts               # Workspace, ViewType
│   │   ├── session.ts                 # Session, ChatMessage
│   │   ├── editor.ts                  # OpenFile
│   │   ├── terminal.ts                # TerminalSession
│   │   └── agent.ts                   # AgentConfig, ProviderConfig
│   └── constants/
│       └── ipc-channels.ts            # IPC channel name constants
│
└── renderer/
    └── src/
        ├── App.vue                     # Root — workspace tabs + view router
        ├── main.ts
        │
        ├── components/
        │   ├── ui/                     # Generic primitives
        │   ├── chat/                   # ChatInput, ChatMessage, QueuedMessages, ModelSelector
        │   ├── editor/                 # EditorTabs, EditorPane
        │   ├── terminal/              # TerminalView
        │   ├── file-explorer/         # FileExplorerPanel, FileTreeNode
        │   ├── architecture/          # MermaidPreview, ArchGraphView, builder/
        │   ├── tiptap/                # Rich text extensions
        │   ├── sidebar/               # ProjectsSidebar, RightSidebar, ScratchpadPanel, ToolsPanel, Versions, SettingsModal
        │   └── views/                 # AgentView, EditorView, DiffView, WebViewView
        │
        ├── composables/
        │   ├── useAgent.ts             # Agent turn loop, streaming
        │   ├── useChat.ts              # Session + message management
        │   ├── useTerminal.ts          # PTY lifecycle
        │   ├── useFileSystem.ts        # File operations
        │   ├── useModel.ts             # Model config
        │   ├── useArchitecture.ts      # Mermaid management
        │   └── useWorkspace.ts         # Workspace switching, state isolation
        │
        ├── stores/
        │   ├── workspace.store.ts      # Workspaces list, active workspace, view state per workspace
        │   ├── session.store.ts         # Sessions + messages for active workspace
        │   ├── editor.store.ts          # Open files per workspace
        │   ├── terminal.store.ts       # PTY sessions per workspace
        │   ├── config.store.ts          # Model provider, API keys
        │   └── ui.store.ts             # Global UI state (sidebar toggles, modals)
        │
        ├── services/
        │   ├── workspace.service.ts    # Wraps window.api.workspace
        │   ├── session.service.ts      # Wraps window.api.session
        │   ├── agent.service.ts         # Wraps window.api.agent
        │   ├── pty.service.ts           # Wraps window.api.pty
        │   └── fs.service.ts            # Wraps window.api.fs
        │
        ├── types/
        │   └── index.ts                 # Re-exports from shared/types
        │
        ├── constants/
        │   └── views.ts                 # View definitions, labels, icons
        │
        ├── utils/
        │   ├── file-utils.ts
        │   ├── markdown-utils.ts
        │   ├── architecture-agent.ts
        │   └── id.ts
        │
        ├── plugins/
        │   └── markstream.ts
        │
        └── env.d.ts
```

## Key Design Decisions

### 1. Workspace state is isolated

Every piece of state that was previously global is now keyed by `workspaceId`:

| State | Before (global) | After (per-workspace) |
|:------|:----------------|:----------------------|
| Active view | `projectsStore.activeView` | `workspace.activeView` |
| Open files | `editorStore.openFiles` | `openFiles WHERE workspace_id = ?` |
| Active file | `editorStore.activeFileId` | `openFiles WHERE workspace_id = ? AND is_active = 1` |
| Terminal sessions | `ptyProcesses` map (global) | `terminal_sessions WHERE workspace_id = ?` |
| Right sidebar | Global refs in App.vue | `workspace.rightSidebarOpen`, `workspace.rightSidebarWidth` |
| Active chat | `projectsStore.activeChatId` | `workspace.activeSessionId` |

### 2. SQLite replaces JSON files

The current `store:read` / `store:write` IPC writes the entire app state as one JSON blob. This doesn't scale — every save serializes everything, and there's no way to query or index.

SQLite gives us:
- Per-record CRUD (update one message without rewriting all messages)
- Foreign keys with cascade delete (delete workspace → all sessions/messages/files deleted)
- Indexed queries (get sessions for a workspace, ordered by updated_at)
- Atomic transactions
- Crash-safe writes (WAL mode)

### 3. Stores are workspace-aware

Stores no longer hold a single global array. Instead:

```typescript
// workspace.store.ts
const workspaces = ref<Workspace[]>([])
const activeWorkspaceId = ref<string | null>(null)

// Computed: get state for the active workspace
const activeWorkspace = computed(() =>
  workspaces.value.find(w => w.id === activeWorkspaceId.value)
)
const activeView = computed(() => activeWorkspace.value?.activeView ?? 'agent')
```

```typescript
// editor.store.ts — keyed by workspaceId
const openFilesByWorkspace = ref<Map<string, OpenFile[]>>(new Map())

const openFiles = computed(() => {
  const wsId = useWorkspaceStore().activeWorkspaceId
  return wsId ? openFilesByWorkspace.value.get(wsId) ?? [] : []
})
```

### 4. Views are workspace-scoped

The view container in App.vue renders views for the **active workspace only**. Switching workspaces changes which views are shown. Each workspace remembers its own `activeView`.

### 5. PTY sessions are workspace-scoped

Terminal PTY sessions are tagged with `workspaceId`. When switching workspaces, the terminal view shows only that workspace's terminals. PTY processes stay alive in the background.

## Migration Path

1. **SQLite setup** — install `better-sqlite3`, create database module, schema
2. **Types** — create `shared/types/` with workspace-isolated types
3. **Main process split** — break `index.ts` into `ipc/`, `services/`, `lib/`, `database/`
4. **Preload refactor** — domain-grouped API surface
5. **Store refactor** — workspace-aware stores
6. **Component refactor** — components read from workspace-scoped stores
7. **App.vue refactor** — workspace tabs, per-workspace view container
