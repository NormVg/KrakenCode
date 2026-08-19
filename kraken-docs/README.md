# Kraken Codebase Documentation

> Internal documentation for the Kraken coding agent interface — Electron + Vue 3 + TypeScript + Pinia + Vite.

## What Kraken Is

Kraken is a desktop coding agent interface built with Electron, Vue 3, and Vite. It lets users open project folders, chat with an AI agent, edit code, run terminals, view diffs, and render architecture diagrams — all in one window.

## Documentation Index

| Doc | Description |
|:----|:------------|
| [01-architecture.md](01-architecture.md) | Process model, layer separation, data flow, current problems |
| [02-main-process.md](02-main-process.md) | IPC handlers, AI streaming, PTY management, filesystem ops, JSON store |
| [03-preload-bridge.md](03-preload-bridge.md) | contextBridge API surface, IPC channel map |
| [04-stores.md](04-stores.md) | Pinia stores: projects, chat, editor, config |
| [05-services.md](05-services.md) | Renderer services: chat, filesystem, persistence, terminal |
| [06-types.md](06-types.md) | Data model: Project, ChatSession, ChatMessage, OpenFile, ViewType |
| [07-components.md](07-components.md) | Component tree: views, sidebar, chat, editor, terminal, architecture |
| [08-known-issues.md](08-known-issues.md) | Active bugs: mermaid rendering, devtools, agent stuck, IPC clone errors |
| [09-workspace-plan.md](09-workspace-plan.md) | Future workspace-isolated architecture with SQLite |

## Tech Stack

| Layer | Technology |
|:------|:-----------|
| Shell | Electron 35 |
| Build | electron-vite |
| Framework | Vue 3 (Composition API, `<script setup>`) |
| State | Pinia |
| Editor | Monaco Editor (via `@guolao/vue-monaco-editor`) |
| Terminal | Ghostty Web (`ghostty-web`) + `node-pty` |
| AI | Vercel AI SDK (`ai`) + `ai-sdk-ollama` |
| Markdown | `markstream-vue` + `stream-markdown` |
| Diagrams | `mermaid` |
| Rich Text | TipTap (`@tiptap/*`) |
| Icons | `lucide-vue-next` |
| Validation | Zod |
| Diff | `diff` |
| Syntax | Shiki |

## File Count

```
src/main/         1 file   (404 lines — monolith)
src/preload/      2 files  (85 + 1 lines)
src/renderer/    44 files  (~5,200 lines total)
```
