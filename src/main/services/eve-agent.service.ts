import { Client, type ClientSession, type HandleMessageStreamEvent } from 'eve/client'

/**
 * Normalized event emitted by the eve agent service.
 *
 * The main-process service consumes the raw eve stream and projects it
 * into these simpler events so the IPC layer can forward them to the
 * renderer without exposing the full eve type surface.
 */
export type AgentStreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'reasoning'; delta: string }
  | { type: 'tool-start'; toolName: string; toolCallId: string; input?: string }
  | { type: 'tool-end'; toolName: string; toolCallId: string; status: 'completed' | 'failed' | 'rejected'; output?: string }
  | { type: 'step-start' }
  | { type: 'turn-complete' }
  | { type: 'error'; message: string }

/**
 * Main-process wrapper around the eve Client + ClientSession.
 *
 * The eve client uses Node.js # subpath imports that Vite cannot resolve
 * in the browser renderer, so it must run here in the main process. The
 * IPC layer bridges the projected events to the renderer.
 *
 * The service holds one persistent session. Each `send` call passes its
 * own `onEvent` callback so the IPC layer can route events to the
 * correct renderer window.
 */
export class EveAgentService {
  private client: Client | null = null
  private session: ClientSession | null = null
  private abortController: AbortController | null = null

  /** Connect to the eve server at the given host. */
  connect(host: string): void {
    this.client = new Client({ host, preserveCompletedSessions: true })
    this.session = this.client.session()
  }

  /** Whether the service is connected and ready to send. */
  get isConnected(): boolean {
    return this.client !== null && this.session !== null
  }

  /**
   * Send a message to the agent and stream back events.
   *
   * The `onEvent` callback receives normalized events for the lifetime
   * of this one turn. It is not retained after the turn completes.
   */
  async send(message: string, onEvent: (event: AgentStreamEvent) => void): Promise<void> {
    if (!this.session) {
      onEvent({ type: 'error', message: 'Not connected to eve server' })
      return
    }

    this.abortController = new AbortController()

    try {
      const response = await this.session.send({
        message,
        signal: this.abortController.signal
      })

      for await (const event of response) {
        if (this.abortController?.signal.aborted) break
        this.processEvent(event, onEvent)
      }

      onEvent({ type: 'turn-complete' })
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        onEvent({ type: 'turn-complete' })
        return
      }
      const msg = err instanceof Error ? err.message : 'Unknown error'
      onEvent({ type: 'error', message: msg })
    } finally {
      this.abortController = null
    }
  }

  /** Cancel the current turn. */
  async cancel(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort()
    }
    if (this.session) {
      try {
        await this.session.cancel()
      } catch {
        // Ignore cancel errors — the turn may already be finished
      }
    }
  }

  /** Reset the session (start fresh conversation). */
  async reset(): Promise<void> {
    if (this.session) {
      try {
        await this.session.reset()
      } catch {
        // Ignore reset errors
      }
    }
  }

  /**
   * Process one raw eve stream event and emit a normalized event.
   *
   * Only events the renderer needs are projected; others (message.completed,
   * reasoning.completed, subagent events) are skipped to keep the IPC
   * channel lean.
   */
  private processEvent(
    event: HandleMessageStreamEvent,
    onEvent: (event: AgentStreamEvent) => void
  ): void {
    switch (event.type) {
      case 'step.started':
        onEvent({ type: 'step-start' })
        break

      case 'message.appended':
        onEvent({ type: 'text', delta: event.data.messageDelta })
        break

      case 'reasoning.appended':
        onEvent({ type: 'reasoning', delta: event.data.reasoningDelta })
        break

      case 'actions.requested':
        for (const action of event.data.actions) {
          // Only tool-call actions have a toolName; subagent and load-skill
          // actions use different fields and are not tool calls.
          if (action.kind === 'tool-call') {
            onEvent({
              type: 'tool-start',
              toolName: action.toolName,
              toolCallId: action.callId,
              input: JSON.stringify(action.input, null, 2)
            })
          }
        }
        break

      case 'action.result': {
        // Only tool-result actions carry a toolName.
        if (event.data.result.kind === 'tool-result') {
          const output =
            typeof event.data.result.output === 'string'
              ? event.data.result.output
              : JSON.stringify(event.data.result.output, null, 2)

          onEvent({
            type: 'tool-end',
            toolName: event.data.result.toolName,
            toolCallId: event.data.result.callId,
            status: event.data.status,
            output
          })
        }
        break
      }

      case 'turn.completed':
      case 'turn.cancelled':
        onEvent({ type: 'turn-complete' })
        break

      case 'turn.failed':
      case 'session.failed':
        onEvent({ type: 'error', message: 'Agent turn failed' })
        break

      default:
        // Other events are not needed by the renderer.
        break
    }
  }
}
