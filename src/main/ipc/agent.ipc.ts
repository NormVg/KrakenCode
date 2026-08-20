import { ipcMain, dialog } from 'electron'
import { IPC } from '../../shared/constants/ipc-channels'
import { EveAgentService, type AgentStreamEvent } from '../services/eve-agent.service'
import { getActiveEveServer } from '../eve/eve-server.service'
import type { ModelConfig, ModelConfigResult } from '../../shared/types'

/**
 * Active eve agent service — one per running eve server.
 *
 * Created when the eve dev server starts and the client connects to it.
 * Lives for the lifetime of the server.
 */
let activeAgent: EveAgentService | null = null

/**
 * Connect the eve agent client to the running eve server.
 *
 * Called after the eve dev server starts. If a previous agent exists,
 * it is cancelled first.
 */
export function connectEveAgent(host: string): EveAgentService {
  if (activeAgent) {
    activeAgent.cancel().catch(() => {})
  }

  activeAgent = new EveAgentService()
  activeAgent.connect(host)
  return activeAgent
}

/** Get the active eve agent service, if any. */
export function getActiveEveAgent(): EveAgentService | null {
  return activeAgent
}

/** Disconnect the active eve agent. */
export function disconnectEveAgent(): void {
  if (activeAgent) {
    activeAgent.cancel().catch(() => {})
    activeAgent = null
  }
}

export function registerAgentIpc(): void {
  ipcMain.handle(IPC.AGENT_SET_MODEL, (_, config: ModelConfig): ModelConfigResult => {
    // Model configuration is now handled by the eve server via env vars.
    // This handler validates that the config is well-formed for the
    // renderer's setup flow.
    if (!config.model || config.model.trim() === '') {
      return { success: false, error: 'Model name is required' }
    }
    return { success: true }
  })

  ipcMain.on(IPC.AGENT_STREAM_CHAT, async (event, payload) => {
    const { id, message } = payload as {
      id: string
      message: string
      system?: string
    }

    const server = getActiveEveServer()
    if (!server) {
      event.sender.send(
        IPC.AGENT_CHAT_ERROR(id),
        'Agent server is not running. Open a workspace to start it.'
      )
      return
    }

    // Connect the agent if not yet connected to this server
    if (!activeAgent || !activeAgent.isConnected) {
      connectEveAgent(server.url)
    }

    try {
      await activeAgent!.send(message, (ev) => forwardEvent(event.sender, id, ev))
    } catch (err: any) {
      event.sender.send(IPC.AGENT_CHAT_ERROR(id), err.message)
    }
  })

  ipcMain.handle(IPC.AGENT_CANCEL_CHAT, async () => {
    if (activeAgent) {
      await activeAgent.cancel()
    }
    return { success: true }
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

/**
 * Forward an agent stream event to the renderer.
 *
 * Text deltas go to the chunk channel; tool events go to the tool
 * channel; turn-complete signals end; errors go to the error channel.
 */
function forwardEvent(
  sender: Electron.WebContents,
  chatId: string,
  event: AgentStreamEvent
): void {
  switch (event.type) {
    case 'text':
      sender.send(IPC.AGENT_CHAT_CHUNK(chatId), event.delta)
      break

    case 'tool-start':
      sender.send(IPC.AGENT_CHAT_TOOL(chatId), {
        phase: 'start',
        toolName: event.toolName,
        toolCallId: event.toolCallId
      })
      break

    case 'tool-end':
      sender.send(IPC.AGENT_CHAT_TOOL(chatId), {
        phase: 'end',
        toolName: event.toolName,
        toolCallId: event.toolCallId,
        status: event.status
      })
      break

    case 'turn-complete':
      sender.send(IPC.AGENT_CHAT_END(chatId))
      break

    case 'error':
      sender.send(IPC.AGENT_CHAT_ERROR(chatId), event.message)
      break

    default:
      // reasoning, step-start — not forwarded to the renderer yet.
      break
  }
}
