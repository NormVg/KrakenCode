import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      chat: (message: string) => Promise<string>
      streamChat: (id: string, message: string) => void
      onChatChunk: (id: string, callback: (chunk: string) => void) => void
      onChatEnd: (id: string, callback: () => void) => void
      onChatError: (id: string, callback: (error: string) => void) => void
      removeChatListeners: (id: string) => void
      minimizeWindow: () => void
      maximizeWindow: () => void
      closeWindow: () => void
      dialogOpenDirectory: () => Promise<{ path: string, name: string } | null>
      storeRead: (filename: string) => Promise<any>
      storeWrite: (filename: string, data: any) => Promise<boolean>
      setModel: (config: { provider: string, model: string, baseURL?: string, apiKey?: string }) => Promise<{ success: boolean, error?: string }>
      fs: {
        readDirectory: (dirPath: string) => Promise<Array<{ name: string, path: string, type: 'file' | 'folder' }>>
        readFile: (filePath: string) => Promise<string>
        writeFile: (filePath: string, content: string) => Promise<boolean>
        createItem: (itemPath: string, type: 'file' | 'folder') => Promise<boolean>
        deleteItem: (itemPath: string) => Promise<boolean>
        renameItem: (oldPath: string, newPath: string) => Promise<boolean>
      }
    }
  }
}
