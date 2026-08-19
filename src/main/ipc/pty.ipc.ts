import { ipcMain } from 'electron'
import { IPC } from '../../shared/constants/ipc-channels'
import { ptyService } from '../services/pty.service'

export function registerPtyIpc(): void {
  ipcMain.handle(
    IPC.PTY_CREATE,
    (event, { id, cols, rows, cwd }: { id: string; cols: number; rows: number; cwd?: string }) => {
      return ptyService.create(
        { id, cols, rows, cwd },
        {
          onData: (data) => event.sender.send(IPC.PTY_DATA(id), data),
          onExit: (exitCode) => event.sender.send(IPC.PTY_EXIT(id), exitCode)
        }
      )
    }
  )

  ipcMain.on(IPC.PTY_WRITE, (_, { id, data }: { id: string; data: string }) => {
    ptyService.write(id, data)
  })

  ipcMain.on(IPC.PTY_RESIZE, (_, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
    ptyService.resize(id, cols, rows)
  })

  ipcMain.on(IPC.PTY_KILL, (_, { id }: { id: string }) => {
    ptyService.kill(id)
  })
}
