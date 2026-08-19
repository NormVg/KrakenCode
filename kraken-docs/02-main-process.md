# Main Process

> `src/main/index.ts` — the 404-line Electron main process monolith.

## File Overview

| Section | Lines | Responsibility |
|:--------|:------|:---------------|
| Imports | 1-11 | Electron, path, os, fs, AI SDK, node-pty, crypto |
| PTY registry | 15-17 | `Map<string, pty.IPty>` — session ID to PTY instance |
| Shell env resolver | 19-61 | Resolves real shell environment for packaged apps |
| Window creation | 64-128 | BrowserWindow, DevTools, window controls |
| App ready | 133-387 | All IPC handler registrations |
| App lifecycle | 389-404 | window-all-closed, PTY cleanup |

## AI / Agent

### Model Setup — `agent:setModel`

**Lines:** 150-174

```typescript
ipcMain.handle('agent:setModel', (_, config) => {
  if (config.provider === 'ollama-local') {
    const ollama = createOllama({ baseURL: "http://127.0.0.1:11434" })
    aiModel = ollama(config.model || 'gemma4:31b-cloud')
    return { success: true }
  }
  if (config.provider === 'ollama-cloud') {
    const ollama = createOllama({
      baseURL: "https://ollama.com",
      headers: { Authorization: `Bearer ${apiKey}` }
    })
    aiModel = ollama(config.model || 'gemma4:31b-cloud')
    return { success: true }
  }
  return { success: false, error: 'Provider not supported yet' }
})
```

- `aiModel` is a module-level `any` variable — the active AI model instance
- Supports `ollama-local` (localhost:11434) and `ollama-cloud` (ollama.com with API key)
- No other providers implemented yet

### Streaming Chat — `agent:stream-chat`

**Lines:** 176-202

```typescript
ipcMain.on('agent:stream-chat', async (event, payload) => {
  const { id, message, system } = payload
  const { textStream } = streamText({
    model: aiModel,
    ...(system?.trim() ? { system: system.trim() } : {}),
    prompt: message,
  })
  for await (const chunk of textStream) {
    event.sender.send(`agent:chat:chunk:${id}`, chunk)
  }
  event.sender.send(`agent:chat:end:${id}`)
})
```

- Uses Vercel AI SDK `streamText()` for streaming
- Sends chunks via `agent:chat:chunk:{id}` IPC events
- Sends end via `agent:chat:end:{id}`
- Errors sent via `agent:chat:error:{id}`
- No conversation history sent — single-turn only (system prompt + current message)
- No tool calling support

## PTY Management

### Registry

**Line 17:** `const ptyProcesses = new Map<string, pty.IPty>()`

Global map of session ID to PTY instance. Not keyed by workspace.

### Shell Environment Resolver

**Lines 19-61:** `resolveShellEnv(shell)`

On macOS/Linux, packaged Electron apps launch without a login shell, getting a bare-bones PATH. This function spawns a login shell (`shell -lc env`) and captures its full environment. Cached after first call.

### PTY Create — `pty:create`

**Lines:** 309-353

```typescript
ipcMain.handle('pty:create', (event, { id, cols, rows, cwd }) => {
  const shell = process.env.SHELL || '/bin/zsh'
  const workingDir = cwd || os.homedir()
  const shellEnv = resolveShellEnv(shell)
  const ptyProcess = pty.spawn(shell, ['-l'], {
    name: 'xterm-256color',
    cols: cols || 80,
    rows: rows || 24,
    cwd: workingDir,
    env: { ...shellEnv, TERM: 'xterm-256color', COLORTERM: 'truecolor' }
  })
  ptyProcesses.set(id, ptyProcess)
  ptyProcess.onData(data => event.sender.send(`pty:data:${id}`, data))
  ptyProcess.onExit(({ exitCode }) => {
    event.sender.send(`pty:exit:${id}`, exitCode)
    ptyProcesses.delete(id)
  })
  return { success: true, pid: ptyProcess.pid }
})
```

### PTY Write/Resize/Kill

| Handler | Lines | Channel |
|:--------|:------|:--------|
| `pty:write` | 356-361 | `ipcMain.on` — sends keystrokes to PTY |
| `pty:resize` | 364-369 | `ipcMain.on` — resizes PTY dimensions |
| `pty:kill` | 372-378 | `ipcMain.on` — kills PTY process |

## Filesystem Operations

**Lines:** 245-304

| Handler | Channel | Operation |
|:--------|:--------|:----------|
| `fs:readDirectory` | `ipcMain.handle` | `fs.readdir` with `withFileTypes`, sorts folders first |
| `fs:readFile` | `ipcMain.handle` | `fs.readFile(path, 'utf-8')` |
| `fs:writeFile` | `ipcMain.handle` | `fs.writeFile(path, content, 'utf-8')` |
| `fs:createItem` | `ipcMain.handle` | `mkdir` for folders, `writeFile` for files |
| `fs:deleteItem` | `ipcMain.handle` | `fs.rm(path, { recursive: true, force: true })` |
| `fs:renameItem` | `ipcMain.handle` | `fs.rename(oldPath, newPath)` |
| `fs:moveItem` | `ipcMain.handle` | `fs.rename(source, dest)` |
| `fs:copyItem` | `ipcMain.handle` | `fs.cp(source, dest, { recursive: true })` |

## JSON Store

**Lines:** 217-243

| Handler | Channel | Operation |
|:--------|:--------|:----------|
| `store:read` | `ipcMain.handle` | Reads `{userData}/{filename}.json`, returns parsed JSON or null |
| `store:write` | `ipcMain.handle` | Atomic write: temp file + rename to `{userData}/{filename}.json` |

The store writes to Electron's `userData` directory. The only file used is `kraken_projects.json` which contains the entire app state (all projects, chats, messages, active view, active chat).

## Window Management

**Lines:** 64-128

- `titleBarStyle: 'hidden'` with traffic lights at `{ x: 12, y: 14 }`
- DevTools toggle: F12 or Cmd/Ctrl+Shift+I
- External links open in system browser (`shell.openExternal`)
- Window controls: `window-minimize`, `window-maximize`, `window-close`

## App Lifecycle

**Lines:** 389-404

- On `window-all-closed`: kills all PTY processes, quits app (except on macOS)
- On `activate`: re-creates window if none exist (macOS dock click)
