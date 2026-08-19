/**
 * markstream-vue initialization.
 *
 * Mermaid and KaTeX rendering are opt-in: the package ships with
 * `enableMermaid()` / `enableKatex()` functions that must be called
 * before any diagram or formula block will render. Without these calls
 * the blocks fall through to plain code text.
 *
 * This plugin wires both loaders once at app startup so every
 * MarkdownRender instance in the app can render diagrams and math.
 */
import { enableMermaid, enableKatex } from 'markstream-vue'

let initialized = false

export function initMarkstream(): void {
  if (initialized) return
  initialized = true

  // Mermaid — lazy-load so the ~1.2 MB library only ships when needed.
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
