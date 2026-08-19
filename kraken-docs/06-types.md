# Types

> Data model — the TypeScript interfaces that define Kraken's domain.

## Type Files

| File | Exports |
|:-----|:--------|
| `types/project.ts` | `ChatMessage`, `ChatSession`, `Project`, `ViewType` |
| `types/editor.ts` | `OpenFile` |
| `types/index.ts` | Barrel re-export |

## ChatMessage

**File:** `src/renderer/src/types/project.ts:1-6`

```typescript
export interface ChatMessage {
  id?: string;
  role: 'user' | 'agent';
  content: string;
  isStreaming?: boolean;
}
```

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `id` | `string` | No | Optional — sometimes set with `Date.now().toString()`, sometimes undefined |
| `role` | `'user' \| 'agent'` | Yes | Message sender |
| `content` | `string` | Yes | Message text (markdown) |
| `isStreaming` | `boolean` | No | True while agent is actively streaming this message |

**Problem:** `id` is optional and inconsistently set. User messages sometimes have no ID. Agent messages use `Date.now().toString()` which is not unique if two messages are created in the same millisecond.

## ChatSession

**File:** `src/renderer/src/types/project.ts:8-13`

```typescript
export interface ChatSession {
  id: string;
  title: string;
  time: string; // e.g. "Just now" or Date string
  messages: ChatMessage[];
}
```

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `id` | `string` | Yes | UUID via `crypto.randomUUID()` |
| `title` | `string` | Yes | Defaults to "New Chat", auto-set from first user message |
| `time` | `string` | Yes | Display string, not a timestamp — "Just now" or date string |
| `messages` | `ChatMessage[]` | Yes | All messages in this session |

**Problem:** `time` is a display string, not an ISO timestamp or epoch number. It cannot be sorted or compared reliably. It's set to `"Just now"` on creation and never updated.

## Project

**File:** `src/renderer/src/types/project.ts:15-22`

```typescript
export interface Project {
  id: string;
  name: string;
  path: string;
  items: ChatSession[];
  architecture?: string;
}
```

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `id` | `string` | Yes | UUID via `crypto.randomUUID()` |
| `name` | `string` | Yes | Folder name extracted from path |
| `path` | `string` | Yes | Absolute filesystem path |
| `items` | `ChatSession[]` | Yes | All chat sessions in this project |
| `architecture` | `string` | No | Mermaid source for the architecture diagram |

**Problem:** `items` is a confusing name — it's chat sessions, not generic items. The project holds all session data inline, meaning the entire conversation history for all sessions is in memory at all times.

## ViewType

**File:** `src/renderer/src/types/project.ts:24`

```typescript
export type ViewType = 'agent' | 'editor' | 'web' | 'diff' | 'graph' | 'terminal'
```

Six view types:

| View | Component | Description |
|:-----|:----------|:------------|
| `agent` | `AgentView.vue` | Chat interface with AI agent |
| `editor` | `EditorView.vue` | Monaco code editor with tabs |
| `web` | `WebViewView.vue` | Embedded webview |
| `diff` | `DiffView.vue` | Diff viewer |
| `graph` | `ArchGraphView.vue` | Architecture diagram (Mermaid) |
| `terminal` | `TerminalView.vue` | Terminal (Ghostty + PTY) |

**Problem:** `ViewType` is global — one active view for all projects. Should be per-workspace.

## OpenFile

**File:** `src/renderer/src/types/editor.ts:1-8`

```typescript
export interface OpenFile {
  id: string;      // The absolute path acts as ID
  name: string;
  path: string;
  language: string;
  isModified: boolean;
  content: string; // Current unsaved content, or empty if not loaded yet
}
```

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `id` | `string` | Yes | Absolute file path (used as unique key) |
| `name` | `string` | Yes | Filename without directory |
| `path` | `string` | Yes | Absolute filesystem path |
| `language` | `string` | Yes | Monaco language identifier |
| `isModified` | `boolean` | Yes | Whether content has unsaved changes |
| `content` | `string` | Yes | Full file content in memory |

**Problem:** `content` holds the entire file in memory. Large files consume significant memory. No virtualization or lazy loading. The `id` and `path` are always identical — redundant fields.

## FileEntry

**File:** `src/renderer/src/services/filesystem.service.ts:1-5`

```typescript
export interface FileEntry {
  name: string
  path: string
  type: 'file' | 'folder'
}
```

Used by `FileSystemService.readDirectory()` to return directory listings. Not exported from `types/index.ts` — defined inline in the service file.

## Missing Types

The following types do not exist but are needed:

| Type | Purpose |
|:-----|:--------|
| `Workspace` | Renamed `Project` with workspace semantics |
| `TerminalSession` | PTY session metadata (id, workspaceId, cwd) |
| `AgentConfig` | Model provider configuration (typed, not `any`) |
| `ProviderConfig` | Provider definition (name, baseURL, supported models) |
| `StreamChatRequest` | Typed request for streaming chat (not inline payload) |
| `IPCResponse<T>` | Generic IPC response wrapper |
| `ArchitectureModel` | Structured diagram model (nodes, edges) |
