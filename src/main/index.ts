import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import * as os from 'os'
import * as fs from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/apple-icon-squircle.png?asset'
import { createOllama } from 'ai-sdk-ollama'
import { streamText } from 'ai'
import * as pty from 'node-pty'

let aiModel: any = null

// ─── PTY Session Registry ────────────────────────────────────────────────────
// Maps session ID → IPty instance. Supports multiple concurrent terminals.
const ptyProcesses = new Map<string, pty.IPty>()


function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 18 },
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webviewTag: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.maximize()
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  ipcMain.on('window-minimize', () => {
    mainWindow.minimize()
  })
  ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  })
  ipcMain.on('window-close', () => {
    mainWindow.close()
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.handle('agent:setModel', (_, config) => {
    try {
      if (config.provider === 'ollama-local') {
        const ollama = createOllama({
          baseURL: "http://127.0.0.1:11434",
        });
        aiModel = ollama(config.model || 'gemma4:31b-cloud');
        return { success: true };
      }

      if (config.provider === 'ollama-cloud') {
        const apiKey = config.apiKey || process.env.OLLAMA_API_KEY;
        const ollama = createOllama({
          baseURL: "https://ollama.com",
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined
        });
        aiModel = ollama(config.model || 'gemma4:31b-cloud');
        return { success: true };
      }

      return { success: false, error: 'Provider not supported yet' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.on('agent:stream-chat', async (event, { id, message }) => {
    try {
      if (!aiModel) {
        event.sender.send(`agent:chat:error:${id}`, "Model not configured. Please select a model first.");
        return;
      }

      const { textStream } = streamText({
        model: aiModel,
        prompt: message
      });

      for await (const chunk of textStream) {
        event.sender.send(`agent:chat:chunk:${id}`, chunk);
      }
      event.sender.send(`agent:chat:end:${id}`);
    } catch (err: any) {
      event.sender.send(`agent:chat:error:${id}`, err.message);
    }
  });

  ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })
    if (canceled || filePaths.length === 0) {
      return null
    }
    const path = filePaths[0]
    // Get the folder name from the path (cross-platform compatible)
    const name = path.replace(/\\/g, '/').split('/').pop() || 'Unnamed Project'
    return { path, name }
  })

  ipcMain.handle('store:read', async (_, filename: string) => {
    try {
      const userDataPath = app.getPath('userData')
      const filePath = join(userDataPath, `${filename}.json`)
      const data = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(data)
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null // File doesn't exist yet
      }
      throw error
    }
  })

  ipcMain.handle('store:write', async (_, filename: string, data: any) => {
    try {
      const userDataPath = app.getPath('userData')
      const filePath = join(userDataPath, `${filename}.json`)
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
      return true
    } catch (error) {
      console.error('Failed to write store', error)
      return false
    }
  })

  // File System Operations
  ipcMain.handle('fs:readDirectory', async (_, dirPath: string) => {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      const items = entries.map(dirent => ({
        name: dirent.name,
        path: join(dirPath, dirent.name),
        type: dirent.isDirectory() ? 'folder' : 'file'
      }))

      // Sort folders first, then alphabetically
      items.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name)
        return a.type === 'folder' ? -1 : 1
      })

      return items
    } catch (error: any) {
      console.error('Failed to read directory:', error)
      return []
    }
  })

  ipcMain.handle('fs:readFile', async (_, filePath: string) => {
    return await fs.readFile(filePath, 'utf-8')
  })

  ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string) => {
    await fs.writeFile(filePath, content, 'utf-8')
    return true
  })

  ipcMain.handle('fs:createItem', async (_, itemPath: string, type: 'file' | 'folder') => {
    if (type === 'folder') {
      await fs.mkdir(itemPath, { recursive: true })
    } else {
      await fs.writeFile(itemPath, '', 'utf-8')
    }
    return true
  })

  ipcMain.handle('fs:deleteItem', async (_, itemPath: string) => {
    await fs.rm(itemPath, { recursive: true, force: true })
    return true
  })

  ipcMain.handle('fs:renameItem', async (_, oldPath: string, newPath: string) => {
    await fs.rename(oldPath, newPath)
    return true
  })

  // ─── PTY Handlers ──────────────────────────────────────────────────────────

  // pty:create — spawn a shell and start forwarding output to the renderer
  ipcMain.handle('pty:create', (event, { id, cols, rows, cwd }: {
    id: string
    cols: number
    rows: number
    cwd?: string
  }) => {
    // Resolve shell: honour SHELL env var, fall back to zsh → bash → sh
    const shell = process.env.SHELL ||
      (process.platform === 'win32' ? 'powershell.exe' : '/bin/zsh')

    // Use the active project directory, home dir, or cwd as working directory
    const workingDir = cwd && cwd.length > 0 ? cwd : os.homedir()

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: cols || 80,
      rows: rows || 24,
      cwd: workingDir,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      }
    })

    ptyProcesses.set(id, ptyProcess)

    // Forward PTY output → renderer
    ptyProcess.onData((data) => {
      event.sender.send(`pty:data:${id}`, data)
    })

    // Notify renderer when process exits
    ptyProcess.onExit(({ exitCode }) => {
      event.sender.send(`pty:exit:${id}`, exitCode)
      ptyProcesses.delete(id)
    })

    return { success: true, pid: ptyProcess.pid }
  })

  // pty:write — send keystrokes / data to the PTY
  ipcMain.on('pty:write', (_, { id, data }: { id: string; data: string }) => {
    const ptyProcess = ptyProcesses.get(id)
    if (ptyProcess) {
      ptyProcess.write(data)
    }
  })

  // pty:resize — update PTY dimensions when the terminal panel is resized
  ipcMain.on('pty:resize', (_, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
    const ptyProcess = ptyProcesses.get(id)
    if (ptyProcess) {
      ptyProcess.resize(cols, rows)
    }
  })

  // pty:kill — explicitly destroy a PTY session
  ipcMain.on('pty:kill', (_, { id }: { id: string }) => {
    const ptyProcess = ptyProcesses.get(id)
    if (ptyProcess) {
      ptyProcess.kill()
      ptyProcesses.delete(id)
    }
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  // Kill all active PTY sessions before quitting
  for (const [id, ptyProcess] of ptyProcesses) {
    try { ptyProcess.kill() } catch { /* already dead */ }
    ptyProcesses.delete(id)
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
