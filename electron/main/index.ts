import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { registerVaultIpc } from './vault'
import { initDatabase, registerMemoryIpc } from './db'
import { applyDocking, type DockEdge } from './docking'
import { BrowserViewManager } from './browserView'
import { registerAiStubIpc } from './aiStub'

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null
let browserViews: BrowserViewManager | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Zarniwoop',
    backgroundColor: '#0f1419',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  browserViews = new BrowserViewManager(mainWindow)

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    browserViews?.dispose()
    browserViews = null
    mainWindow = null
  })
}

function registerShellIpc(): void {
  ipcMain.handle('shell:set-sidebar-collapsed', (_event, collapsed: boolean) => {
    browserViews?.setSidebarCollapsed(Boolean(collapsed))
  })

  ipcMain.handle('shell:set-sidebar-width', (_event, width: number) => {
    browserViews?.setSidebarWidth(Number(width))
  })

  ipcMain.handle('shell:navigate', async (_event, url: string) => {
    return browserViews?.navigate(url)
  })

  ipcMain.handle('shell:get-url', () => {
    return browserViews?.getUrl() ?? 'about:blank'
  })

  ipcMain.handle('shell:dock', (_event, edge: DockEdge) => {
    if (!mainWindow) return { ok: false, reason: 'no-window' }
    return applyDocking(mainWindow, edge)
  })
}

app.whenReady().then(async () => {
  await initDatabase()
  registerVaultIpc()
  registerMemoryIpc()
  registerAiStubIpc()
  registerShellIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
