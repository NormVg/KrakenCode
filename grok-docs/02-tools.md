# Tools

> How grok-build defines, registers, and executes tools — the four-layer architecture, 50-tool inventory, and permission-gated execution pipeline.

## 1. Architecture Overview

The tool system is a **four-layer architecture** spanning six crates:

| Layer | Crate | Responsibility |
|:------|:------|:---------------|
| **Shell adapters** | `xai-grok-shell` | ToolBridge, config resolution, notification bridging, permission integration |
| **Tool runtime** | `xai-tool-runtime` | `Tool` trait, `ToolDyn` type erasure, `ToolDispatch`, streaming, `ToolError`, `ContentBlock` |
| **Tool definitions** | `xai-grok-tools` | `ToolMetadata` trait, `ToolRegistryBuilder`, `FinalizedToolset`, `Resources`, all tool implementations |
| **Wire protocol** | `xai-tool-protocol` + `xai-tool-types` | JSON-RPC envelopes, frames, session events, `ToolId`, `ToolCapabilities`, `ToolDescription` |
| **UI rendering** | `xai-grok-pager` | Per-tool render blocks (`ToolCallBlock` enum) |
| **Permissions** | `xai-grok-workspace` | Actor-based permission manager, policy engine, sandbox integration |

## 2. Tool Definition Framework

Every tool implements **two complementary traits**:

### 2.1 The `Tool` Trait (Runtime Layer)

**File:** `crates/common/xai-tool-runtime/src/tool.rs:36-112`

```rust
pub trait Tool: Send + Sync {
    type Args: for<'de> Deserialize<'de> + JsonSchema + Send + 'static;
    type Output: Serialize + ToolOutput + Send + 'static;

    fn id(&self) -> ToolId;
    fn description(&self, _ctx: &ListToolsContext) -> ToolDescription;
    fn capabilities(&self) -> ToolCapabilities { ToolCapabilities::default() }
    fn has_dynamic_description(&self) -> bool { false }
    fn should_list(&self, _ctx: &ListToolsContext) -> bool { true }

    // Streaming entry point — the runtime always calls this.
    fn execute(&self, ctx: ToolCallContext, args: Self::Args)
        -> impl Future<Output = ToolStream<Self::Output>> + Send;

    // Blocking convenience hook (default returns NotImplemented).
    fn run(&self, _ctx: ToolCallContext, _args: Self::Args)
        -> impl Future<Output = Result<Self::Output, ToolError>> + Send;
}
```

- `Args` — typed input, deserializable from JSON, with `JsonSchema` for the model-facing schema
- `Output` — typed output, implements `ToolOutput` (provides model-facing content blocks)
- `execute()` — **streaming entry point; the runtime always calls this.** Default wraps `run` into a single-item terminal stream
- `run()` — blocking convenience hook. Default returns `Err(ToolError::not_implemented(...))`

### 2.2 The `ToolMetadata` Trait (Codegen Layer)

**File:** `crates/codegen/xai-grok-tools/src/types/tool_metadata.rs:36-113`

```rust
pub trait ToolMetadata: Send + Sync {
    fn kind(&self) -> ToolKind;
    fn tool_namespace(&self) -> ToolNamespace;
    fn description_template(&self) -> &str;
    fn is_read_only(&self) -> bool { self.kind().is_read_only() }
    fn emitted_notifications(&self) -> &'static [&'static str] { &[] }
    fn requires_expr(&self) -> Expr<ToolRequirement> { Expr::True }
    fn versioned_definition(&self, ...) -> ToolDefinition { /* renders template */ }
}
```

### 2.3 `ToolKind` — Tool Categorization

**File:** `crates/codegen/xai-grok-tools/src/types/tool.rs:70-106`

34 variants (33 named + `Other`), serialized as snake_case:

`Read`, `Edit`, `Delete`, `ListDir`, `Write`, `Move`, `Search`, `Lsp`, `Execute`, `Plan`, `WebSearch`, `WebFetch`, `BackgroundTaskAction`, `WaitTasksAction`, `KillTaskAction`, `List`, `Skill`, `MemorySearch`, `MemoryGet`, `Task`, `EnterPlan`, `ExitPlan`, `AskUser`, `ImageGen`, `VideoGen`, `ImageToVideo`, `ReferenceToVideo`, `DeployApp`, `SearchTool`, `UseTool`, `Monitor`, `GoalUpdate`, `Workflow`, `Other`.

### 2.4 `ToolNamespace` — Toolset Grouping

| Variant | Wire form | Meaning |
|:--------|:----------|:--------|
| `GrokBuild` | `grok_build` | Primary toolset |
| `GrokBuildConcise` | `grok_build_concise` | Concise output variant |
| `GrokBuildHashline` | `grok_build_hashline` | Anchor-based variant |
| `Codex` | `codex` | Codex-compatible toolset |
| `OpenCode` | `opencode` | OpenCode-compatible toolset |
| `MCP` | `mcp` | Model Context Protocol tools |

### 2.5 `ToolDyn` — Object-Safe Type Erasure

**File:** `crates/common/xai-tool-runtime/src/tool.rs:304-402`

`Tool` carries associated types, so it cannot be `dyn Tool`. `ToolDyn` erases those types — `execute` takes a `serde_json::Value` and returns `ToolStream<TypedToolOutput>`. A blanket impl provides `ToolDyn for T where T: Tool`. `ArcTool = Arc<dyn ToolDyn>` is the common handle shape.

### 2.6 `ToolStream` — Streaming Output

**File:** `crates/common/xai-tool-runtime/src/tool.rs:114-133`

```rust
pub type ToolStream<T> = Pin<Box<dyn Stream<Item = ToolStreamItem<T>> + Send>>;

pub enum ToolStreamItem<T> {
    Progress(ToolProgress),          // zero or more
    Terminal(Result<T, ToolError>),  // exactly one, always last
}
```

**Stream invariant:** at most arbitrarily many `Progress` items, ending in exactly one `Terminal`.

`ToolProgress` variants: `Text { text }`, `Content { blocks }`, `Custom { subkind, payload }`.

## 3. Tool Inventory (50 Tools)

### 3.1 GrokBuild Tools (Primary Toolset)

All in `ToolNamespace::GrokBuild`. Registered in `ToolRegistryBuilder::new()` at `registry/types.rs:674-765`.

#### File/Shell/Search Tools

| # | Tool Name | Struct | ToolKind | Read-Only | Args |
|:--|:----------|:-------|:---------|:----------|:-----|
| 1 | `run_terminal_cmd` | `BashTool` | `Execute` | No | `command`, `timeout`, `description`, `is_background` |
| 2 | `read_file` | `ReadFileTool` | `Read` | Yes | `path`, `offset`, `limit`, `pages`, `format` |
| 3 | `list_dir` | `ListDirTool` | `List` | Yes | `target_directory` |
| 4 | `grep` | `GrepTool` | `Search` | Yes | `pattern`, `path`, `glob`, `output_mode`, `-B`, `-A`, `-t` |
| 5 | `search_replace` | `SearchReplaceTool` | `Edit` | No | `file_path`, `old_string`, `new_string`, `replace_all` |
| 6 | `todo_write` | `TodoWriteTool` | `Plan` | No | `merge`, `todos[]` (id, content, status) |
| 7 | `lsp` | `LspTool` | `Lsp` | Yes | `operation`, `file_path`, `line`, `character`, `query` |

**Key tool details:**

- **`run_terminal_cmd`**: Executes bash commands with optional timeout (max 5 min foreground, default 2 min). Supports background execution (returns `task_id` immediately). Shell state persistence (cwd, env vars). Background operator detection (`&`), heredoc parsing, self-matching `pkill` protection. Auto-backgrounding when timeout exceeded.

- **`read_file`**: Reads files with line-number anchors every 10 lines. Supports PDFs, PowerPoint, Jupyter notebooks, and images (multimodal). Token validation (max 25,000 tokens → `FileTooLarge` with grep/range suggestions). Streaming: content delivered in 4 KiB chunks.

- **`list_dir`**: Lists directory contents. No dot-files. Respects `.gitignore`. Large directories summarized with file counts and extension breakdowns. BFS tree expansion with budget caps (100K items max).

- **`grep`**: Content search via ripgrep (`rg`). Full regex syntax. Respects `.gitignore`. Output is ripgrep-style: `:` for match lines, `-` for context lines. Large results capped with "at least" counts.

- **`search_replace`**: Exact string replacement in files. Empty `old_string` creates new file. `replace_all` for multiple occurrences. Unicode-normalized fallback matching. No-match errors include nearest-match hints and confusable diagnostics. CRLF preservation. Requires a Read tool (unless `skip_read_before_edit` is true).

- **`todo_write`**: Structured task list management. Merge mode (default) updates by ID; replace mode clears and re-adds. States: `pending`, `in_progress`, `completed`, `cancelled`.

- **`lsp`**: Code intelligence via language servers. Operations: `goToDefinition`, `findReferences`, `hover`, `goToImplementation`, `documentSymbol`, `workspaceSymbol`.

#### Task/Web/Plan/Media Tools

| # | Tool Name | Struct | ToolKind | Args Summary |
|:--|:----------|:-------|:---------|:-------------|
| 8 | `task` | `TaskTool` | `Task` | `prompt`, `description`, `subagent_type`, `run_in_background`, `isolation`, `resume_from`, `cwd`, `model` |
| 9 | `get_task_output` | `TaskOutputTool` | `BackgroundTaskAction` | `task_ids[]`, `timeout_ms` |
| 10 | `get_terminal_command_output` | `GetTerminalCommandOutputTool` | `BackgroundTaskAction` | Same as above (subagent-free variant) |
| 11 | `wait_tasks` | `WaitTasksTool` | `WaitTasksAction` | `task_ids[]`, `mode` (WaitAll/WaitAny), `timeout_ms` |
| 12 | `kill_task` | `KillTaskTool` | `KillTaskAction` | `task_id` |
| 13 | `kill_terminal_command` | `KillTerminalCommandTool` | `KillTaskAction` | `task_id` (subagent-free variant) |
| 14 | `web_fetch` | `WebFetchTool` | `WebFetch` | `url` |
| 15 | `web_search` | `WebSearchTool` | `WebSearch` | `query`, `allowed_domains` |
| 16 | `ask_user_question` | `AskUserQuestionTool` | `AskUser` | `questions[]` (question, options[], multi_select) |
| 17 | `enter_plan_mode` | `EnterPlanModeTool` | `EnterPlan` | (empty) |
| 18 | `exit_plan_mode` | `ExitPlanModeTool` | `ExitPlan` | (empty) |
| 19 | `update_goal` | `UpdateGoalTool` | `GoalUpdate` | `completed`, `message`, `blocked_reason` |
| 20 | `workflow` | `WorkflowTool` | `Workflow` | `name`/`script`/`script_path`, `args`, `agent_budget`, `resume_from_run_id`, `validate_only` |
| 21 | `image_gen` | `ImageGenTool` | `ImageGen` | `prompt`, `aspect_ratio` |
| 22 | `image_edit` | `ImageEditTool` | `ImageGen` | `prompt`, `image[]`, `aspect_ratio` |
| 23 | `image_to_video` | `ImageToVideoTool` | `ImageToVideo` | `prompt`, `image`, `duration`, `resolution_name` |
| 24 | `reference_to_video` | `ReferenceToVideoTool` | `ReferenceToVideo` | `prompt`, `images[]`, `voices[]`, `aspect_ratio`, `duration`, `resolution_name` |
| 25 | `monitor` | `MonitorTool` | `Monitor` | `command`, `description`, `timeout_ms`, `persistent` |
| 26 | `scheduler_create` | `SchedulerCreateTool` | `Other` | `task_id`, `interval`, `prompt`, `durable`, `foreground`, `fire_immediately` |
| 27 | `scheduler_delete` | `SchedulerDeleteTool` | `Other` | `id` |
| 28 | `scheduler_list` | `SchedulerListTool` | `Other` | (empty) |

**Key tool details:**

- **`task`**: Subagent spawning system. Depth limit (default 1), concurrent spawn limit (default 32, env `GROK_MAX_CONCURRENT_SUBAGENTS`). Background mode spawns fire-and-forget; blocking mode awaits with auto-backgrounding on budget expiry. Coordinator actor owns all lifecycle state: pending, active, completed (capped at 1024), queued, waiters.

- **`web_fetch`**: HTTP fetching pipeline with SSRF protection, caching (15 min TTL, 128 entries), HTTPS upgrade, content-type dispatch (PDF/image/video/binary/text). HTML→markdown conversion. Overflow handling: 3% of context window budget, persists full content to disk artifact with recovery footer. Per-hop SSRF re-checking on redirects.

- **`monitor`**: Background event streamer. Each stdout line is an event. Rate-limited via token bucket (capacity 10, refill every 2s). Auto-kill after 30s of continuous rate-limit violations. Persistent mode runs for session lifetime.

#### Hashline Variants (Anchor-Based)

| # | Tool Name | Struct | ToolKind |
|:--|:----------|:-------|:---------|
| 29 | `hashline_read` | `HashlineReadTool` | `Read` |
| 30 | `hashline_grep` | `HashlineGrepTool` | `Search` |
| 31 | `hashline_edit` | `HashlineEditTool` | `Edit` |

These delegate to grok_build core logic, then post-process output with anchor injection. `hashline_read` formats each line as `LINE:ANCHOR→CONTENT`. `hashline_edit` supports `replace`, `insert_after`, `write` operations with anchor-based targeting, validated against pre-edit snapshot, applied atomically bottom-up.

#### Concise Variants

| # | Tool Name | Struct |
|:--|:----------|:-------|
| 32 | `bash` (concise) | `BashConciseTool` |
| 33 | `read_file` (concise) | `ReadFileConciseTool` |
| 34 | `search_replace` (concise) | `SearchReplaceConciseTool` |

These delegate to grok_build core logic, then swap in shorter output fields. The concise `search_replace` explicitly skips the read-before-edit guard.

### 3.2 Codex Tools

All in `ToolNamespace::Codex`. Namespace-exclusive alternatives to GrokBuild.

| # | Tool Name | Struct | ToolKind | Key Difference |
|:--|:----------|:-------|:---------|:---------------|
| 35 | `grep_files` | `CodexGrepFilesTool` | `Search` | File paths only (no content), sorted by mtime |
| 36 | `list_dir` | `CodexListDirTool` | `ListDir` | BFS with depth control, no gitignore, no hidden-file exclusion |
| 37 | `apply_patch` | `ApplyPatchTool` | `Edit` | Custom `*** Begin Patch` format, 4-tier fuzzy matching, two-phase compute-then-write |
| 38 | `read_file` | `CodexReadFileTool` | `Read` | `L{n}:` format, slice + indentation modes |

### 3.3 OpenCode Tools

All in `ToolNamespace::OpenCode`. Convention: camelCase parameter naming.

| # | Tool Name | Struct | ToolKind | Key Difference |
|:--|:----------|:-------|:---------|:---------------|
| 39 | `bash` | `BashTool` | `Execute` | No background support, fresh shell per command |
| 40 | `edit` | `EditTool` | `Edit` | camelCase wire, no Unicode normalization fallback |
| 41 | `glob` | `GlobTool` | `Search` | No grok_build equivalent; `rg --files --glob` |
| 42 | `grep` | `GrepTool` | `Search` | Simpler (3 fields), mtime sorting, no context lines |
| 43 | `read` | `ReadTool` | `Read` | camelCase, u32 offset, XML-wrapped output |
| 44 | `skill` | `SkillTool` | `Skill` | Reuses shared skill infrastructure |
| 45 | `todowrite` | `TodoWriteTool` | `Plan` | Full-replace only, positional IDs, string status |
| 46 | `write` | `WriteTool` | `Write` | Standalone full-file-write (no grok_build equivalent) |

### 3.4 Memory Tools

Backend-agnostic — resolve `Arc<dyn MemoryBackend>` from `SharedResources`.

| # | Tool Name | Struct | ToolKind | Behavior |
|:--|:----------|:-------|:---------|:---------|
| 47 | `memory_search` | `MemorySearchImpl` | `MemorySearch` | Hybrid search (FTS5 + vector KNN). Soft message if backend absent. |
| 48 | `memory_get` | `MemoryGetImpl` | `MemoryGet` | Read memory file with optional line range. |

### 3.5 Meta-Tools

| # | Tool Name | Struct | ToolKind | Purpose |
|:--|:----------|:-------|:---------|:--------|
| 49 | `use_tool` | `UseTool` | `UseTool` | Dynamic MCP tool invocation. Args: `tool_name`, `tool_input`. Native-tool corrective error prevents routing native tools through `use_tool`. |
| 50 | `search_tool` | `SearchTool` | `SearchTool` | Tool discovery via BM25 search. Args: `query`, `limit`. Returns grouped results with full `input_schema`. |

## 4. Tool Execution Pipeline

### End-to-End Flow

```
Model emits tool_call (client function name + JSON args)
    │
    ▼
ToolBridge::call(client_name, params, tool_call_id)
    │ delegates to
    ▼
FinalizedToolset::call(name, params, tool_call_id, notification_handle)
    │ resolves client name → registered tool
    │ parses arguments into typed ToolInput
    │ inserts SharedResources into ToolCallContext.extensions
    │ dispatches via LocalRegistry → ToolDyn::execute(ctx, args: Value)
    │
    ▼
ToolDyn::execute (blanket impl)
    │ serde_json::from_value(args) → T::Args
    │ on decode error: terminal_only(Err(invalid_arguments))
    │ Tool::execute(self, ctx, typed_args)
    │   default: self.run(ctx, args).await → terminal_only(result)
    │ map stream:
    │   Progress(p) → Progress(p)
    │   Terminal(Ok(out)) → serialize → TypedToolOutput
    │     model_output from out.model_output() or extract_content_blocks()
    │   Terminal(Err(e)) → Terminal(Err(e))
    │
    ▼
ToolStream<TypedToolOutput>
    │ drained by caller
    ▼
ToolRunResult { output, prompt_text, effective_tool_name }
    │ into_typed_tool_output()
    ▼
TypedToolOutput { tool_id, value, model_output: Vec<ContentBlock>, chat_completion_output }
    │ model_output → ContentBlock::Text { text: prompt_text }
    │ sent back to model as tool_result
```

### Notifications Flow Sideways

Tool execution emits `ToolNotification` events through a `ToolNotificationHandle` — **not** through the return value:

```
ToolNotificationHandle (acknowledged channel)
    │ spawn_notification_bridge loop
    │ handle_notification dispatch
    ├── ACP gateway (live TUI updates)
    ├── persistence (updates.jsonl for replay)
    ├── hunk tracker / file state tracker (rewind)
    └── session command channel (auto-wake prompts)
```

**Notification types:** `BashOutputChunk`, `BashExecutionComplete`, `BashExecutionTimeout`, `BashExecutionBackgrounded`, `BashExecutionFailed`, `FileWritten`, `TaskCompleted`, `PlanModeEntered`, `PlanModeExited`, `UserQuestionAsked`, `LspServerStarting/Ready/Crashed/Retrying/Failed`, `ScheduledTaskFired/Removed/Created`, `MonitorEvent`.

## 5. Tool Registration & Discovery

### `ToolRegistryBuilder` — The Mutable Registry

**File:** `crates/codegen/xai-grok-tools/src/registry/types.rs:528-1262`

`register_with_params::<T, P>()` (`registry/types.rs:575`):
1. `let tool = T::default();`
2. Build fully-qualified name: `format!("{}:{}", tool.tool_namespace(), Tool::id(&tool).as_str())`
3. Insert `ToolEntry` with type-erased closures for `input_schema`, `metadata`, `output_converter`, `parse_input`, `register_in_local`

### Tool Packs — Out-of-Tree Registration

**File:** `registry/types.rs:27-51`

```rust
pub type ToolPack = fn(&mut ToolRegistryBuilder);
static TOOL_PACKS: OnceLock<Mutex<Vec<ToolPack>>>;
```

Out-of-tree tool packs can contribute registrations into every new builder. `register_tool_pack` MUST run before the first `ToolRegistryBuilder::new()`.

### `FinalizedToolset` — The Immutable, Dispatch-Ready Toolset

**File:** `registry/types.rs:454-472`

Tools wrapped in `parking_lot::RwLock` for concurrent read access (dispatch) with rare write access (MCP registration). Read guard held only for microsecond lookups — never across `.await`.

### Cross-Tool Requirement Validation

The `ToolRequirement` system gates tool *availability* at finalization. Examples enforced by `validate_config`:
- `enabled_background=true` requires `get_task_output` + `kill_task`
- `enter_plan_mode`/`exit_plan_mode` must be paired
- No mixing standard/hashline file tools
- `search_replace` with `skip_read_before_edit=false` requires a Read tool

## 6. Tool Context System

### `ToolCallContext`

**File:** `crates/common/xai-tool-runtime/src/context.rs:64-98`

```rust
pub struct ToolCallContext {
    pub call_id: ToolCallId,
    pub extensions: TypedExtensions,
}
```

### `TypedExtensions` — Typed Extension Store

Open typed-extension store keyed by `TypeId`. Methods: `insert<T>`, `insert_arc<T>`, `get<T>() -> Option<Arc<T>>`, `contains<T>`, `remove<T>`, `merge_defaults`.

### Blessed Extension Types

| Type | Purpose |
|:-----|:--------|
| `Cwd(pub PathBuf)` | Working directory for relative path resolution |
| `BehaviorVersion(pub String)` | Opaque behavior version; unknown values = hard error |
| `TraceContext(pub String)` | Distributed-trace correlation (W3C `traceparent`) |
| `SessionContext(pub String)` | Session ID for multi-session tool servers |
| `Cancellation(pub CancellationToken)` | Cooperative-cancellation handle |
| `WorkspaceViewerContext` | Per-user feature flags (`stream_tool_progress: bool`) |

### `Resources` — The DI Container

**File:** `crates/codegen/xai-grok-tools/src/types/resources.rs:175-180`

```rust
pub struct Resources {
    data: HashMap<TypeId, Box<dyn Any + Send + Sync>>,
    entries: Vec<ResourceEntry>,
}
pub type SharedResources = Arc<Mutex<Resources>>;
```

Key resource types: `Cwd`, `FileSystem`, `Terminal`, `NotificationHandle`, `DenyReadGlobs`, `RespectGitignore`, `SessionEnv`, `TruncationCfg`, `InnerDispatch`, `ToolNameMapping`, `ParamNameMapping`.

The `ToolBridge` inserts `SharedResources` into `ctx.extensions` before dispatching. Tools extract it via `shared_resources(ctx)`, which reads `ctx.get::<SharedResources>()` and errors with `"missing_resources"` if absent.

## 7. Tool Output & Rendering

### The `ToolOutput` Trait

**File:** `crates/common/xai-tool-runtime/src/render.rs:63`

```rust
pub trait ToolOutput: Serialize {
    fn model_output(&self) -> Vec<ContentBlock> { Vec::new() }
    fn chat_completion_output(&self) -> Option<ToolChatCompletionResponse> { None }
}
```

- `model_output()` — Returns model-facing `ContentBlock`s. Default returns **empty `Vec`**, signaling "use automatic extraction."
- `chat_completion_output()` — Optional structured frame for frontend.

### `ContentBlock` Enum

```rust
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentBlock {
    Text { text: String },
    Image { mime_type, data, media_id?, filename?, path?, metadata },
    Resource { uri, mime_type?, text? },
}
```

### Template Rendering

**File:** `crates/codegen/xai-grok-tools/src/types/template_renderer.rs:185`

Tool descriptions are MiniJinja templates using custom delimiters:
- `${{ tools.by_kind.read }}` — resolves to the client-facing Read tool name
- `${{ params.edit.old_string }}` — resolves to the client-facing param name
- `${%- if tools.by_kind.search %}...${%- endif %}` — conditional sections

At runtime, `render_schema_descriptions()` recursively renders `${{ ... }}` placeholders in JSON Schema `description` fields before sending to the model.

## 8. Permission & Approval System

### Architecture

**Core location:** `crates/codegen/xai-grok-workspace/src/permission/`

The permission system is an **actor-based async manager**. `PermissionHandle` has two variants:
- `Actor { cmd_tx, yolo_state, auto_state, ... }` — normal mode
- `AllowAll` — bypasses all checks (non-interactive contexts)

### Decision Pipeline

When a tool wants to execute, it sends a `PermissionCommand::Request` through an mpsc channel. The actor processes each request through this ordered pipeline:

1. **YOLO / always-approve mode** — If `yolo_mode` is true, `Decision::Allow` immediately
2. **Policy deny** — If a configured `deny` rule matches, returns `Decision::PolicyDeny`
3. **Policy ask / shell-file ask floors** — Force user prompt regardless of grants
4. **Session grants** — Persisted "always allow" grants
5. **Configured policy allow** — Narrow allow rule can authorize without classifier
6. **Auto mode classifier** — LLM-based or heuristic classifier
7. **Sandbox auto-allow** — If sandbox is active and `auto_allow_bash` is enabled
8. **Interactive prompt** — If no auto-decision was made, the user is prompted

### Permission Rules

**File:** `crates/codegen/xai-grok-config-types/src/permission.rs:7-59`

```toml
[[permission.rules]]
action = "allow"       # allow | deny | ask (default: deny — CWE-1188)
tool = "bash"          # any | bash | edit | read | grep | mcp | webfetch (default: any)
pattern = "git *"
pattern_mode = "glob"  # glob | domain
```

### `Decision` — The Verdict

```rust
pub enum Decision {
    Allow,
    Ask,
    FollowupMessage(String),
    Reject(String),         // user-initiated rejection
    PolicyDeny(String),     // policy deny rule; returned to LLM
    Cancelled,              // user cancelled the turn
}
```

### Bash Command Approval

**Evaluation precedence:** `deny > ask > allow` — order-independent, deny always wins. For Bash: allow is **conjunctive** — every peeled chain segment must independently match an allow rule.

**Bash gate:** Uses tree-sitter-bash to decompose scripts into segments (commands joined by `&&`, `||`, `;`, `|`). Per-segment evaluation. Wrapper peeling (`timeout`, `env`, `sudo`, `command`). Inline script recursion up to `MAX_INLINE_SHELL_DEPTH`. Fail-closed for undecomposable scripts.

**Grant persistence:** Whole-script grants (exact match replay) and per-segment grants. Dangerous verbs (`git push`, `rm`) and exec vehicles (`docker run`, `sudo`, `ssh`) never mint standalone prefix grants.

### Read-Only vs Write Permission Flow

`ToolKind::is_read_only()`:

**Read-only:** `Read`, `Search`, `Lsp`, `ListDir`, `List`, `MemorySearch`, `MemoryGet`, `WebSearch`, `WebFetch`, `EnterPlan`, `ExitPlan`, `AskUser`

**Mutating:** `Edit`, `Delete`, `Write`, `Move`, `Execute`, `Plan`, `Task`, `ImageGen`, `VideoGen`, `Monitor`, `GoalUpdate`, `Workflow`, `UseTool`, `Other`, etc.

Read-only tools map to `AccessKind::Read`/`Grep` — typically auto-allowed in ask mode. Write tools map to `AccessKind::Edit`/`Bash`/`MCPTool`/`WebFetch` — go through the full decision pipeline.

## 9. Error Handling

### `ToolError`

**File:** `crates/common/xai-tool-runtime/src/error.rs:111-125`

```rust
pub struct ToolError {
    pub kind: ToolErrorKind,            // 19 variants
    pub detail: String,                // model-facing message
    #[serde(skip)] source: Option<anyhow::Error>,  // causal chain (NOT sent to model)
    pub details: Option<Value>,        // structured metadata
}
```

19 `ToolErrorKind` variants: `NotImplemented`, `InvalidArguments`, `NotFound`, `PermissionDenied`, `Unauthorized`, `Timeout`, `Cancelled`, `RateLimited`, `UsagePoolExhausted`, `UsageLimitReached`, `GlobalRateLimit`, `ConcurrencyLimit`, `ServiceUnavailable`, `NetworkError`, `Execution`, `BehaviorVersionUnsupported`, `RenderLimited`, `TerminalError`, `Custom`.

### Parameter Validation

Two-phase validation:
1. **Structural (serde):** `serde_path_to_error::deserialize` enriches failures with `field_path`, `bad_value`, `expected`, `category`
2. **Semantic (tool-defined):** `T::validate_params_value(&typed)`

## 10. Supporting Systems

### Hunk Tracker

**File:** `crates/codegen/xai-hunk-tracker/src/`

Tracks file hunks (diffs) with agent/external attribution using an actor pattern. `HunkTrackerActor` runs in a dedicated tokio task, receives `Command`s from agent tools and fs_notify event loop, maintains state without locks.

LOC tracking types: `AuthorType` (Agent vs External), `EventType` (Addition vs deletion), `HunkRecord`, `HunkRecordWriter`, `LocAggregate`, `SourceType`.

### Fuzzy File Search

**File:** `crates/codegen/xai-fuzzy-file-search/src/lib.rs`

An `ignore` walk feeds paths into a `nucleo` matcher. Three degradation modes: `Full` → `BrowseOnly` → `Disabled`. Thread constants: `NUM_NUCLEO_THREADS = 2`, `NUM_IGNORE_THREADS = 8`.

### Git Status

**File:** `crates/codegen/xai-gix-status/src/lib.rs`

Thread-safe `gix` status scanning. `compute_gix_status_thread_limit()` caps produce workers: `HARD_CAP = 8`, `OUTER_RESERVE = 8`, serial if `headroom < 2`.

## Key Takeaways for Kraken

1. **Two-trait design** — `Tool` (runtime, typed) + `ToolMetadata` (codegen, model-facing) separates execution from definition
2. **Type erasure via `ToolDyn`** — `Arc<dyn ToolDyn>` enables heterogeneous tool collections without monomorphization
3. **Streaming output** — `ToolStream` with Progress + Terminal items enables real-time UI updates during long-running tools
4. **50 tools across 6 namespaces** — GrokBuild, GrokBuildConcise, GrokBuildHashline, Codex, OpenCode, MCP
5. **Template-based descriptions** — MiniJinja templates with `${{ tools.by_kind.read }}` cross-references enable dynamic tool descriptions
6. **Resources as DI container** — `SharedResources` injected via `TypedExtensions`, not constructor parameters
7. **Permission-first design** — Every tool call passes through an 8-step decision pipeline before execution
8. **Bash command decomposition** — tree-sitter-bash splits scripts into segments, evaluated conjunctively for allow
9. **Fail-closed by default** — Default action is `deny` (CWE-1188), undecomposable scripts fail closed
10. **Notifications flow sideways** — Tool notifications go through a separate channel, not the return value, enabling persistence and auto-wake
11. **Cross-tool requirements** — Tools can declare dependencies on other tools being present, validated at finalization
12. **Tool packs** — Out-of-tree registration via `ToolPack` function pointers for extensibility
