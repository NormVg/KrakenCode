import { ipcMain } from 'electron'
import { IPC } from '../../shared/constants/ipc-channels'
import { filesystemService } from '../services/filesystem.service'

export function registerFsIpc(): void {
  ipcMain.handle(IPC.FS_READ_DIRECTORY, async (_, dirPath: string) => {
    return await filesystemService.readDirectory(dirPath)
  })

  ipcMain.handle(IPC.FS_READ_FILE, async (_, filePath: string) => {
    return await filesystemService.readFile(filePath)
  })

  ipcMain.handle(IPC.FS_WRITE_FILE, async (_, filePath: string, content: string) => {
    return await filesystemService.writeFile(filePath, content)
  })

  ipcMain.handle(IPC.FS_CREATE_ITEM, async (_, itemPath: string, type: 'file' | 'folder') => {
    return await filesystemService.createItem(itemPath, type)
  })

  ipcMain.handle(IPC.FS_DELETE_ITEM, async (_, itemPath: string) => {
    return await filesystemService.deleteItem(itemPath)
  })

  ipcMain.handle(IPC.FS_RENAME_ITEM, async (_, oldPath: string, newPath: string) => {
    return await filesystemService.renameItem(oldPath, newPath)
  })

  ipcMain.handle(IPC.FS_MOVE_ITEM, async (_, source: string, dest: string) => {
    return await filesystemService.moveItem(source, dest)
  })

  ipcMain.handle(IPC.FS_COPY_ITEM, async (_, source: string, dest: string) => {
    return await filesystemService.copyItem(source, dest)
  })
}
