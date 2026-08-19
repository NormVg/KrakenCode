# Preload Bridge

> `src/preload/index.ts` — the contextBridge API surface between main and renderer.

## Overview

The preload script exposes a single `window.api` object to the renderer via `contextBridge.exposeInMainWorld`. It is a flat API with no domain grouping (except `fs` and `pty` which are nested objects).

## API Surface

### Agent / Chat

```typescript
// One-shot chat (not currently used by the UI)
chat: (message: string) => ipcRenderer.invoke('agent:chat', message)

// Streaming chat — fire and forget (ipcRenderer.send, not invoke)
streamChat: (id: string, message: string, options?: { system?: string }) =>
  ipcRenderer.send('agent:stream-chat', { id, message, system: options?.system })

// Stream event listeners (per chat ID)
onChatChunk: (id: string, callback: (chunk: string) => void) =>
  ipcRenderer.on(`agent:chat:chunk:${id}`, (_, chunk) => callback(chunk))

onChatEnd: (id: string, callback: () => void) =>
  ipcRenderer.once(`agent:chat:end:${id}`, () => callback())

onChatError: (id: string, callback: (err: string) => void) =>
  ipcRenderer.once(`agent:chat:error:${id}`, (_, err) => callback(err))

// Cleanup — must call before starting a new stream on the same ID
removeChatListeners: (id: string) => {
  ipcRenderer.removeAllListeners(`agent:chat:chunk:${id}`)
  ipcRenderer.removeAllListeners(`agent:chat:end:${id}`)
  ipcRenderer.removeAllListeners(`agent:chat:error:${id}`)
}

// Model configuration
setModel: (config: { provider: string, model: string, baseURL?: string }) =>
  ipcRenderer.invoke('agent:setModel', config)
```

**Key detail:** `onChatEnd` and `onChatError` use `ipcRenderer.once` (fire once), but `onChatChunk` uses `ipcRenderer.on` (fires multiple times). If a stream errors, `removeChatListeners` must be called to clean up the chunk listener.

### Filesystem

```typescript
fs: {
  readDirectory: (dirPath: string) => ipcRenderer.invoke('fs:readDirectory', dirPath)
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath)
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content)
  createItem: (itemPath: string, type: 'file' | 'folder') => ipcRenderer.invoke('fs:createItem', itemPath, type)
  deleteItem: (itemPath: string) => ipcRenderer.invoke('fs:deleteItem', itemPath)
  renameItem: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:renameItem', oldPath, newPath)
  moveItem: (source: string, dest: string) => ipcRenderer.invoke('fs:moveItem', source, dest)
  copyItem: (source: string, dest: string) => ipcRenderer.invoke('fs:copyItem', source, dest)
}
```

All filesystem operations use `ipcRenderer.invoke` (promise-based, returns a value).

### PTY

```typescript
pty: {
  create: (id: string, cols: number, rows: number, cwd?: string) =>
    ipcRenderer.invoke('pty:create', { id, cols, rows, cwd })

  write: (id: string, data: string) =>
    ipcRenderer.send('pty:write', { id, data })  // fire and forget

  resize: (id: string, cols: number, rows: number) =>
    ipcRenderer.send('pty:resize', { id, cols, rows })  // fire and forget

  kill: (id: string) =>
    ipcRenderer.send('pty:kill', { id })  // fire and forget

  onData: (id: string, callback: (data: string) => void) =>
    ipcRenderer.on(`pty:data:${id}`, (_, data) => callback(data))

  onExit: (id: string, callback: (exitCode: number) => void) =>
    ipcRenderer.once(`pty:exit:${id}`, (_, exitCode) => callback(exitCode))

  removeListeners: (id: string) => {
    ipcRenderer.removeAllListeners(`pty:data:${id}`)
    ipcRenderer.removeAllListeners(`pty:exit:${id}`)
  }
}
```

**Key detail:** `write`, `resize`, and `kill` use `ipcRenderer.send` (fire and forget, no return value). `create` uses `ipcRenderer.invoke` (returns `{ success, pid }`).

### Store (Persistence)

```typescript
storeRead: (filename: string) => ipcRenderer.invoke('store:read', filename)
storeWrite: (filename: string, data: any) => ipcRenderer.invoke('store:write', filename, data)
```

**Known issue:** `data` is typed as `any`. Vue reactive proxies cannot be structured-cloned across IPC. The renderer's `PersistenceService` works around this with `JSON.parse(JSON.stringify(data))` before sending.

### Dialog

```typescript
dialogOpenDirectory: () => ipcRenderer.invoke('dialog:openDirectory')
```

Returns `{ path: string, name: string }` or `null` if cancelled.

### Window Controls

```typescript
minimizeWindow: () => ipcRenderer.send('window-minimize')
maximizeWindow: () => ipcRenderer.send('window-maximize')
closeWindow: () => ipcRenderer.send('window-close')
```

All fire and forget (`ipcRenderer.send`).

## IPC Channel Map

| Channel | Direction | Pattern | Returns |
|:--------|:----------|:--------|:--------|
| `agent:chat` | renderer → main | `invoke` | response |
| `agent:setModel` | renderer → main | `invoke` | `{ success, error? }` |
| `agent:stream-chat` | renderer → main | `send` | void |
| `agent:chat:chunk:{id}` | main → renderer | `on` | chunk string |
| `agent:chat:end:{id}` | main → renderer | `once` | void |
| `agent:chat:error:{id}` | main → renderer | `once` | error string |
| `dialog:openDirectory` | renderer → main | `invoke` | `{ path, name } \| null` |
| `store:read` | renderer → main | `invoke` | parsed JSON \| null |
| `store:write` | renderer → main | `invoke` | boolean |
| `fs:readDirectory` | renderer → main | `invoke` | `FileEntry[]` |
| `fs:readFile` | renderer → main | `invoke` | string |
| `fs:writeFile` | renderer → main | `invoke` | boolean |
| `fs:createItem` | renderer → main | `invoke` | boolean |
| `fs:deleteItem` | renderer → main | `invoke` | boolean |
| `fs:renameItem` | renderer → main | `invoke` | boolean |
| `fs:moveItem` | renderer → main | `invoke` | boolean |
| `fs:copyItem` | renderer → main | `invoke` | boolean |
| `pty:create` | renderer → main | `invoke` | `{ success, pid }` |
| `pty:write` | renderer → main | `send` | void |
| `pty:resize` | renderer → main | `send` | void |
| `pty:kill` | renderer → main | `send` | void |
| `pty:data:{id}` | main → renderer | `on` | data string |
| `pty:exit:{id}` | main → renderer | `once` | exit code number |
| `window-minimize` | renderer → main | `send` | void |
| `window-maximize` | renderer → main | `send` | void |
| `window-close` | renderer → main | `send` | void |

## Type Declarations

**File:** `src/preload/index.d.ts`

Declares the `window.api` type for the renderer. Currently minimal — most methods return `any`.

## Problems

1. **Flat API** — No domain grouping except `fs` and `pty`. Agent, store, dialog, and window APIs are top-level.
2. **Magic strings** — Channel names are hardcoded strings with no central constant definitions.
3. **`any` types** — `storeWrite` takes `data: any`, `setModel` config is loosely typed.
4. **No cleanup guarantee** — `removeChatListeners` and `pty.removeListeners` must be called manually; no automatic cleanup on component unmount.
5. **`once` vs `on` mismatch** — `onChatEnd` and `onChatError` use `once` but if both fire (error then end), the second is silently dropped.
