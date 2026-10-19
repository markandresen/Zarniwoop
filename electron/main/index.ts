import { app, BrowserWindow, ipcMain, screen, shell } from 'electron'
import { join } from 'node:path'
import { registerVaultIpc } from './vault'
import { initDatabase, registerMemoryIpc, registerSettingsIpc } from './db'
import {
  applyDocking,
  releaseDockReservation,
  releaseDockReservationForce,
  type DockEdge
} from './docking'
import { BrowserViewManager } from './browserView'
import { lockAppWindowNavigation } from './navGuard'
import { registerAiIpc } from './ai/registerAiIpc'
import {
  slideBrowserIn,
  slideBrowserOut,
  WORKSPACE_MIN_WIDTH
} from './windowMotion'
import {
  destroyIconDock,
  hideIconDock,
  showIconDock,
  getIconDockBounds,
  moveIconDockByDelta,
  moveIconDockFollowCursor,
  moveIconDockToScreenY,
  persistIconDockY
} from './iconDockWindow'

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
  // Seed right-edge using full monitor bounds (not workArea — AppBar shrinks that).
  const primary = screen.getPrimaryDisplay()
  const seedWidth = Math.min(COMPANION_WIDTH, Math.floor(primary.bounds.width * 0.32))
  const seedBounds = {
    x: primary.bounds.x + primary.bounds.width - seedWidth,
    y: primary.workArea.y,
    width: seedWidth,
    height: primary.workArea.height
  }

  mainWindow = new BrowserWindow({
    ...seedBounds,
    minWidth: COMPANION_MIN,
    minHeight: 480,
    title: 'Zarniwoop',
    // Transparent + acrylic: see-through chrome. Safe now that icon-dock is a
    // separate window (main never shrinks to 64×64).
    transparent: true,
    backgroundColor: '#00000000',
    ...(process.platform === 'win32' ? { backgroundMaterial: 'acrylic' as const } : {}),
    frame: false,
    hasShadow: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  if (process.platform === 'darwin') {
    try {
      mainWindow.setVibrancy('under-window')
    } catch (err) {
      console.warn('[zarniwoop] setVibrancy failed', err)
    }
  } else if (process.platform === 'win32') {
    try {
      mainWindow.setBackgroundMaterial('acrylic')
    } catch (err) {
      console.warn('[zarniwoop] setBackgroundMaterial failed', err)
    }
  }

  browserViews = new BrowserViewManager(mainWindow)
  browserViews.setBrowserCollapsed(true)

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) return
    mainWindow.show()
    try {
      const dock = applyDocking(mainWindow, 'right')
      const b = mainWindow.getBounds()
      const mon = screen.getDisplayMatching(b)
      console.log(
        `[zarniwoop] dock mode=${dock.mode} reserved=${Boolean(dock.reserved)} edge=${dock.edge}` +
          ` bounds=${b.x},${b.y} ${b.width}x${b.height}` +
          ` monitor=${mon.bounds.width}x${mon.bounds.height} sf=${mon.scaleFactor}` +
          ` work=${mon.workArea.width}x${mon.workArea.height}`
      )
    } catch (err) {
      console.error('[zarniwoop] dock on show failed', err)
    }
  })

  lockAppWindowNavigation(mainWindow)

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('close', () => {
    if (mainWindow) releaseDockReservation(mainWindow)
  })

  mainWindow.on('closed', () => {
    destroyIconDock()
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
    // Hide opaque main; float a separate transparent orb chip.
    restoreBrowserOnExpand = !browserCollapsed
    sidebarCollapsed = true
    browserViews?.setBrowserCollapsed(true)
    browserViews?.setChromeLayout({ rightChrome: 0 })
    releaseDockReservation(win)
    setTrafficLights(win, false)
    // Keep main at companion size while hidden — never shrink it to 64×64.
    win.setMinimumSize(COMPANION_MIN, 480)
    await slideBrowserIn(win)
    if (mainWindow !== win || win.isDestroyed()) return
    showIconDock(win)
    win.hide()
    broadcastSidebarCollapsed()
    return
  }

  // Expand: kill chip, show main again at full companion / workspace size.
  sidebarCollapsed = false
  hideIconDock()
  setTrafficLights(win, true)
  win.setMinimumSize(COMPANION_MIN, 480)
  win.setResizable(true)
  win.show()
  broadcastSidebarCollapsed()

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

function broadcastSidebarCollapsed(): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('shell:sidebar-collapsed', sidebarCollapsed)
  }
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

  ipcMain.handle('shell:get-icon-dock-bounds', () => getIconDockBounds())

  ipcMain.handle('shell:move-icon-dock-y', (_event, screenY: number) => {
    return moveIconDockToScreenY(Number(screenY))
  })

  ipcMain.handle('shell:move-icon-dock-dy', (_event, dy: number) => {
    return moveIconDockByDelta(Number(dy))
  })

  ipcMain.handle('shell:move-icon-dock-follow', (_event, grabOffsetY: number) => {
    return moveIconDockFollowCursor(Number(grabOffsetY))
  })

  ipcMain.handle('shell:persist-icon-dock-y', () => persistIconDockY())

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

  ipcMain.handle('shell:open-external', async (_event, url: string) => {
    const raw = String(url ?? '').trim()
    if (!/^https?:\/\//i.test(raw)) {
      return { ok: false, error: 'Only http(s) links allowed' }
    }
    await shell.openExternal(raw)
    return { ok: true }
  })

  ipcMain.handle('shell:quit', () => {
    // Quit after the IPC reply — sync app.quit() inside a handler can no-op.
    setImmediate(() => {
      try {
        destroyIconDock()
      } catch {
        /* ignore */
      }
      try {
        if (mainWindow && !mainWindow.isDestroyed()) {
          releaseDockReservation(mainWindow)
        }
        releaseDockReservationForce()
      } catch {
        /* ignore */
      }
      for (const w of BrowserWindow.getAllWindows()) {
        if (!w.isDestroyed()) w.destroy()
      }
      app.exit(0)
    })
    return { ok: true }
  })
}

app.whenReady().then(async () => {
  // Clear ghost AppBar inset left by a prior force-killed / crashed session.
  releaseDockReservationForce()
  await initDatabase()
  registerVaultIpc()
  registerMemoryIpc()
  registerSettingsIpc()
  registerAiIpc()
  registerShellIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  destroyIconDock()
  if (mainWindow && !mainWindow.isDestroyed()) releaseDockReservation(mainWindow)
  releaseDockReservationForce()
})

app.on('will-quit', () => {
  releaseDockReservationForce()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
