# Architecture

> Crate structure, design patterns, and key takeaways from grok-build for the Kraken project.

## 1. Crate Organization

The codebase contains 60+ crates organized under `crates/codegen/`, each with a single responsibility. Crates are organized by layer:

### Core Types Layer (No I/O)

| Crate | Purpose |
|:------|:--------|
| `xai-grok-sampling-types` | Pure data types for sampling/API layer (no HTTP, no filesystem) |
| `xai-grok-config-types` | Configuration type definitions |
| `xai-hooks-plugins-types` | Hooks and plugins type definitions |
| `xai-token-estimation` | Token estimation primitives (single source of truth) |
| `xai-grok-workspace-types` | Workspace type definitions |
| `xai-grok-shared` | Shared types and utilities |

### Agent Layer

| Crate | Purpose |
|:------|:--------|
| `xai-agent-lifecycle` | Host-agnostic lifecycle hooks (contributor pattern) |
| `xai-chat-state` | Actor-based conversation state management |
| `xai-grok-agent` | Agent definition and configuration |
| `xai-grok-subagent-resolution` | Pure-logic subagent config/definition resolution |
| `xai-compaction-transcript` | Pure rendering of compacted segments to markdown |
| `xai-prompt-queue` | Shared prompt-queue wire types and merge rules |

### Tools Layer

| Crate | Purpose |
|:------|:--------|
| `xai-grok-tools` | Tool implementations and coordinator |
| `xai-grok-tools-api` | Tool API contracts and traits |
| `xai-grok-mcp` | Model Context Protocol integration |
| `xai-codebase-graph` | Tree-sitter code graph |
| `xai-fuzzy-file-search` | Fuzzy file search with nucleo |
| `xai-gix-status` | Thread-safe git status scanning |
| `xai-fast-worktree` | CoW git worktree creation |
| `xai-hunk-tracker` | File hunk tracking with attribution |

### Shell Layer

| Crate | Purpose |
|:------|:--------|
| `xai-grok-shell` | The main host: session actor, turn loop, tools, persistence |
| `xai-grok-shell-base` | Shell base utilities |
| `xai-grok-shell-session-support` | Session support utilities |

### Security Layer

| Crate | Purpose |
|:------|:--------|
| `xai-grok-sandbox` | Kernel-enforced sandboxing (Landlock/Seatbelt) |
| `xai-grok-secrets` | Secret redaction |
| `xai-grok-auth` | Authentication |

### Infrastructure Layer

| Crate | Purpose |
|:------|:--------|
| `xai-grok-config` | Config loading, layers, signed policies |
| `xai-grok-workspace` | Workspace daemon, permissions, sessions |
| `xai-grok-workspace-client` | Workspace client |
| `xai-grok-workspace-daemon` | Workspace daemon |
| `xai-grok-memory` | Hybrid (BM25 + vector) memory system |
| `xai-grok-hooks` | Hooks system |
| `xai-grok-workflow` | Rhai-scripted workflow engine |
| `xai-grok-models` | Model configuration |
| `xai-grok-sampler` | API sampling calls |
| `xai-grok-paths` | Path utilities |

### UI Layer

| Crate | Purpose |
|:------|:--------|
| `xai-grok-pager` | Terminal UI framework |
| `xai-grok-pager-bin` | Pager binary |
| `xai-grok-pager-diff` | Diff rendering |
| `xai-grok-pager-minimal` | Minimal pager |
| `xai-grok-pager-render` | Pager rendering |
| `xai-grok-pager-pty-harness` | PTY management |
| `xai-grok-markdown` | Terminal markdown rendering |
| `xai-grok-markdown-core` | Core markdown rendering primitives |
| `xai-grok-mermaid` | Mermaid diagram rendering |
| `xai-ratatui-inline` | Inline ratatui components |
| `xai-ratatui-textarea` | Textarea component |
| `xai-tty-utils` | Terminal utilities |

### Supporting Layer

| Crate | Purpose |
|:------|:--------|
| `xai-grok-active-sessions` | Crash recovery tracking |
| `xai-grok-foreign-sessions` | Foreign session discovery/import |
| `xai-grok-session-events` | Session event types |
| `xai-grok-session-search` | Session search |
| `xai-grok-telemetry` | Telemetry |
| `xai-grok-diag-server` | Diagnostic server |
| `xai-grok-env` | Environment utilities |
| `xai-grok-home` | Grok home directory |
| `xai-grok-http` | HTTP utilities |
| `xai-grok-extra-ca` | Extra CA certificates |
| `xai-grok-bundle` | Bundling |
| `xai-grok-update` | Auto-update |
| `xai-grok-version` | Version info |
| `xai-grok-voice` | Voice support |
| `xai-grok-announcements` | Announcements |
| `xai-grok-plugin-marketplace` | Plugin marketplace |
| `xai-sqlite-journal` | SQLite journal |
| `xai-file-utils` | File utilities |
| `xai-fsnotify` | Filesystem notification |
| `xai-system-power` | System power management |
| `xai-tracing-macros` | Tracing macros |
| `xai-acp-lib` | ACP library |
| `xai-crash-handler` | Crash handler |
| `xai-mixpanel` | Mixpanel analytics |
| `ptyctl` / `ptyctl-cli` | PTY control |

## 2. Key Design Patterns

### 2.1 Actor Pattern

The entire system uses actors for state isolation:

- **SessionActor** — Owns all session state, runs on a dedicated OS thread
- **ChatStateActor** — Owns conversation state, no locks (sequential command processing)
- **PermissionManager** — Owns permission state, spawned as a dedicated task
- **HunkTrackerActor** — Owns file hunk state, runs in a dedicated tokio task
- **Coordinator Actor** (subagents) — Owns all subagent lifecycle state

**Key principle:** State is owned exclusively by the actor task — no locks, no atomics, no shared mutable state. Commands processed sequentially via mpsc channels.

### 2.2 Contributor Pattern

**File:** `crates/codegen/xai-agent-lifecycle/src/`

Host-agnostic lifecycle hooks that receive data-only inputs at dispatch time. Contributors never own loop control; they act through capabilities injected at install time.

Four contributor traits:
1. `TurnLifecycleContributor` — Turn start/done/abort/error
2. `TurnInputContributor` — Contribute turn input fragments
3. `SessionLifecycleContributor` — Session idle
4. `CommandContributor` — Advertise and handle commands

Two flavors: `send` (Send + Sync, Arc-based) and `local` (?Send, Rc-based for single-threaded hosts).

### 2.3 InputPolicy — Typed Turn Classification

Every turn carries an `InputPolicy` that classifies it along six dimensions:

```rust
pub struct InputPolicy {
    pub authority: InputAuthority,       // HumanIntent | ModelAuthoredUntrusted | RuntimeControl
    pub turn_boundary: TurnBoundary,     // Conversational | MidTurn | None
    pub analytics: AnalyticsClass,        // HumanPrompt | AgentMessage | RuntimeWake
    pub compaction: CompactionClass,      // HumanAnchor | ConversationalAgentAnchor | RuntimeEphemera
    pub queue: QueuePolicy,               // VisibleProtected | VisibleEditable | Hidden
    pub shutdown: ShutdownPolicy,         // Drain | CancelWithProducer | DropEphemeral
}
```

This policy drives compaction decisions, queue visibility, analytics classification, and shutdown behavior.

### 2.4 Journal Pattern (Write-Ahead Log)

Used in two places:
- **Workflow Journal** — Records every result-bearing host call for replay/resumption
- **Session Persistence** — `updates.jsonl` is the durable source of truth

Key properties:
- `req_hash` (SHA-256) for divergence detection
- Truncation for error recovery (`prune_trailing_host_error`)
- Fast-forward on resume

### 2.5 Graceful Degradation

Every subsystem degrades rather than crashes:

| Subsystem | Degradation Path |
|:----------|:-----------------|
| Fuzzy search | Full → BrowseOnly → Disabled |
| Memory search | Hybrid (BM25 + vector) → FTS-only |
| Git status | Parallel → Serial (1 thread) |
| Mermaid | PureRustEngine → error (never auto-selects mmdc) |
| Sandbox | Applied → fail-closed (treated as confining) |

### 2.6 Fail-Closed Defaults

- Permissions default to `deny` (CWE-1188)
- Sandbox profiles are immutable after apply
- Requested-but-unapplied sandbox profiles are treated as confining
- Hook file I/O errors abort subagent resolution
- Permission analysis failures return `AskFailClosed`

### 2.7 Dual-Track Token Accounting

1. **Provider-reported `total_tokens`** — Set when the model reports usage
2. **Estimated `estimated_tokens_since_model`** — Incremented on every non-assistant push via bytes/4 heuristic. Provides real-time overflow detection between model responses.

### 2.8 Turn Capture

Instead of duplicating each conversation item on push, a single offset records where the turn started. At take time, `conversation[turn_start_offset..]` gives the turn's items with one bulk clone. Mid-turn conversation replacements snapshot the slice first.

## 3. Session Actor Architecture

### Dedicated OS Thread

Each session runs on a dedicated OS thread with its own tokio runtime and `LocalSet`:

```
spawn_session_on_thread:
  1. Create OS thread (name: ses-{first 8 chars of session id}, 8MB stack)
  2. Load initial state from updates.jsonl
  3. Build tokio runtime, enter LocalSet, block_on
  4. spawn_session_actor — constructs SessionActor + all dependencies
  5. Send SessionInitResult back via oneshot channel
```

The `!Send` `SessionActor` is constructed on the session thread and never crosses a thread boundary.

### Main Loop

```rust
loop {
    tokio::select! {
        biased;
        _ = &mut idle_flush_sleep, if ... => { /* background memory flush */ }
        _ = &mut dream_check_sleep, if ... => { /* periodic dream check */ }
        changed = model_switch_rx.changed() => { /* reset laziness counter */ }
        event = chat_state_event_rx.recv() => { /* ConversationReset, ImageBudget */ }
        maybe_event = event_rx.recv() => { /* SessionEvent: notifications */ }
        maybe_cmd = cmd_rx.recv() => {
            // Command dispatch
            match cmd {
                SessionCommand::Prompt { .. } => { /* queue input, maybe promote */ }
                SessionCommand::Cancel { .. } => { /* cancel running task */ }
                SessionCommand::Shutdown { .. } => { /* teardown */ }
            }
        }
    }
}
```

## 4. Data Flow

### Message Flow Through the System

```
User input
  → SessionCommand::Prompt (cmd_tx channel)
  → run_session loop dispatches
  → maybe_start_running_task promotes front
  → handle_turn_input:
      → parse prompt, normalize images
      → chat_state_handle.push_user_message(ConversationItem::User)
      → ChatStateActor persists to updates.jsonl + chat_history.jsonl
  → process_conversation_turn loop:
      → chat_state_handle.build_request() → ConversationRequest
      → run_turn_via_sampler → SamplerHandle::submit_and_collect
      → ConversationResponse with items
      → chat_state_handle.push_assistant_response(items)
      → if tool_calls: execute_tool_calls → push_tool_result for each
      → loop continues
  → handle_completion:
      → emit TurnCompleted (durable, replayed)
      → fire on_turn_done contributors
      → maybe_start_running_task (next queued prompt)
```

### On-Disk Persistence Layout

```
{root}/sessions/{url_encoded_cwd}/{session_id}/
    summary.json          — session metadata
    chat_history.jsonl     — derived chat cache (ConversationItem per line)
    updates.jsonl          — durable source of truth (SessionUpdate per line)
    plan.json              — plan state
    signals.json           — session signals (telemetry)
    goal/state.json        — goal orchestration state
    compaction/            — compaction segments (optional)
```

`updates.jsonl` is the durable source of truth. `chat_history.jsonl` is derived from it via `ChatReducer`. Atomic writes use temp-file + rename. Torn-write healing prepends a newline if the last byte isn't `\n`, bounding damage to one record.

## 5. Key Takeaways for Kraken

### Architecture Lessons

1. **Separate types from I/O** — Pure data type crates with no HTTP/filesystem dependencies enable reuse and testing
2. **Actor-based state isolation** — Each stateful component runs as an actor with exclusive state ownership, no locks
3. **Dedicated thread per session** — `!Send` actor on a dedicated OS thread with its own runtime, never crossing thread boundaries
4. **Contributor pattern** — Host-agnostic lifecycle hooks that receive data-only inputs, never owning loop control
5. **Typed turn classification** — `InputPolicy` classifies every turn along 6 dimensions, driving compaction, queue, analytics, and shutdown decisions

### Security Lessons

6. **Kernel-enforced sandbox** — Use Landlock/Seatbelt, not user-space filtering
7. **Fail-closed everything** — Permissions, sandbox, hook resolution all default to deny
8. **Project config can only add** — Prevents malicious workspaces from redefining trusted profiles
9. **Secret redaction everywhere** — Cover API keys, tokens, PEM, URLs with credentials, user paths
10. **Out-of-process crash isolation** — Render untrusted content (Mermaid) in child processes

### Performance Lessons

11. **Dual-track token accounting** — Provider-reported + estimated (bytes/4) for real-time overflow detection
12. **Turn capture via offset** — Single offset instead of duplicating items on push
13. **Two-pass prefire compaction** — Background summarization ahead of threshold, cached by fingerprint
14. **Fit ladder** — 5-level graceful input reduction for compaction, never returning empty
15. **CoW worktrees** — Copy-on-write cloning for fast git worktree creation
16. **Memory-mapped I/O** — Zero-copy index loading for codebase graph
17. **Graceful degradation** — Every subsystem degrades through modes rather than crashing

### Agent Loop Lessons

18. **Simple tools-vs-respond decision** — If model returns tool calls, execute and loop; if not, turn is complete
19. **Stationarity detection** — Break after 16 identical tool calls (8 nudge, 4 true-noop hard stop)
20. **Cooperative cancellation** — `AbortHandle::abort()` instead of cancellation tokens; takes effect at next `.await`
21. **Stop gate** — Post-completion hooks can force the model to keep working
22. **Goal continuation** — Outer loop injects continuation directives for multi-round pursuit

### Workflow Lessons

23. **Rhai-scripted workflows** — Deterministic, resumable pipelines with journal-based replay
24. **Host service pattern** — Async actor with semaphore-based concurrency control and isolated scratch space
25. **Subagent usage folding** — Child token costs folded into parent's ledger

### UI Lessons

26. **Separate rendering from data** — Markdown core crate provides primitives shared across contexts
27. **Scrollback blocks** — Compose conversation from typed blocks for flexible rendering
28. **ACP handler pattern** — Centralized event ingestion dispatched to view updaters
29. **Source maps** — Map markdown positions to terminal positions for cursor tracking
30. **No remote resolvers** — Mermaid uses no remote/file resolvers and a bundled font for safety
