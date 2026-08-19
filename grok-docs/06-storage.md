# Storage

> How grok-build persists data: hybrid memory system, codebase graph, session state, and worktree metadata.

## 1. Memory System

**File:** `crates/codegen/xai-grok-memory/src/`

Markdown-based cross-session knowledge persistence with hybrid (BM25 + vector) search.

### Data Layout (`lib.rs:8-17`)

```
~/.grok/memory/
  ├── MEMORY.md                         # Global curated knowledge
  └── {workspace_hash}/                 # Per-workspace (blake3(cwd)[..16])
      ├── MEMORY.md                     # Project-level curated knowledge
      └── sessions/
          └── YYYY-MM-DD-{slug}-{sid8}.md  # Session logs
```

Enabled via `GROK_MEMORY`, `[memory] enabled`, or remote settings (`lib.rs:19-22`).

### Storage (`storage.rs`)

`MemoryStorage` (`storage.rs:27-36`) handles file I/O:

| Field | Description |
|:------|:------------|
| `global_dir` | `~/.grok/memory/` |
| `workspace_dir` | `~/.grok/memory/{slug}-{hash8}/` (blake3 hash, 8 hex chars) |
| `ephemeral` | When true (temp-dir CWDs), workspace writes are silently skipped |

### Source Classification (`storage.rs:132-143`)

| Source | Description |
|:-------|:------------|
| `"global"` | MEMORY.md under global_dir |
| `"workspace"` | MEMORY.md under workspace_dir |
| `"session"` | Session logs |

## 2. SQLite Index

**File:** `crates/codegen/xai-grok-memory/src/schema.rs`

Three tables (`schema.rs:23-64`):

### `meta` Table

Key-value metadata:
- Embedding dimensions
- Schema version

### `chunks` Table

Indexed text chunks with:
- `blake3` content hashes
- `path` — source file path
- `line_range` — source line range
- `source` — global/workspace/session
- `timestamps` — created/updated/accessed
- `access_count` — how many times retrieved

### `chunks_fts` Table

Contentless FTS5 virtual table for BM25 keyword search.

### `chunks_vec` Table (when sqlite-vec available)

`vec0` virtual table for KNN vector search.

## 3. Hybrid Search

**File:** `crates/codegen/xai-grok-memory/src/search.rs`

8-stage pipeline (`search.rs:1-16`):

```
Stage 1: FTS5 keyword search (always available)
    │
Stage 2: Vector KNN search (when sqlite-vec + embeddings available)
    │
Stage 3: Merge by chunk_id, normalize scores to [0,1]
    │
Stage 4: Skip content-free chunks (empty/boilerplate templates)
    │
Stage 5: Temporal decay
    │  • Evergreen sources (global, workspace) exempt
    │  • Session chunks decay with e^(-λ × age_days)
    │  • λ = ln(2) / half_life_days
    │
Stage 6: Source weights + access-frequency boost, filter by min_score
    │
Stage 7: MMR diversity re-ranking (opt-in)
    │
Stage 8: Limit to max_results
```

### Graceful Degradation (`search.rs:17`)

Falls back to FTS-only with `text_weight = 1.0` when vector search unavailable.

## 4. Embedding Provider

**File:** `crates/codegen/xai-grok-memory/src/embedding.rs`

`ApiEmbeddingProvider` (`embedding.rs:37-78`) calls an OpenAI-compatible `/embeddings` endpoint:

| Parameter | Value |
|:----------|:------|
| Batch size | 32 |
| Retry | Exponential backoff (1s, 2s, 4s) on 429/5xx |
| Cache | Embeddings cached in the sqlite-vec `chunks_vec` table |

## 5. MMR Re-ranking

**File:** `crates/codegen/xai-grok-memory/src/mmr.rs`

Maximal Marginal Relevance (`mmr.rs:1-17`):

```
MMR(d) = λ × relevance(d) - (1-λ) × max_similarity(d, selected)
```

- Uses Jaccard similarity on tokenized snippets (no embeddings needed)
- O(n²) but n is tiny (6-18 candidates)

## 6. Additional Memory Components

| Module | Purpose |
|:-------|:--------|
| `dream.rs` | "Dream" consolidation (background memory processing) |
| `dream_lock.rs` | Locking for dream process |
| `flush.rs` | Flush pending writes |
| `index.rs` | `MemoryIndex` + sqlite-vec initialization |
| `observation.rs` | Memory observation types |
| `query_expansion.rs` | Query expansion for search |
| `watcher.rs` | File system watcher for incremental reindexing |
| `chunker.rs` | Text chunking for indexing |
| `archive.rs` | Session archive management |
| `backend.rs` | `MemoryBackendImpl` / `MemoryBackendParams` |
| `text_utils.rs` | Text processing utilities |

## 7. Codebase Graph

**File:** `crates/codegen/xai-codebase-graph/src/`

High-performance code graph generation using tree-sitter queries.

### Capabilities (`lib.rs:1-42`)

- Go-to-definitions and go-to-references
- Initial repository indexing (build full index from scratch)
- Incremental reindexing (update based on file system events)
- Parallel processing (rayon)
- Memory-mapped I/O (zero-copy file reading, fast index caching)

### Architecture

| Component | File | Description |
|:----------|:-----|:------------|
| `IndexBuilder` | `manager/builder.rs` | Builds the full index from a repo path with configurable thread count |
| `IndexManager` | `index_manager.rs` | Channel-based incremental updates via `IndexManagerHandle` |
| `Navigator` | `navigation.rs` | Location-based operations (goto_definition at a specific row/col) |
| `ScopeGraph` | `scope_graph/` | Scope graph with nodes, edges, symbols, local defs/imports/scopes |
| `StringInterner` | `interner.rs` | Memory-efficient string storage |

### IndexManager Direct Queries

Exposes direct query commands that answer in-place without cloning the full index:
- `goto_definition_blocking`
- `has_definition_blocking`
- `get_file_count`

### Language Support (`languages/`)

| Language | File |
|:---------|:-----|
| Rust | `rust.rs` |
| TypeScript | `ts.rs` |
| JavaScript | `javascript.rs` |
| Python | `python.rs` |
| Go | `golang.rs` |
| Type definitions | `types.rs` |

### Index Persistence

| Function | Description |
|:---------|:------------|
| `save_index` / `load_index` | Binary serialization with memory-mapped I/O |
| `get_cache_path` | Cache path computation |
| `try_lock` / `WorkspaceLockGuard` | File locking to prevent concurrent index builds |
| `MAX_INDEXABLE_FILE_SIZE` | Size limit for indexable files |
| `is_binary_content` | Binary file detection |

## 8. Git Worktree System

**File:** `crates/codegen/xai-fast-worktree/src/`

High-performance git worktree creation using CoW (copy-on-write) cloning.

### Pipeline (`lib.rs:1-9`)

```
1. git worktree add --no-checkout  (instant metadata creation)
2. Parallel CoW file cloning with hash-based sharding
3. Optional dirty file replication and ignored file copying
4. BTRFS snapshot support on Linux for O(1) cloning
5. Worktree sync API for pre-created worktree pools
6. SQLite metadata tracking (behind `metadata` feature)
```

### Worktree Orchestration

| Component | File | Description |
|:----------|:-----|:------------|
| `WorktreePlan` | `worktree/plan.rs:13-32` | Source, dest, git_ref, parallelism, modes, cancellation_token |
| `execute_plan(plan)` | `worktree/mod.rs:34-36` | Blocking execution of the plan |
| `CreateWorktreeResult` | `worktree/mod.rs:16-31` | worktree_path, commit, copy_stats, ignored_stats, dirty_files_report |

### Creation Modes (`lib.rs:40-45`)

| Type | Variants |
|:-----|:---------|
| `CreationMode` | linked, standalone, git checkout |
| `WorkingTreeMode` | PreserveWorkingTree, CleanTracked |
| `IgnoredFilesMode` | Skip, Copy with skip_patterns |

### Copy Engine (`copy/`)

| Module | Purpose |
|:-------|:--------|
| `cow.rs` | CoW cloning |
| `engine.rs` | Copy engine |
| `gitdir.rs` | Gitdir handling |
| `shard.rs` | Hash-based sharding |
| `skip.rs` | Skip logic |
| `standalone.rs` | Standalone worktrees |
| `worker.rs` | Worker threads |

### BTRFS Support (`btrfs/`)

| Module | Purpose |
|:-------|:--------|
| `detect.rs` | BTRFS detection |
| `snapshot.rs` | O(1) snapshot creation on Linux BTRFS |

### Git Safety (`git/safety/`)

| Module | Purpose |
|:-------|:--------|
| `build_output.rs` | Build output detection |
| `reachability.rs` | Reachability checks |
| `refs.rs` | Ref safety |
| `working_tree.rs` | Working tree safety |
| `git_dir.rs` | Git_dir safety |

`reclaimable_after_snapshot` determines if a worktree can be safely reclaimed.

### Metadata DB (`db/`)

SQLite tracking of worktree records, status, and labels:
- `auto_gc.rs` — Auto-GC with configurable max age and rebuild
- `discovery.rs` — Rebuilds the DB from filesystem state

### Sync (`sync.rs`)

`WorktreeSync` with `SourceDirtyState` collection and `SyncReport` — syncs dirty files from source to worktree.

## 9. Session Persistence

### On-Disk Layout

```
~/.grok/
├── active_sessions.json          # Active session tracking
├── active_sessions.lock          # File lock
├── sandbox-events.jsonl          # Sandbox violation events
├── sandbox.toml                   # Sandbox configuration
├── config.toml                    # Global configuration
├── trusted_folders.json           # Trusted folder list
├── memory/                        # Memory system data
│   ├── MEMORY.md                  # Global knowledge
│   └── {workspace_hash}/          # Per-workspace
├── sessions/                      # Session data
│   └── {session_id}/
│       ├── conversation.jsonl     # Conversation history
│       ├── session.json           # Session metadata
│       ├── workflows/              # Workflow runs
│       └── checkpoints/           # Session checkpoints
├── worktrees/                     # Worktree metadata DB
└── hooks/                         # Global hooks
```

### SQLite Journal

**File:** `crates/codegen/xai-sqlite-journal/src/`

A SQLite-based journal for session state persistence:
- Write-ahead logging for crash safety
- Atomic state transitions
- Efficient replay on recovery

## 10. File Utilities

**File:** `crates/codegen/xai-file-utils/src/`

Shared file system utilities:
- Atomic file writes (temp + rename)
- File locking
- Path normalization
- Binary file detection

## Key Takeaways for Kraken

1. **Hybrid search** — Combine BM25 keyword search with vector KNN for best recall
2. **Temporal decay** — Session memory decays; global/workspace knowledge is evergreen
3. **MMR diversity** — Re-rank results to avoid redundancy using Jaccard similarity
4. **Graceful degradation** — Fall back to FTS-only when vector search is unavailable
5. **Tree-sitter codebase graph** — Build a scope graph for go-to-definition/references
6. **Memory-mapped I/O** — Use mmap for zero-copy index loading
7. **CoW worktrees** — Use copy-on-write cloning for fast git worktree creation
8. **SQLite for metadata** — Track worktree records, session state, and memory chunks in SQLite
9. **File system watcher** — Incremental reindexing on file changes
10. **Content hashing** — Use blake3 for chunk deduplication and integrity
