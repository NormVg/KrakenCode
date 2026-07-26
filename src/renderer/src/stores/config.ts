import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useConfigStore = defineStore('config', () => {
  const provider = ref('ollama-local')
  const model = ref('gemma4:31b-cloud')
  const apiKey = ref('')
  
  const isSetup = ref(false)
  const setupError = ref('')

  const initializeAgent = async () => {
    setupError.value = ''
    try {
      const result = await window.api.setModel({
        provider: provider.value,
        model: model.value,
        apiKey: apiKey.value
      })
      
      if (result.success) {
        isSetup.value = true
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
    initializeAgent
  }
})
