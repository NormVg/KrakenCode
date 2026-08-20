import { registerAgentIpc } from './agent.ipc'
import { registerPtyIpc } from './pty.ipc'
import { registerFsIpc } from './fs.ipc'
import { registerDatabaseIpc } from './database.ipc'
import { registerEveIpc } from './eve.ipc'

/**
 * Register all IPC handlers.
 * Must be called after Electron app is ready and database is initialized.
 */
export function registerAllIpc(): void {
  registerAgentIpc()
  registerPtyIpc()
  registerFsIpc()
  registerDatabaseIpc()
  registerEveIpc()
  console.log('[ipc] All handlers registered')
}
