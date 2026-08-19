# Skills

> How grok-build extends agent capabilities through slash commands, hooks, and plugins.

## 1. Slash Commands

**File:** `crates/codegen/xai-grok-pager/src/slash/`

Slash commands are user-invoked shortcuts that trigger agent actions. They are parsed from the input stream and dispatched to handlers.

### Command Categories

| Category | Example Commands | Purpose |
|:---------|:-----------------|:--------|
| Session | `/compact`, `/context`, `/session-info` | Session management and context |
| Workflow | `/workflow pause <name>`, `/workflow resume <name>` | Workflow control |
| File | `/read`, `/edit`, `/grep` | File operations |
| System | `/help`, `/status`, `/quit` | System commands |

### Workflow Slash Commands

**File:** `crates/codegen/xai-grok-pager/src/slash/commands/workflows.rs`

```
/workflow pause <name>   — Pause a running workflow
/workflow resume <name>   — Resume a paused workflow
```

## 2. Hooks System

**File:** `crates/codegen/xai-grok-hooks/src/`

Hooks are event-driven handlers that can intercept and modify agent actions. They are the primary extensibility mechanism.

### Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Discovery   │────▶│  Dispatcher  │────▶│   Runner     │
│              │     │              │     │              │
│ Loads hook   │     │ Matches      │     │ Executes     │
│ specs from   │     │ events to    │     │ command or   │
│ files/dirs   │     │ matchers     │     │ HTTP request │
└──────────────┘     └──────────────┘     └──────────────┘
```

### Discovery (`discovery.rs:944 lines`)

Loads `HookSpec` from two sources:
- **SettingsFile** — Explicit hook definitions in config
- **Directory** — Auto-discovery from `.grok/hooks/` directories

### Dispatcher (`dispatcher.rs:1224 lines`)

Matches `HookEventName` → `HookMatcher` → `Runner`. The dispatcher evaluates hooks in order and aggregates decisions.

### Hook Events (`event.rs:982 lines`)

| Event | When Fired | Can Modify |
|:------|:----------|:-----------|
| `PreToolUse` | Before a tool executes | Tool arguments (InputRewrite) |
| `PostToolUse` | After a tool executes | — |
| `PreSession` | Before session starts | — |
| `PostSession` | After session ends | — |
| `Notification` | On agent notifications | — |

### Hook Decisions

| Decision | Effect |
|:---------|:-------|
| `Allow` | Continues to next hook/action |
| `Deny` | Blocks the action (e.g., prevents a tool call in `PreToolUse`) |
| `InputRewrite` | Modifies the `serde_json::Value` of tool arguments before execution |

### Runner Types

#### Command Runner (`runner/command.rs:1971 lines`)

Executes shell commands:
- `stdin` receives the `HookEventEnvelope` JSON
- Exit code `2` signals `Deny`
- Environment expansion via `env_expand.rs` (872 lines)

#### HTTP Runner (`runner/http.rs:897 lines`)

Sends `POST` requests:
- SSRF protection (blocks private IPs)
- Disables redirects
- Timeout enforcement

### Hook Configuration (`config.rs:1400 lines`)

```toml
[[hooks]]
event = "PreToolUse"
matcher = "bash"
command = "/path/to/hook-script"
timeout_ms = 5000
```

### Hook Trust (`trust.rs:171 lines`)

Hooks require folder trust before execution. Project-local hooks from untrusted directories are ignored.

### Environment Expansion (`env_expand.rs:872 lines`)

Expands environment variables and template variables in hook commands:
- `$TOOL_NAME` — The tool being called
- `$EVENT` — The hook event name
- `$SESSION_ID` — Current session ID
- `$WORKSPACE` — Current workspace path

## 3. Plugins System

**File:** `crates/codegen/xai-hooks-plugins-types/src/lib.rs:1271 lines`

Plugins are a higher-level abstraction over hooks. They package multiple hooks with shared configuration.

### Plugin Types

| Type | Description |
|:-----|:------------|
| `PluginManifest` | Plugin metadata, hooks, and dependencies |
| `PluginSource` | Where the plugin was loaded from |
| `PluginConfig` | Plugin-specific configuration |
| `PluginCapability` | What the plugin can do |

### Plugin Marketplace

**File:** `crates/codegen/xai-grok-plugin-marketplace/src/`

Supports discovering and installing plugins from a marketplace:
- Plugin search and listing
- Installation with trust verification
- Version management
- Dependency resolution

## 4. Skill-like Patterns

While grok-build doesn't have a direct "skills" concept like some agents, the equivalent functionality is provided through:

1. **Slash commands** — User-invoked shortcuts
2. **Hooks** — Event-driven automation
3. **Plugins** — Packaged extensibility
4. **Workflows** — Scripted multi-step procedures (see [07-loops.md](07-loops.md))
5. **System prompts** — Behavioral instructions (see below)

### System Prompt as Skill

The system prompt itself acts as a "skill" — it instructs the agent on:
- How to write code (root-cause fixes, no hacks)
- How to use tools (when to use which tool)
- How to interact with users (asking for permission)
- How to handle errors (never swallow, always surface)

## 5. Configuration Layers

**File:** `crates/codegen/xai-grok-config/src/config_layers.rs`

Configuration is layered (global → enterprise → project → env):

```
Global (~/.grok/config.toml)
    └─ Enterprise (managed policy)
        └─ Project (.grok/config.toml)
            └─ Environment (GROK_* env vars)
```

### Signed Policies

**File:** `crates/codegen/xai-grok-config/src/signed_policy.rs`

Enterprise policies can be cryptographically signed to prevent tampering. Signed policies override user configuration for security-critical settings.

### Environment Overlay

**File:** `crates/codegen/xai-grok-config/src/env_overlay.rs`

Environment variables (`GROK_*`) overlay on top of file configuration, allowing runtime overrides without modifying config files.

## 6. Feature Flags

**File:** `crates/codegen/xai-grok-config-types/src/flags.rs`

Feature flags control which capabilities are enabled:

```toml
[features]
memory = true
workflows = true
auto_mode = false
```

## Key Takeaways for Kraken

1. **Hooks as the extension point** — Event-driven hooks (PreToolUse, PostToolUse) allow intercepting and modifying agent behavior without touching core code
2. **InputRewrite** — Hooks can modify tool arguments before execution, enabling powerful transformations
3. **SSRF protection** — HTTP hooks block private IPs and disable redirects
4. **Folder trust** — Project-local hooks require explicit trust, preventing malicious repos from running arbitrary commands
5. **Plugin marketplace** — Plugins package multiple hooks with shared config and can be distributed
6. **Layered configuration** — Global → enterprise → project → env, with signed policies for security
