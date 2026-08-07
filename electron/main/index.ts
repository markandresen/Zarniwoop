import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { registerVaultIpc } from './vault'
import { initDatabase, registerMemoryIpc } from './db'
import {
  applyDocking,
  applyIconDock,
  releaseDockReservation,
  type DockEdge
} from './docking'
import { BrowserViewManager } from './browserView'
import { registerAiStubIpc } from './aiStub'
import {
  iconDockBounds,
  ICON_DOCK_SIZE,
  slideBrowserIn,
  slideBrowserOut,
  slideToIconDock,
  WORKSPACE_MIN_WIDTH
} from './windowMotion'

const isDev = !app.isPackaged
const COMPANION_WIDTH = 400
const COMPANION_MIN = 320

let mainWindow: BrowserWindow | null = null
let browserViews: BrowserViewManager | null = null
let browserCollapsed = true
let sidebarCollapsed = false
/** When leaving icon dock, reopen browser workspace if it was open. */
let restoreBrowserOnExpand = false
let modeTransition: Promise<void> = Promise.resolve()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: COMPANION_WIDTH,
    height: 900,
    minWidth: COMPANION_MIN,
    minHeight: 480,
    title: 'Zarniwoop',
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  browserViews = new BrowserViewManager(mainWindow)
  browserViews.setBrowserCollapsed(true)

  // Default: AI companion strip docked to the right
  applyDocking(mainWindow, 'right')

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) return
    applyDocking(mainWindow, 'right')
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('close', () => {
    if (mainWindow) releaseDockReservation(mainWindow)
  })

  mainWindow.on('closed', () => {
    browserViews?.dispose()
    browserViews = null
    mainWindow = null
  })
}

function setTrafficLights(win: BrowserWindow, visible: boolean): void {
  if (process.platform === 'darwin') {
    win.setWindowButtonVisibility(visible)
  }
}

async function setBrowserCollapsedMode(collapsed: boolean): Promise<void> {
  if (!mainWindow) {
    browserCollapsed = collapsed
    browserViews?.setBrowserCollapsed(collapsed)
    return
  }

  const win = mainWindow

  // Icon dock owns the window — expand chat first.
  if (sidebarCollapsed) {
    browserCollapsed = collapsed
    return
  }

  if (collapsed === browserCollapsed) {
    browserViews?.setBrowserCollapsed(collapsed)
    return
  }

  if (!collapsed) {
    browserCollapsed = false
    releaseDockReservation(win)
    setTrafficLights(win, true)
    win.setAlwaysOnTop(false)
    win.setMovable(true)
    win.setResizable(true)
    win.setMinimumSize(COMPANION_MIN, 480)
    browserViews?.setBrowserCollapsed(false)
    await slideBrowserOut(win)
    if (mainWindow !== win || win.isDestroyed()) return
    win.setMinimumSize(WORKSPACE_MIN_WIDTH, 600)
    return
  }

  browserCollapsed = true
  browserViews?.setBrowserCollapsed(true)
  browserViews?.setChromeLayout({ rightChrome: 0 })
  win.setMinimumSize(COMPANION_MIN, 480)
  await slideBrowserIn(win)
  if (mainWindow !== win || win.isDestroyed()) return
  browserViews?.setBrowserCollapsed(true)
  applyDocking(win, 'right')
  setTrafficLights(win, true)
}

async function setSidebarCollapsedMode(collapsed: boolean): Promise<void> {
  if (!mainWindow) {
    sidebarCollapsed = collapsed
    return
  }

  const win = mainWindow
  if (collapsed === sidebarCollapsed) return

  if (collapsed) {
    // Collapse everything to a single restore chip.
    restoreBrowserOnExpand = !browserCollapsed
    sidebarCollapsed = true
    browserViews?.setBrowserCollapsed(true)
    browserViews?.setChromeLayout({ rightChrome: 0 })
    releaseDockReservation(win)
    setTrafficLights(win, false)
    win.setMinimumSize(ICON_DOCK_SIZE, ICON_DOCK_SIZE)
    await slideToIconDock(win)
    if (mainWindow !== win || win.isDestroyed()) return
    applyIconDock(win, iconDockBounds(win))
    return
  }

  // Expand chip back to docked chat (and browser workspace if that was open).
  sidebarCollapsed = false
  setTrafficLights(win, true)
  win.setMinimumSize(COMPANION_MIN, 480)
  win.setResizable(true)

  if (restoreBrowserOnExpand) {
    restoreBrowserOnExpand = false
    browserCollapsed = false
    releaseDockReservation(win)
    win.setAlwaysOnTop(false)
    win.setMovable(true)
    browserViews?.setBrowserCollapsed(false)
    await slideBrowserOut(win)
    if (mainWindow !== win || win.isDestroyed()) return
    win.setMinimumSize(WORKSPACE_MIN_WIDTH, 600)
    return
  }

  restoreBrowserOnExpand = false
  browserCollapsed = true
  browserViews?.setBrowserCollapsed(true)
  await slideBrowserIn(win)
  if (mainWindow !== win || win.isDestroyed()) return
  applyDocking(win, 'right')
}

function registerShellIpc(): void {
  ipcMain.handle('shell:set-browser-collapsed', async (_event, collapsed: boolean) => {
    modeTransition = modeTransition
      .catch(() => undefined)
      .then(() => setBrowserCollapsedMode(Boolean(collapsed)))
    await modeTransition
    return { ok: true, browserCollapsed }
  })

  ipcMain.handle('shell:get-browser-collapsed', () => browserCollapsed)

  ipcMain.handle('shell:set-chrome-layout', (_event, layout) => {
    browserViews?.setChromeLayout({
      toolbarHeight: Number(layout?.toolbarHeight),
      rightChrome: Number(layout?.rightChrome)
    })
    return { ok: true }
  })

  ipcMain.handle('shell:set-sidebar-collapsed', async (_event, collapsed: boolean) => {
    modeTransition = modeTransition
      .catch(() => undefined)
      .then(() => setSidebarCollapsedMode(Boolean(collapsed)))
    await modeTransition
    return { ok: true, sidebarCollapsed, browserCollapsed }
  })

  ipcMain.handle('shell:get-sidebar-collapsed', () => sidebarCollapsed)

  ipcMain.handle('shell:navigate', async (_event, url: string) => {
    return browserViews?.navigate(url)
  })

  ipcMain.handle('shell:get-url', () => {
    return browserViews?.getUrl() ?? 'about:blank'
  })

  ipcMain.handle('shell:dock', (_event, edge: DockEdge) => {
    if (!mainWindow) return { ok: false, reason: 'no-window' }
    if (sidebarCollapsed) return { ok: false, reason: 'icon-dock' }
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

app.on('before-quit', () => {
  if (mainWindow && !mainWindow.isDestroyed()) releaseDockReservation(mainWindow)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
