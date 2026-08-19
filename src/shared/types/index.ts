/**
 * Shared type definitions — used by both the main process and renderer.
 *
 * These mirror the Drizzle schema types but are plain interfaces so they can
 * be imported in the renderer without pulling in database dependencies.
 */

// ─── View Types ──────────────────────────────────────────────────────────────

export type ViewType = 'agent' | 'editor' | 'web' | 'diff' | 'graph' | 'terminal'

// ─── Workspace ───────────────────────────────────────────────────────────────

export interface Workspace {
  id: string
  name: string
  path: string
  architecture: string | null
  activeView: ViewType
  activeSessionId: string | null
  leftSidebarOpen: boolean
  rightSidebarOpen: boolean
  rightSidebarWidth: number
  scratchpadContent: string | null
  createdAt: number
  lastOpenedAt: number
}

export interface CreateWorkspaceInput {
  id: string
  name: string
  path: string
}

export interface UpdateWorkspaceInput {
  name?: string
  architecture?: string | null
  activeView?: ViewType
  activeSessionId?: string | null
  leftSidebarOpen?: boolean
  rightSidebarOpen?: boolean
  rightSidebarWidth?: number
  scratchpadContent?: string | null
}

// ─── Session ─────────────────────────────────────────────────────────────────

export interface Session {
  id: string
  workspaceId: string
  title: string
  createdAt: number
  updatedAt: number
}

export interface CreateSessionInput {
  id: string
  workspaceId: string
  title?: string
}

export interface UpdateSessionInput {
  title?: string
}

// ─── Message ─────────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'agent'

export interface Message {
  id: string
  sessionId: string
  role: MessageRole
  content: string
  isStreaming: boolean
  createdAt: number
}

export interface CreateMessageInput {
  id: string
  sessionId: string
  role: MessageRole
  content?: string
  isStreaming?: boolean
}

export interface UpdateMessageInput {
  content?: string
  isStreaming?: boolean
}

// ─── Open File ───────────────────────────────────────────────────────────────

export interface OpenFile {
  id: string
  workspaceId: string
  path: string
  name: string
  language: string
  content: string
  isModified: boolean
  isActive: boolean
  openedAt: number
}

export interface UpsertOpenFileInput {
  id: string
  workspaceId: string
  path: string
  name: string
  language?: string
  content?: string
  isModified?: boolean
  isActive?: boolean
}

export interface UpdateOpenFileInput {
  name?: string
  language?: string
  content?: string
  isModified?: boolean
  isActive?: boolean
}

// ─── Terminal Session ────────────────────────────────────────────────────────

export interface TerminalSession {
  id: string
  workspaceId: string
  ptyId: string
  cwd: string | null
  isActive: boolean
  createdAt: number
}

export interface CreateTerminalInput {
  id: string
  workspaceId: string
  ptyId: string
  cwd?: string
  isActive?: boolean
}

// ─── App Config ──────────────────────────────────────────────────────────────

export interface AppConfigEntry {
  key: string
  value: string
}

// ─── Agent / Model ──────────────────────────────────────────────────────────

export type ModelProvider = 'ollama-local' | 'ollama-cloud'

export interface ModelConfig {
  provider: ModelProvider
  model: string
  apiKey?: string
}

export interface ModelConfigResult {
  success: boolean
  error?: string
}

// ─── IPC Response ───────────────────────────────────────────────────────────

export interface IpcResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}
