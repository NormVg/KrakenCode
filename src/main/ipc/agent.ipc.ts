import { ipcMain, dialog } from 'electron'
import { IPC } from '../../shared/constants/ipc-channels'
import { agentService } from '../services/agent.service'
import type { ModelConfig } from '../../shared/types'

export function registerAgentIpc(): void {
  ipcMain.handle(IPC.AGENT_SET_MODEL, (_, config: ModelConfig) => {
    return agentService.setModel(config)
  })

  ipcMain.on(IPC.AGENT_STREAM_CHAT, async (event, payload) => {
    const { id, message, system } = payload as {
      id: string
      message: string
      system?: string
    }

    try {
      if (!agentService.isConfigured()) {
        event.sender.send(IPC.AGENT_CHAT_ERROR(id), 'Model not configured. Please select a model first.')
        return
      }

      for await (const chunk of agentService.streamChat(message, system)) {
        event.sender.send(IPC.AGENT_CHAT_CHUNK(id), chunk)
      }
      event.sender.send(IPC.AGENT_CHAT_END(id))
    } catch (err: any) {
      event.sender.send(IPC.AGENT_CHAT_ERROR(id), err.message)
    }
  })

  ipcMain.handle(IPC.DIALOG_OPEN_DIRECTORY, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })
    if (canceled || filePaths.length === 0) return null
    const path = filePaths[0]
    const name = path.replace(/\\/g, '/').split('/').pop() || 'Unnamed Project'
    return { path, name }
  })
}
