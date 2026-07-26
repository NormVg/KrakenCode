import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      chat: (message: string) => Promise<string>
      streamChat: (id: string, message: string) => void
      onChatChunk: (id: string, callback: (chunk: string) => void) => void
      onChatEnd: (id: string, callback: () => void) => void
      onChatError: (id: string, callback: (err: string) => void) => void
      removeChatListeners: (id: string) => void
      setModel: (config: { provider: string, model: string, baseURL?: string, apiKey?: string }) => Promise<{ success: boolean, error?: string }>
    }
  }
}
