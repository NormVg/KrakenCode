import { spawn } from 'node:child_process'
import { join, resolve } from 'node:path'
import { app } from 'electron'
import { existsSync } from 'node:fs'

export interface EveServerHandle {
  url: string
  port: number
  pid: number
  close: () => Promise<void>
}

let activeServer: EveServerHandle | null = null

/**
 * Resolve the path to the eve CLI binary inside node_modules.
 */
function getEveBinary(): string {
  const krakenRoot = resolve(app.getAppPath(), '..')
  // In dev, the app path is the electron-vite output dir.
  // In production, it's inside the .app bundle.
  const devPath = join(krakenRoot, 'node_modules', 'eve', 'bin', 'eve.js')
  const prodPath = join(process.resourcesPath, 'node_modules', 'eve', 'bin', 'eve.js')

  if (existsSync(devPath)) return devPath
  if (existsSync(prodPath)) return prodPath
  throw new Error('eve binary not found. Expected at node_modules/eve/bin/eve.js')
}

/**
 * Resolve the path to the agent directory.
 */
function getAgentDir(): string {
  const krakenRoot = resolve(app.getAppPath(), '..')
  const devPath = join(krakenRoot, 'agent')
  const prodPath = join(process.resourcesPath, 'agent')

  if (existsSync(devPath)) return devPath
  if (existsSync(prodPath)) return prodPath
  throw new Error('agent directory not found')
}

/**
 * Find an available port starting from the given port.
 */
async function findAvailablePort(startPort: number): Promise<number> {
  const net = await import('node:net')
  return new Promise((resolvePort, rejectPort) => {
    const server = net.createServer()
    server.listen(startPort, '127.0.0.1', () => {
      const { port } = server.address() as { port: number }
      server.close(() => resolvePort(port))
    })
    server.on('error', () => {
      // Port in use, try next
      if (startPort < 65535) {
        resolvePort(findAvailablePort(startPort + 1))
      } else {
        rejectPort(new Error('No available ports'))
      }
    })
  })
}

/**
 * Start the eve development server for a given workspace.
 *
 * Spawns `eve dev --no-ui --port <port>` as a child process with
 * environment variables set for the workspace path and model config.
 *
 * Returns once the server prints its listening URL.
 */
export async function startEveServer(opts: {
  workspacePath: string
  modelProvider: string
  modelName: string
  apiKey?: string
}): Promise<EveServerHandle> {
  // If a server is already running, close it first
  if (activeServer) {
    await activeServer.close()
    activeServer = null
  }

  const port = await findAvailablePort(3456)
  const eveBin = getEveBinary()
  const agentDir = getAgentDir()

  const env: Record<string, string | undefined> = {
    ...process.env,
    KRAKEN_WORKSPACE_PATH: opts.workspacePath,
    KRAKEN_MODEL_PROVIDER: opts.modelProvider,
    KRAKEN_MODEL_NAME: opts.modelName,
    EVE_DEV: '1'
  }

  if (opts.apiKey) {
    env.KRAKEN_API_KEY = opts.apiKey
  }

  const child = spawn('node', [eveBin, 'dev', '--no-ui', '--port', String(port)], {
    cwd: agentDir,
    env,
    stdio: ['pipe', 'pipe', 'pipe']
  })

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill()
      reject(new Error('eve dev server failed to start within 30 seconds'))
    }, 30000)

    let stdoutBuffer = ''
    let stderrBuffer = ''

    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString()
      stdoutBuffer += text
      console.log('[eve:stdout]', text.trim())

      // Look for the listening URL
      const match = stdoutBuffer.match(/listening at (https?:\/\/[^\s/]+)/)
      if (match && !activeServer) {
        clearTimeout(timeout)
        const url = match[1]
        activeServer = {
          url,
          port,
          pid: child.pid ?? 0,
          close: async () => {
            child.kill('SIGTERM')
            // Give it 3 seconds to shut down gracefully
            await new Promise<void>((r) => {
              const killTimeout = setTimeout(() => {
                child.kill('SIGKILL')
                r()
              }, 3000)
              child.on('exit', () => {
                clearTimeout(killTimeout)
                r()
              })
            })
            if (activeServer === activeServer) activeServer = null
          }
        }
        resolve(activeServer)
      }
    })

    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString()
      stderrBuffer += text
      console.error('[eve:stderr]', text.trim())
    })

    child.on('exit', (code) => {
      clearTimeout(timeout)
      if (!activeServer) {
        reject(
          new Error(
            `eve dev server exited with code ${code} before listening.\nstdout: ${stdoutBuffer}\nstderr: ${stderrBuffer}`
          )
        )
      }
    })

    child.on('error', (err) => {
      clearTimeout(timeout)
      reject(new Error(`Failed to spawn eve dev server: ${err.message}`))
    })
  })
}

/**
 * Get the currently running eve server, if any.
 */
export function getActiveEveServer(): EveServerHandle | null {
  return activeServer
}

/**
 * Close the active eve server, if one is running.
 */
export async function closeEveServer(): Promise<void> {
  if (activeServer) {
    await activeServer.close()
    activeServer = null
  }
}
