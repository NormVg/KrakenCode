# Workspace Plan

> The target architecture for workspace-isolated state — what's been done and what remains.

## What "Workspace" Means

A **workspace** is a project folder the user opens. It is the root isolation boundary:

- Each workspace has its own **sessions** (chats)
- Each workspace has its own **active view** (agent, editor, terminal, web, diff, graph)
- Each workspace has its own **editor state** (open files, active file)
- Each workspace has its own **terminal state** (PTY sessions)
- Each workspace has its own **right panel state** (scratchpad, tools, versions)
- Multiple workspaces can be open simultaneously
- Switching between workspaces restores that workspace's full state

## What's Been Done

### Database Layer (Drizzle ORM + better-sqlite3)

- `src/main/database/schema.ts` — Drizzle schema for 6 tables: `workspaces`, `sessions`, `messages`, `open_files`, `terminal_sessions`, `app_config`
- `src/main/database/connection.ts` — SQLite connection with WAL mode, foreign keys, auto-migrations
- `src/main/database/repos.ts` — Typed repository layer with full CRUD for every table

### Main Process Split

- `src/main/index.ts` — now 90 lines, only window creation + lifecycle
- `src/main/ipc/` — one handler file per domain (agent, pty, fs, database)
- `src/main/services/` — business logic (agent.service, pty.service, filesystem.service)
- `src/main/lib/shell-env.ts` — shell environment resolver

### Shared Types

- `src/shared/types/index.ts` — Workspace, Session, Message, OpenFile, TerminalSession, AppConfig, ModelConfig, IpcResponse
- `src/shared/constants/ipc-channels.ts` — central IPC channel name definitions

### Preload Bridge

- Domain-grouped, fully typed API: `agent`, `workspace`, `session`, `message`, `openFile`, `terminal`, `config`, `fs`, `pty`, `dialog`, `window`
- Exports `KrakenApi` type for renderer type declarations

### Workspace-Aware Stores

- `workspace.store.ts` — workspaces list, active workspace, per-workspace view state
- `session.store.ts` — sessions + messages as separate refs, loaded per workspace
- `editor.store.ts` — open files per workspace, loaded from DB
- `config.store.ts` — persists model config to SQLite

### Components Updated

- All components use new store names and APIs
- Both `typecheck:node` and `typecheck:web` pass with zero errors

## What Remains

### 1. Multi-Workspace UI (Workspace Tabs)

Currently the app shows one workspace at a time. The target is to show multiple workspaces simultaneously with tabs or a workspace switcher.

**Needed:**
- Workspace tab bar in the top bar
- Each tab shows the workspace name and active view
- Clicking a tab switches the active workspace (restoring its view, editor, terminal state)
- Close button on tabs to close a workspace (without deleting it)

### 2. Per-Workspace View Container

The view container in `App.vue` currently renders views globally. It should render views for the active workspace only, and each workspace should remember its own `activeView`.

**Status:** `activeView` is already per-workspace in the database (the `workspaces.active_view` column). The `workspaceStore.activeView` computed reads from the active workspace. But the view components themselves (EditorView, TerminalView) still use global state in some cases.

**Needed:**
- `EditorView` should load files from `editorStore.loadOpenFiles()` when the workspace changes
- `TerminalView` should create/restore PTY sessions per workspace
- A watcher on `activeWorkspaceId` that triggers `loadSessions()`, `loadOpenFiles()`, and terminal restoration

### 3. Per-Workspace Terminal State

Terminal PTY sessions are still global (tracked by UUID in `TerminalView.vue`). They need to be associated with workspaces.

**Needed:**
- `TerminalView.vue` generates a `sessionId` and should pass it + `workspaceId` to `terminal.create()`
- The `terminal_sessions` table tracks which terminal belongs to which workspace
- When switching workspaces, show only that workspace's terminals
- PTY processes stay alive in the background when switching

### 4. Per-Workspace Right Panel (Scratchpad)

The scratchpad content should be per-workspace. The `workspaces.scratchpad_content` column exists but `ScratchpadPanel.vue` doesn't read from or write to it yet.

**Needed:**
- `ScratchpadPanel.vue` loads content from `workspaceStore.activeWorkspace?.scratchpadContent`
- On change, debounced save via `workspaceStore.setScratchpadContent(content)`

### 5. Per-Workspace Sidebar State

`leftSidebarOpen`, `rightSidebarOpen`, and `rightSidebarWidth` are in the `workspaces` table but `App.vue` still uses local refs.

**Needed:**
- `App.vue` reads sidebar state from `workspaceStore.activeWorkspace`
- On change, persists via `workspaceStore.updateWorkspace(id, { leftSidebarOpen, ... })`

### 6. Multi-Turn Conversation History

The agent currently sends only the current message to the model — no conversation history.

**Needed:**
- `agent.service.ts` `streamChat()` should accept a messages array, not just a single prompt
- `agent.ipc.ts` should pass the full conversation history from the renderer
- The renderer should build the messages array from `sessionStore.messages`

### 7. Session Auto-Load on Workspace Switch

When switching workspaces, the sessions list and messages for the active session should load automatically.

**Status:** `ProjectsSidebar.vue` has a watcher on `activeWorkspaceId` that calls `sessionStore.loadSessions()`. But `AgentView.vue` doesn't load messages when the active session changes.

**Needed:**
- Watcher on `workspaceStore.activeSessionId` that calls `sessionStore.loadMessages(sessionId)`
- `AgentView.vue` should reactively display messages from `sessionStore.messages`

### 8. Old Types Cleanup

The old `src/renderer/src/types/` directory still has `project.ts`, `editor.ts`, and `index.ts` with the old interfaces. These should be replaced with re-exports from `src/shared/types/`.

**Needed:**
- Delete `src/renderer/src/types/project.ts` and `src/renderer/src/types/editor.ts`
- Replace `src/renderer/src/types/index.ts` with: `export * from '../../../shared/types'`
- Update any imports that reference old types

### 9. Architecture Agent Utility

`src/renderer/src/utils/architectureAgent.ts` uses the old `Project` type. It should use the `Workspace` type from shared types.

**Needed:**
- Update `buildArchitectureSystemPrompt` to accept `Workspace` type
- Update `extractArchitectureUpdate` return type if needed

## Migration Summary

| Item | Status | Priority |
|:-----|:-------|:---------|
| SQLite database | Done | — |
| Main process split | Done | — |
| Shared types | Done | — |
| Preload typed API | Done | — |
| Workspace-aware stores | Done | — |
| Component API migration | Done | — |
| Typecheck passes | Done | — |
| Per-workspace view container | Partial | High |
| Per-workspace terminal state | Not started | High |
| Multi-workspace tabs UI | Not started | Medium |
| Per-workspace sidebar state | Not started | Medium |
| Per-workspace scratchpad | Not started | Medium |
| Multi-turn conversation history | Not started | High |
| Session auto-load on switch | Partial | High |
| Old types cleanup | Not started | Low |
| Architecture agent utility types | Not started | Low |
