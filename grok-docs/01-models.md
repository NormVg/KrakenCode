# Models

> How grok-build handles model configuration, conversation representation, sampling, and context window management.

## 1. Conversation Representation

The core abstraction is `ConversationItem` — a backend-agnostic representation that can convert to/from any of three API formats: Chat Completions, Responses API, and Anthropic Messages API.

**File:** `crates/codegen/xai-grok-sampling-types/src/conversation.rs:68-100`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ConversationItem {
    System(SystemItem),
    User(UserItem),
    Assistant(AssistantItem),
    ToolResult(ToolResultItem),
    BackendToolCall(BackendToolCallItem),
    Reasoning(rs::ReasoningItem),
}
```

### Key Design Insight: Sibling Reasoning Items

`Reasoning` and `BackendToolCall` are **sibling items** alongside `Assistant`, not nested inside it. This preserves:
1. N parallel reasoning items (e.g. `tco_*` blobs from parallel backend tool calls) without last-write-wins clobbering
2. The interleaved order `[reasoning, tool_call, reasoning, ..., message]` the model emits, which keeps the server-side prefix KV-cache hot

### Item Types

| Type | File:Line | Key Fields |
|:-----|:----------|:-----------|
| `SystemItem` | `conversation.rs:103-106` | `content: Arc<str>` — cheap cloning |
| `UserItem` | `conversation.rs:242-279` | `content`, `synthetic_reason`, `prompt_index`, `prior_turn_interrupt` |
| `AssistantItem` | `conversation.rs:290-314` | `content: Arc<str>`, `tool_calls`, `model_id`, `reasoning_effort` |
| `ToolResultItem` | `conversation.rs:317-329` | `tool_call_id`, `content: Arc<str>`, `images` |
| `BackendToolCallItem` | `conversation.rs:335-405` | `kind: BackendToolKind` |

### Synthetic Reasons

`SyntheticReason` (`conversation.rs:117-150`) classifies why a `UserItem` was synthesized by the runtime rather than typed by a real user: `CompactionMeta`, `SystemReminder`, `AutoContinue`, `Unknown`, etc.

The `starts_prompt_turn()` method determines whether a synthetic item opens a new turn for truncation purposes.

### Prompt Index for Truncation

`UserItem.prompt_index` records the prompt-turn index this user item started, in the same coordinate space as the session's `prompt_index` / rewind targets. This is critical for `conversation_truncate_for_prompt`.

## 2. Content Parts

**File:** `crates/codegen/xai-grok-sampling-types/src/conversation.rs:150-242`

`ContentPart` is the polymorphic content unit inside `UserItem` and `ToolResultItem`:

```rust
pub enum ContentPart {
    Text { text: String },
    Image { image_url: ImageUrl, detail: Option<String> },
}
```

## 3. API Format Conversion

The conversation model converts to three wire formats:

| Format | Endpoint | Conversion Module |
|:-------|:---------|:-----------------|
| Chat Completions | `/v1/chat/completions` | `types.rs` |
| Responses API | `/v1/responses` | Uses `rs` (re-exported `async_openai::types::responses`) |
| Anthropic Messages | `/v1/messages` | `messages.rs` |

### Tool Overrides

**File:** `crates/codegen/xai-grok-sampling-types/src/tool_overrides.rs`

The `toolOverrides` wire contract allows the backend to host tools. When a backend tool is called, a `BackendToolCallItem` is inserted into the conversation as a sibling, preserving the interleaved order.

## 4. Token Estimation

**File:** `crates/codegen/xai-token-estimation/src/lib.rs`

Pure shared token-estimation primitives — the single source of truth for context-window arithmetic.

| Constant | Value | Description |
|:---------|:------|:------------|
| `BYTES_PER_TOKEN` | 4 | The bytes/4 heuristic |
| `IMAGE_TOKEN_ESTIMATE` | 765 | Per-image approximate token cost |

### Key Functions

| Function | File:Line | Description |
|:---------|:----------|:------------|
| `estimate_tokens(s)` | `lib.rs:17` | `len / 4` |
| `estimate_chars(tokens)` | `lib.rs` | Inverse: `tokens * 4` |
| `estimate_image_tokens(count)` | `lib.rs` | `count * 765` |
| `usage_percentage(used, total)` | `lib.rs` | Clamped to 100.0, returns 0.0 for total=0 |
| `free_tokens(total, used)` | `lib.rs` | `total - used`, saturating at zero |
| `exceeds_threshold(used, cw, pct)` | `lib.rs` | `used * 100 >= cw * pct` |
| `exceeds_threshold_with_headroom(used, cw, pct, headroom)` | `lib.rs` | Subtracts headroom from threshold |

Used by: `/context`, `/session-info`, auto-compact gates, preflight overflow check, and all client renderers.

## 5. Doom Loop Detection

**File:** `crates/codegen/xai-grok-sampling-types/src/doom_loop.rs`

Server-side doom-loop detection wire types. Detects when the agent is stuck in a repetitive loop (same tool calls, same errors) and signals the client to break out.

## 6. Model Configuration

**File:** `crates/codegen/xai-grok-models/src/`

Model configuration is managed by the `xai-grok-models` crate, which handles:
- Available model definitions
- Model capability flags (vision, tool use, reasoning)
- Model fingerprinting for tracking which model produced which output

### Reasoning Effort

`AssistantItem` carries `reasoning_effort: Option<ReasoningEffort>` — the effort level used for that turn, preserved in the conversation history for audit and replay.

## 7. Context Window Management

The agent manages context window limits through:

1. **Token estimation** — Pre-flight check before sending to the API
2. **Conversation truncation** — `conversation_truncate_for_prompt` uses `prompt_index` to trim old turns
3. **Auto-compaction** — When `exceeds_threshold` returns true, the agent triggers compaction
4. **Compaction transcript** — `xai-compaction-transcript` crate handles summarizing old conversation

## 8. Sampler

**File:** `crates/codegen/xai-grok-sampler/src/`

The sampler crate handles the actual API calls, streaming responses, and error handling. It uses the `xai-grok-sampling-types` crate for wire types, keeping I/O separate from data definitions.

## 9. Chat State

**File:** `crates/codegen/xai-chat-state/src/`

`xai-chat-state` depends only on `xai-grok-sampling-types` (not the full shell), enabling:
- Conversation state management without I/O dependencies
- Testable conversation logic in isolation
- Shared conversation model between pager and shell

## Key Takeaways for Kraken

1. **Separate data types from I/O** — The sampling types crate has no HTTP client, making it reusable and testable
2. **Sibling reasoning items** — Don't nest reasoning inside assistant items; keep them as siblings to preserve interleaved order and KV-cache efficiency
3. **Prompt index tracking** — Track which turn each user message belongs to for precise truncation
4. **Single source of truth for tokens** — One crate handles all token estimation, used everywhere
5. **Backend tool support** — The `toolOverrides` contract allows backend-hosted tools alongside client tools
