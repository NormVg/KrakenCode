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
        window.api.removeChatListeners(id)
      }
    }, timeoutMs)

    window.api.onChatChunk(id, (chunk: string) => {
      if (isFinished) return
      onChunk(chunk)
    })

    window.api.onChatEnd(id, () => {
      if (isFinished) return
      isFinished = true
      clearTimeout(streamTimeout)
      onEnd()
      window.api.removeChatListeners(id)
    })

    window.api.onChatError(id, (err: string) => {
      if (isFinished) return
      isFinished = true
      clearTimeout(streamTimeout)
      onError(err)
      window.api.removeChatListeners(id)
    })

    window.api.streamChat(id, message, { system })

    return {
      cleanup: () => {
        isFinished = true
        clearTimeout(streamTimeout)
        window.api.removeChatListeners(id)
      }
    }
  }
}
