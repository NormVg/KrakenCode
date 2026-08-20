import { eq, desc } from 'drizzle-orm'
import { getDb } from './connection'
import {
  workspaces,
  sessions,
  messages,
  openFiles,
  terminalSessions,
  appConfig,
  type Workspace,
  type Session,
  type Message,
  type OpenFile,
  type TerminalSession
} from './schema'

// ─── Workspaces ──────────────────────────────────────────────────────────────

export const workspaceRepo = {
  getAll(): Workspace[] {
    const db = getDb()
    return db.select().from(workspaces).orderBy(desc(workspaces.lastOpenedAt)).all()
  },

  getById(id: string): Workspace | undefined {
    const db = getDb()
    return db.select().from(workspaces).where(eq(workspaces.id, id)).get()
  },

  getByPath(path: string): Workspace | undefined {
    const db = getDb()
    return db.select().from(workspaces).where(eq(workspaces.path, path)).get()
  },

  create(data: {
    id: string
    name: string
    path: string
    createdAt: number
    lastOpenedAt: number
  }): Workspace {
    const db = getDb()
    db.insert(workspaces)
      .values({
        id: data.id,
        name: data.name,
        path: data.path,
        createdAt: data.createdAt,
        lastOpenedAt: data.lastOpenedAt
      })
      .run()
    return this.getById(data.id)!
  },

  update(id: string, data: Partial<Omit<Workspace, 'id'>>): void {
    const db = getDb()
    db.update(workspaces).set(data).where(eq(workspaces.id, id)).run()
  },

  touch(id: string): void {
    const db = getDb()
    db.update(workspaces)
      .set({ lastOpenedAt: Date.now() })
      .where(eq(workspaces.id, id))
      .run()
  },

  delete(id: string): void {
    const db = getDb()
    db.delete(workspaces).where(eq(workspaces.id, id)).run()
  }
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export const sessionRepo = {
  getAll(): Session[] {
    const db = getDb()
    return db
      .select()
      .from(sessions)
      .orderBy(desc(sessions.updatedAt))
      .all()
  },

  getByWorkspace(workspaceId: string): Session[] {
    const db = getDb()
    return db
      .select()
      .from(sessions)
      .where(eq(sessions.workspaceId, workspaceId))
      .orderBy(desc(sessions.updatedAt))
      .all()
  },

  getById(id: string): Session | undefined {
    const db = getDb()
    return db.select().from(sessions).where(eq(sessions.id, id)).get()
  },

  create(data: {
    id: string
    workspaceId: string
    title?: string
    createdAt: number
    updatedAt: number
  }): Session {
    const db = getDb()
    db.insert(sessions)
      .values({
        id: data.id,
        workspaceId: data.workspaceId,
        title: data.title ?? 'New Chat',
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      })
      .run()
    return this.getById(data.id)!
  },

  update(id: string, data: Partial<Omit<Session, 'id'>>): void {
    const db = getDb()
    db.update(sessions).set(data).where(eq(sessions.id, id)).run()
  },

  touch(id: string): void {
    const db = getDb()
    db.update(sessions)
      .set({ updatedAt: Date.now() })
      .where(eq(sessions.id, id))
      .run()
  },

  delete(id: string): void {
    const db = getDb()
    db.delete(sessions).where(eq(sessions.id, id)).run()
  }
}

// ─── Messages ───────────────────────────────────────────────────────────────

export const messageRepo = {
  getBySession(sessionId: string): Message[] {
    const db = getDb()
    return db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(messages.createdAt)
      .all()
  },

  create(data: {
    id: string
    sessionId: string
    role: 'user' | 'agent'
    content?: string
    isStreaming?: boolean
    createdAt: number
  }): Message {
    const db = getDb()
    db.insert(messages)
      .values({
        id: data.id,
        sessionId: data.sessionId,
        role: data.role,
        content: data.content ?? '',
        isStreaming: data.isStreaming ? 1 : 0,
        createdAt: data.createdAt
      })
      .run()
    return db.select().from(messages).where(eq(messages.id, data.id)).get()!
  },

  update(id: string, data: Partial<Omit<Message, 'id'>>): void {
    const db = getDb()
    db.update(messages).set(data).where(eq(messages.id, id)).run()
  },

  appendContent(id: string, chunk: string): void {
    const db = getDb()
    const msg = db.select().from(messages).where(eq(messages.id, id)).get()
    if (msg) {
      db.update(messages)
        .set({ content: msg.content + chunk })
        .where(eq(messages.id, id))
        .run()
    }
  },

  delete(id: string): void {
    const db = getDb()
    db.delete(messages).where(eq(messages.id, id)).run()
  },

  deleteBySession(sessionId: string): void {
    const db = getDb()
    db.delete(messages).where(eq(messages.sessionId, sessionId)).run()
  }
}

// ─── Open Files ─────────────────────────────────────────────────────────────

export const openFileRepo = {
  getByWorkspace(workspaceId: string): OpenFile[] {
    const db = getDb()
    return db
      .select()
      .from(openFiles)
      .where(eq(openFiles.workspaceId, workspaceId))
      .orderBy(openFiles.openedAt)
      .all()
  },

  getActive(workspaceId: string): OpenFile | undefined {
    const db = getDb()
    return db
      .select()
      .from(openFiles)
      .where(eq(openFiles.workspaceId, workspaceId))
      .all()
      .find(f => f.isActive === 1)
  },

  create(data: {
    id: string
    workspaceId: string
    path: string
    name: string
    language?: string
    content?: string
    isModified?: boolean
    isActive?: boolean
    openedAt: number
  }): OpenFile {
    const db = getDb()
    db.insert(openFiles)
      .values({
        id: data.id,
        workspaceId: data.workspaceId,
        path: data.path,
        name: data.name,
        language: data.language ?? 'plaintext',
        content: data.content ?? '',
        isModified: data.isModified ? 1 : 0,
        isActive: data.isActive ? 1 : 0,
        openedAt: data.openedAt
      })
      .run()
    return db.select().from(openFiles).where(eq(openFiles.id, data.id)).get()!
  },

  upsert(data: {
    id: string
    workspaceId: string
    path: string
    name: string
    language?: string
    content?: string
    isModified?: boolean
    isActive?: boolean
    openedAt: number
  }): OpenFile {
    const db = getDb()
    db.insert(openFiles)
      .values({
        id: data.id,
        workspaceId: data.workspaceId,
        path: data.path,
        name: data.name,
        language: data.language ?? 'plaintext',
        content: data.content ?? '',
        isModified: data.isModified ? 1 : 0,
        isActive: data.isActive ? 1 : 0,
        openedAt: data.openedAt
      })
      .onConflictDoUpdate({
        target: [openFiles.workspaceId, openFiles.path],
        set: {
          name: data.name,
          language: data.language ?? 'plaintext',
          isActive: data.isActive ? 1 : 0
        }
      })
      .run()
    return db.select().from(openFiles).where(eq(openFiles.id, data.id)).get()!
  },

  update(id: string, data: Partial<Omit<OpenFile, 'id'>>): void {
    const db = getDb()
    db.update(openFiles).set(data).where(eq(openFiles.id, id)).run()
  },

  setActive(workspaceId: string, fileId: string): void {
    const db = getDb()
    // Clear previous active
    db.update(openFiles)
      .set({ isActive: 0 })
      .where(eq(openFiles.workspaceId, workspaceId))
      .run()
    // Set new active
    db.update(openFiles)
      .set({ isActive: 1 })
      .where(eq(openFiles.id, fileId))
      .run()
  },

  delete(id: string): void {
    const db = getDb()
    db.delete(openFiles).where(eq(openFiles.id, id)).run()
  },

  deleteByWorkspace(workspaceId: string): void {
    const db = getDb()
    db.delete(openFiles).where(eq(openFiles.workspaceId, workspaceId)).run()
  }
}

// ─── Terminal Sessions ──────────────────────────────────────────────────────

export const terminalRepo = {
  getByWorkspace(workspaceId: string): TerminalSession[] {
    const db = getDb()
    return db
      .select()
      .from(terminalSessions)
      .where(eq(terminalSessions.workspaceId, workspaceId))
      .orderBy(terminalSessions.createdAt)
      .all()
  },

  create(data: {
    id: string
    workspaceId: string
    ptyId: string
    cwd?: string
    isActive?: boolean
    createdAt: number
  }): TerminalSession {
    const db = getDb()
    db.insert(terminalSessions)
      .values({
        id: data.id,
        workspaceId: data.workspaceId,
        ptyId: data.ptyId,
        cwd: data.cwd,
        isActive: data.isActive ? 1 : 0,
        createdAt: data.createdAt
      })
      .run()
    return db.select().from(terminalSessions).where(eq(terminalSessions.id, data.id)).get()!
  },

  update(id: string, data: Partial<Omit<TerminalSession, 'id'>>): void {
    const db = getDb()
    db.update(terminalSessions).set(data).where(eq(terminalSessions.id, id)).run()
  },

  delete(id: string): void {
    const db = getDb()
    db.delete(terminalSessions).where(eq(terminalSessions.id, id)).run()
  },

  deleteByWorkspace(workspaceId: string): void {
    const db = getDb()
    db.delete(terminalSessions).where(eq(terminalSessions.workspaceId, workspaceId)).run()
  }
}

// ─── App Config ─────────────────────────────────────────────────────────────

export const configRepo = {
  get(key: string): string | undefined {
    const db = getDb()
    const row = db.select().from(appConfig).where(eq(appConfig.key, key)).get()
    return row?.value
  },

  set(key: string, value: string): void {
    const db = getDb()
    db.insert(appConfig)
      .values({ key, value })
      .onConflictDoUpdate({
        target: appConfig.key,
        set: { value }
      })
      .run()
  },

  getAll(): Record<string, string> {
    const db = getDb()
    const rows = db.select().from(appConfig).all()
    const result: Record<string, string> = {}
    for (const row of rows) {
      result[row.key] = row.value
    }
    return result
  },

  delete(key: string): void {
    const db = getDb()
    db.delete(appConfig).where(eq(appConfig.key, key)).run()
  }
}
