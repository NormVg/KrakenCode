# Sessions

> How grok-build manages session lifecycle, prompt queueing, crash recovery, and foreign session import.

## 1. Session Lifecycle

**File:** `crates/codegen/xai-agent-lifecycle/src/`

The agent lifecycle crate manages the full lifecycle of an agent session: spawn, register, fork, and teardown.

### Lifecycle States

```
Spawn ──▶ Register ──▶ Running ──▶ Teardown
               │            │
               │            ├─▶ Paused
               │            ├─▶ BudgetLimited
               │            └─▶ Failed
               │
               ├─▶ Fork (subagent)
               └─▶ Crash Recovery
```

### Spawn and Registry

When a session starts:
1. A unique `session_id` is generated
2. The session is registered in `~/.grok/active_sessions.json`
3. A session directory is created under `~/.grok/sessions/{session_id}/`
4. The agent runtime is initialized with the session context

### Fork (Subagents)

Subagents are forked from the main session:
- Inherit the workspace and sandbox profile
- Get their own `session_id` and session directory
- Can be spawned with reduced context (fork_turns parameter)
- Results are routed back to the parent via channels

## 2. Prompt Queue

**File:** `crates/codegen/xai-prompt-queue/src/{lib.rs, types.rs, combine.rs}`

The prompt queue lets a client enqueue multiple follow-up prompts against a single session while a turn is running.

### Wire Types (`types.rs`)

#### QueueEntryMeta (`types.rs:11-26`)

Per-item metadata the session actor attaches to user-originated inputs. Held in actor state, never serialized.

| Field | Type | Description |
|:------|:-----|:------------|
| `id` | — | Stable, reuses the prompt's `prompt_id` |
| `version` | — | Monotonic, bumped on each in-place edit; stale version = no-op |
| `owner` | — | Enqueuing client identifier (attribution); never overwritten |
| `last_editor` | — | Most recent editor's client id |
| `kind` | — | Display kind label |
| `text` | — | Plain prompt text for shared queue display |
| `combined_texts` | — | Per-prompt display texts when combine merged several follow-ups |

#### QueueEntryWire (`types.rs:29-51`)

One queue row on the wire. `camelCase` serde. Adds `position` (0-based among queued, not-yet-running prompts).

#### QueueChanged (`types.rs:54-76`)

Broadcast payload for the `x.ai/queue/changed` notification:

| Field | Description |
|:------|:------------|
| `session_id` | Drives per-session fan-out routing (required) |
| `entries` | The pending queue (running row omitted) |
| `running_prompt_id` | The prompt the actor is currently draining |
| `running_text` | Text of the running prompt |
| `running_kind` | Kind of the running prompt |
| `running_combined_texts` | Combined texts if the running prompt was merged |

### Combine Logic (`combine.rs`)

The `[ui].combine_queued_prompts` feature merges consecutive plain-text follow-ups into a single model turn.

#### Merge Rules

| Rule | Effect |
|:-----|:-------|
| Front must be plain user prompt | Not synthetic, not expanded skill, not bash, non-empty text |
| Followers must have no images | Front may keep its own images |
| Synthetic/auto-wake origins | Never combine |
| Bash commands | Stop the merge run |
| Non-prompt kinds (e.g. `/compact`) | Stop the merge run |
| Expanded skills | Stop the merge run |
| Rows under edit hold (`skip_ids`) | Skipped |

#### Functions

| Function | File:Line | Description |
|:---------|:----------|:------------|
| `can_merge_front` | `combine.rs:30-32` | Front of a combine run eligibility |
| `can_merge_follower` | `combine.rs:35-37` | Follower eligibility |
| `combine_prefix_len` | `combine.rs:41-60` | Length of mergeable prefix |
| `join_texts` | `combine.rs:62-68` | Joins with `"\n\n"` separator |
| `is_combined` / `stamp_combined_display_texts` | `combine.rs:72-93` | Multi-bubble UI when >= 2 merged |

## 3. Active Sessions Tracking

**File:** `crates/codegen/xai-grok-active-sessions/src/lib.rs` (277 lines)

Tracks open TUI sessions in `~/.grok/active_sessions.json` for crash recovery.

### Data Model

```rust
pub struct ActiveSession {
    pub session_id: String,
    pub pid: u32,
    pub cwd: PathBuf,
    pub opened_at: u64,
}
```

### File Layout

| File | Purpose |
|:-----|:--------|
| `active_sessions.json` | The data file |
| `active_sessions.lock` | Exclusive file lock (fs2 `FileExt`) |
| `active_sessions.json.tmp` | Temp for atomic write |

### Public API (`lib.rs:29-42`)

| Function | Description |
|:---------|:------------|
| `register(session)` | Register a session as active (idempotent by `session_id`) |
| `try_unregister(session_id)` | Remove a session (clean exit) |
| `collect_crashed()` | Find orphaned entries (dead PIDs) |
| `collect_all()` | Get all active sessions |

### Crash Recovery Flow

```
1. App starts
2. collect_crashed() finds sessions with dead PIDs
3. For each crashed session:
   a. Load session state from disk
   b. Offer user to resume or discard
4. Clean up orphaned entries
```

## 4. Foreign Session Discovery

**File:** `crates/codegen/xai-grok-foreign-sessions/src/`

Discovers and imports sessions from other tools (Claude Code, Cursor, etc.) that use compatible formats.

### Discovery Sources

- Claude Code sessions (`.claude/` directory)
- Other ACP-compatible tools
- Git-based session history

### Import Flow

```
1. Scan for foreign session directories
2. Parse session metadata
3. Convert to grok-build format
4. Import into ~/.grok/sessions/
5. Make available for resume
```

## 5. Session Search

**File:** `crates/codegen/xai-grok-session-search/src/`

Search across session history:
- Full-text search of past conversations
- Filter by date, workspace, tool usage
- Session event indexing

## 6. Session Events

**File:** `crates/codegen/xai-grok-session-events/src/`

Event types emitted during a session:

| Event | Description |
|:------|:------------|
| `SessionStarted` | Session initialized |
| `PromptQueued` | User prompt added to queue |
| `TurnStarted` | Agent began processing |
| `ToolExecuted` | A tool was called |
| `TurnCompleted` | Agent finished responding |
| `SessionPaused` | Session was paused |
| `SessionResumed` | Session was resumed |
| `SessionEnded` | Session terminated |

## 7. Session Persistence

### On-Disk Layout

```
~/.grok/sessions/{session_id}/
├── conversation.jsonl     # Conversation history (JSONL)
├── session.json            # Session metadata
├── workflows/              # Workflow runs
│   └── {run_id}/
│       ├── args.json
│       ├── script.rhai
│       └── manifest.json
├── journal.jsonl           # Workflow journal (WAL)
└── checkpoints/            # Session checkpoints
```

### SQLite Journal

**File:** `crates/codegen/xai-sqlite-journal/src/`

A SQLite-based journal for session state persistence:
- Write-ahead logging for crash safety
- Atomic state transitions
- Efficient replay on recovery

## 8. Session Recovery

**File:** `crates/codegen/xai-grok-workspace/src/recovery.rs`

Session recovery handles:
- Detecting crashed sessions (dead PIDs in active_sessions.json)
- Loading partial conversation state
- Reconstructing the conversation from JSONL
- Offering resume or discard to the user

### Restore Fetch

**File:** `crates/codegen/xai-grok-workspace/src/restore_fetch.rs`

Fetches and restores session state from disk:
- Conversation items
- Tool call results
- Workflow states
- Permission decisions

## 9. Session Checkpointing

**File:** `crates/codegen/xai-grok-workspace/src/session/checkpoint.rs`

Checkpoints capture session state at key points:
- Before tool execution
- After tool execution
- At turn boundaries
- At workflow phase transitions

Checkpoints enable:
- Rewind to a previous point
- Branch from a checkpoint (fork)
- Audit trail of state changes

## 10. Folder Trust

**File:** `crates/codegen/xai-grok-workspace/src/folder_trust.rs`

Before operating in a directory, the agent verifies folder trust:
- First-time use prompts for trust confirmation
- Trusted folders are recorded in `~/.grok/trusted_folders.json`
- Untrusted folders have restricted capabilities (no hooks, no workflows)

## Key Takeaways for Kraken

1. **Prompt queue with combine** — Multiple follow-up prompts can be queued and intelligently merged into a single model turn
2. **Crash recovery via PID tracking** — Active sessions file with PID checking enables automatic crash detection
3. **Atomic writes** — Session state uses temp file + rename for atomic persistence
4. **JSONL conversation history** — Append-only format enables fast writes and partial recovery
5. **Checkpoint-based rewind** — Session state is checkpointed at key boundaries for rewind and forking
6. **Folder trust** — Security gate prevents untrusted directories from running hooks or workflows
7. **Foreign session import** — Can discover and import sessions from other tools
