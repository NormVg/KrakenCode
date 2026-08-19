export interface FileEntry {
  name: string
  path: string
  type: 'file' | 'folder'
}

export const FileSystemService = {
  async readDirectory(dirPath: string): Promise<FileEntry[]> {
    return await window.api.fs.readDirectory(dirPath)
  },

  async readFile(filePath: string): Promise<string> {
    return await window.api.fs.readFile(filePath)
  },

  async writeFile(filePath: string, content: string): Promise<boolean> {
    return await window.api.fs.writeFile(filePath, content)
  },

  async createItem(itemPath: string, type: 'file' | 'folder'): Promise<boolean> {
    return await window.api.fs.createItem(itemPath, type)
  },

  async deleteItem(itemPath: string): Promise<boolean> {
    return await window.api.fs.deleteItem(itemPath)
  },

  async renameItem(oldPath: string, newPath: string): Promise<boolean> {
    return await window.api.fs.renameItem(oldPath, newPath)
  },

  async moveItem(source: string, dest: string): Promise<boolean> {
    return await window.api.fs.moveItem(source, dest)
  },

  async copyItem(source: string, dest: string): Promise<boolean> {
    return await window.api.fs.copyItem(source, dest)
  }
}
