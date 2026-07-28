import { ref, computed, watch, type Ref } from 'vue'
import { DEFAULT_ARCH_DIAGRAM } from '../templates'

// ─── useArchDiagram ───────────────────────────────────────────────────────────
// Text-first architecture state. Source of truth is Mermaid markdown.
// Designed so the agent can read/write `source` as plain text.
// ─────────────────────────────────────────────────────────────────────────────

export function useArchDiagram(externalSource?: Ref<string>) {
  const source = externalSource ?? ref(DEFAULT_ARCH_DIAGRAM)
  const error = ref<string | null>(null)
  const isRendering = ref(false)
  const lastRenderedAt = ref<number | null>(null)

  const lineCount = computed(() => source.value.split('\n').length)
  const isEmpty = computed(() => source.value.trim().length === 0)

  function setSource(next: string) {
    source.value = next
  }

  function resetToDefault() {
    source.value = DEFAULT_ARCH_DIAGRAM
    error.value = null
  }

  function applyTemplate(templateSource: string) {
    source.value = templateSource
    error.value = null
  }

  // Agent / external mutation surface
  function agentSetDiagram(mermaidSource: string) {
    source.value = mermaidSource.trim() + (mermaidSource.endsWith('\n') ? '' : '\n')
  }

  function agentAppend(fragment: string) {
    const base = source.value.trimEnd()
    source.value = `${base}\n${fragment.trim()}\n`
  }

  function toAgentContext(): string {
    return [
      '## Architecture Diagram (Mermaid)',
      'The user maintains a live Mermaid architecture diagram.',
      'Edit by replacing or appending Mermaid syntax — never invent Vue Flow nodes.',
      '```mermaid',
      source.value.trim(),
      '```',
    ].join('\n')
  }

  return {
    source,
    error,
    isRendering,
    lastRenderedAt,
    lineCount,
    isEmpty,
    setSource,
    resetToDefault,
    applyTemplate,
    agentSetDiagram,
    agentAppend,
    toAgentContext,
  }
}

/** Debounce helper for live preview */
export function useDebouncedValue<T>(value: Ref<T>, delayMs = 280) {
  const debounced = ref(value.value) as Ref<T>
  let timer: ReturnType<typeof setTimeout> | null = null

  watch(
    value,
    (next) => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        debounced.value = next
      }, delayMs)
    },
    { immediate: true },
  )

  return debounced
}
