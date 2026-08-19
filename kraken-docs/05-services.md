# Services

> Renderer services — thin wrappers around `window.api` IPC calls.

## Service Map

| Service | File | Lines | Wraps |
|:--------|:-----|:------|:------|
| `ChatService` | `services/chat.service.ts` | 57 | `window.api.streamChat`, `onChatChunk`, `onChatEnd`, `onChatError`, `removeChatListeners` |
| `FileSystemService` | `services/filesystem.service.ts` | 39 | `window.api.fs.*` |
| `PersistenceService` | `services/persistence.service.ts` | 23 | `window.api.storeRead`, `storeWrite` |
| `TerminalService` | `services/terminal.service.ts` | 29 | `window.api.pty.*` |

## ChatService

**File:** `src/renderer/src/services/chat.service.ts`

Wraps the streaming chat IPC into a callback-based API.

### Interface

```typescript
interface StreamChatOptions {
  id: string                                    // Unique stream ID
  message: string                               // User message
  system?: string                               // System prompt
  onChunk: (chunk: string) => void              // Called per text chunk
  onEnd: () => void                             // Called when stream completes
  onError: (err: string) => void               // Called on error
  timeoutMs?: number                           // Watchdog timeout (default 120s)
}
```

### Usage

```typescript
ChatService.streamMessage({
  id: msgId,
  message: text,
  system,
  onChunk: (chunk) => { /* append to message */ },
  onEnd: () => { /* finalize */ },
  onError: (err) => { /* show error */ }
})
```

### Watchdog

A `setTimeout` fires after `timeoutMs` (default 120 seconds). If the stream hasn't finished, it calls `onError` with a timeout message and cleans up listeners.

### Cleanup

Returns a `{ cleanup() }` method that can be called to abort the stream early. Sets `isFinished = true` to prevent further callbacks, clears the timeout, and removes IPC listeners.

### Problem

No abort mechanism on the main process side. Calling `cleanup()` stops the renderer from receiving chunks, but the main process keeps streaming from the AI model. There's no `AbortController` or cancel IPC.

## FileSystemService

**File:** `src/renderer/src/services/filesystem.service.ts`

Thin wrapper around `window.api.fs.*`. All methods are async.

### Methods

| Method | Returns | Description |
|:-------|:--------|:------------|
| `readDirectory(dirPath)` | `Promise<FileEntry[]>` | List directory contents |
| `readFile(filePath)` | `Promise<string>` | Read file as UTF-8 |
| `writeFile(filePath, content)` | `Promise<boolean>` | Write string to file |
| `createItem(itemPath, type)` | `Promise<boolean>` | Create file or folder |
| `deleteItem(itemPath)` | `Promise<boolean>` | Delete file or folder (recursive) |
| `renameItem(oldPath, newPath)` | `Promise<boolean>` | Rename |
| `moveItem(source, dest)` | `Promise<boolean>` | Move |
| `copyItem(source, dest)` | `Promise<boolean>` | Copy (recursive) |

### FileEntry Type

```typescript
interface FileEntry {
  name: string
  path: string
  type: 'file' | 'folder'
}
```

## PersistenceService

**File:** `src/renderer/src/services/persistence.service.ts`

Wraps `window.api.storeRead` and `window.api.storeWrite`.

### Methods

| Method | Returns | Description |
|:-------|:--------|:------------|
| `read<T>(key)` | `Promise<T \| null>` | Read JSON from store |
| `write<T>(key, data)` | `Promise<boolean>` | Write JSON to store |

### IPC Clone Fix

```typescript
async write<T>(key: string, data: T): Promise<boolean> {
  const plainData = JSON.parse(JSON.stringify(data))
  await window.api.storeWrite(key, plainData)
  return true
}
```

Vue reactive proxies cannot be structured-cloned across Electron IPC. This service strips reactivity by round-tripping through JSON. This is a workaround, not a fix — the root cause is passing reactive objects to IPC.

## TerminalService

**File:** `src/renderer/src/services/terminal.service.ts`

Wraps `window.api.pty.*`.

### Methods

| Method | Returns | Description |
|:-------|:--------|:------------|
| `create(id, cols, rows, cwd?)` | `Promise<{ success, pid? }>` | Spawn shell |
| `write(id, data)` | `void` | Send input to shell |
| `resize(id, cols, rows)` | `void` | Resize PTY |
| `kill(id)` | `void` | Kill shell |
| `onData(id, cb)` | `void` | Subscribe to shell output |
| `onExit(id, cb)` | `void` | Subscribe to exit event |
| `removeListeners(id)` | `void` | Clean up listeners |

### Problem

No session management. The caller generates a UUID (`crypto.randomUUID()`) and passes it as `id`. There's no registry of active terminals, no way to list them, and no association with a workspace.
