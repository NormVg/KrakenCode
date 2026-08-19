import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import * as schema from './schema'

let dbInstance: BetterSQLite3Database<typeof schema> | null = null
let rawDb: Database.Database | null = null

/**
 * Get the database file path inside Electron's userData directory.
 */
function getDbPath(): string {
  return join(app.getPath('userData'), 'kraken.db')
}

/**
 * Initialize the SQLite database with Drizzle ORM.
 * Must be called after Electron app is ready.
 *
 * Uses WAL mode for crash-safe concurrent reads during writes.
 * Enables foreign keys for cascade deletes.
 */
export function initDatabase(): BetterSQLite3Database<typeof schema> {
  if (dbInstance) return dbInstance

  const dbPath = getDbPath()
  console.log(`[database] Opening SQLite at ${dbPath}`)

  rawDb = new Database(dbPath)

  // Performance pragmas
  rawDb.pragma('journal_mode = WAL')
  rawDb.pragma('foreign_keys = ON')
  rawDb.pragma('synchronous = NORMAL')
  rawDb.pragma('busy_timeout = 5000')

  dbInstance = drizzle(rawDb, { schema })

  // Run migrations (create tables if they don't exist)
  runMigrations(rawDb)

  return dbInstance
}

/**
 * Get the initialized database instance.
 * Throws if initDatabase() hasn't been called yet.
 */
export function getDb(): BetterSQLite3Database<typeof schema> {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return dbInstance
}

/**
 * Close the database connection.
 * Called during app shutdown.
 */
export function closeDatabase(): void {
  if (rawDb) {
    rawDb.close()
    rawDb = null
    dbInstance = null
    console.log('[database] Closed')
  }
}

/**
 * Create all tables if they don't exist.
 * In production this is a simple CREATE TABLE IF NOT EXISTS for each table.
 * For future schema changes, use drizzle-kit migrations.
 */
function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      architecture TEXT,
      active_view TEXT NOT NULL DEFAULT 'agent',
      active_session_id TEXT,
      left_sidebar_open INTEGER NOT NULL DEFAULT 1,
      right_sidebar_open INTEGER NOT NULL DEFAULT 1,
      right_sidebar_width INTEGER NOT NULL DEFAULT 300,
      scratchpad_content TEXT DEFAULT '',
      created_at INTEGER NOT NULL,
      last_opened_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 'New Chat',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'agent')),
      content TEXT NOT NULL DEFAULT '',
      is_streaming INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

    CREATE TABLE IF NOT EXISTS open_files (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      path TEXT NOT NULL,
      name TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'plaintext',
      content TEXT NOT NULL DEFAULT '',
      is_modified INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 0,
      opened_at INTEGER NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      UNIQUE(workspace_id, path)
    );

    CREATE INDEX IF NOT EXISTS idx_open_files_workspace ON open_files(workspace_id);

    CREATE TABLE IF NOT EXISTS terminal_sessions (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      pty_id TEXT NOT NULL,
      cwd TEXT,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_terminals_workspace ON terminal_sessions(workspace_id);

    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  console.log('[database] Migrations complete')
}
