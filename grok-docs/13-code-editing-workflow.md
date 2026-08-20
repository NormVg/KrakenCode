# Code-Editing Workflow

> How grok-build actually reads, searches, edits, and creates code — the dedicated tool approach, the editing loop, and why it avoids raw terminal commands for file operations.

## 1. The Core Principle

Grok-build does NOT write code through terminal tools like `grep`, `sed`, or `awk`. It uses **dedicated, purpose-built tools** with typed inputs/outputs, structured responses, permission gating, and safety checks.

The system prompt enforces this explicitly:

> Use specialized tools instead of bash commands when possible. For file operations, prefer dedicated file tools (e.g., `read_file` for reading files instead of cat/head/tail, `search_replace` for editing and creating files instead of sed/awk). Reserve bash tools exclusively for actual system commands and terminal operations that require shell execution. NEVER use bash echo or other command-line tools to communicate thoughts, explanations, or instructions to the user.

And when Unix utilities are unavailable:

> The Unix utilities `grep`, `head`, `tail`, `sed`, `awk`, and `find` are NOT available in this shell. Use the dedicated tools instead.

## 2. The Code-Editing Loop

The standard workflow for any code change:

```
1. READ     → read_file (not cat/head/tail)
2. SEARCH   → grep (ripgrep-backed, not shell grep)
3. LIST     → list_dir (not ls/find)
4. EDIT     → search_replace (not sed/awk)
5. CREATE   → search_replace with empty old_string (not touch/echo >)
6. VERIFY   → run_terminal_command (bash — for builds, tests, linters)
```

The terminal (`run_terminal_command`) is reserved for:
- Running builds (`cargo build`, `npm run build`)
- Running tests (`cargo test`, `npm test`)
- Running linters (`cargo clippy`, `eslint`)
- System operations (git, package managers, process management)
- Background processes (dev servers, watch modes)

## 3. The File Tools in Detail

### 3.1 ReadFile (`read_file`)

**File:** `xai-grok-tools/src/implementations/grok_build/read_file/mod.rs`

**Kind:** `ToolKind::Read` (read-only)

**Description:**

> Read a file.
>
> Usage:
> - The `target_file` parameter can be a relative path in the workspace or an absolute path
> - By default, it reads up to {max_lines_read} lines starting from the beginning of the file
> - Line numbers (1-based) appear as anchors in the format LINE_NUMBER→LINE_CONTENT on the first returned line and on every 10th line of the file; the lines in between show content only. Count from the nearest anchor when referring to a specific line
> - This tool can read PDF files (.pdf), PowerPoint files (.pptx), Jupyter notebooks (.ipynb files), and image files (e.g. PNG, JPG, etc).
> - When reading an image file the contents are presented visually as this tool uses multimodal LLMs.

**Parameters:**

| Parameter | Type | Description |
|:----------|:-----|:------------|
| `target_file` | string | Relative or absolute path |
| `offset` | i64 (optional) | Line number to start reading from |
| `limit` | usize (optional) | Number of lines to read |
| `pages` | string (optional) | Page range for PDFs (e.g. '1-5', '3', '10-') |
| `format` | string (optional) | PDF output format: 'image' (default) or 'text' |

**Key features:**
- Line-number anchors (`LINE_NUMBER→LINE_CONTENT`) every 10 lines — the model references lines by counting from the nearest anchor
- Multimodal: images are presented visually to the model, not as text
- PDF support with page ranges and image/text output formats
- PPTX text extraction
- Jupyter notebook support

### 3.2 SearchReplace (`search_replace`)

**File:** `xai-grok-tools/src/implementations/grok_build/search_replace/mod.rs`

**Kind:** `ToolKind::Edit` (mutating)

**Description:**

> Replace an exact string in a file.
>
> - `read_file` prefixes each line with "LINE_NUMBER→". That prefix is not part of the file: match only what comes after the →, with its exact indentation.
> - `old_string` must match exactly one place in the file. If it appears more than once, add surrounding lines to make it unique, or set `replace_all` to change every occurrence (handy for renaming an identifier).
> - To create a new file, set `old_string` to an empty string. An empty `old_string` cannot overwrite an existing non-empty file.

**Parameters:**

| Parameter | Type | Description |
|:----------|:-----|:------------|
| `file_path` | string | Relative or absolute path |
| `old_string` | string | The text to replace (empty = create new file) |
| `new_string` | string | The replacement text |
| `replace_all` | bool (default false) | Replace all occurrences |

**Execution flow:**

1. Resolve path relative to workspace CWD
2. Canonicalize path (with Unicode filename fallback)
3. Validate path length
4. Reject if path is a directory
5. Check `.gitignore` (refuses to edit ignored files, unless legacy mode)
6. Reject if `old_string == new_string`
7. If `old_string` is empty:
   - Create new file (or fill empty file)
   - Guard: empty `old_string` cannot overwrite existing non-empty file (when `empty_old_string_does_not_override` is enabled)
8. If `old_string` is non-empty:
   - Find exact match in file content
   - If exact match fails: try Unicode confusable normalization (smart quotes → straight quotes, em-dashes → hyphens)
   - If multiple matches: error unless `replace_all: true`
   - If exactly one match: perform replacement
9. Emit `FileWritten` notification
10. Return structured output with line diff counts (added/removed)

**Safety features:**
- Exact match uniqueness enforcement (prevents accidental wrong-location edits)
- `.gitignore` respect (won't edit ignored files)
- Unicode confusable fallback (handles model-emitted smart quotes vs file's straight quotes)
- User-edit hint on no-match (nudges model to re-read instead of blindly retrying)
- Path validation and canonicalization

**Output structure:**

```rust
SearchReplaceOutput::EditsApplied(SearchReplaceEditsApplied {
    edits: SearchReplaceEditDetail {
        old_string, new_string, replace_all,
        details: [SearchReplaceEditContextInformation { ... }]
    }
})
```

### 3.3 Grep (`grep`)

**File:** `xai-grok-tools/src/implementations/grok_build/grep/mod.rs`

**Kind:** `ToolKind::Search` (read-only)

**Description:**

> Search file contents with regular expressions (ripgrep).
>
> - Full regex syntax, so escape literal special characters: `functionCall\(`, or `interface\{\}` to find interface{} in Go.
> - Pass `pattern` as a raw regex string — no surrounding quotes.
> - Respects .gitignore unless you pass a broad glob like '--glob *'.
> - Only filter by `type` or `glob` when you are sure of the file type; import paths may not match source file types (.js vs .ts).
> - Output is ripgrep-style: ':' marks match lines, '-' marks context lines, grouped by file. Large results are capped and report "at least" counts.

**Backed by:** ripgrep (not shell grep)

**Parameters:**

| Parameter | Type | Description |
|:----------|:-----|:------------|
| `pattern` | string | Regex pattern (raw, no quotes) |
| `path` | string (optional) | Directory or file to search |
| `glob` | string (optional) | File glob filter |
| `type` | string (optional) | File type filter |
| `output_mode` | string (optional) | Output format |
| `-n` / context | int (optional) | Context lines |

### 3.4 ListDir (`list_dir`)

**File:** `xai-grok-tools/src/implementations/grok_build/list_dir/mod.rs`

**Kind:** `ToolKind::List` (read-only)

**Description:**

> Lists files and directories in a given path.
> The `target_directory` parameter can be relative to the workspace root or absolute.
>
> Other details:
>     - The result does not display dot-files and dot-directories.
>     - Respects .gitignore patterns (files/directories ignored by git are not shown).
>     - Large directories are summarized with file counts and extension breakdowns instead of listing all files.

### 3.5 Bash (`run_terminal_command`)

**File:** `xai-grok-tools/src/implementations/grok_build/bash/mod.rs`

**Kind:** `ToolKind::Execute` (mutating)

**Description (background enabled):**

> Run a bash command and return its output.
>
> Usage notes:
>   - You can specify an optional `timeout` in milliseconds (up to 300000ms). If not specified, foreground commands exceeding the default timeout will be automatically backgrounded instead of killed. You will receive a task id to check output later. Background tasks are not bounded by the default: with `timeout` omitted or 0 they run until they exit or are killed; a positive `timeout` still applies.
>   - Timeout enforcement: when the timeout fires, the wrapper kills the child process group (SIGTERM, escalated to SIGKILL after a ~1s grace period). Descendants that did not detach via `setsid` / `nohup` will also be killed. `timeout: 0` in `background: true` mode disables the wrapper timeout entirely; the child's lifetime is owned by the model via `kill_command_or_subagent`.
>   - If the output exceeds {max_output_bytes} characters, the middle is truncated (you keep the beginning and end) and the result includes the path to a log file with the full output, which you can read or search.
>   - You can use the `background` parameter to run the command in the background (e.g., dev servers, long builds): it returns a task id immediately and keeps running in the background. You are notified on completion, so do not poll or sleep-wait for it. You do not need to use '&' at the end of the command when using this parameter.

**Parameters:**

| Parameter | Type | Description |
|:----------|:-----|:------------|
| `command` | string | The bash command to run |
| `timeout` | f64 (optional) | Timeout in milliseconds |
| `background` | bool (optional) | Run in background, returns task_id |

**Key features:**
- Streaming output via `bash_output_chunk` progress items (max 16KB per delta)
- Auto-background on timeout (configurable)
- Process group kill on timeout (SIGTERM → SIGKILL)
- Output truncation with log file for full output
- Background task lifecycle management

## 4. The Hashline Workflow (Alternate Edit Mode)

Some toolset presets (`grok-build-hashline`) use an anchor-based editing workflow:

1. Use `grep` to locate targets
2. Read via `hashline_read` — returns `ANCHOR→CONTENT` format (e.g. `22:abc:rst→code`)
3. Edit via `search_replace` using anchors — the anchor is only `22:abc:rst`, never include `→` or content
4. Edits are atomic — if any anchor is stale, ALL edits in a batch are rejected
5. On stale anchors, use the fresh anchors returned in the error response to retry immediately
6. Never fabricate or modify anchors

This is an optimization for large files where exact string matching is expensive — the anchor system provides a stable reference even as the file changes.

## 5. Why Dedicated Tools Instead of Raw Bash

| Concern | Raw Bash | Dedicated Tools |
|:--------|:---------|:-----------------|
| **Structured output** | Unstructured text | Line-numbered anchors, typed responses, file grouping |
| **Safety** | No validation | Exact match uniqueness, `.gitignore` respect, Unicode fallback |
| **Permission gating** | All-or-nothing | Per-tool `ToolKind` → read-only vs mutating → permission pipeline |
| **Streaming** | Line-by-line text | Typed `ToolStream` with Progress + Terminal items |
| **Multimodal** | Text only | Images presented visually to model |
| **Error messages** | Exit codes + stderr | Structured `ToolError` with 19 kind variants, field paths, bad values |
| **Notifications** | None | `FileWritten`, `BashExecutionComplete`, etc. flow sideways |
| **Truncation** | Arbitrary | Head+tail truncation with log file for full output |
| **Cross-references** | None | Tool descriptions reference each other via `${{ tools.by_kind.* }}` |

## 6. Tool Output Structure

Every tool returns typed output implementing `ToolOutput`, which provides model-facing content blocks:

```rust
pub trait ToolOutput: Send + Sync {
    fn to_content_blocks(&self) -> Vec<ContentBlock>;
}

pub enum ContentBlock {
    Text { text: String },
    Image { image_url: ImageUrl, detail: Option<String> },
}
```

The `ContentBlock` is what the model actually sees — structured, typed, and consistent across tools.

## 7. The Edit Verification Pattern

After making edits, grok-build's system prompt instructs the agent to verify:

1. **Run the build** — `run_terminal_command` with the project's build command
2. **Run the tests** — targeted tests for the changed area, not just the full suite
3. **Run the linter** — catch style/type errors
4. **Read the result** — `read_file` to confirm the edit landed correctly
5. **Capture evidence** — for goal-mode, save test output to scratch dir as proof

The goal rules prompt reinforces this:

> VERIFY AS YOU GO: run each change. If output is visual, capture and inspect it; for data/config, validate programmatically.
>
> TEST PROACTIVELY: run targeted tests after every change, not just at the end.

## 8. The Subagent Delegation Pattern

In orchestrator mode, the orchestrator does NOT edit files directly. It delegates:

1. **Explore subagent** — reads files, searches codebase, reports findings
2. **General-purpose subagent** — makes edits, runs builds/tests, produces evidence
3. **Multiple parallel subagents** — for independent files/modules

The orchestrator's job is to:
- Plan and architect
- Brief subagents with context (file paths, function names, acceptance criteria)
- Review subagent results
- Synthesize the final response for the user

This separation means the code-editing tools (`search_replace`, `read_file`) are used by subagents, not the orchestrator. The orchestrator only uses read-only tools (`read_file`, `grep`, `list_dir`) for quick context and delegates all mutations.

## Key Takeaways for Kraken

1. **Build dedicated tools** — `read_file`, `search_replace`, `grep`, `list_dir` in the main process, exposed via IPC to the renderer
2. **Don't use the terminal for code operations** — the terminal is for builds, tests, and system commands only
3. **Line-number anchors** — `read_file` returns `LINE_NUMBER→LINE_CONTENT` format so the model can reference specific lines
4. **Exact-match editing** — `search_replace` requires unique `old_string` match; `replace_all` for renames; empty `old_string` for new files
5. **Unicode fallback** — handle smart quotes/em-dashes the model emits vs straight quotes in files
6. **`.gitignore` respect** — don't edit ignored files
7. **Streaming bash output** — stream command output in real-time, truncate with log file for full output
8. **Background tasks** — long commands run in background, return task_id, notify on completion
9. **Typed tool output** — structured `ContentBlock` responses, not raw text
10. **Verify after every edit** — build, test, lint, read-back — not just at the end
