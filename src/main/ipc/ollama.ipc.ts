import { ipcMain } from 'electron'
import { IPC } from '../../shared/constants/ipc-channels'

export interface OllamaModel {
  name: string
  size: number
  parameterSize: string
  quantization: string
  family: string
}

export interface OllamaListResult {
  success: boolean
  models?: OllamaModel[]
  error?: string
}

/**
 * Fetch available models from the Ollama API.
 *
 * Calls http://127.0.0.1:11434/api/tags and normalizes the response
 * into a flat list of model metadata.
 */
async function fetchOllamaModels(): Promise<OllamaListResult> {
  try {
    const response = await fetch('http://127.0.0.1:11434/api/tags', {
      signal: AbortSignal.timeout(5000)
    })

    if (!response.ok) {
      return {
        success: false,
        error: `Ollama returned status ${response.status}`
      }
    }

    const data = await response.json()
    const models: OllamaModel[] = (data.models || []).map((m: any) => ({
      name: m.name || 'unknown',
      size: m.size || 0,
      parameterSize: m.details?.parameter_size || '',
      quantization: m.details?.quantization_level || '',
      family: m.details?.family || ''
    }))

    return { success: true, models }
  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return {
        success: false,
        error: 'Ollama is not responding. Make sure it is running.'
      }
    }
    if (err.code === 'ECONNREFUSED' || err.message?.includes('fetch failed')) {
      return {
        success: false,
        error: 'Cannot connect to Ollama. Is it running on port 11434?'
      }
    }
    return {
      success: false,
      error: err.message || 'Failed to fetch models from Ollama'
    }
  }
}

export function registerOllamaIpc(): void {
  ipcMain.handle(IPC.OLLAMA_LIST_MODELS, async (): Promise<OllamaListResult> => {
    return fetchOllamaModels()
  })
}
