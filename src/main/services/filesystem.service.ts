import * as fs from 'fs/promises'
import { join } from 'path'

export interface FileEntry {
  name: string
  path: string
  type: 'file' | 'folder'
}

export const filesystemService = {
  async readDirectory(dirPath: string): Promise<FileEntry[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      const items = entries.map((dirent) => ({
        name: dirent.name,
        path: join(dirPath, dirent.name),
        type: dirent.isDirectory() ? ('folder' as const) : ('file' as const)
      }))

      items.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name)
        return a.type === 'folder' ? -1 : 1
      })

      return items
    } catch (error: any) {
      console.error('Failed to read directory:', error)
      return []
    }
  },

  async readFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf-8')
  },

  async writeFile(filePath: string, content: string): Promise<boolean> {
    await fs.writeFile(filePath, content, 'utf-8')
    return true
  },

  async createItem(itemPath: string, type: 'file' | 'folder'): Promise<boolean> {
    if (type === 'folder') {
      await fs.mkdir(itemPath, { recursive: true })
    } else {
      await fs.writeFile(itemPath, '', 'utf-8')
    }
    return true
  },

  async deleteItem(itemPath: string): Promise<boolean> {
    await fs.rm(itemPath, { recursive: true, force: true })
    return true
  },

  async renameItem(oldPath: string, newPath: string): Promise<boolean> {
    await fs.rename(oldPath, newPath)
    return true
  },

  async moveItem(source: string, dest: string): Promise<boolean> {
    await fs.rename(source, dest)
    return true
  },

  async copyItem(source: string, dest: string): Promise<boolean> {
    await fs.cp(source, dest, { recursive: true })
    return true
  }
}
