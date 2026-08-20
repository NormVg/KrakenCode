import { ipcMain } from 'electron'
import { IPC } from '../../shared/constants/ipc-channels'
import { startEveServer, closeEveServer, getActiveEveServer } from '../eve/eve-server.service'

export interface EveStartOptions {
  workspacePath: string
  modelProvider: string
  modelName: string
  apiKey?: string
}

export interface EveStatus {
  running: boolean
  url: string | null
  port: number | null
}

export function registerEveIpc(): void {
  ipcMain.handle(IPC.EVE_START, async (_, opts: EveStartOptions) => {
    try {
      const handle = await startEveServer(opts)
      return {
        success: true,
        url: handle.url,
        port: handle.port
      }
    } catch (err: any) {
      console.error('[eve:ipc] Failed to start eve server:', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle(IPC.EVE_STOP, async () => {
    try {
      await closeEveServer()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle(IPC.EVE_GET_STATUS, async () => {
    const server = getActiveEveServer()
    return {
      running: server !== null,
      url: server?.url ?? null,
      port: server?.port ?? null
    } satisfies EveStatus
  })
}
