# Loops

> How grok-build orchestrates multi-step work: the Rhai-scripted workflow engine, the agentic turn loop, hooks, and task coordination.

## 1. The Agentic Turn Loop

The core of grok-build is the agentic loop: sample the model, execute any tool calls, re-sample with results appended, repeat until the model stops calling tools.

### The Three Nested Loops

```
┌─────────────────────────────────────────────────────┐
│  Outer Loop (Goal Continuation + Stop Gate)          │
│  turn.rs:915-995                                     │
│                                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │  Inner Loop (Sampling + Tool Execution)        │  │
│  │  turn.rs:2028-2894                              │  │
│  │                                                 │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │  Tool Execution Pipeline                  │  │  │
│  │  │  tool_calls.rs                            │  │  │
│  │  │  Phase 1: Sequential preparation         │  │  │
│  │  │  Phase 2: Parallel dispatch               │  │  │
│  │  │  Phase 3: Post-flight                     │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Inner Sampling Loop (`process_conversation_turn`)

**File:** `crates/codegen/xai-grok-shell/src/session/acp_session_impl/turn.rs:2028-2894`

```rust
loop {
    // 1. Action stationarity check
    //    - Break after 16 identical tool calls (8 nudge, 4 true-noop hard stop)
    
    // 2. Pre-sampling housekeeping:
    //    - Drain interjections at safe point
    //    - Flush pending skill reminders
    //    - Inject pending monitor events
    //    - First-turn memory reminder injection
    //    - MCP reminder injection
    //    - Two-pass prefire compaction (background)
    //    - Auto-compaction check (if tokens > 85% of context window)
    
    // 3. Build the request
    let request = self.chat_state_handle.build_request(...).await;
    
    // 4. Call the model
    let (response, latency) = self.run_turn_via_sampler(request).await;
    
    // 5. Extract tool calls from response
    let tool_calls = response.tool_calls().to_vec();
    
    // 6. DECISION POINT: tools vs final response
    if tool_calls.is_empty() {
        // No tool calls → turn complete
        return Ok(TurnOutcome::Completed { ... });
    }
    
    // 7. Execute tool calls
    let result = self.execute_tool_calls(tool_calls).await;
    
    // 8. Max-turns check
    if let Some(limit) = self.max_turns && next_turn > limit {
        return Ok(TurnOutcome::MaxTurnsReached { limit });
    }
    
    // Loop continues → re-builds request with tool results appended
}
```

### The Tools-vs-Respond Decision

**File:** `turn.rs:2671`

The decision is simple: **the model's response either contains tool calls or it doesn't**.

```rust
if tool_calls.is_empty() {
    return Ok(TurnOutcome::Completed { ... });
}
// Otherwise: execute tools, append results, re-sample
```

The model's `stop_reason` distinguishes:
- `StopReason::Stop` — model chose to stop (natural end)
- `StopReason::ToolCalls` — model wants to call tools (continue loop)
- `StopReason::Length` — max tokens reached
- `StopReason::ContentFilter` — content filtered

### Loop Safety Mechanisms

| Mechanism | Threshold | File:Line |
|:----------|:----------|:----------|
| Max turns | `self.max_turns` (configurable) | `turn.rs:2870-2879` |
| Identical tool call hard stop | 16 consecutive identical calls | `turn.rs:2899` |
| Identical tool call nudge | 8 consecutive identical calls | `turn.rs:2900` |
| True-noop hard stop | 4 consecutive true no-ops | `turn.rs:2901` |
| Doom loop detection | Server-side, `DoomLoopRecoveryPolicy` | `xai-grok-sampling-types/src/doom_loop.rs` |
| Auth retry budget | `AuthRetrySchedule::MAX_RETRIES` | `turn.rs:2413-2471` |

### TurnOutcome

**File:** `crates/codegen/xai-grok-shell/src/session/acp_session_impl/types.rs:67-94`

```rust
pub(crate) enum TurnOutcome {
    Completed { snapshot, tools_called, structured_output, refusal: Option<String> },
    Cancelled { category: Option<CancellationCategory>, context: Option<Value> },
    MaxTurnsReached { limit: usize },
    StationarityEnded { snapshot },  // silent end after repeated identical tool calls
}
```

## 2. Outer Loop: Goal Continuation and Stop Gate

**File:** `turn.rs:915-995`

```rust
loop {
    let round = self.process_conversation_turn_with_recovery(...).await;
    
    if !matches!(round, Ok(TurnOutcome::Completed { .. })) { break round; }
    if matches!(round, Ok(TurnOutcome::Completed { refusal: Some(_), .. })) { break round; }
    
    // Goal continuation logic
    if goal_active {
        if self.has_runnable_queued_user_row().await { break round; }  // yield to queued input
        let decision = self.run_goal_round_end().await;
        if let GoalRoundDecision::Continue(directive) = decision {
            self.inject_goal_continuation_message(directive).await;
            continue;  // re-enter loop
        }
    }
    
    // Stop gate
    match self.run_stop_gate(prompt_id, stop_continuations_this_turn).await {
        StopGateDecision::AllowStop => break round,
        StopGateDecision::KeepWorking { feedback } => {
            self.chat_state_handle.push_user_message(
                ConversationItem::stop_hook_feedback(feedback)
            );
            // continue — model must keep working
        }
    }
}
```

**Loop continuation conditions:** Model completed without refusal AND (goal continuation needed OR stop gate says keep working).

**Loop break conditions:** Non-Completed outcome, refusal, queued user input (goal mode), or stop gate allows stop.

## 3. Context Window Management (Compaction)

### Three Compaction Styles

| Style | When | Scope | Tail Kept? |
|:------|:-----|:------|:------------|
| **Intra** | Between steps, inside agent loop | Steps and/or history (mode-dependent) | Yes (partial modes) / No (FullReplace) |
| **Inter** | Between user turns | Prior conversation history | Yes (chunked) |
| **Code** | Whole-session, full-replace | Entire conversation | No (full rebuild) |

### Auto-Compaction Trigger

**File:** `crates/common/xai-grok-compaction/src/intra_compaction/trigger.rs:117-149`

Triggers when `last_prompt_tokens > context_window * trigger_threshold_percent / 100` (default 85%). For partial modes, additionally requires `current_step >= min_steps_before_compact` (default 3).

### The Fit Ladder

**File:** `crates/common/xai-grok-compaction/src/intra_compaction/fit.rs`

When the conversation is too large for the compaction LLM, the fit ladder reduces input in strict order:

1. **Verbatim** — fits as-is
2. **HistoryTurnSelected** — drop oldest history turns first
3. **ToolTruncated** — prefix-clip oversized tool results
4. **StepTurnsSelected** — drop oldest step turns
5. **Emergency** — hard-shrink newest item (never returns empty)

### Two-Pass Compaction (Prefire)

**File:** `crates/codegen/xai-grok-shell/src/session/compaction.rs:118-393`

- **Pass 1 (prefire):** Background summarization of the conversation prefix, cached as `NOTE₁` with a fingerprint. Runs ahead of the auto-compact threshold (10% lead).
- **Pass 2 (apply):** If a valid cached `NOTE₁` exists, summarize `(NOTE₁ + recent tail + special prompt) → final summary`. Cache validated by fingerprinting the prefix — a mismatch means the prefix changed (edit/rewind/branch) and the cache is dropped.

## 4. The Workflow Engine

**File:** `crates/codegen/xai-workflow/src/`

The workflow engine is a Rhai-scripted runtime that defines the logic and sequence of agent calls for complex multi-step tasks.

### What Is a Workflow?

A workflow is a **Rhai script** consisting of a mandatory metadata header and executable logic:

```rhai
let meta = #{
    name: "workflow-name",        // kebab-case, <= 64 bytes
    description: "description",   // <= 1,024 bytes
    when_to_use: "optional hint",
    phases: [
        #{ title: "Phase 1", detail: "optional detail" },  // <= 64 entries
    ],
};

// Executable logic
let result = agent("Analyze the codebase structure");
phase("Implementation");
let impl_result = agent("Implement the feature based on analysis");
complete(impl_result);
```

### Core Types

**File:** `crates/codegen/xai-workflow/src/meta.rs`, `src/run.rs`

| Type | Fields / Variants | Description |
|:-----|:------------------|:------------|
| `WorkflowMeta` | `name`, `description`, `when_to_use`, `phases` | Top-level metadata |
| `PhaseMeta` | `title`, `detail` | Logical stage of the workflow |
| `PauseKind` | `User`, `BackOff`, `NoProgress`, `Verification`, `Infra` | Reasons for suspension |
| `WorkflowOutcome` | `Completed`, `Paused`, `BudgetExceeded`, `Cancelled`, `Failed` | Final execution state |

### Registration and Discovery

**File:** `crates/codegen/xai-grok-shell/src/session/workflow/registry.rs`

The `WorkflowRegistry` scans three scopes:

1. **Builtins** — Hardcoded in `BUILTIN_WORKFLOWS`
2. **Project-local** — `{project_root}/.grok/workflows` (requires folder trust)
3. **User-global** — `{grok_home}/workflows`

**Discovery Flow:** `WorkflowRegistry::scan()` → `extract_meta()` → `validate_script()` → `RegistryEntry`

### Storage

**File:** `crates/codegen/xai-grok-shell/src/session/workflow/store.rs`

The `WorkflowRunStore` persists specific runs in `session_dir/workflows/{run_id}/`:

| File | Purpose |
|:-----|:--------|
| `args.json` | Input arguments |
| `script.rhai` | The script used |
| `manifest.json` | Contains `WorkflowRunManifest` (`version`, `state`, `script_revision`) |

## 5. Workflow Execution Pipeline

### The Engine

**File:** `crates/codegen/xai-workflow/src/engine.rs` (1778 lines)

The engine wraps a `rhai::Engine` with restricted functions to ensure determinism.

```
1. Initialization — Compile AST, set up Ctx (Journal + host_tx)
2. Step Evaluation:
   ├── Replay Path: If ctx.journal.covers(seq), return recorded result
   └── Live Path: Send WorkflowHostRequest via mpsc to HostService
                     Engine blocks on oneshot receiver
3. Completion — Triggered by complete(val) → ControlToken::Complete
```

### Step Types and Parallelism

| Rhai Function | Request Type | Mechanism |
|:--------------|:-------------|:----------|
| `agent(prompt)` | `SpawnAgent` | Blocks for `AgentResult` |
| `phase(title)` | `Phase` | Updates logical grouping |
| `parallel(jobs)` | N/A | Spawns multiple `PendingAgent` entries; limited by `MAX_PARALLEL` (1,024) |

### End-to-End Data Flow

```
1. Trigger — WorkflowManager receives a launch request via LaunchSpec
2. Initialization — Manager retrieves ResolvedWorkflow script, initializes Journal
3. Execution — run_workflow compiles Rhai AST, enters execution loop
4. Step Evaluation:
   ├── Replay: journal.covers(seq) → return cached result
   └── Live: WorkflowHostRequest → HostService → SubagentRequest
5. Host Processing — HostService translates request, manages concurrency via Semaphore
6. Completion — Result sent via oneshot to engine, recorded in Journal
   Workflow terminates when complete(value) returns ControlToken::Complete
```

## 6. Workflow State Management

### The Journal (Write-Ahead Log)

**File:** `crates/codegen/xai-workflow/src/journal.rs` (680 lines)

A JSONL write-ahead log for resumability.

| Field | Description |
|:------|:------------|
| `seq` | Sequence number |
| `kind` | Entry kind |
| `req_hash` | SHA-256 of request parameters (divergence detection) |
| `result` | Recorded result value |
| `at_ms` | Timestamp |

**Divergence detection:** If a script is edited, the engine detects `JournalError::Divergence` via `req_hash` mismatch.

**Resumption:** When `LaunchSpec.resume_run_id` is provided, the engine loads the existing journal and skips all previously completed sequences, fast-forwarding to the point of interruption.

**Error recovery:** `prune_trailing_host_error` truncates the journal if the last entry was a host error, forcing a retry of only the failed step.

### The Tracker

**File:** `crates/codegen/xai-grok-shell/src/session/workflow/tracker.rs` (1300 lines)

Manages the runtime `WorkflowRunState`:

| Status | Description |
|:-------|:------------|
| `Active` | Workflow is running |
| `UserPaused` | User paused the workflow |
| `BudgetLimited` | Budget exceeded |
| `BackOffPaused` | Backoff triggered |
| `NoProgressPaused` | No progress detected |
| `Complete` | Workflow finished |
| `Failed` | Workflow failed |

`WorkflowAgentRow` tracks `agent_id`, `tokens_used`, and `duration_ms` per agent. `revision: u64` increments on every state change to synchronize with the UI.

## 7. The Host Service Pattern

**File:** `crates/codegen/xai-grok-shell/src/session/workflow/host_service.rs` (1227 lines)

The `HostService` is an asynchronous actor that provides the runtime environment.

### Capabilities

- **Resource Isolation** — Provides a `scratch_dir` with hard limits (64 files, 10MB/file, 64MB total)
- **Concurrency Control** — Uses a `tokio::sync::Semaphore` (`agent_slots`) to throttle concurrent agent spawns
- **Communication** — `Workflow Engine` →(mpsc)→ `HostService` →(mpsc)→ `SubagentBackend`

### Concurrency and Parallelism

While the Rhai script executes linearly, the engine supports parallelism:
- **Parallel Agent Calls** — Engine tracks multiple `PendingAgent::Live` requests simultaneously
- **Synchronization** — Parallel steps awaited at synchronization points before proceeding
- **Global Limits** — `WorkflowManager` ensures total concurrent agents across all active workflows do not exceed machine capacity (`manager.rs:1866`)

### Budgeting and Backoff

- **Budget Limits** — If a run exceeds its allocated resources, marked as `BudgetLimited`. Manager can restart with increased `agent_budget` (`manager.rs:121`)
- **Backoff** — `WorkflowRunStatus` includes `BackOffPaused` and `NoProgressPaused` states
- **Concurrency Caps** — `WORKFLOW_MAX_ACTIVE_RUNS_PER_SESSION` (4)

## 8. The WorkflowManager

**File:** `crates/codegen/xai-grok-shell/src/session/workflow/manager.rs` (1766 lines)

The orchestrator between the session and the workflow.

- **Non-Blocking Execution** — Workflows run in the background via the `HostService`
- **Subagent Spawning** — Uses `subagent_event_tx` to send `SubagentEvent::Spawn` requests
- **Feedback Loop** — `SubagentResult` routed back to the engine. If a subagent is "auto-backgrounded" without a result, the manager marks the workflow as `Failed` (`manager.rs:1838`)
- **Concurrency** — Capped by `WORKFLOW_MAX_ACTIVE_RUNS_PER_SESSION` (4)

## 9. Subagent Orchestration

### Architecture

Three crates collaborate:
- `xai-grok-tools` — shared coordinator actor, data types, backend trait
- `xai-grok-shell` — shell-specific adapter (`ShellChildRunner`)
- `xai-grok-subagent-resolution` — pure-logic resolution

### Spawn Flow

```
1. Model calls task tool → SubagentBackendResource → ChannelBackend.spawn(SubagentRequest)
2. SubagentEvent::Spawn sent to coordinator mailbox
3. handle_spawn: reparent nested spawns, stop guard, duplicate check, Admission::admit()
4. start_child: child starts in pending, runner wrapped in catch_unwind
5. ShellChildRunner::run: builds SubagentSpawnContext from parent session (~70 fields)
6. run_shell_child: resolves agent definition, gates type, resolves toolset/runtime config
7. run_one_turn_attempt: sends SessionCommand::Prompt with task text, awaits completion
8. Usage folding: child token costs folded into parent's ledger
9. finish_child: delivers result to spawn-reply oneshot, buffers completion summary
10. present_child_completion: emits SubagentFinished notification, optionally injects auto-wake
```

### Resolution Crate

**File:** `crates/codegen/xai-grok-subagent-resolution/src/lib.rs`

Pure-logic crate with no session/transport dependencies. Resolves:
- Effective runtime config via precedence: explicit override > role > persona > parent
- Persona instructions (fail-closed: file I/O errors abort resolution)
- Role prompts (soft-degraded: warning on read failure, spawn continues)
- Resume identity validation (type must match; persona only if explicitly requested)
- Fork context normalization (≤3 turns verbatim, otherwise last 3 + earlier summarized)

## 10. Cancellation and Interruption

### Cancellation Mechanism

**There is no `CancellationToken` for turn cancellation.** Cancellation is cooperative via `tokio::task::AbortHandle::abort()`.

**File:** `crates/codegen/xai-grok-shell/src/session/acp_session_impl/tasks_cancel.rs`

### Cancel Flow

1. Classify the cancel (reason, rewind requested, prompt id)
2. Claim the named front under lock
3. Rewind-claimed path: drain monitor buffer, capture turn epoch, abort_turn_task, pop front
4. Cancel subagents: abort producer task, cancel_all_session_subagents
5. Kill foreground processes (terminal)
6. Kill background tasks (if requested)
7. State lock teardown: sweep monitor buffer, abort running task
8. Queue resolution: rewind (front popped), hard teardown (drain whole queue), normal cancel
9. Post-cancel: emit TurnEnded with MidTurnAbort category, announce turn abort

### Cancel Triggers

**File:** `commands.rs:182-230`

```rust
pub enum CancelTrigger { Esc, CtrlC, SendNow, Shutdown, SessionClose, SessionDelete, Client(String) }
pub enum CancelKind { StopGesture, Replace, Teardown }
```

- `Esc`/`CtrlC`/`Client` → `StopGesture` (stop the current turn)
- `SendNow` → `Replace` (cancel and run next prompt)
- `Shutdown`/`SessionClose`/`SessionDelete` → `Teardown` (full shutdown)

### Stop Gate

**File:** `crates/codegen/xai-grok-shell/src/session/acp_session_impl/stop_gate.rs:265-365`

Runs **after** a `Completed` round (not during sampling). Consults Stop hooks:
- `StopGateDecision::AllowStop` — turn ends
- `StopGateDecision::KeepWorking { feedback }` — feedback pushed as user message, model must continue

## Key Takeaways for Kraken

1. **Simple tools-vs-respond decision** — If the model returns tool calls, execute them and loop; if not, the turn is complete
2. **Stationarity detection** — Break after 16 identical tool calls (8 nudge, 4 true-noop hard stop) to prevent infinite loops
3. **Two-pass prefire compaction** — Background summarization runs ahead of the threshold, cached by fingerprint for instant apply
4. **Fit ladder** — Gracefully reduce compaction input through 5 levels, never returning empty
5. **Rhai-scripted workflows** — Deterministic, resumable pipelines with journal-based replay for multi-step tasks
6. **Host service pattern** — Async actor with semaphore-based concurrency control and isolated scratch space
7. **Cooperative cancellation** — Use `AbortHandle::abort()` instead of cancellation tokens; takes effect at next `.await`
8. **Stop gate** — Post-completion hooks can force the model to keep working by injecting feedback
9. **Goal continuation** — Outer loop can inject continuation directives to drive multi-round goal pursuit
10. **Subagent usage folding** — Child token costs are folded into the parent's ledger for accurate accounting
