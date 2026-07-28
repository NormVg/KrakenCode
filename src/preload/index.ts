import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  chat: (message: string) => ipcRenderer.invoke('agent:chat', message),
  streamChat: (
    id: string,
    message: string,
    options?: { system?: string }
  ) => ipcRenderer.send('agent:stream-chat', { id, message, system: options?.system }),
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
  setModel: (config: { provider: string, model: string, baseURL?: string }) => ipcRenderer.invoke('agent:setModel', config),
  fs: {
    readDirectory: (dirPath: string) => ipcRenderer.invoke('fs:readDirectory', dirPath),
    readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content),
    createItem: (itemPath: string, type: 'file' | 'folder') => ipcRenderer.invoke('fs:createItem', itemPath, type),
    deleteItem: (itemPath: string) => ipcRenderer.invoke('fs:deleteItem', itemPath),
    renameItem: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:renameItem', oldPath, newPath),
    moveItem: (source: string, dest: string) => ipcRenderer.invoke('fs:moveItem', source, dest),
    copyItem: (source: string, dest: string) => ipcRenderer.invoke('fs:copyItem', source, dest)
  },
  pty: {
    // Spawn a shell — resolves with { pid } once the process is running
    create: (id: string, cols: number, rows: number, cwd?: string) =>
      ipcRenderer.invoke('pty:create', { id, cols, rows, cwd }),
    // Send raw input (keystrokes, paste, etc.) to the shell
    write: (id: string, data: string) =>
      ipcRenderer.send('pty:write', { id, data }),
    // Notify the PTY of a terminal resize
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.send('pty:resize', { id, cols, rows }),
    // Explicitly kill the shell (also called on component unmount)
    kill: (id: string) =>
      ipcRenderer.send('pty:kill', { id }),
    // Subscribe to data chunks coming from the shell
    onData: (id: string, callback: (data: string) => void) =>
      ipcRenderer.on(`pty:data:${id}`, (_, data) => callback(data)),
    // Subscribe to shell exit event
    onExit: (id: string, callback: (exitCode: number) => void) =>
      ipcRenderer.once(`pty:exit:${id}`, (_, exitCode) => callback(exitCode)),
    // Remove all listeners for a session (call before kill to avoid leaks)
    removeListeners: (id: string) => {
      ipcRenderer.removeAllListeners(`pty:data:${id}`)
      ipcRenderer.removeAllListeners(`pty:exit:${id}`)
    }
  }
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
