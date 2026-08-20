import { app, shell, BrowserWindow, ipcMain, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/apple-icon-squircle.png?asset'
import { initDatabase, closeDatabase } from './database/connection'
import { registerAllIpc } from './ipc'
import { ptyService } from './services/pty.service'
import { closeEveServer } from './eve/eve-server.service'
import { IPC } from '../shared/constants/ipc-channels'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 12, y: 14 },
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

  // DevTools: F12 toggles in any environment. Also Cmd/Ctrl+Shift+I as fallback.
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.type !== 'keyDown') return
    const isF12 = input.code === 'F12'
    const isCmdShiftI =
      (input.control || input.meta) && input.shift && input.code === 'KeyI'
    if (isF12 || isCmdShiftI) {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools()
      } else {
        mainWindow.webContents.openDevTools({ mode: 'undocked' })
      }
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Window controls
  ipcMain.on(IPC.WINDOW_MINIMIZE, () => mainWindow.minimize())
  ipcMain.on(IPC.WINDOW_MAXIMIZE, () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.on(IPC.WINDOW_CLOSE, () => mainWindow.close())

  // Load the renderer
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Remove native application menu
  Menu.setApplicationMenu(null)

  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize database
  initDatabase()

  // Register all IPC handlers
  registerAllIpc()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // Kill all PTY sessions before quitting
  ptyService.killAll()

  // Close eve dev server
  closeEveServer()

  // Close database
  closeDatabase()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})
