# Kraken Project Notes

## Overview
Kraken is a Modern Coding Agent interface built with Electron, Vue 3, Vite, and Vercel AI SDK (Ollama Provider).

## Long-Term Tasklist
- [x] Initial setup and Eve integration
- [x] Modern UI Overhaul (Dark mode, syntax highlighting, sidebar)
- [x] Implement Git auto-commit workflow
- [ ] Setup persistence for chat history

## Current Status
- Modern UI overhaul is complete.
- Eve integration foundation is set up.
- Project now enforces auto-commit and strict tracking via `project.md` and `AGENTS.md`.
- TypeScript typecheck passes cleanly (`pnpm run typecheck`).
- Dev server runs via `pnpm run dev` (Electron + Vite on port 5173/5174).
