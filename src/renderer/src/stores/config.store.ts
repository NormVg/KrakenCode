import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ModelProvider } from '../../../shared/types'

export const useConfigStore = defineStore('config', () => {
  const provider = ref<ModelProvider>('ollama-local')
  const model = ref('gemma4:31b-cloud')
  const apiKey = ref('')
  const isSetup = ref(false)
  const setupError = ref('')

  async function loadConfig(): Promise<void> {
    try {
      const config = await window.api.config.getAll()
      if (config.provider) provider.value = config.provider as ModelProvider
      if (config.model) model.value = config.model
      if (config.apiKey) apiKey.value = config.apiKey
    } catch (e) {
      console.error('[config] Failed to load config:', e)
    }
  }

  async function initializeAgent(): Promise<boolean> {
    setupError.value = ''
    try {
      const result = await window.api.agent.setModel({
        provider: provider.value,
        model: model.value,
        apiKey: apiKey.value
      })

      if (result.success) {
        isSetup.value = true
        // Persist config
        await window.api.config.set('provider', provider.value)
        await window.api.config.set('model', model.value)
        await window.api.config.set('apiKey', apiKey.value)
        return true
      } else {
        setupError.value = result.error || 'Failed to setup model'
        return false
      }
    } catch (err: any) {
      setupError.value = err.message || 'Unknown error'
      return false
    }
  }

  return {
    provider,
    model,
    apiKey,
    isSetup,
    setupError,
    loadConfig,
    initializeAgent
  }
})
