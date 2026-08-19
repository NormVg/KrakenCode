# Known Issues

> Active bugs and problems in the Kraken codebase.

## 1. Mermaid Diagrams Not Rendering

**Status:** Active
**Reported:** 2026-08-20

The agent writes mermaid diagrams in ` ```architecture-mermaid ` fences, but they don't render in the chat. The `markstream-vue` package is used for markdown rendering but its mermaid configuration may not be set up correctly.

**Root cause hypothesis:** The `plugins/markstream.ts` plugin configuration may not enable mermaid rendering, or the mermaid package integration is incomplete. The `mermaid` package is installed but may not be wired into the markstream renderer.

**Affected files:**
- `src/renderer/src/plugins/markstream.ts` — plugin config
- `src/renderer/src/components/ChatMessage.vue` — uses markstream for rendering

## 2. DevTools Cannot Be Opened

**Status:** Active
**Reported:** 2026-08-20

DevTools cannot be opened in the app. The main process has an F12 / Cmd+Shift+I handler, but it may not be working in certain states.

**Root cause hypothesis:** The `before-input-event` handler in the main process checks for F12 and Cmd+Shift+I, but the Electron `optimizer.watchWindowShortcuts` may be interfering. Also, in production builds, DevTools may be disabled.

**Affected files:**
- `src/main/index.ts:88-100` — DevTools toggle handler

## 3. Agent Gets Stuck

**Status:** Active
**Reported:** 2026-08-20

The AI agent sometimes gets stuck mid-stream. Restarting the app fixes it temporarily.

**Root cause hypothesis:** The streaming chat uses `ipcRenderer.send` (fire and forget) with no cancellation mechanism. If the AI model stops responding, the watchdog timeout fires but the main process keeps the connection open. There's no `AbortController` or cancel IPC. Also, `onChatEnd` and `onChatError` use `ipcRenderer.once` — if both fire, the second is silently dropped.

**Affected files:**
- `src/main/services/agent.service.ts` — no abort mechanism
- `src/renderer/src/services/chat.service.ts` — watchdog cleanup only removes listeners, doesn't cancel main process stream
- `src/preload/index.ts` — `once` vs `on` mismatch

## 4. "An object could not be cloned" IPC Error

**Status:** Fixed (workaround)
**Fixed in:** This refactor

Previously, Vue reactive proxies were passed directly to `window.api.storeWrite()`, which uses Electron's structured clone algorithm. Vue proxies cannot be cloned.

**Fix applied:** The old `PersistenceService` used `JSON.parse(JSON.stringify(data))` as a workaround. The new architecture uses SQLite via Drizzle ORM with typed repository methods, so reactive proxies are never passed to IPC. Each field is extracted and passed as a primitive.

## 5. PTY "posix_spawnp failed" Error

**Status:** Active (intermittent)
**Reported:** 2026-08-20

Terminal initialization sometimes fails with `Error: posix_spawnp failed`.

**Root cause hypothesis:** The shell path resolution (`process.env.SHELL || '/bin/zsh'`) may fail on systems where the shell isn't in the expected location. The `resolveShellEnv` function spawns a login shell to get the environment, which can fail if the shell binary is missing or permissions are wrong.

**Affected files:**
- `src/main/services/pty.service.ts` — shell resolution
- `src/main/lib/shell-env.ts` — environment resolver

## 6. Single-Turn Only (No Conversation History)

**Status:** Active
**Reported:** 2026-08-20

The agent only sends the current message to the model — no conversation history. Each turn is independent.

**Root cause:** The `agent.service.ts` `streamChat()` method calls `streamText({ model, system, prompt: message })` — it passes only the current message as `prompt`, not the full conversation history.

**Fix needed:** Build a conversation array from the session messages and pass it to the AI SDK. The Vercel AI SDK `streamText` accepts a `messages` parameter instead of `prompt`.

**Affected files:**
- `src/main/services/agent.service.ts` — `streamChat()` method
- `src/main/ipc/agent.ipc.ts` — IPC handler passes only `message` and `system`

## 7. Config Not Persisted

**Status:** Fixed in this refactor

Previously, the config store (`useConfigStore`) didn't persist the model provider, model name, or API key. On app restart, `isSetup` reset to `false`.

**Fix applied:** The new `config.store.ts` calls `window.api.config.set()` to persist provider, model, and apiKey to the SQLite `app_config` table. On startup, `loadConfig()` reads them back.
