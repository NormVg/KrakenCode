import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

// ─── Workspaces ───────────────────────────────────────────────────────────────
// A workspace is a project folder the user opens. It is the root isolation
// boundary: each workspace has its own sessions, editor state, terminal state,
// and view state.
// ─────────────────────────────────────────────────────────────────────────────

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  path: text('path').notNull().unique(),
  architecture: text('architecture'),

  // Per-workspace view state
  activeView: text('active_view').notNull().default('agent'),
  activeSessionId: text('active_session_id'),

  // Per-workspace sidebar state
  leftSidebarOpen: integer('left_sidebar_open').notNull().default(1),
  rightSidebarOpen: integer('right_sidebar_open').notNull().default(1),
  rightSidebarWidth: integer('right_sidebar_width').notNull().default(300),

  // Per-workspace scratchpad content
  scratchpadContent: text('scratchpad_content').default(''),

  createdAt: integer('created_at').notNull(),
  lastOpenedAt: integer('last_opened_at').notNull()
})

// ─── Sessions (chats inside a workspace) ────────────────────────────────────

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default('New Chat'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})

// ─── Messages (inside sessions) ──────────────────────────────────────────────

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'agent'] }).notNull(),
  content: text('content').notNull().default(''),
  isStreaming: integer('is_streaming').notNull().default(0),
  createdAt: integer('created_at').notNull()
})

// ─── Open Files (per-workspace editor state) ─────────────────────────────────
// Tracks which files are open in the editor for each workspace, their content
// (unsaved changes), and which file is active.

export const openFiles = sqliteTable('open_files', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  path: text('path').notNull(),
  name: text('name').notNull(),
  language: text('language').notNull().default('plaintext'),
  content: text('content').notNull().default(''),
  isModified: integer('is_modified').notNull().default(0),
  isActive: integer('is_active').notNull().default(0),
  openedAt: integer('opened_at').notNull()
})

// ─── Terminal Sessions (per-workspace terminal state) ───────────────────────
// Tracks PTY sessions associated with each workspace. The actual PTY process
// lives in the main process pty.service.ts; this table records metadata.

export const terminalSessions = sqliteTable('terminal_sessions', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  ptyId: text('pty_id').notNull(),
  cwd: text('cwd'),
  isActive: integer('is_active').notNull().default(0),
  createdAt: integer('created_at').notNull()
})

// ─── App Config (key-value store for global settings) ───────────────────────
// Stores model provider, API keys, and other global app settings.

export const appConfig = sqliteTable('app_config', {
  key: text('key').primaryKey(),
  value: text('value').notNull()
})

// ─── Type Exports ────────────────────────────────────────────────────────────

export type Workspace = typeof workspaces.$inferSelect
export type NewWorkspace = typeof workspaces.$inferInsert

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert

export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert

export type OpenFile = typeof openFiles.$inferSelect
export type NewOpenFile = typeof openFiles.$inferInsert

export type TerminalSession = typeof terminalSessions.$inferSelect
export type NewTerminalSession = typeof terminalSessions.$inferInsert

export type AppConfig = typeof appConfig.$inferSelect
export type NewAppConfig = typeof appConfig.$inferInsert
