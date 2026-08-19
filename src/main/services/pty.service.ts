import * as os from 'os'
import * as pty from 'node-pty'
import { resolveShellEnv } from '../lib/shell-env'

const ptyProcesses = new Map<string, pty.IPty>()

interface CreatePtyOptions {
  id: string
  cols: number
  rows: number
  cwd?: string
}

interface PtyCallbacks {
  onData: (data: string) => void
  onExit: (exitCode: number) => void
}

export const ptyService = {
  /**
   * Spawn a shell and start forwarding output.
   * Returns the process PID.
   */
  create(opts: CreatePtyOptions, callbacks: PtyCallbacks): { success: boolean; pid?: number } {
    const shell = process.env.SHELL || (process.platform === 'win32' ? 'powershell.exe' : '/bin/zsh')
    const workingDir = opts.cwd && opts.cwd.length > 0 ? opts.cwd : os.homedir()
    const shellEnv = resolveShellEnv(shell)

    const ptyProcess = pty.spawn(shell, ['-l'], {
      name: 'xterm-256color',
      cols: opts.cols || 80,
      rows: opts.rows || 24,
      cwd: workingDir,
      env: {
        ...shellEnv,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor'
      }
    })

    ptyProcesses.set(opts.id, ptyProcess)

    ptyProcess.onData((data) => callbacks.onData(data))
    ptyProcess.onExit(({ exitCode }) => {
      callbacks.onExit(exitCode)
      ptyProcesses.delete(opts.id)
    })

    return { success: true, pid: ptyProcess.pid }
  },

  write(id: string, data: string): void {
    const p = ptyProcesses.get(id)
    if (p) p.write(data)
  },

  resize(id: string, cols: number, rows: number): void {
    const p = ptyProcesses.get(id)
    if (p) p.resize(cols, rows)
  },

  kill(id: string): void {
    const p = ptyProcesses.get(id)
    if (p) {
      p.kill()
      ptyProcesses.delete(id)
    }
  },

  killAll(): void {
    for (const [id, p] of ptyProcesses) {
      try {
        p.kill()
      } catch {
        // already dead
      }
      ptyProcesses.delete(id)
    }
  }
}
