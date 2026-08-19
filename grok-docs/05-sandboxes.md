# Sandboxes

> How grok-build enforces security through kernel-level sandboxing, permission systems, and secret redaction.

## 1. Sandbox Architecture

**File:** `crates/codegen/xai-grok-sandbox/src/`

The sandbox is the core security boundary. It restricts filesystem access (read/write/deny) and network access for child processes using OS-native kernel enforcement.

### Design Principles

1. **Applied once at startup** — The sandbox is applied irreversibly to the current process
2. **Fail-closed** — A requested-but-unapplied profile still warns and is treated as confining
3. **Kernel-enforced** — Uses Landlock (Linux) or Seatbelt (macOS), not user-space filtering
4. **Immutable after apply** — Once applied, the sandbox cannot be loosened

### SandboxManager (`lib.rs:159-260`)

```rust
// Creates the manager, does not apply yet
SandboxManager::new(profile, workspace)

// Applies the sandbox irreversibly to the current process
SandboxManager::apply(workspace)
// Calls nono::Sandbox::apply() with a CapabilitySet

// Stores sandbox state globally for session-lifetime violation logging
SandboxManager::install(self)
// Uses OnceLock<GlobalSandboxState>
```

### Global State (`lib.rs:70-133`)

| Global | Type | Purpose |
|:-------|:-----|:--------|
| `SANDBOX` | `OnceLock<GlobalSandboxState>` | The active sandbox state |
| `CONFIGURED_PROFILE` | `OnceLock<String>` | The resolved profile from startup |
| `AUTO_ALLOW_BASH` | `AtomicBool` | Whether bash commands are auto-approved |

### Fail-Closed Design (`lib.rs:110-122`)

`requested_confinement_profile()` keys on the *request*, not on whether enforcement succeeded — a requested-but-unapplied profile still warns the user and is treated as confining.

## 2. Sandbox Profiles

**File:** `crates/codegen/xai-grok-sandbox/src/profiles.rs`

### Built-in Profiles (`profiles.rs:68-77`)

| Profile | Network Restricted | Description |
|:--------|:-------------------|:------------|
| `Workspace` (default) | No | Read/write to workspace + grok_home + temp |
| `Devbox` | No | Like workspace but write-denies `/data` (Linux) |
| `ReadOnly` | Yes | Minimal writable (grok_home + temp only) |
| `Strict` | Yes | Read-only filesystem access, no default read |
| `Off` | No | Sandbox disabled |
| `Custom(name)` | Configurable | User-defined via `sandbox.toml` |

### Profile Resolution (`profiles.rs:206-514`)

`ProfileName::resolve_profile()` converts a profile name into a `SandboxProfile` struct with resolved paths:
- Custom profiles can `extends` a built-in
- Custom cannot extend custom (`profiles.rs:470-475`)
- The `Off` profile returns an error on resolve (`profiles.rs:464-468`)

### Capability Set Construction (`profiles.rs:232-340`)

`capability_set_from_profile()` builds a `nono::CapabilitySet`:

| Config Field | Capability |
|:-------------|:-----------|
| `default_read` | `caps.allow_path("/", AccessMode::Read)` |
| `read_only` paths | `AccessMode::Read` (skips non-existent) |
| `read_write` paths | `AccessMode::ReadWrite` (pre-creates dirs like `~/.grok/`) |
| Device files | `allow_file` (filtered through `device_file_openable`) |
| Deny paths | `deny::apply_*` functions |

## 3. Configuration

### Config Files (`profiles.rs:120-179`)

Sandbox config is loaded from two TOML files:
1. **Global:** `~/.grok/sandbox.toml` (`profiles.rs:124`)
2. **Project:** `<workspace>/.grok/sandbox.toml` (`profiles.rs:130`)

### Security-Critical Merge Rule (`profiles.rs:114-119, 162-168`)

Project config may only *add* new profile names. It cannot redefine a name already present in global config — this prevents a malicious workspace from hollowing out a user/enterprise custom profile while keeping the trusted name.

```toml
# Example sandbox.toml
[profiles.my-strict]
extends = "strict"
deny = [".env", "secrets/**"]
read_only = ["/data"]
restrict_network = true
```

## 4. Path Allowlisting

**File:** `crates/codegen/xai-grok-sandbox/src/allow_path.rs`

`normalize_allow_path()` (`allow_path.rs:31-76`) is the security-sensitive parser for `read_only`/`read_write` entries.

### Key Properties

- Allow paths are **literal directory grants**, never widened
- One trailing recursive glob (`/**`, `/**/`, `/**/*`, `/*`) is stripped to the parent directory
- Surrounding whitespace is **rejected** (never trimmed — trimming would widen `/tmp/* ` into a grant of `/tmp`)
- Entries still glob-shaped after stripping are skipped with a warning

## 5. Deny Paths

**File:** `crates/codegen/xai-grok-sandbox/src/deny/mod.rs`, `deny/glob.rs`

Deny paths are kernel-enforced (read + write/rename) on both platforms.

### macOS (`deny/mod.rs:80-118`)

Uses Seatbelt platform rules via `nono::CapabilitySet::add_platform_rule`:
- Emits `(deny file-read* ...)` and `(deny file-write* ...)` 
- Plus 8 specific write sub-actions (`file-write-data`, `file-write-create`, `file-write-unlink`, etc.)
- The broad `file-write*` deny alone doesn't win against last-match workspace write grants
- Handles macOS `/private` firmlink aliases (`/tmp` ↔ `/private/tmp`)

### Linux (`deny/glob.rs`)

Landlock cannot deny a subpath of an allowed tree, so read-deny is enforced via **bwrap bind-over**:
- A zero-permission placeholder (mode 000) is created under `grok_home`
- Bound over the denied path, yielding EPERM on read

### Glob Deny Entries (`deny/glob.rs:27-38`)

`partition_deny_entries()` splits deny entries into exact paths and glob patterns:
- Globs validated identically on both platforms (rejects `{`/`}`/`\`, non-component `**`, `.`/`..` segments)
- macOS: globs become anchored runtime regexes (covers files created after launch)
- Linux: globs expanded to concrete existing matches at bwrap launch time (files created later NOT covered)

## 6. Hook Write-Deny

**File:** `crates/codegen/xai-grok-sandbox/src/hook_write_deny.rs`

Protects Grok-owned hook files from being overwritten by the agent. Enforced for all profiles except `Devbox` and `Off` (`hook_write_deny.rs:18-20`).

### Path Identity Revalidation (`hook_write_deny.rs:58-125`)

Before applying the sandbox, each hook path's identity (dev, ino, is_dir, nlink) is captured and revalidated to detect rename races:
- Regular files must have `st_nlink == 1` (no hard-link aliases)
- Symlinks are rejected outright

### bwrap Plan (`hook_write_deny.rs:260-358`)

On Linux, `HookWriteDenyBwrapPlan` computes:
- Ancestor `--bind` (writable) entries
- Leaf `--ro-bind` (read-only) entries
- Directory JSON snapshots captured and revalidated before apply

### Namespace Lockdown (`hook_write_deny.rs:392-424`)

After bwrap re-exec, a seccomp filter is installed:
- Blocks `unshare`/`setns`/`clone(CLONE_NEW*)` → EPERM
- Blocks `clone3` → ENOSYS (forcing libc fallback to legacy clone)

## 7. Child Network Filtering

**File:** `crates/codegen/xai-grok-sandbox/src/child_net.rs`

### Seccomp BPF Filters (Linux)

| Filter | Blocks |
|:-------|:-------|
| `build_child_network_filter()` | `socket`/`connect`/`bind`/`listen`/`accept`/`sendto`/`recvfrom` in child processes |
| `build_namespace_lockdown_filter()` | `unshare`/`setns` → EPERM, `clone3` → ENOSYS, `clone(CLONE_NEW*)` → EPERM |

- Installed pre-exec via `SECCOMP_FILTER_FLAG_TSYNC`
- Architecture-checked (x86_64/aarch64), x32 bit rejected

## 8. Network Policy

**File:** `crates/codegen/xai-grok-sandbox/src/network_policy.rs`

Pure policy modeling for future child website egress. Not currently enforced by the sandbox runtime.

### Types

| Type | Description |
|:-----|:------------|
| `ChildNetworkPolicy` | `Unrestricted`, `Blocked`, `Websites(WebsitePolicy)` |
| `WebsiteOrigin` | Exact HTTP(S) origin with IDNA ASCII hostname and effective nonzero port. Rejects IP literals, wildcards, userinfo, control characters |
| `WebsitePolicy` | Allow/deny lists with deny precedence, default action |
| `NetworkPolicySnapshot` | Canonical JSON with SHA-256 hash for tamper detection |

## 9. Event Logging

**File:** `crates/codegen/xai-grok-sandbox/src/logging.rs`, `types.rs`

`SandboxLogger` (`logging.rs:13-105`) collects sandbox events in memory and flushes to `~/.grok/sandbox-events.jsonl` as JSONL.

### Event Types (`types.rs:150-158`)

| Event | Description |
|:------|:------------|
| `ProfileApplied` | Sandbox profile was applied |
| `ApplyFailed` | Sandbox application failed |
| `FsViolation` | Filesystem access violation |
| `NetViolation` | Network access violation |
| `BypassGranted` | Sandbox bypass was granted |
| `BypassDenied` | Sandbox bypass was denied |

### Metrics (`types.rs:161-193`)

Atomic counters for `fs_violations`, `net_violations`, `bypasses_granted`, `bypasses_denied`.

## 10. Path Tables

**File:** `crates/codegen/xai-grok-sandbox/src/paths.rs`

| Function | Returns |
|:---------|:--------|
| `grok_home()` | `$GROK_HOME` or `~/.grok` (`paths.rs:10-12`) |
| `DEVICE_FILES` | `/dev/null`, `/dev/zero`, `/dev/random`, `/dev/urandom`, `/dev/tty`, `/dev/ptmx` (`paths.rs:25-32`) |
| `DEVICE_DIRS` | `/dev/pts`, `/dev/fd` (`paths.rs:36-39`) |
| `temp_writable_paths()` | `/tmp`, `/var/tmp`, macOS `/private/tmp`, `/private/var/tmp`, `/private/var/folders`, `$TMPDIR` (`paths.rs:50-73`) |
| `essential_writable_paths(workspace)` | workspace + grok_home + temp (`paths.rs:79-83`) |
| `essential_writable_paths_minimal()` | grok_home + temp only (for read-only profile) (`paths.rs:87-91`) |

## 11. Secrets Management

**File:** `crates/codegen/xai-grok-secrets/src/sanitizer.rs`

Regex-based secret redaction for telemetry, logs, and model context.

### Detected Secret Patterns

| Pattern | Regex |
|:--------|:------|
| API keys | `sk-`/`sk_`/`xai-` prefixed (20+ chars, word-boundary anchored) |
| AWS | `AKIA`/`ASIA` access key IDs (16 chars) |
| GitHub classic PATs | `ghp_`/`gho_`/`ghu_`/`ghs_`/`ghr_` |
| GitHub fine-grained | `github_pat_` |
| GitLab | `glpat-` |
| Slack | `xoxa-`/`xoxb-`/`xoxp-`/`xapp-` |
| Google API keys | `AIza` + 35 chars |
| PEM private keys | Full block including body |
| Bearer tokens | `Bearer ` + 16+ chars |
| Bare JWTs | `eyJ...header.payload.signature` |
| Secret assignments | `api_key=...`, `token=...`, `password=...` (8+ char floor) |

### URL Redaction (`sanitizer.rs:132-147`)

Strips credentials, fragments, and sensitive query params:
- `access_token`, `api_key`, `code`, `password`, `refresh_token`, `state` (14 params total)

### User Path Redaction

Collapses `/Users/alice` → `~` and username segments → `<user>`, with whole-segment matching to avoid collapsing `/Users/bobby` into `/Users/bob`.

## 12. Security Architecture Summary

```
┌─────────────────────────────────────────────────────┐
│                    Agent Process                     │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │         Kernel Sandbox (applied once)          │   │
│  │  Landlock (Linux) / Seatbelt (macOS)          │   │
│  │                                                │   │
│  │  ┌────────────┐  ┌────────────┐  ┌─────────┐ │   │
│  │  │ FS Access  │  │ Network    │  │ Deny    │ │   │
│  │  │ Control    │  │ Filter     │  │ Paths   │ │   │
│  │  └────────────┘  └────────────┘  └─────────┘ │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │         Permission System (per-tool)           │   │
│  │  allow / deny / ask  +  auto-mode classifier   │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │         Secret Redaction (all output)          │   │
│  │  API keys, tokens, PEM, URLs with credentials  │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │         Hook Write-Deny                        │   │
│  │  Protects hook files + namespace lockdown     │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Key Takeaways for Kraken

1. **Kernel-level enforcement** — Use Landlock/Seatbelt, not user-space filtering, for the sandbox boundary
2. **Applied once, irreversible** — The sandbox cannot be loosened after application
3. **Fail-closed** — Requested-but-unapplied profiles are treated as confining
4. **Project config can only add** — Prevents malicious workspaces from redefining trusted profiles
5. **Path identity revalidation** — Detect rename races by checking dev/ino/nlink before and after
6. **Seccomp for child processes** — Block network syscalls and namespace creation in children
7. **Comprehensive secret redaction** — Cover API keys, tokens, PEM blocks, URLs with credentials
8. **bwrap bind-over for deny** — On Linux, use zero-permission placeholders for read-deny
9. **macOS firmlink handling** — Handle `/tmp` ↔ `/private/tmp` aliases to prevent bypass
10. **Event logging** — Log all sandbox violations and bypass decisions for audit
