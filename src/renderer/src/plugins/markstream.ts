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

import { createMermaidWorkerFromCDN } from 'markstream-vue/workers/mermaidCdnWorker'
import { createKaTeXWorkerFromCDN } from 'markstream-vue/workers/katexCdnWorker'

let initialized = false

export function initMarkstream(): void {
  if (initialized) return
  initialized = true

  // Use CDN workers because local Web Workers in Electron + Vite suffer from 
  // severe file:// CORS restrictions and code-splitting dynamic import failures.
  // Using classic mode + CDN bypasses all module/CORS issues entirely.
  const mermaid = createMermaidWorkerFromCDN({
    mermaidUrl: 'https://cdn.jsdelivr.net/npm/mermaid@11.4.0/dist/mermaid.min.js',
    mode: 'classic'
  })
  if (mermaid.worker) setMermaidWorker(mermaid.worker)

  const katex = createKaTeXWorkerFromCDN({
    katexUrl: 'https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.js',
    mode: 'classic'
  })
  if (katex.worker) setKaTeXWorker(katex.worker)

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
