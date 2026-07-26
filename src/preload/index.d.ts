import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      chat: (message: string) => Promise<string>
      setModel: (config: { provider: string, model: string, baseURL?: string }) => Promise<{ success: boolean, error?: string }>
    }
  }
}
