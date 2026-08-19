# Kraken Folder Structure Recommendation

> Recommended folder structure for Kraken's future, informed by grok-build's architecture and the Cordis dashboard categories (Models, Tools, Skills, Sessions, Sandboxes, Storage, Loops, UI).

## Current Problems

1. **`src/main/index.ts` is a 404-line monolith** — handles AI, PTY, FS, IPC, window management all in one file
2. **Components are flat** — no feature grouping; will become unwieldy as the project grows
3. **Types are minimal** — only `project.ts` and `editor.ts`; no conversation, tool, session, or model types
4. **Services are thin wrappers** — no service layer pattern; business logic leaks into stores and components
5. **No composables** — AGENTS.md recommends `composables/` but none exist
6. **`projects.ts` store does too much** — projects, chats, views, persistence all in one store
7. **No constants or shared config** — magic strings scattered everywhere
8. **Preload is a flat API dump** — no domain grouping

## Recommended Structure

```
kraken/
├── src/
│   ├── main/                           # Electron main process
│   │   ├── index.ts                    # App entry — window creation only
│   │   ├── ipc/                        # IPC handlers (one file per domain)
│   │   │   ├── index.ts                # Registers all handlers
│   │   │   ├── agent.ipc.ts            # agent:chat, agent:stream-chat, agent:setModel
│   │   │   ├── pty.ipc.ts              # pty:create, pty:write, pty:resize, pty:kill
│   │   │   ├── fs.ipc.ts               # fs:readDirectory, fs:readFile, fs:writeFile, etc.
│   │   │   └── store.ipc.ts            # store:read, store:write
│   │   ├── services/                   # Main-process business logic
│   │   │   ├── agent.service.ts        # AI model setup, streaming, provider management
│   │   │   ├── pty.service.ts           # PTY session registry, spawn, resize, kill
│   │   │   ├── filesystem.service.ts    # File operations (read, write, create, delete)
│   │   │   └── persistence.service.ts  # Electron store read/write
│   │   ├── lib/                        # Main-process utilities
│   │   │   ├── shell-env.ts            # Shell environment resolver
│   │   │   └── paths.ts                # App data paths, temp paths
│   │   └── types.ts                    # Main-process shared types
│   │
│   ├── preload/                        # Electron preload bridge
│   │   ├── index.ts                    # Entry — contextBridge exposure
│   │   └── api/                        # Typed API definitions (one per domain)
│   │       ├── agent.api.ts            # Chat/stream/model API surface
│   │       ├── pty.api.ts              # PTY API surface
│   │       ├── fs.api.ts               # Filesystem API surface
│   │       ├── store.api.ts            # Persistence API surface
│   │       └── window.api.ts           # Window controls API surface
│   │
│   ├── renderer/
│   │   └── src/
│   │       ├── App.vue                 # Root component
│   │       ├── main.ts                 # Renderer entry
│   │       │
│   │       ├── assets/                 # Static assets
│   │       │   ├── styles/             # Global CSS, variables, themes
│   │       │   │   ├── variables.css   # Color tokens, spacing, typography
│   │       │   │   ├── reset.css       # CSS reset
│   │       │   │   └── themes/         # Dark/light theme definitions
│   │       │   └── icons/              # SVG icons (if not using lucide)
│   │       │
│   │       ├── components/             # Reusable UI components (dumb + smart)
│   │       │   ├── ui/                 # Generic primitives (buttons, inputs, modals)
│   │       │   │   ├── BaseButton.vue
│   │       │   │   ├── BaseInput.vue
│   │       │   │   ├── BaseModal.vue
│   │       │   │   ├── BaseTooltip.vue
│   │       │   │   └── index.ts        # Barrel export
│   │       │   ├── chat/               # Chat-specific components
│   │       │   │   ├── ChatInput.vue
│   │       │   │   ├── ChatMessage.vue
│   │       │   │   ├── ChatMessageList.vue
│   │       │   │   ├── QueuedMessages.vue
│   │       │   │   └── ModelSelector.vue
│   │       │   ├── editor/             # Code editor components
│   │       │   │   ├── EditorTabs.vue
│   │       │   │   └── EditorPane.vue
│   │       │   ├── terminal/           # Terminal components
│   │       │   │   └── TerminalView.vue
│   │       │   ├── file-explorer/      # File tree components
│   │       │   │   ├── FileExplorerPanel.vue
│   │       │   │   └── FileTreeNode.vue
│   │       │   ├── architecture/       # Architecture/diagram components
│   │       │   │   ├── MermaidPreview.vue
│   │       │   │   ├── ArchGraphView.vue
│   │       │   │   ├── templates.ts
│   │       │   │   ├── builder/        # Diagram builder sub-components
│   │       │   │   │   ├── ArchBuilder.vue
│   │       │   │   │   ├── BuilderNodeCard.vue
│   │       │   │   │   ├── layout.ts
│   │       │   │   │   ├── mermaidCodec.ts
│   │       │   │   │   └── types.ts
│   │       │   │   └── composables/
│   │       │   │       └── useArchDiagram.ts
│   │       │   ├── tiptap/             # Rich text editor extensions
│   │       │   │   ├── AtMention.ts
│   │       │   │   ├── CommandList.vue
│   │       │   │   ├── SlashCommands.ts
│   │       │   │   ├── scratchpadSuggestion.ts
│   │       │   │   └── suggestion.ts
│   │       │   ├── sidebar/            # Sidebar components
│   │       │   │   ├── ProjectsSidebar.vue
│   │       │   │   ├── RightSidebar.vue
│   │       │   │   ├── ScratchpadPanel.vue
│   │       │   │   ├── ToolsPanel.vue
│   │       │   │   ├── Versions.vue
│   │       │   │   └── SettingsModal.vue
│   │       │   └── views/              # Full-page view containers
│   │       │       ├── AgentView.vue
│   │       │       ├── EditorView.vue
│   │       │       ├── TerminalView.vue  # (moved to terminal/ later)
│   │       │       ├── DiffView.vue
│   │       │       ├── WebViewView.vue
│   │       │       └── ArchGraphView.vue
│   │       │
│   │       ├── composables/           # Reusable business logic (Nuxt auto-import pattern)
│   │       │   ├── useAgent.ts         # Agent turn loop, streaming, tool calls
│   │       │   ├── useChat.ts          # Chat session management, message queue
│   │       │   ├── useTerminal.ts      # PTY lifecycle, input/output
│   │       │   ├── useFileSystem.ts    # File operations, tree building
│   │       │   ├── useModel.ts         # Model config, provider switching
│   │       │   ├── useArchitecture.ts  # Mermaid diagram management
│   │       │   ├── usePersistence.ts   # LocalStorage/Electron store
│   │       │   └── useMarkdown.ts      # markstream-vue rendering config
│   │       │
│   │       ├── stores/                # Pinia stores (one per domain)
│   │       │   ├── projects.store.ts   # Projects list, active project
│   │       │   ├── chat.store.ts       # Chat sessions, messages, streaming
│   │       │   ├── editor.store.ts     # Open files, active file, tabs
│   │       │   ├── config.store.ts     # Model provider, API keys, settings
│   │       │   ├── terminal.store.ts   # PTY sessions, active terminal
│   │       │   └── ui.store.ts         # Active view, sidebar state, theme
│   │       │
│   │       ├── services/               # Service layer (API communication only)
│   │       │   ├── agent.service.ts    # AI streaming, model setup (wraps window.api)
│   │       │   ├── pty.service.ts       # PTY create/write/kill (wraps window.api)
│   │       │   ├── fs.service.ts        # File operations (wraps window.api)
│   │       │   └── store.service.ts    # Persistence (wraps window.api)
│   │       │
│   │       ├── types/                  # TypeScript type definitions
│   │       │   ├── index.ts            # Barrel export
│   │       │   ├── chat.ts             # ChatMessage, ChatSession, MessageRole
│   │       │   ├── project.ts          # Project, ViewType
│   │       │   ├── editor.ts           # OpenFile, FileEntry, TreeNode
│   │       │   ├── agent.ts            # AgentConfig, ProviderConfig, ModelConfig
│   │       │   ├── terminal.ts         # PTYSession, TerminalConfig
│   │       │   └── architecture.ts     # ArchNode, ArchEdge, DiagramModel
│   │       │
│   │       ├── constants/              # App constants and enums
│   │       │   ├── views.ts            # ViewType enum, view labels
│   │       │   ├── ipc-channels.ts     # IPC channel name constants
│   │       │   ├── models.ts           # Available models, defaults
│   │       │   └── storage.ts          # Storage keys, filenames
│   │       │
│   │       ├── utils/                  # Pure utility functions
│   │       │   ├── file-utils.ts       # Extension detection, path utils
│   │       │   ├── markdown-utils.ts   # Markdown helpers
│   │       │   ├── architecture-agent.ts  # Architecture prompt builder
│   │       │   └── id.ts              # UUID generation
│   │       │
│   │       ├── plugins/               # Vue plugins
│   │       │   └── markstream.ts       # Markdown streaming plugin config
│   │       │
│   │       └── env.d.ts                # Environment type declarations
│   │
│   └── shared/                        # Types shared between main + renderer
│       ├── types/                      # Shared type definitions
│       │   ├── ipc.ts                  # IPC channel types, request/response shapes
│       │   └── agent.ts               # Agent request/response types shared across processes
│       └── constants/                  # Shared constants
│           └── ipc-channels.ts         # IPC channel names (used by both main + preload)
│
├── resources/                          # App resources (icons, etc.)
├── build/                              # Build resources
├── .info2ai/                           # Reference documentation
│   ├── grok-build/                     # Grok-build source (reference)
│   └── markstream.md                   # Markstream docs
├── grok-docs/                          # Grok-build analysis docs
├── AGENTS.md                           # Agent instructions
├── project.md                          # Project notes and tasklist
├── package.json
├── electron.vite.config.ts
├── tsconfig.json
├── tsconfig.web.json
├── tsconfig.node.json
└── eslint.config.mjs
```

## Migration Priority

### Phase 1: Split the monolith (do first)
Break `src/main/index.ts` into `ipc/` handlers + `services/` + `lib/`. This is the highest-risk file and the biggest blocker on growth.

### Phase 2: Domain-grouped stores
Split `projects.ts` (doing projects + chats + views + persistence) into `projects.store.ts`, `chat.store.ts`, `ui.store.ts`. Each store owns one domain.

### Phase 3: Composables
Extract reusable logic from components into `composables/`. `AgentView.vue` (280 lines) should delegate to `useAgent()`. `ChatInput.vue` (354 lines) should delegate to `useChat()`.

### Phase 4: Component grouping
Move flat components into domain folders (`chat/`, `editor/`, `terminal/`, `file-explorer/`, `sidebar/`).

### Phase 5: Types and constants
Expand `types/` to cover all domains. Create `constants/` for IPC channels, view types, model defaults. Create `shared/` for types used by both main and renderer.

### Phase 6: Service layer
Formalize `services/` as the only layer that touches `window.api`. Components and stores call services, never `window.api` directly.

## Why This Structure

Informed by grok-build's architecture (see `grok-docs/09-architecture.md`):

1. **Separate types from I/O** — grok-build's `xai-grok-sampling-types` has no HTTP/filesystem. Kraken's `types/` should be pure data definitions, importable anywhere.

2. **Actor/service isolation** — grok-build's `SessionActor` owns all state. Kraken's stores should own domain state exclusively, with services as the I/O boundary.

3. **Composables as the reusable logic layer** — grok-build's contributor pattern separates hooks from core logic. Kraken's composables should encapsulate business logic that components consume.

4. **IPC channel constants** — grok-build uses typed `ToolId` and `SessionCommand`. Kraken should centralize IPC channel names in `shared/constants/` to prevent typos across main/preload/renderer.

5. **Domain-oriented stores** — grok-build separates `ChatState`, `PermissionState`, `ToolState`. Kraken should separate `chat.store`, `editor.store`, `terminal.store`, `config.store`, `ui.store`.

6. **Service layer pattern** — grok-build's API routes call services, never DB directly. Kraken's components should call services, never `window.api` directly.

## Future Expansion

When Kraken adds these Cordis features, here's where they go:

| Feature | Location |
|:--------|:---------|
| **Models** (multi-provider, model switching) | `stores/config.store.ts`, `services/agent.service.ts`, `composables/useModel.ts`, `types/agent.ts` |
| **Tools** (tool definitions, execution) | `main/services/tool.service.ts`, `renderer/src/composables/useTools.ts`, `types/tool.ts` |
| **Skills** (slash commands, hooks) | `renderer/src/composables/useSlashCommands.ts`, `main/services/hook.service.ts` |
| **Sessions** (lifecycle, crash recovery) | `stores/session.store.ts`, `main/services/session.service.ts`, `composables/useSession.ts` |
| **Sandboxes** (agent operation isolation) | `main/services/sandbox.service.ts`, `main/lib/sandbox.ts` |
| **Storage** (memory, codebase index) | `main/services/memory.service.ts`, `stores/memory.store.ts`, `composables/useMemory.ts` |
| **Loops** (agent turn loop, workflows) | `composables/useAgent.ts`, `main/services/workflow.service.ts` |
| **UI** (rendering, markdown, mermaid) | `components/chat/`, `plugins/markstream.ts`, `components/architecture/` |
