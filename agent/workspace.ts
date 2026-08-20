/**
 * Host sandbox backend — gives the agent direct access to the real
 * workspace filesystem.
 *
 * Unlike just-bash (virtual FS, no real binaries) or Docker (containerized),
 * this backend runs tools directly on the host with the workspace folder
 * as the working directory.
 *
 * This is safe for a local-first desktop app where the user explicitly
 * opens a project folder. The workspace path is set via the
 * KRAKEN_WORKSPACE_PATH environment variable.
 */

import { readFile, writeFile, mkdir, readdir, stat, rm, rename, copyFile } from 'node:fs/promises'
import { join, resolve, relative, isAbsolute } from 'node:path'
import { spawn } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'

const WORKSPACE_PATH = process.env.KRAKEN_WORKSPACE_PATH || process.cwd()

/**
 * Resolve a path relative to the workspace root.
 * Rejects paths that escape the workspace.
 */
function resolveWorkspacePath(path: string): string {
  const resolved = isAbsolute(path) ? path : join(WORKSPACE_PATH, path)
  const rel = relative(WORKSPACE_PATH, resolved)
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`Path "${path}" escapes the workspace boundary`)
  }
  return resolved
}

/**
 * Read a file from the workspace.
 * Returns content with line-number anchors every 10 lines.
 */
export async function readWorkspaceFile(path: string, offset = 1, limit = 2000): Promise<string> {
  const fullPath = resolveWorkspacePath(path)
  const content = await readFile(fullPath, 'utf-8')
  const lines = content.split('\n')
  const start = Math.max(0, offset - 1)
  const end = Math.min(lines.length, start + limit)
  const slice = lines.slice(start, end)

  const out: string[] = []
  for (let i = 0; i < slice.length; i++) {
    const lineNum = start + i + 1
    if (lineNum % 10 === 1 || i === 0) {
      out.push(`${lineNum}→${slice[i]}`)
    } else {
      out.push(slice[i])
    }
  }
  return out.join('\n')
}

/**
 * Write a file to the workspace (create or overwrite).
 */
export async function writeWorkspaceFile(path: string, content: string): Promise<void> {
  const fullPath = resolveWorkspacePath(path)
  await mkdir(join(fullPath, '..'), { recursive: true })
  await writeFile(fullPath, content, 'utf-8')
}

/**
 * List files and directories in a workspace path.
 */
export async function listWorkspaceDir(path = '.'): Promise<Array<{ name: string; type: 'file' | 'folder' }>> {
  const fullPath = resolveWorkspacePath(path)
  const entries = await readdir(fullPath, { withFileTypes: true })
  const items = entries
    .filter((e) => !e.name.startsWith('.'))
    .map((e) => ({
      name: e.name,
      type: e.isDirectory() ? ('folder' as const) : ('file' as const)
    }))
  items.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name)
    return a.type === 'folder' ? -1 : 1
  })
  return items
}

/**
 * Search file contents with regex (using ripgrep if available, grep fallback).
 */
export async function grepWorkspace(
  pattern: string,
  path = '.',
  glob?: string,
  contextLines = 0
): Promise<string> {
  const fullPath = resolveWorkspacePath(path)
  const args = ['-rn', '--color=never']
  if (glob) args.push('--glob', glob)
  if (contextLines > 0) args.push('-C', String(contextLines))
  args.push(pattern, fullPath)

  return new Promise((resolve, reject) => {
    const child = spawn('rg', args, { cwd: WORKSPACE_PATH })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (data) => { stdout += data.toString() })
    child.stderr.on('data', (data) => { stderr += data.toString() })
    child.on('close', (code) => {
      if (code === 0 || code === 1) {
        resolve(stdout.slice(0, 20000) || 'No matches found')
      } else {
        // Fallback to grep if rg is not available
        const grepArgs = ['-rn']
        if (glob) grepArgs.push('--include', glob)
        if (contextLines > 0) grepArgs.push('-C', String(contextLines))
        grepArgs.push(pattern, fullPath)
        const grepChild = spawn('grep', grepArgs, { cwd: WORKSPACE_PATH })
        let grepStdout = ''
        let grepStderr = ''
        grepChild.stdout.on('data', (data) => { grepStdout += data.toString() })
        grepChild.stderr.on('data', (data) => { grepStderr += data.toString() })
        grepChild.on('close', (grepCode) => {
          if (grepCode === 0 || grepCode === 1) {
            resolve(grepStdout.slice(0, 20000) || 'No matches found')
          } else {
            reject(new Error(`grep failed: ${grepStderr || 'unknown error'}`))
          }
        })
      }
    })
  })
}

/**
 * Persistent shell session for the workspace.
 *
 * Keeps a single shell process alive across multiple command executions
 * so that state (cwd, env vars, aliases, functions) persists between
 * tool calls. Uses a unique sentinel marker to detect command completion
 * and capture the exit code.
 */
class PersistentShell {
  private shell: ReturnType<typeof spawn> | null = null
  private cwd: string

  constructor(cwd: string) {
    this.cwd = cwd
  }

  private ensureShell(): ReturnType<typeof spawn> {
    if (this.shell && !this.shell.killed) return this.shell

    this.shell = spawn('bash', ['--noprofile', '--norc'], {
      cwd: this.cwd,
      env: { ...process.env, TERM: 'dumb', PS1: '' },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    // Start in the workspace directory
    this.shell.stdin?.write(`cd "${this.cwd}"\n`)

    return this.shell
  }

  async run(command: string, timeoutMs = 30000): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const shell = this.ensureShell()
    const sentinel = `__KRAKEN_END_${Date.now()}_${Math.random().toString(36).slice(2)}__`

    return new Promise((resolve) => {
      let stdout = ''
      let stderr = ''
      let resolved = false

      const cleanup = () => {
        shell.stdout?.removeListener('data', onStdout)
        shell.stderr?.removeListener('data', onStderr)
        clearTimeout(timer)
      }

      const finish = (exitCode: number) => {
        if (resolved) return
        resolved = true
        cleanup()

        // Strip the sentinel line from stdout
        const sentinelRegex = new RegExp(`${sentinel}:(\\d+)\\s*$`)
        const match = stdout.match(sentinelRegex)
        if (match) {
          exitCode = parseInt(match[1], 10)
          stdout = stdout.replace(sentinelRegex, '').trimEnd()
        }

        if (stdout.length > 20000) {
          const head = stdout.slice(0, 10000)
          const tail = stdout.slice(-10000)
          stdout = head + '\n... [truncated] ...\n' + tail
        }

        resolve({ stdout, stderr, exitCode })
      }

      const onStdout = (data: Buffer) => { stdout += data.toString() }
      const onStderr = (data: Buffer) => { stderr += data.toString() }

      shell.stdout?.on('data', onStdout)
      shell.stderr?.on('data', onStderr)

      const timer = setTimeout(() => {
        // On timeout, send Ctrl-C to interrupt the running command
        shell.stdin?.write('\x03')
        finish(124)
      }, timeoutMs)

      // Watch for the sentinel in stdout to detect completion
      const sentinelWatcher = setInterval(() => {
        if (stdout.includes(sentinel)) {
          clearInterval(sentinelWatcher)
          finish(0)
        }
      }, 10)

      // Write the command followed by the sentinel
      shell.stdin?.write(`${command}\n`)
      shell.stdin?.write(`echo "${sentinel}:$?"\n`)
    })
  }

  /** Kill the shell process. */
  destroy(): void {
    if (this.shell) {
      this.shell.kill('SIGTERM')
      this.shell = null
    }
  }
}

const persistentShell = new PersistentShell(WORKSPACE_PATH)

/**
 * Run a shell command in the workspace directory using a persistent
 * shell session. State (cwd, env vars, aliases) persists between calls.
 */
export function runWorkspaceCommand(
  command: string,
  timeoutMs = 30000
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return persistentShell.run(command, timeoutMs)
}

export { WORKSPACE_PATH, resolveWorkspacePath }
