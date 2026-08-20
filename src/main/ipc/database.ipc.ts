import { ipcMain } from 'electron'
import { IPC } from '../../shared/constants/ipc-channels'
import {
  workspaceRepo,
  sessionRepo,
  messageRepo,
  openFileRepo,
  terminalRepo,
  configRepo
} from '../database/repos'
import type {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  CreateSessionInput,
  UpdateSessionInput,
  CreateMessageInput,
  UpdateMessageInput,
  UpsertOpenFileInput,
  UpdateOpenFileInput,
  CreateTerminalInput
} from '../../shared/types'

export function registerDatabaseIpc(): void {
  // ─── Workspaces ────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.WORKSPACE_GET_ALL, () => {
    return workspaceRepo.getAll()
  })

  ipcMain.handle(IPC.WORKSPACE_GET_BY_ID, (_, id: string) => {
    return workspaceRepo.getById(id)
  })

  ipcMain.handle(IPC.WORKSPACE_CREATE, (_, data: CreateWorkspaceInput) => {
    const now = Date.now()
    return workspaceRepo.create({
      id: data.id,
      name: data.name,
      path: data.path,
      createdAt: now,
      lastOpenedAt: now
    })
  })

  ipcMain.handle(IPC.WORKSPACE_UPDATE, (_, id: string, data: UpdateWorkspaceInput) => {
    // Convert booleans to integers for SQLite
    const dbData: Record<string, unknown> = {}
    if (data.name !== undefined) dbData.name = data.name
    if (data.architecture !== undefined) dbData.architecture = data.architecture
    if (data.activeView !== undefined) dbData.activeView = data.activeView
    if (data.activeSessionId !== undefined) dbData.activeSessionId = data.activeSessionId
    if (data.leftSidebarOpen !== undefined) dbData.leftSidebarOpen = data.leftSidebarOpen ? 1 : 0
    if (data.rightSidebarOpen !== undefined) dbData.rightSidebarOpen = data.rightSidebarOpen ? 1 : 0
    if (data.rightSidebarWidth !== undefined) dbData.rightSidebarWidth = data.rightSidebarWidth
    if (data.scratchpadContent !== undefined) dbData.scratchpadContent = data.scratchpadContent
    workspaceRepo.update(id, dbData)
    return workspaceRepo.getById(id)
  })

  ipcMain.handle(IPC.WORKSPACE_DELETE, (_, id: string) => {
    workspaceRepo.delete(id)
    return true
  })

  ipcMain.handle(IPC.WORKSPACE_TOUCH, (_, id: string) => {
    workspaceRepo.touch(id)
    return true
  })

  // ─── Sessions ──────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.SESSION_GET_ALL, () => {
    return sessionRepo.getAll()
  })

  ipcMain.handle(IPC.SESSION_GET_BY_WORKSPACE, (_, workspaceId: string) => {
    return sessionRepo.getByWorkspace(workspaceId)
  })

  ipcMain.handle(IPC.SESSION_CREATE, (_, data: CreateSessionInput) => {
    const now = Date.now()
    return sessionRepo.create({
      id: data.id,
      workspaceId: data.workspaceId,
      title: data.title,
      createdAt: now,
      updatedAt: now
    })
  })

  ipcMain.handle(IPC.SESSION_UPDATE, (_, id: string, data: UpdateSessionInput) => {
    const dbData: Record<string, unknown> = {}
    if (data.title !== undefined) dbData.title = data.title
    dbData.updatedAt = Date.now()
    sessionRepo.update(id, dbData)
    return sessionRepo.getById(id)
  })

  ipcMain.handle(IPC.SESSION_DELETE, (_, id: string) => {
    sessionRepo.delete(id)
    return true
  })

  // ─── Messages ───────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.MESSAGE_GET_BY_SESSION, (_, sessionId: string) => {
    return messageRepo.getBySession(sessionId)
  })

  ipcMain.handle(IPC.MESSAGE_CREATE, (_, data: CreateMessageInput) => {
    return messageRepo.create({
      id: data.id,
      sessionId: data.sessionId,
      role: data.role,
      content: data.content,
      isStreaming: data.isStreaming,
      createdAt: Date.now()
    })
  })

  ipcMain.handle(IPC.MESSAGE_UPDATE, (_, id: string, data: UpdateMessageInput) => {
    const dbData: Record<string, unknown> = {}
    if (data.content !== undefined) dbData.content = data.content
    if (data.isStreaming !== undefined) dbData.isStreaming = data.isStreaming ? 1 : 0
    messageRepo.update(id, dbData)
    return true
  })

  ipcMain.handle(IPC.MESSAGE_APPEND_CONTENT, (_, id: string, chunk: string) => {
    messageRepo.appendContent(id, chunk)
    return true
  })

  ipcMain.handle(IPC.MESSAGE_DELETE, (_, id: string) => {
    messageRepo.delete(id)
    return true
  })

  // ─── Open Files ─────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.OPEN_FILE_GET_BY_WORKSPACE, (_, workspaceId: string) => {
    return openFileRepo.getByWorkspace(workspaceId)
  })

  ipcMain.handle(IPC.OPEN_FILE_UPSERT, (_, data: UpsertOpenFileInput) => {
    return openFileRepo.upsert({
      id: data.id,
      workspaceId: data.workspaceId,
      path: data.path,
      name: data.name,
      language: data.language,
      content: data.content,
      isModified: data.isModified,
      isActive: data.isActive,
      openedAt: Date.now()
    })
  })

  ipcMain.handle(IPC.OPEN_FILE_UPDATE, (_, id: string, data: UpdateOpenFileInput) => {
    const dbData: Record<string, unknown> = {}
    if (data.name !== undefined) dbData.name = data.name
    if (data.language !== undefined) dbData.language = data.language
    if (data.content !== undefined) dbData.content = data.content
    if (data.isModified !== undefined) dbData.isModified = data.isModified ? 1 : 0
    if (data.isActive !== undefined) dbData.isActive = data.isActive ? 1 : 0
    openFileRepo.update(id, dbData)
    return true
  })

  ipcMain.handle(IPC.OPEN_FILE_SET_ACTIVE, (_, workspaceId: string, fileId: string) => {
    openFileRepo.setActive(workspaceId, fileId)
    return true
  })

  ipcMain.handle(IPC.OPEN_FILE_DELETE, (_, id: string) => {
    openFileRepo.delete(id)
    return true
  })

  // ─── Terminal Sessions ──────────────────────────────────────────────────────

  ipcMain.handle(IPC.TERMINAL_GET_BY_WORKSPACE, (_, workspaceId: string) => {
    return terminalRepo.getByWorkspace(workspaceId)
  })

  ipcMain.handle(IPC.TERMINAL_CREATE, (_, data: CreateTerminalInput) => {
    return terminalRepo.create({
      id: data.id,
      workspaceId: data.workspaceId,
      ptyId: data.ptyId,
      cwd: data.cwd,
      isActive: data.isActive,
      createdAt: Date.now()
    })
  })

  ipcMain.handle(IPC.TERMINAL_DELETE, (_, id: string) => {
    terminalRepo.delete(id)
    return true
  })

  // ─── App Config ─────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.CONFIG_GET, (_, key: string) => {
    return configRepo.get(key)
  })

  ipcMain.handle(IPC.CONFIG_SET, (_, key: string, value: string) => {
    configRepo.set(key, value)
    return true
  })

  ipcMain.handle(IPC.CONFIG_GET_ALL, () => {
    return configRepo.getAll()
  })
}
