/**
 * markstream-vue initialization.
 *
 * Mermaid and KaTeX rendering require three things:
 * 1. enableMermaid() / enableKatex() — feature flags
 * 2. setMermaidWorker() / setKaTeXWorker() — inject the web workers that
 *    do the actual parsing/rendering off the main thread
 * 3. A loader function that lazy-imports the mermaid/katex packages
 */
import {
  enableMermaid,
  enableKatex,
  setMermaidWorker,
  setKaTeXWorker,
} from 'markstream-vue'

// Import workers using Vite's ?worker&inline suffix. This bundles them as data URIs
// and perfectly bypasses CSP/module issues with file:// URIs in Electron.
import MermaidWorker from 'markstream-vue/workers/mermaidParser.worker?worker&inline'
import KatexWorker from 'markstream-vue/workers/katexRenderer.worker?worker&inline'

let initialized = false

export function initMarkstream(): void {
  if (initialized) return
  initialized = true

  // Inject the workers before enabling the features.
  setMermaidWorker(new MermaidWorker())
  setKaTeXWorker(new KatexWorker())

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
