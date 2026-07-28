/**
 * Architecture ↔ Agent bridge.
 *
 * The Graph view stores plain Mermaid. The agent receives that source as context
 * and can replace it by emitting a fenced `architecture-mermaid` block.
 */

export const ARCHITECTURE_FENCE = 'architecture-mermaid'

const FENCE_RE = /```architecture-mermaid\s*\n([\s\S]*?)```/i

export function buildArchitectureSystemPrompt(opts: {
  projectName?: string | null
  projectPath?: string | null
  architecture?: string | null
}): string {
  const name = opts.projectName?.trim() || 'Untitled workspace'
  const path = opts.projectPath?.trim()
  const source = opts.architecture?.trim()

  const lines: string[] = [
    'You are Kraken, a local-first AI coding agent inside a desktop IDE.',
    `Active project: ${name}${path ? ` (${path})` : ''}.`,
    '',
    '## Architecture diagram',
    'This workspace has a Graph view powered by Mermaid (not a node canvas).',
    'The diagram source is plain Mermaid text, versioned with the project.',
    '',
    'When the user asks you to design, update, or document system architecture:',
    `- Emit a single fenced block using language tag \`${ARCHITECTURE_FENCE}\` with the FULL replacement Mermaid source.`,
    '- Prefer flowchart TB / LR, sequenceDiagram, erDiagram, or C4 when appropriate.',
    '- Do not use Vue Flow, JSON node graphs, or proprietary canvas formats.',
    '- Keep diagrams readable: short labels, clear subgraphs, real protocol labels on edges when useful.',
    `- Only emit an \`${ARCHITECTURE_FENCE}\` block when you intend to change the saved diagram.`,
    '',
  ]

  if (source) {
    lines.push(
      'Current architecture Mermaid source:',
      '```mermaid',
      source,
      '```',
      '',
    )
  } else {
    lines.push(
      'No architecture diagram is saved yet for this project. You may create the first one when asked.',
      '',
    )
  }

  return lines.join('\n')
}

export interface ArchitectureUpdateResult {
  /** Full agent message with architecture fence replaced by a short confirmation */
  displayContent: string
  /** Extracted Mermaid source, if the agent emitted an update */
  mermaidSource: string | null
  didUpdate: boolean
}

/**
 * Parse agent output for an architecture update fence.
 * Returns cleaned display text + optional new Mermaid source.
 */
export function extractArchitectureUpdate(agentContent: string): ArchitectureUpdateResult {
  const match = agentContent.match(FENCE_RE)
  if (!match) {
    return {
      displayContent: agentContent,
      mermaidSource: null,
      didUpdate: false,
    }
  }

  const mermaidSource = match[1].trim()
  if (!mermaidSource) {
    return {
      displayContent: agentContent,
      mermaidSource: null,
      didUpdate: false,
    }
  }

  const confirmation =
    '\n\n---\n**Architecture updated** — open the Graph view to see the live Mermaid preview.\n'

  const displayContent = agentContent.replace(FENCE_RE, confirmation).trim()

  return {
    displayContent,
    mermaidSource: mermaidSource.endsWith('\n') ? mermaidSource : `${mermaidSource}\n`,
    didUpdate: true,
  }
}

/** Build the user-facing context blurb (optional appendix on the user turn). */
export function buildArchitectureUserAppendix(architecture?: string | null): string {
  const source = architecture?.trim()
  if (!source) return ''
  return [
    '',
    '<architecture-context>',
    'Current project architecture (Mermaid):',
    '```mermaid',
    source,
    '```',
    '</architecture-context>',
  ].join('\n')
}
