import { defineAgent } from 'eve'
import { createOllama } from 'ai-sdk-ollama'

// Model is configured at runtime via environment variables.
// The Electron main process sets these before booting the eve server.
const provider = process.env.KRAKEN_MODEL_PROVIDER || 'ollama-local'
const modelName = process.env.KRAKEN_MODEL_NAME || 'gemma4:31b-cloud'

function getModel() {
  if (provider === 'ollama-cloud') {
    const apiKey = process.env.KRAKEN_API_KEY || process.env.OLLAMA_API_KEY
    const ollama = createOllama({
      baseURL: 'https://ollama.com',
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined
    })
    return ollama(modelName)
  }

  // Default: ollama-local
  const ollama = createOllama({ baseURL: 'http://127.0.0.1:11434' })
  return ollama(modelName)
}

export default defineAgent({
  model: getModel(),
  // Ollama models don't carry AI Gateway context window metadata.
  // Set this explicitly so eve's compaction system works.
  modelContextWindowTokens: 128_000,
  // Framework tools (read_file, write_file, grep, glob, bash) are included
  // by default. Our custom tools in agent/tools/ override them with
  // workspace-confined versions.
  //
  // The sandbox is omitted — eve auto-provides a default. For local dev
  // without Docker, it falls back to just-bash. Our custom tools bypass
  // the sandbox and access the real filesystem directly via workspace.ts.
})
