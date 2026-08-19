import { createOllama } from 'ai-sdk-ollama'
import { streamText } from 'ai'
import type { ModelConfig, ModelConfigResult } from '../../shared/types'

let aiModel: ReturnType<ReturnType<typeof createOllama>> | null = null

export const agentService = {
  /**
   * Configure the AI model based on provider config.
   */
  setModel(config: ModelConfig): ModelConfigResult {
    try {
      if (config.provider === 'ollama-local') {
        const ollama = createOllama({ baseURL: 'http://127.0.0.1:11434' })
        aiModel = ollama(config.model || 'gemma4:31b-cloud')
        return { success: true }
      }

      if (config.provider === 'ollama-cloud') {
        const apiKey = config.apiKey || process.env.OLLAMA_API_KEY
        const ollama = createOllama({
          baseURL: 'https://ollama.com',
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined
        })
        aiModel = ollama(config.model || 'gemma4:31b-cloud')
        return { success: true }
      }

      return { success: false, error: 'Provider not supported yet' }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  },

  /**
   * Check if a model has been configured.
   */
  isConfigured(): boolean {
    return aiModel !== null
  },

  /**
   * Stream a chat completion. Returns an async generator of text chunks.
   * Throws if no model is configured.
   */
  async *streamChat(message: string, system?: string): AsyncGenerator<string> {
    if (!aiModel) {
      throw new Error('Model not configured. Please select a model first.')
    }

    const { textStream } = streamText({
      model: aiModel,
      ...(system?.trim() ? { system: system.trim() } : {}),
      prompt: message
    })

    for await (const chunk of textStream) {
      yield chunk
    }
  }
}
