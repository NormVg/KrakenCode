# Grok-Build Documentation

> Deep analysis of the grok-build codebase — a production-grade Rust coding agent by xAI.
> Source: `.info2ai/grok-build/`

## Overview

Grok-Build is a terminal-based AI coding agent built in Rust. It is not a thin wrapper around an LLM API — it is a complete agent runtime with kernel-enforced sandboxing, a deterministic workflow engine, a hybrid memory system, tree-sitter codebase indexing, git worktree pooling for parallel work, and a sophisticated terminal UI (pager).

## Documentation Index

| Doc | Category | Description |
|:----|:---------|:------------|
| [01-models.md](01-models.md) | Models | Model configuration, sampling types, conversation representation, context window management |
| [02-tools.md](02-tools.md) | Tools | Tool definitions, execution pipeline, permission gating, tool registry |
| [03-skills.md](03-skills.md) | Skills | Slash commands, hooks/plugins system, extensible agent capabilities |
| [04-sessions.md](04-sessions.md) | Sessions | Session lifecycle, prompt queueing, crash recovery, foreign session import |
| [05-sandboxes.md](05-sandboxes.md) | Sandboxes | Kernel-enforced sandboxing (Landlock/Seatbelt), permission system, secret redaction |
| [06-storage.md](06-storage.md) | Storage | Memory system (BM25 + vector), codebase graph, session persistence, worktree metadata |
| [07-loops.md](07-loops.md) | Loops | Workflow engine (Rhai-scripted), hooks system, multi-step task coordination |
| [08-ui.md](08-ui.md) | UI | Terminal pager, markdown rendering, Mermaid diagrams, scrollback blocks |
| [09-architecture.md](09-architecture.md) | Architecture | Crate structure, design patterns, key takeaways for Kraken |
| [10-folder-structure-recommendation.md](10-folder-structure-recommendation.md) | Folder Structure | Recommended project structure for Kraken based on grok-build patterns |
| [11-workspace-architecture.md](11-workspace-architecture.md) | Workspace | Per-workspace isolation: editor, terminal, agents, views, scratchpad |
| [12-system-prompts.md](12-system-prompts.md) | System Prompts | Base prompt, subagent prompt, apply-patch prompt, orchestrator body, goal-system prompts, template rendering |
| [13-code-editing-workflow.md](13-code-editing-workflow.md) | Code Editing | How grok-build reads, searches, edits, and creates code — dedicated tools vs raw bash, the editing loop, hashline workflow |

## Key Design Principles

1. **Defense-in-depth security** — Kernel sandbox + permission system + secret redaction
2. **Deterministic workflows** — Rhai-scripted pipelines with journal-based replay
3. **Graceful degradation** — Every subsystem degrades rather than crashes under resource pressure
4. **Fail-closed defaults** — Permissions default to deny (CWE-1188), sandbox profiles are immutable
5. **Zero-copy performance** — Memory-mapped I/O, shallow refs, CSS containment, v-memo
6. **Offline-first** — Pure-Rust Mermaid rendering, bundled fonts, no remote resolvers

## Crate Count

The codebase contains 60+ crates organized under `crates/codegen/`, each with a single responsibility.
