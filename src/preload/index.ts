import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  chat: (message: string) => ipcRenderer.invoke('agent:chat', message),
  streamChat: (id: string, message: string) => ipcRenderer.send('agent:stream-chat', { id, message }),
  onChatChunk: (id: string, callback: (chunk: string) => void) => {
    ipcRenderer.on(`agent:chat:chunk:${id}`, (_, chunk) => callback(chunk));
  },
  onChatEnd: (id: string, callback: () => void) => {
    ipcRenderer.once(`agent:chat:end:${id}`, () => callback());
  },
  onChatError: (id: string, callback: (err: string) => void) => {
    ipcRenderer.once(`agent:chat:error:${id}`, (_, err) => callback(err));
  },
  removeChatListeners: (id: string) => {
    ipcRenderer.removeAllListeners(`agent:chat:chunk:${id}`);
    ipcRenderer.removeAllListeners(`agent:chat:end:${id}`);
    ipcRenderer.removeAllListeners(`agent:chat:error:${id}`);
  },
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  dialogOpenDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  storeRead: (filename: string) => ipcRenderer.invoke('store:read', filename),
  storeWrite: (filename: string, data: any) => ipcRenderer.invoke('store:write', filename, data),
  setModel: (config: { provider: string, model: string, baseURL?: string }) => ipcRenderer.invoke('agent:setModel', config)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
