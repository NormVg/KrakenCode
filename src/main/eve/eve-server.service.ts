import { spawn } from 'node:child_process'
import { join, resolve, dirname } from 'node:path'
import { app } from 'electron'
import { existsSync, mkdirSync, symlinkSync } from 'node:fs'

export interface EveServerHandle {
  url: string
  port: number
  pid: number
  workspacePath: string
  close: () => Promise<void>
}

let activeServer: EveServerHandle | null = null

/**
 * Resolve the path to the eve CLI binary inside node_modules.
 *
 * In dev, app.getAppPath() may return the project root, out/main, or
 * the main entry file depending on the electron-vite version. We try
 * several candidates. In production, resources live under
 * process.resourcesPath.
 */
function getEveBinary(): string {
  const appPath = app.getAppPath()
  const candidates = [
    // Dev: appPath is the project root
    join(appPath, 'node_modules', 'eve', 'bin', 'eve.js'),
    // Dev: appPath is out/main (one level up to project root)
    join(resolve(appPath, '..'), 'node_modules', 'eve', 'bin', 'eve.js'),
    // Dev: appPath is out/main/index.js (dirname twice to project root)
    join(resolve(dirname(appPath), '..'), 'node_modules', 'eve', 'bin', 'eve.js'),
    // Production: extraResources places eve at resourcesPath/node_modules/eve
    join(process.resourcesPath, 'node_modules', 'eve', 'bin', 'eve.js')
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  throw new Error(`eve binary not found. Tried:\n${candidates.map((c) => `  ${c}`).join('\n')}`)
}

/**
 * Resolve the path to the agent directory.
 *
 * In dev, the agent directory is at the project root. In production,
 * it is placed at resourcesPath/agent via extraResources.
 */
function getAgentDir(): string {
  const appPath = app.getAppPath()
  const candidates = [
    // Dev: agent is at project root
    join(appPath, 'agent'),
    join(resolve(appPath, '..'), 'agent'),
    join(resolve(dirname(appPath), '..'), 'agent'),
    // Production: extraResources places agent at resourcesPath/agent
    join(process.resourcesPath, 'agent')
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  throw new Error(`agent directory not found. Tried:\n${candidates.map((c) => `  ${c}`).join('\n')}`)
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

/** PID of the currently spawning eve child process, to exclude from orphan killing. */
let spawningPid: number | null = null

/**
 * Kill any lingering eve dev server processes from a previous app session.
 *
 * When the app is force-quit or crashes, the spawned eve process survives
 * and holds port 3456. This finds and kills those orphaned processes
 * before starting a fresh server.
 *
 * Excludes the current process and any eve child we just spawned.
 */
async function killOrphanedEveServers(): Promise<void> {
  return new Promise((resolve) => {
    // Find eve dev server PIDs
    const pgrep = spawn('pgrep', ['-f', 'eve.*dev.*--no-ui'], {
      shell: false,
      stdio: ['pipe', 'pipe', 'ignore']
    })

    let pids = ''
    pgrep.stdout?.on('data', (data: Buffer) => { pids += data.toString() })

    pgrep.on('close', () => {
      const pidList = pids.trim().split('\n').filter(Boolean)
      if (pidList.length === 0) {
        resolve()
        return
      }

      // Don't kill ourselves or the eve child we just spawned
      const ownPid = process.pid
      const targets = pidList
        .map((p) => parseInt(p.trim(), 10))
        .filter((pid) => pid !== ownPid && pid !== spawningPid && !isNaN(pid))

      if (targets.length === 0) {
        resolve()
        return
      }

      console.log(`[eve] Killing ${targets.length} orphaned eve process(es): ${targets.join(', ')}`)
      for (const pid of targets) {
        try {
          process.kill(pid, 'SIGTERM')
        } catch {
          // Process may have already exited
        }
      }

      // Give them a moment to die gracefully
      setTimeout(() => {
        // Force kill any survivors
        for (const pid of targets) {
          try {
            process.kill(pid, 'SIGKILL')
          } catch {
            // Already dead
          }
        }
        resolve()
      }, 1000)
    })

    pgrep.on('error', () => resolve())
  })
}

/**
 * Mutex to prevent concurrent startEveServer calls from racing.
 * App.vue and AgentView.vue can both call startEveServer on app launch;
 * without this guard, the second call kills the process the first call
 * just spawned.
 */
let startPromise: Promise<EveServerHandle> | null = null

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
  // If a server is already running for the SAME workspace, return it.
  // If the workspace changed, close the old server and start a new one.
  if (activeServer) {
    if (activeServer.workspacePath === opts.workspacePath) {
      return activeServer
    }
    // Workspace changed — close the old server
    console.log(`[eve] Workspace changed, restarting server for: ${opts.workspacePath}`)
    await activeServer.close()
    activeServer = null
    startPromise = null
  }

  // If a start is already in progress, wait for it
  if (startPromise) {
    return startPromise
  }

  startPromise = (async () => {
    // Kill any orphaned eve processes from a *previous* app session.
    // Only do this once at the very first start — not on retries.
    await killOrphanedEveServers()

    // Try to start the server, retrying once if the port is still in use
    let lastError: Error | null = null
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const handle = await doStartEveServer(opts)
        startPromise = null
        return handle
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        const msg = lastError.message
        // Only retry on port-in-use errors
        if (msg.includes('EADDRINUSE') || msg.includes('address already in use')) {
          console.warn(`[eve] Port conflict on attempt ${attempt + 1}, retrying...`)
          await killOrphanedEveServers()
          await new Promise((r) => setTimeout(r, 500))
          continue
        }
        break
      }
    }

    startPromise = null
    throw lastError ?? new Error('Failed to start eve server')
  })()

  return startPromise
}

/**
 * Internal: spawn the eve dev server and wait for it to start listening.
 */
async function doStartEveServer(opts: {
  workspacePath: string
  modelProvider: string
  modelName: string
  apiKey?: string
}): Promise<EveServerHandle> {
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

  // In production, the agent directory is at resourcesPath/agent and
  // node_modules is at resourcesPath/node_modules. Set NODE_PATH so the
  // agent can resolve eve, ai, and ai-sdk-ollama.
  const resourcesPath = process.resourcesPath ?? ''
  if (resourcesPath && existsSync(join(resourcesPath, 'node_modules'))) {
    env.NODE_PATH = join(resourcesPath, 'node_modules')
  }

  if (opts.apiKey) {
    env.KRAKEN_API_KEY = opts.apiKey
  }

  // In production, create a node_modules symlink inside the agent directory
  // so eve's TypeScript compiler can resolve imports. createRequire in Node.js
  // does not always honor NODE_PATH, but it does walk up from the file location.
  if (resourcesPath && existsSync(join(resourcesPath, 'node_modules'))) {
    const agentNodeModules = join(agentDir, 'node_modules')
    if (!existsSync(agentNodeModules)) {
      try {
        mkdirSync(join(agentDir, 'node_modules'), { recursive: true })
        // Create symlinks for each dependency
        for (const dep of ['eve', 'ai', 'ai-sdk-ollama', 'zod']) {
          const target = join(resourcesPath, 'node_modules', dep)
          const link = join(agentDir, 'node_modules', dep)
          if (existsSync(target) && !existsSync(link)) {
            try {
              symlinkSync(target, link, 'dir')
            } catch {
              // Symlink may fail on some systems — NODE_PATH is the fallback
            }
          }
        }
      } catch {
        // Non-fatal — NODE_PATH should still work
      }
    }
  }

  const child = spawn('node', [eveBin, 'dev', '--no-ui', '--port', String(port)], {
    cwd: agentDir,
    env,
    stdio: ['pipe', 'pipe', 'pipe']
  })

  // Track the spawned PID so killOrphanedEveServers doesn't kill it
  spawningPid = child.pid ?? null

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill()
      spawningPid = null
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
        spawningPid = null
        const url = match[1]
        activeServer = {
          url,
          port,
          pid: child.pid ?? 0,
          workspacePath: opts.workspacePath,
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
            activeServer = null
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
      spawningPid = null
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
      spawningPid = null
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
