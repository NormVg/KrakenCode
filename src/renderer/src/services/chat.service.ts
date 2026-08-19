import type { ModelConfig, ModelConfigResult } from '../../../shared/types'

export interface StreamChatOptions {
  id: string
  message: string
  system?: string
  onChunk: (chunk: string) => void
  onEnd: () => void
  onError: (err: string) => void
  timeoutMs?: number
}

export const ChatService = {
  streamMessage(opts: StreamChatOptions) {
    const { id, message, system, onChunk, onEnd, onError, timeoutMs = 120_000 } = opts

    let isFinished = false

    // Safety net watchdog
    const streamTimeout = setTimeout(() => {
      if (!isFinished) {
        isFinished = true
        onError('Stream timed out — the model may be unresponsive.')
        window.api.agent.removeChatListeners(id)
      }
    }, timeoutMs)

    window.api.agent.onChatChunk(id, (chunk: string) => {
      if (isFinished) return
      onChunk(chunk)
    })

    window.api.agent.onChatEnd(id, () => {
      if (isFinished) return
      isFinished = true
      clearTimeout(streamTimeout)
      onEnd()
      window.api.agent.removeChatListeners(id)
    })

    window.api.agent.onChatError(id, (err: string) => {
      if (isFinished) return
      isFinished = true
      clearTimeout(streamTimeout)
      onError(err)
      window.api.agent.removeChatListeners(id)
    })

    window.api.agent.streamChat(id, message, { system })

    return {
      cleanup: () => {
        isFinished = true
        clearTimeout(streamTimeout)
        window.api.agent.removeChatListeners(id)
      }
    }
  },

  async setModel(config: ModelConfig): Promise<ModelConfigResult> {
    return await window.api.agent.setModel(config)
  }
}
