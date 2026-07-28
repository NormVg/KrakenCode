# Kraken Project Notes

## Overview
Kraken is a Modern Coding Agent interface built with Electron, Vue 3, Vite, and Vercel AI SDK (Ollama Provider).

## Long-Term Tasklist
- [x] Initial setup and Eve integration
- [x] Modern UI Overhaul (Dark mode, syntax highlighting, sidebar)
- [x] Implement Git auto-commit workflow
- [x] Architecture view: replace Vue Flow with Mermaid (text-first, agent-editable)
- [x] Wire agent to read project architecture + apply `architecture-mermaid` updates
- [x] Graph toolbar: Preview/Code + zoom/pan on #0A0D18 canvas chrome
- [ ] Architecture builder mode (structured nodes → Mermaid source) — see proposal below
- [ ] Setup persistence for chat history
- [ ] Full multi-turn chat history in model context (currently single-turn prompt)

## Proposal: User diagram builder (without forcing Mermaid fluency)

**Goal:** Let users *compose* architecture themselves while keeping Mermaid as the
single source of truth (agent-editable, versionable, no Vue Flow canvas debt).

**Recommended approach — “Structured builder → Mermaid” (not freeform nodes):**

1. **Source of truth stays Mermaid text** (`Project.architecture`).
2. **Builder mode** (third mode next to Preview / Code) edits a small typed model:
   - nodes: `{ id, kind: service|db|queue|external|client, label, tech? }`
   - edges: `{ from, to, label? }`
   - optional groups/subgraphs
3. **Compile** model → Mermaid flowchart (deterministic).
4. **Parse** Mermaid → model when possible (best-effort for our subset); fall back
   to Code mode if the source is freeform Mermaid the parser can’t round-trip.
5. **UI:** palette of kinds + “add node / connect A→B” forms — no drag-handle
   graph engine. Layout is Mermaid’s job in Preview.
6. **Agent path unchanged:** agent still writes `architecture-mermaid` fences;
   builder reloads from source.

**Why this over Vue Flow again:** agent + git + diff stay text; UI stays simple;
users get guided authoring without reintroducing a second graph system.

**Ship order if approved:** (1) model + compile, (2) Builder UI, (3) soft parse.

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
  - Agent receives architecture in system prompt; can overwrite via ` ```architecture-mermaid ` fences
  - Slash command `/Architecture` seeds an architecture update prompt
