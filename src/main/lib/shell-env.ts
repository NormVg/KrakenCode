import * as os from 'os'
import { execSync } from 'child_process'

let resolvedShellEnv: Record<string, string> | null = null

/**
 * On macOS/Linux, packaged Electron apps launch without a login shell, so they
 * get a bare-bones PATH. This function asks the user's own shell for its real
 * environment by running it as a login shell and capturing `env` output.
 *
 * Same approach as VS Code's "resolveShellEnv" internally.
 * Works universally — any machine, any shell, any user configuration.
 */
export function resolveShellEnv(shell: string): Record<string, string> {
  if (resolvedShellEnv) return resolvedShellEnv

  try {
    const raw = execSync(`${shell} -lc env`, {
      encoding: 'utf8',
      timeout: 5000,
      env: { HOME: os.homedir(), USER: os.userInfo().username, SHELL: shell }
    })

    const env: Record<string, string> = { ...process.env } as Record<string, string>

    for (const line of raw.split('\n')) {
      const idx = line.indexOf('=')
      if (idx > 0) {
        const key = line.slice(0, idx)
        const value = line.slice(idx + 1)
        env[key] = value
      }
    }

    resolvedShellEnv = env
    return env
  } catch (err) {
    console.warn('[pty] Shell env resolution failed, using process.env as fallback:', err)
    resolvedShellEnv = process.env as Record<string, string>
    return resolvedShellEnv
  }
}
