export const TerminalService = {
  async create(id: string, cols: number, rows: number, cwd?: string): Promise<{ success: boolean, pid?: number }> {
    return await window.api.pty.create(id, cols, rows, cwd)
  },

  write(id: string, data: string): void {
    window.api.pty.write(id, data)
  },

  resize(id: string, cols: number, rows: number): void {
    window.api.pty.resize(id, cols, rows)
  },

  kill(id: string): void {
    window.api.pty.kill(id)
  },

  onData(id: string, cb: (data: string) => void): void {
    window.api.pty.onData(id, cb)
  },

  onExit(id: string, cb: (code: number) => void): void {
    window.api.pty.onExit(id, cb)
  },

  removeListeners(id: string): void {
    window.api.pty.removeListeners(id)
  }
}
