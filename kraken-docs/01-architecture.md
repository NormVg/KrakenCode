# Architecture

> Process model, layer separation, data flow, and current structural problems.

## Process Model

Kraken is an Electron app with three processes:

```
┌─────────────────────────────────────────────────────┐
│                  Main Process                        │
│                  src/main/index.ts                   │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ AI/Agent  │ │ PTY      │ │ File     │ │ JSON   │ │
│  │ Streaming │ │ Registry │ │ System   │ │ Store  │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│         │           │           │           │        │
│         └───────────┴───────────┴───────────┘        │
│                          │                           │
│                    ipcMain handlers                  │
└──────────────────────────┬──────────────────────────┘
                           │  IPC (contextBridge)
┌──────────────────────────┴──────────────────────────┐
│                  Preload                            │
│                  src/preload/index.ts               │
│                                                      │
│  Exposes `window.api` with:                         │
│    agent.*, pty.*, fs.*, store*, dialog*            │
└──────────────────────────┬──────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────┐
│                  Renderer (Vue 3)                    │
│                  src/renderer/src/                   │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Stores   │ │ Services │ │ Components│ │ Utils  │ │
│  │ (Pinia)  │ │ (API     │ │ (Vue)    │ │        │ │
│  │          │ │  wrappers)│           │ │        │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│         │           │           │                    │
│         └───────────┴───────────┘                    │
│                   App.vue                            │
│         (view router, sidebars, layout)              │
└─────────────────────────────────────────────────────┘
```

## Layer Separation (Current)

### Main Process — `src/main/index.ts` (404 lines, monolith)

Everything lives in one file:

| Responsibility | Lines | IPC Channels |
|:---------------|:------|:-------------|
| Window creation + lifecycle | 64-128 | `window-minimize`, `window-maximize`, `window-close` |
| Shell environment resolver | 19-61 | (internal helper) |
| AI model setup | 150-174 | `agent:setModel` |
| AI streaming | 176-202 | `agent:stream-chat` → `agent:chat:chunk:{id}`, `agent:chat:end:{id}`, `agent:chat:error:{id}` |
| Directory dialog | 204-215 | `dialog:openDirectory` |
| JSON store read/write | 217-243 | `store:read`, `store:write` |
| Filesystem operations | 245-304 | `fs:readDirectory`, `fs:readFile`, `fs:writeFile`, `fs:createItem`, `fs:deleteItem`, `fs:renameItem`, `fs:moveItem`, `fs:copyItem` |
| PTY management | 306-378 | `pty:create`, `pty:write`, `pty:resize`, `pty:kill` → `pty:data:{id}`, `pty:exit:{id}` |

### Preload — `src/preload/index.ts` (85 lines)

Exposes a flat `window.api` object with:
- `chat()`, `streamChat()`, `onChatChunk()`, `onChatEnd()`, `onChatError()`, `removeChatListeners()`
- `setModel()`
- `dialogOpenDirectory()`
- `storeRead()`, `storeWrite()`
- `fs.readDirectory()`, `fs.readFile()`, `fs.writeFile()`, `fs.createItem()`, `fs.deleteItem()`, `fs.renameItem()`, `fs.moveItem()`, `fs.copyItem()`
- `pty.create()`, `pty.write()`, `pty.resize()`, `pty.kill()`, `pty.onData()`, `pty.onExit()`, `pty.removeListeners()`
- `minimizeWindow()`, `maximizeWindow()`, `closeWindow()`

### Renderer — `src/renderer/src/`

| Directory | Purpose |
|:----------|:--------|
| `stores/` | Pinia stores (projects, chat, editor, config) |
| `services/` | Thin wrappers around `window.api` |
| `components/` | Vue components (flat, no feature grouping) |
| `components/views/` | Full-page view containers |
| `components/architecture/` | Mermaid diagram components + builder |
| `components/tiptap/` | TipTap rich text extensions |
| `types/` | TypeScript interfaces |
| `utils/` | Utility functions |
| `plugins/` | Vue plugins (markstream) |

## Data Flow

### Chat Flow

```
User types in ChatInput.vue
  → AgentView.vue handleChat()
  → chatStore.addMessageToActiveChat({ role: 'user', content })
  → chatStore.addMessageToActiveChat({ role: 'agent', isStreaming: true })
  → ChatService.streamMessage({ id, message, system })
  → window.api.streamChat(id, message, { system })
  → ipcMain: agent:stream-chat
  → streamText({ model: aiModel, system, prompt })
  → for await (chunk of textStream)
    → event.sender.send(`agent:chat:chunk:${id}`, chunk)
  → window.api.onChatChunk(id, cb)
  → chatStore.updateActiveChatStreamingMessage(chunk)
  → ChatMessage.vue re-renders (reactive)
  → on end: chatStore.endActiveChatStreamingMessage()
  → applyArchitectureFromAgentReply() (extracts mermaid fences)
  → projectsStore.saveData() (JSON persistence)
```

### File Edit Flow

```
User double-clicks file in FileExplorerPanel
  → editorStore.openFile({ name, path })
  → FileSystemService.readFile(path)
  → window.api.fs.readFile(path)
  → ipcMain: fs:readFile → fs.readFile(path, 'utf-8')
  → openFiles.push(newFile)
  → projectsStore.activeView = 'editor'
  → EditorView.vue renders Monaco with file content
  → on change: editorStore.updateFileContent(id, value)
  → debounced saveFile → FileSystemService.writeFile(path, content)
```

### Terminal Flow

```
TerminalView.vue onMounted
  → Ghostty.load(wasmUrl)
  → new Terminal({ ghostty, theme })
  → fitAddon.fit()
  → TerminalService.create(sessionId, cols, rows, cwd)
  → window.api.pty.create(id, cols, rows, cwd)
  → ipcMain: pty:create → pty.spawn(shell, ['-l'], { cwd, env })
  → ptyProcess.onData → event.sender.send(`pty:data:${id}`, data)
  → TerminalService.onData(sessionId, cb) → term.write(data)
  → term.onData → TerminalService.write(sessionId, data)
  → ipcMain: pty:write → ptyProcess.write(data)
```

## Current Problems

### 1. Main process is a monolith

`src/main/index.ts` is 404 lines handling AI, PTY, FS, IPC, window management, and persistence. No separation of concerns.

### 2. Views are global, not per-workspace

`projectsStore.activeView` is a single global value. Switching projects doesn't restore the view you were in for that project. All projects share the same view state.

### 3. Editor state is global

`editorStore.openFiles` is a single global array. Opening files in one project shows them in all projects. There's no per-project file isolation.

### 4. Terminal state is global

PTY sessions are tracked by a global `sessionId` (UUID generated on mount). There's no association between a terminal and a workspace. Switching projects loses terminal context.

### 5. Persistence is JSON blobs

`store:write` serializes the entire app state as one JSON file. Every save rewrites everything. No per-record CRUD, no queries, no indexes, no crash safety.

### 6. No composables

AGENTS.md recommends `composables/` but none exist. Business logic lives inside components (e.g., `AgentView.vue` has the full agent turn loop inline).

### 7. `projects.ts` store does too much

The projects store manages projects, chats, active view, active chat, architecture, and persistence — all in 90 lines with no domain separation.

### 8. No shared types between processes

Types live only in `src/renderer/src/types/`. The main process has no type definitions for the data it persists, leading to `any` in IPC handlers.

### 9. IPC channel names are magic strings

Channel names like `'agent:stream-chat'` and `'pty:create'` are hardcoded strings scattered across main, preload, and renderer with no central definition.

### 10. No service layer enforcement

Components and stores call `window.api` directly in some places (e.g., `projectsStore.addProject` calls `window.api.dialogOpenDirectory()`), bypassing the service layer.
