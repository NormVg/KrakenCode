# Kraken Agent Foundation Plan (Revised — eve-based)

> Build the coding agent using `eve` as the foundation. Eve provides the agentic loop, tools, sandbox, streaming protocol, session management, and Vue integration. We author an agent directory on disk, boot eve's dev server in-process inside Electron, and connect the renderer via `useEveAgent`.

## Why eve instead of raw AI SDK

| Concern | Raw AI SDK (old plan) | eve |
|:--------|:----------------------|:----|
| Agentic loop | Hand-build with `streamText` + `stopWhen` | Built-in harness with `StepStarted`, `StepCompleted`, `TurnCompleted` events |
| Tools | Hand-build 6 tools from scratch | `defineReadFileTool`, `defineWriteFileTool`, `defineGrepTool`, `defineGlobTool`, `defineBashTool` — all framework-provided |
| Sandbox / path confinement | Hand-build workspace guard | `defineSandbox` with `just-bash` backend (virtual FS, no Docker needed) |
| System prompt | Hand-build template | `defineInstructions` — markdown-first authoring |
| Streaming to renderer | Hand-build IPC channels | `useEveAgent` Vue composable with typed stream events |
| Session persistence | Hand-build from DB messages | `ClientSession` with `continuationToken` + `sessionId` |
| Subagents | Not planned | `subagents/` directory with `defineAgent` |
| Tool call UI | Not planned | `defaultMessageReducer` projects tool calls into `EveMessagePart` |
| Cancellation | Hand-build with AbortSignal | `session.cancel()` + `useEveAgent().stop()` |

## Architecture

```
┌─ Renderer (Vue) ──────────────────────────────────────────────┐
│  AgentView.vue                                                 │
│    └─ useEveAgent({ host: 'http://localhost:PORT' })          │
│       ├─ data: EveMessageData (messages with parts)            │
│       ├─ status: 'ready' | 'submitted' | 'streaming' | 'error' │
│       ├─ send({ message })                                     │
│       └─ stop()                                                │
└────────────────────────────────────────────────────────────────┘
                          ↕ HTTP (localhost)
┌─ Main Process (Electron) ─────────────────────────────────────┐
│  eve-dev-server.ts                                              │
│    └─ createNodeDevelopmentRunner() → HTTP server on random port │
│                                                                 │
│  agent/ (authored on disk, compiled by eve)                    │
│    ├─ agent.ts          → defineAgent({ model, tools })        │
│    ├─ instructions.md   → system prompt                        │
│    ├─ tools/            → custom tools (if needed)             │
│    └─ sandbox.ts        → defineSandbox({ just-bash })        │
└────────────────────────────────────────────────────────────────┘
```

## How eve works

1. **Author an agent as a directory** — markdown for instructions, TypeScript for tools/config
2. **eve compiles it** to `.eve/` artifacts at dev time
3. **eve dev server** runs a Nitro HTTP server that handles agent turns
4. **Client** (renderer) connects via HTTP, sends messages, receives NDJSON stream events
5. **Stream events** are typed: `SessionStarted`, `TurnStarted`, `StepStarted`, `MessageReceived`, `MessageAppended`, `StepCompleted`, `TurnCompleted`, `ResultCompleted`, etc.
6. **`defaultMessageReducer`** folds stream events into `EveMessageData` with `messages[].parts[]` (text, reasoning, tool calls, tool results, step-start markers)
7. **`useEveAgent`** Vue composable wraps this in reactive refs

## Implementation Phases

### Phase 1: Author the Agent Directory

Create the agent definition on disk. Eve expects a specific directory structure.

**Files to create:**
- `agent/agent.ts` — `defineAgent({ model, tools, sandbox })`
- `agent/instructions.md` — system prompt (markdown-first)
- `agent/sandbox.ts` — `defineSandbox({ backend: justBash() })`
- `agent/package.json` — minimal package for eve to recognize the agent
- `agent/tsconfig.json` — TypeScript config for the agent

**agent.ts:**
```typescript
import { defineAgent } from 'eve'
import { defineSandbox } from 'eve/sandbox'
import { justBash } from 'eve/sandbox/just-bash'
import { readFile, writeFile, grep, glob, bash } from 'eve/tools/defaults'

export default defineAgent({
  model: 'ollama/gemma4:31b-cloud',  // or whatever model
  sandbox: defineSandbox({
    backend: justBash({ autoInstall: true })
  }),
  // Framework tools are included by default; we can customize here
})
```

**instructions.md:**
The system prompt as markdown — identity, workspace context, tool rules, work policy, communication guidelines. Inspired by grok-build's prompt but adapted for Kraken.

### Phase 2: Boot eve Dev Server in Electron

**File:** `src/main/eve/eve-dev-server.ts`

The eve dev server runs as a Nitro HTTP server. We boot it in the main process on a random port and pass the port to the renderer.

```typescript
import { createNodeDevelopmentRunner } from 'eve/dist/src/internal/nitro/host/dev-runner.js'

export async function startEveServer(agentDir: string): Promise<{ port: number; close: () => Promise<void> }> {
  const runner = createNodeDevelopmentRunner({
    entry: agentDir,
    name: 'kraken-agent',
    workerData: {}
  })
  await runner.waitForReady(30000)
  // The runner exposes a fetch() — we wrap it in a Node HTTP server
  // ...
}
```

**Key considerations:**
- The dev server runs in a worker thread — it won't block the main process
- We need to find the port it listens on (or assign one)
- The server handles `/eve/v1/...` routes for message/stream/cancel
- On app quit, we call `runner.close()`

### Phase 3: IPC for eve Server Lifecycle

**Files to modify:**
- `src/shared/constants/ipc-channels.ts` — Add `EVE_START`, `EVE_GET_PORT`, `EVE_STOP`
- `src/main/ipc/eve.ipc.ts` — Start/stop eve server, return port
- `src/preload/index.ts` — Expose eve IPC methods
- `src/main/ipc/index.ts` — Register eve IPC

**Flow:**
1. App starts → `initDatabase()` → `registerAllIpc()` → `createWindow()`
2. When user opens a workspace → start eve server with that workspace as the agent dir
3. Renderer gets the port → connects via `useEveAgent({ host: 'http://localhost:PORT' })`
4. On workspace switch → stop old server, start new one (or reuse if same agent config)
5. On app quit → `runner.close()` + `closeDatabase()`

### Phase 4: Renderer Integration with useEveAgent

**Files to modify:**
- `src/renderer/src/components/views/AgentView.vue` — Replace `ChatService.streamMessage` with `useEveAgent`
- `src/renderer/src/services/chat.service.ts` — Remove or repurpose (eve handles streaming)
- `src/renderer/src/stores/session.store.ts` — Sync with eve session state

**AgentView.vue changes:**
```typescript
import { useEveAgent } from 'eve/vue'

const evePort = ref<number | null>(null)

const { data, status, send, stop, error } = useEveAgent({
  host: `http://localhost:${evePort.value}`,
  onError: (err) => console.error('eve error:', err),
  onFinish: (snapshot) => {
    // Persist messages to SQLite
  }
})

const handleChat = async () => {
  if (!prompt.value.trim()) return
  await send({ message: prompt.value })
  prompt.value = ''
}
```

**Message rendering:**
The `data.messages` array contains `EveMessage` objects with `parts[]`. Each part is typed:
- `type: 'text'` — streamed text content
- `type: 'reasoning'` — model reasoning
- `type: 'dynamic-tool'` — tool call with lifecycle state
- `type: 'step-start'` — marks a new agent step
- `type: 'file'` — file attachments

We render these parts in `ChatMessage.vue`.

### Phase 5: Model Configuration

**File:** `agent/agent.ts`

Eve needs a model. We support Ollama (local + cloud) using the AI SDK's Ollama provider that's already in the project.

```typescript
import { defineAgent } from 'eve'
import { createOllama } from 'ai-sdk-ollama'

const ollama = createOllama({ baseURL: 'http://127.0.0.1:11434' })

export default defineAgent({
  model: ollama('gemma4:31b-cloud'),
  // ...
})
```

For cloud Ollama:
```typescript
const ollama = createOllama({
  baseURL: 'https://ollama.com',
  headers: { Authorization: `Bearer ${apiKey}` }
})
```

The model config is read from the app's SQLite config store and injected when the eve server boots.

### Phase 6: Workspace as Agent Directory

Each workspace IS an agent directory. When the user opens a project folder:
1. Create `agent/` subdirectory inside the workspace (or in app data)
2. Write `agent.ts`, `instructions.md`, `sandbox.ts` with workspace-specific config
3. Boot eve dev server pointing at that directory
4. The sandbox's `/workspace` maps to the project folder

**Sandbox configuration:**
```typescript
import { defineSandbox } from 'eve/sandbox'
import { justBash } from 'eve/sandbox/just-bash'

export default defineSandbox({
  backend: justBash({ autoInstall: true }),
  // workspace/ folder is seeded into the sandbox
})
```

The `workspace/` directory inside the agent dir contains the project files (or symlinks to them).

### Phase 7: Message Persistence

eve manages session state via `continuationToken` and `sessionId`. We persist this to SQLite so sessions can be resumed.

**Database changes:**
- `sessions` table: add `eveSessionId` and `eveContinuationToken` columns
- On `send()`: store the continuation token from the response
- On resume: pass `initialSession` to `useEveAgent` with the stored token
- Message content is still stored in the `messages` table for offline access

### Phase 8: Tool Call UI

The `defaultMessageReducer` projects tool calls as `EveMessagePart` with `type: 'dynamic-tool'`. We render these as collapsible blocks in `ChatMessage.vue`:

- Tool name + args (collapsed by default)
- Tool result (expandable)
- Status indicator (running / completed / failed)
- PixelLoader variant changes based on active tool (reading → blue, writing → green, executing → amber)

## What We're NOT Building (Yet)

- Subagents (eve supports this via `subagents/` directory)
- Skills (eve supports this via `defineSkill`)
- Permission gating / approval (eve supports this via `Approval` on tools)
- Custom tools beyond framework defaults
- Web search / web fetch
- Memory system
- Plan mode / goal system
- LSP integration
- Mermaid crash isolation

## Build Order

1. Create `agent/` directory with `agent.ts`, `instructions.md`, `sandbox.ts`
2. Build `eve-dev-server.ts` — boot eve in-process
3. Add IPC for eve server lifecycle
4. Wire up `useEveAgent` in AgentView
5. Update ChatMessage to render eve message parts
6. Configure model from app settings
7. Test end-to-end: open workspace, chat with agent, agent reads files
8. Add message persistence (continuation tokens in DB)
9. Add tool call UI rendering
10. Add PixelLoader variant switching based on active tool

## Verification

After implementation, these must work:
1. eve dev server boots when a workspace is opened
2. Renderer connects via `useEveAgent`
3. User sends a message → agent responds with streaming text
4. Agent can call `read_file` to read a file in the workspace
5. Agent can call `list_dir` / `glob` to explore the workspace
6. Agent can call `grep` to search file contents
7. Agent can call `write_file` to create a new file
8. Agent can call `bash` to run a shell command
9. Agent loops: reads a file, then edits it, then verifies
10. Tool calls render as collapsible blocks in the chat
11. PixelLoader switches variant based on active tool
12. Sessions persist across app restarts (continuation token)
13. Cancellation works (user clicks stop)
14. Agent stays confined to the workspace sandbox
