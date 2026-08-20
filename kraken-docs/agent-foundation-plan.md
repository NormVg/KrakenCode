# Kraken Agent Foundation Plan

> Build a real coding agent — not a chat wrapper. The agent gets project-scoped tools, an agentic loop, conversation history, and a proper system prompt. Inspired by grok-build's architecture, adapted for Electron + Vue + AI SDK v7.

## Current State (What Exists)

| Component | Status | Problem |
|:----------|:-------|:--------|
| `agent.service.ts` | Single-shot `streamText` | No tools, no loop, no conversation history, sends only latest message |
| `agent.ipc.ts` | Streams text chunks | No tool-call events, no multi-step support |
| `filesystem.service.ts` | Basic FS ops | No workspace confinement, no `.gitignore`, no line numbers, no structured output |
| `pty.service.ts` | node-pty terminal | Works but had `posix_spawnp` errors (shell env resolution) |
| Database | Drizzle + SQLite | Stores messages but agent doesn't use history |
| AI SDK v7 | `ai@7.0.37` + `ai-sdk-ollama@4.1.0` | Supports `tools`, `stopWhen`, `onStepEnd` — none of which are used |

## What We're Building

A foundation coding agent that can:
1. Read files in the workspace (with line numbers)
2. Search files with regex (grep)
3. List directories
4. Edit files (exact string replacement)
5. Create new files
6. Run shell commands (builds, tests, linters)
7. Loop: call tools, see results, call more tools, until done
8. Maintain conversation context across turns
9. Stay confined to the workspace project folder

## Architecture

```
┌─ Renderer (Vue) ──────────────────────────────────────────┐
│  AgentView.vue                                             │
│    ├─ ChatMessage.vue (renders text + tool calls)          │
│    └─ ChatInput.vue                                        │
│                                                             │
│  chat.service.ts                                           │
│    └─ streamMessage() → IPC → main process                │
│                                                             │
│  session.store.ts                                          │
│    └─ messages[] (persisted to SQLite)                    │
└─────────────────────────────────────────────────────────────┘
                          ↕ IPC
┌─ Main Process (Electron) ─────────────────────────────────┐
│  agent.service.ts                                          │
│    ├─ buildSystemPrompt(workspace)                         │
│    ├─ buildMessages(history) → AI SDK format               │
│    ├─ tools: { read_file, list_dir, grep,                  │
│    │         write_file, edit_file, run_command }           │
│    ├─ streamText({ model, messages, tools, stopWhen })     │
│    └─ stream: text chunks + tool-call events → IPC         │
│                                                             │
│  agent-tools/                                              │
│    ├─ types.ts          (ToolDefinition, ToolResult)       │
│    ├─ read-file.tool.ts                                    │
│    ├─ list-dir.tool.ts                                     │
│    ├─ grep.tool.ts                                         │
│    ├─ write-file.tool.ts                                   │
│    ├─ edit-file.tool.ts                                    │
│    ├─ run-command.tool.ts                                  │
│    └─ index.ts          (registry)                          │
│                                                             │
│  workspace-guard.ts                                        │
│    └─ confinePath(workspacePath, requestedPath) → safe|deny│
└─────────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Workspace Guard + Tool Types

**Files to create:**
- `src/main/agent/workspace-guard.ts` — Path confinement utility
- `src/main/agent/types.ts` — Shared tool types

**workspace-guard.ts:**
- `confinePath(workspacePath, requestedPath)` — resolves requested path relative to workspace, rejects paths that escape the workspace root
- `isPathSafe(workspacePath, requestedPath)` — boolean check
- Handles both relative and absolute paths
- Symlink resolution (reject symlinks pointing outside workspace)
- Normalizes path separators

**types.ts:**
- `ToolExecutionContext` — workspace path, session ID, message ID
- `ToolResult` — success/error, content, metadata
- `ToolEvent` — for streaming tool call lifecycle to renderer

### Phase 2: Agent Tools (6 Tools)

Each tool is a function that takes typed args + execution context, returns a `ToolResult`. Wrapped in AI SDK `tool()` definitions for the model.

**read-file.tool.ts:**
- Args: `path` (relative to workspace), `offset?` (line number), `limit?` (line count)
- Returns: file content with `LINE_NUMBER→CONTENT` anchor format (every 10th line)
- Respects `.gitignore` (refuses to read ignored files)
- Rejects binary files (detect via null bytes)
- Max lines default: 2000

**list-dir.tool.ts:**
- Args: `path` (relative to workspace, defaults to root)
- Returns: files and folders, sorted (folders first, then alphabetical)
- Respects `.gitignore`
- Hides dot-files by default

**grep.tool.ts:**
- Args: `pattern` (regex), `path?` (search root, defaults to workspace), `glob?` (file filter), `contextLines?` (0-5)
- Uses `child_process.execFile('rg', ...)` — ripgrep, not shell grep
- Returns: ripgrep-style output (file:line:match)
- Respects `.gitignore` (ripgrep does this natively)
- Max results cap (100 matches)

**write-file.tool.ts:**
- Args: `path` (relative to workspace), `content` (full file content)
- Creates new file or overwrites existing
- Respects `.gitignore` (refuses to write ignored files)
- Creates parent directories if needed

**edit-file.tool.ts:**
- Args: `path`, `oldString`, `newString`, `replaceAll?` (default false)
- Exact string replacement (like grok-build's `search_replace`)
- `oldString` must match exactly once (unless `replaceAll`)
- Empty `oldString` = create new file (delegates to write-file logic)
- Rejects if `oldString == newString`
- Returns line diff (added/removed counts)

**run-command.tool.ts:**
- Args: `command` (string), `timeout?` (ms, default 30000, max 120000), `cwd?` (defaults to workspace)
- Runs via `child_process.exec` with shell
- Returns: stdout + stderr, exit code, truncated at 20000 chars
- Timeout: kills process, returns partial output
- Does NOT support background mode (keep it simple for foundation)

### Phase 3: System Prompt

**File:** `src/main/agent/system-prompt.ts`

A proper coding agent system prompt, inspired by grok-build but adapted for Kraken:

- Identity: "You are Kraken, a local-first AI coding agent inside a desktop IDE."
- Workspace context: project name, path, current date
- Tool usage rules: prefer dedicated tools over bash, never use echo to communicate
- Work policy: keep requirements in view, do reversible work immediately, only claim done when verified
- Communication: direct, concise, lead with the answer
- Formatting: GitHub-flavored markdown
- Architecture mermaid support (preserve existing behavior)
- AGENTS.md support (read project instruction files)

### Phase 4: Agentic Loop (agent.service.ts rewrite)

**File:** `src/main/services/agent.service.ts` (rewrite)

Replace single-shot `streamText` with multi-step:

```typescript
const result = streamText({
  model: aiModel,
  system: buildSystemPrompt(workspace),
  messages: buildMessages(history),  // full conversation history
  tools: {
    read_file: tool({ description, parameters: schema, execute: ... }),
    list_dir: tool({ ... }),
    grep: tool({ ... }),
    write_file: tool({ ... }),
    edit_file: tool({ ... }),
    run_command: tool({ ... }),
  },
  stopWhen: stepCountIs(50),  // max 50 steps per turn
  maxRetries: 2,
  onStepEnd: ({ stepCount, toolCalls, toolResults }) => {
    // Emit tool call events to renderer
    for (const tc of toolCalls) {
      event.sender.send(IPC.AGENT_TOOL_CALL(id), { tool: tc.toolName, args: tc.args })
    }
    for (const tr of toolResults) {
      event.sender.send(IPC.AGENT_TOOL_RESULT(id), { tool: tr.toolName, result: tr.result })
    }
  }
})

// Stream text chunks
for await (const chunk of result.textStream) {
  event.sender.send(IPC.AGENT_CHAT_CHUNK(id), chunk)
}
```

**Key changes:**
- Pass full message history (not just latest message) — convert DB messages to AI SDK format
- Define tools with `tool()` from AI SDK
- `stopWhen: stepCountIs(50)` — max 50 tool-call steps per turn
- `onStepEnd` callback emits tool call/result events to renderer
- `abortSignal` support for cancellation
- Stationarity detection: track consecutive identical tool calls, break after 8

**Conversation history conversion:**
- User messages → `{ role: 'user', content: text }`
- Agent messages → `{ role: 'assistant', content: text }`
- Tool calls/results need to be preserved in history for multi-turn context

### Phase 5: IPC Updates

**Files to modify:**
- `src/shared/constants/ipc-channels.ts` — Add new channels
- `src/main/ipc/agent.ipc.ts` — Pass workspace + history, emit tool events
- `src/preload/index.ts` — Expose new tool event listeners
- `src/renderer/src/services/chat.service.ts` — Handle tool events

**New IPC channels:**
```typescript
AGENT_TOOL_CALL: (id: string) => `agent:tool:call:${id}`,
AGENT_TOOL_RESULT: (id: string) => `agent:tool:result:${id}`,
AGENT_CANCEL: 'agent:cancel',
```

**agent.ipc.ts changes:**
- `AGENT_STREAM_CHAT` handler now receives `{ id, message, system, workspacePath, history }`
- Emits `AGENT_TOOL_CALL` and `AGENT_TOOL_RESULT` events during execution
- Handles `AGENT_CANCEL` to abort the stream

### Phase 6: Renderer Updates (Minimal)

**Files to modify:**
- `src/renderer/src/components/views/AgentView.vue` — Pass workspace + history to stream
- `src/renderer/src/services/chat.service.ts` — New `onToolCall`/`onToolResult` callbacks
- `src/renderer/src/stores/session.store.ts` — Build history array for the agent

**AgentView.vue changes:**
- Pass `workspaceStore.activeWorkspace?.path` to `streamMessage`
- Pass `sessionStore.messages` (converted to history format) to `streamMessage`
- Handle tool call events (for now, just log them — UI rendering comes later)

**chat.service.ts changes:**
- `StreamChatOptions` gains `workspacePath`, `history`, `onToolCall`, `onToolResult`
- Registers tool event listeners alongside text chunk listeners

## What We're NOT Building (Yet)

These are for later phases:
- Tool call UI rendering (collapsible tool call blocks in chat)
- Background task support (long-running commands)
- Subagent spawning / delegation
- Plan mode / goal system
- Memory system
- Permission gating (auto-approve all tools for now)
- LSP integration
- Web search
- Mermaid crash isolation

## Build Order

1. `workspace-guard.ts` + `types.ts` (foundation)
2. `read-file.tool.ts` + `list-dir.tool.ts` (simplest tools)
3. `grep.tool.ts` (needs ripgrep check)
4. `write-file.tool.ts` + `edit-file.tool.ts`
5. `run-command.tool.ts`
6. `system-prompt.ts`
7. `agent.service.ts` rewrite (the loop)
8. `agent.ipc.ts` + IPC channels + preload
9. `chat.service.ts` + `AgentView.vue` + `session.store.ts`
10. Test end-to-end: open workspace, ask agent to read a file and explain it

## Verification

After implementation, these must work:
1. Agent can read a file in the workspace and explain its contents
2. Agent can list the workspace directory structure
3. Agent can grep for a pattern across the workspace
4. Agent can create a new file in the workspace
5. Agent can edit an existing file (exact string replacement)
6. Agent can run a shell command (e.g., `ls`, `git status`)
7. Agent loops: reads a file, then edits it, then verifies the edit
8. Agent cannot access files outside the workspace
9. Conversation history is maintained across turns
10. Cancellation works (user can stop a running agent)
