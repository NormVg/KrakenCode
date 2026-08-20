import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC } from '../shared/constants/ipc-channels'
import type {
  Workspace,
  Session,
  Message,
  OpenFile,
  TerminalSession,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  CreateSessionInput,
  UpdateSessionInput,
  CreateMessageInput,
  UpdateMessageInput,
  UpsertOpenFileInput,
  UpdateOpenFileInput,
  CreateTerminalInput,
  ModelConfig,
  ModelConfigResult
} from '../shared/types'

const api = {
  // ─── Agent / Chat ────────────────────────────────────────────────────────────
  agent: {
    setModel: (config: ModelConfig): Promise<ModelConfigResult> =>
      ipcRenderer.invoke(IPC.AGENT_SET_MODEL, config),

    streamChat: (id: string, message: string, options?: { system?: string }): void => {
      ipcRenderer.send(IPC.AGENT_STREAM_CHAT, { id, message, system: options?.system })
    },

    cancelChat: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC.AGENT_CANCEL_CHAT),

    onChatChunk: (id: string, callback: (chunk: string) => void): void => {
      ipcRenderer.on(IPC.AGENT_CHAT_CHUNK(id), (_, chunk) => callback(chunk))
    },

    onChatTool: (
      id: string,
      callback: (event: {
        phase: 'start' | 'end'
        toolName: string
        toolCallId: string
        status?: 'completed' | 'failed' | 'rejected'
      }) => void
    ): void => {
      ipcRenderer.on(IPC.AGENT_CHAT_TOOL(id), (_, event) => callback(event))
    },

    onChatEnd: (id: string, callback: () => void): void => {
      ipcRenderer.once(IPC.AGENT_CHAT_END(id), () => callback())
    },

    onChatError: (id: string, callback: (err: string) => void): void => {
      ipcRenderer.once(IPC.AGENT_CHAT_ERROR(id), (_, err) => callback(err))
    },

    removeChatListeners: (id: string): void => {
      ipcRenderer.removeAllListeners(IPC.AGENT_CHAT_CHUNK(id))
      ipcRenderer.removeAllListeners(IPC.AGENT_CHAT_TOOL(id))
      ipcRenderer.removeAllListeners(IPC.AGENT_CHAT_END(id))
      ipcRenderer.removeAllListeners(IPC.AGENT_CHAT_ERROR(id))
    }
  },

  // ─── Workspace ───────────────────────────────────────────────────────────────
  workspace: {
    getAll: (): Promise<Workspace[]> =>
      ipcRenderer.invoke(IPC.WORKSPACE_GET_ALL),

    getById: (id: string): Promise<Workspace | undefined> =>
      ipcRenderer.invoke(IPC.WORKSPACE_GET_BY_ID, id),

    create: (data: CreateWorkspaceInput): Promise<Workspace> =>
      ipcRenderer.invoke(IPC.WORKSPACE_CREATE, data),

    update: (id: string, data: UpdateWorkspaceInput): Promise<Workspace | undefined> =>
      ipcRenderer.invoke(IPC.WORKSPACE_UPDATE, id, data),

    delete: (id: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.WORKSPACE_DELETE, id),

    touch: (id: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.WORKSPACE_TOUCH, id)
  },

  // ─── Session ─────────────────────────────────────────────────────────────────
  session: {
    getByWorkspace: (workspaceId: string): Promise<Session[]> =>
      ipcRenderer.invoke(IPC.SESSION_GET_BY_WORKSPACE, workspaceId),

    create: (data: CreateSessionInput): Promise<Session> =>
      ipcRenderer.invoke(IPC.SESSION_CREATE, data),

    update: (id: string, data: UpdateSessionInput): Promise<Session | undefined> =>
      ipcRenderer.invoke(IPC.SESSION_UPDATE, id, data),

    delete: (id: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.SESSION_DELETE, id)
  },

  // ─── Message ─────────────────────────────────────────────────────────────────
  message: {
    getBySession: (sessionId: string): Promise<Message[]> =>
      ipcRenderer.invoke(IPC.MESSAGE_GET_BY_SESSION, sessionId),

    create: (data: CreateMessageInput): Promise<Message> =>
      ipcRenderer.invoke(IPC.MESSAGE_CREATE, data),

    update: (id: string, data: UpdateMessageInput): Promise<boolean> =>
      ipcRenderer.invoke(IPC.MESSAGE_UPDATE, id, data),

    appendContent: (id: string, chunk: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.MESSAGE_APPEND_CONTENT, id, chunk),

    delete: (id: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.MESSAGE_DELETE, id)
  },

  // ─── Open Files ─────────────────────────────────────────────────────────────
  openFile: {
    getByWorkspace: (workspaceId: string): Promise<OpenFile[]> =>
      ipcRenderer.invoke(IPC.OPEN_FILE_GET_BY_WORKSPACE, workspaceId),

    upsert: (data: UpsertOpenFileInput): Promise<OpenFile> =>
      ipcRenderer.invoke(IPC.OPEN_FILE_UPSERT, data),

    update: (id: string, data: UpdateOpenFileInput): Promise<boolean> =>
      ipcRenderer.invoke(IPC.OPEN_FILE_UPDATE, id, data),

    setActive: (workspaceId: string, fileId: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.OPEN_FILE_SET_ACTIVE, workspaceId, fileId),

    delete: (id: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.OPEN_FILE_DELETE, id)
  },

  // ─── Terminal Sessions ───────────────────────────────────────────────────────
  terminal: {
    getByWorkspace: (workspaceId: string): Promise<TerminalSession[]> =>
      ipcRenderer.invoke(IPC.TERMINAL_GET_BY_WORKSPACE, workspaceId),

    create: (data: CreateTerminalInput): Promise<TerminalSession> =>
      ipcRenderer.invoke(IPC.TERMINAL_CREATE, data),

    delete: (id: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.TERMINAL_DELETE, id)
  },

  // ─── App Config ──────────────────────────────────────────────────────────────
  config: {
    get: (key: string): Promise<string | undefined> =>
      ipcRenderer.invoke(IPC.CONFIG_GET, key),

    set: (key: string, value: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.CONFIG_SET, key, value),

    getAll: (): Promise<Record<string, string>> =>
      ipcRenderer.invoke(IPC.CONFIG_GET_ALL)
  },

  // ─── Ollama ──────────────────────────────────────────────────────────────────
  ollama: {
    listModels: (): Promise<{
      success: boolean
      models?: Array<{
        name: string
        size: number
        parameterSize: string
        quantization: string
        family: string
      }>
      error?: string
    }> => ipcRenderer.invoke(IPC.OLLAMA_LIST_MODELS)
  },

  // ─── Filesystem ──────────────────────────────────────────────────────────────
  fs: {
    readDirectory: (dirPath: string) =>
      ipcRenderer.invoke(IPC.FS_READ_DIRECTORY, dirPath),
    readFile: (filePath: string) =>
      ipcRenderer.invoke(IPC.FS_READ_FILE, filePath),
    writeFile: (filePath: string, content: string) =>
      ipcRenderer.invoke(IPC.FS_WRITE_FILE, filePath, content),
    createItem: (itemPath: string, type: 'file' | 'folder') =>
      ipcRenderer.invoke(IPC.FS_CREATE_ITEM, itemPath, type),
    deleteItem: (itemPath: string) =>
      ipcRenderer.invoke(IPC.FS_DELETE_ITEM, itemPath),
    renameItem: (oldPath: string, newPath: string) =>
      ipcRenderer.invoke(IPC.FS_RENAME_ITEM, oldPath, newPath),
    moveItem: (source: string, dest: string) =>
      ipcRenderer.invoke(IPC.FS_MOVE_ITEM, source, dest),
    copyItem: (source: string, dest: string) =>
      ipcRenderer.invoke(IPC.FS_COPY_ITEM, source, dest)
  },

  // ─── PTY ─────────────────────────────────────────────────────────────────────
  pty: {
    create: (id: string, cols: number, rows: number, cwd?: string) =>
      ipcRenderer.invoke(IPC.PTY_CREATE, { id, cols, rows, cwd }),
    write: (id: string, data: string) =>
      ipcRenderer.send(IPC.PTY_WRITE, { id, data }),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.send(IPC.PTY_RESIZE, { id, cols, rows }),
    kill: (id: string) =>
      ipcRenderer.send(IPC.PTY_KILL, { id }),
    onData: (id: string, callback: (data: string) => void) =>
      ipcRenderer.on(IPC.PTY_DATA(id), (_, data) => callback(data)),
    onExit: (id: string, callback: (exitCode: number) => void) =>
      ipcRenderer.once(IPC.PTY_EXIT(id), (_, exitCode) => callback(exitCode)),
    removeListeners: (id: string) => {
      ipcRenderer.removeAllListeners(IPC.PTY_DATA(id))
      ipcRenderer.removeAllListeners(IPC.PTY_EXIT(id))
    }
  },

  // ─── Dialog ──────────────────────────────────────────────────────────────────
  dialog: {
    openDirectory: (): Promise<{ path: string; name: string } | null> =>
      ipcRenderer.invoke(IPC.DIALOG_OPEN_DIRECTORY)
  },

  // ─── Window ───────────────────────────────────────────────────────────────────
  window: {
    minimize: (): void => ipcRenderer.send(IPC.WINDOW_MINIMIZE),
    maximize: (): void => ipcRenderer.send(IPC.WINDOW_MAXIMIZE),
    close: (): void => ipcRenderer.send(IPC.WINDOW_CLOSE)
  },

  // ─── Eve Agent Server ───────────────────────────────────────────
  eve: {
    start: (opts: {
      workspacePath: string
      modelProvider: string
      modelName: string
      apiKey?: string
    }): Promise<{ success: boolean; url?: string; port?: number; error?: string }> =>
      ipcRenderer.invoke(IPC.EVE_START, opts),

    stop: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.EVE_STOP),

    getStatus: (): Promise<{ running: boolean; url: string | null; port: number | null }> =>
      ipcRenderer.invoke(IPC.EVE_GET_STATUS)
  }
}

export type KrakenApi = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
