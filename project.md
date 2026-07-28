# Kraken Project Notes

## Overview
Kraken is a Modern Coding Agent interface built with Electron, Vue 3, Vite, and Vercel AI SDK (Ollama Provider).

## Long-Term Tasklist
- [x] Initial setup and Eve integration
- [x] Modern UI Overhaul (Dark mode, syntax highlighting, sidebar)
- [x] Implement Git auto-commit workflow
- [x] Architecture view: replace Vue Flow with Mermaid (text-first, agent-editable)
- [ ] Setup persistence for chat history
- [ ] Wire agent tools to read/write project architecture Mermaid source

## Current Status
- Modern UI overhaul is complete.
- Eve integration foundation is set up.
- Project now enforces auto-commit and strict tracking via `project.md` and `AGENTS.md`.
- TypeScript typecheck passes cleanly (`pnpm run typecheck`).
- Dev server runs via `pnpm run dev` (Electron + Vite on port 5173/5174).
- **Architecture / Graph view** is Mermaid-based:
  - Monaco source editor + live Mermaid preview
  - Per-project persistence via `Project.architecture`
  - Templates: System flowchart, Sequence, C4 Context, ER
  - Vue Flow / elkjs removed from dependencies
