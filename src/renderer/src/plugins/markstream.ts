/**
 * markstream-vue initialization.
 *
 * Mermaid and KaTeX rendering require three things:
 * 1. enableMermaid() / enableKatex() — feature flags
 * 2. setMermaidWorker() / setKaTeXWorker() — inject the web workers that
 *    do the actual parsing/rendering off the main thread
 * 3. A loader function that lazy-imports the mermaid/katex packages
 *
 * Without the workers, every render call fails with WORKER_INIT_ERROR
 * and the diagram falls through to plain code text.
 *
 * The worker files are copied to /public/workers/ because markstream-vue's
 * package.json exports map doesn't expose them for subpath imports.
 */
import {
  enableMermaid,
  enableKatex,
  setMermaidWorker,
  setKaTeXWorker,
} from 'markstream-vue'

let initialized = false

export function initMarkstream(): void {
  if (initialized) return
  initialized = true

  // Inject the workers before enabling the features.
  setMermaidWorker(new Worker('workers/mermaidParser.worker.js', { type: 'module' }))
  setKaTeXWorker(new Worker('workers/katexRenderer.worker.js', { type: 'module' }))

  // Mermaid — lazy-load the library (the worker imports it too, but the
  // main thread needs it for the final SVG render step).
  enableMermaid(async () => {
    const mermaid = await import('mermaid')
    return mermaid.default ?? mermaid
  })

  // KaTeX — lazy-load for math formula rendering.
  enableKatex(async () => {
    const katex = await import('katex')
    return katex.default ?? katex
  })
}
