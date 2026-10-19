import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { getSetting, setSetting } from './db'
import { lockAppWindowNavigation } from './navGuard'
import {
  ICON_DOCK_SIZE,
  iconDockBounds,
  iconDockBoundsAtY,
  iconDockYFraction
} from './windowMotion'

const Y_FRACTION_KEY = 'iconDock.yFraction'

let dockWin: BrowserWindow | null = null

function readYFraction(): number {
  const raw = getSetting(Y_FRACTION_KEY)
  if (raw == null) return 0.5
  const n = Number(raw)
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.5
}

function dockAnchorBounds(from: BrowserWindow | null): {
  x: number
  y: number
  width: number
  height: number
} {
  const frac = readYFraction()
  if (from && !from.isDestroyed()) return iconDockBounds(from, frac)
  const { bounds: monitor, workArea } = screen.getPrimaryDisplay()
  const size = ICON_DOCK_SIZE
  const travel = Math.max(0, workArea.height - size)
  return {
    x: monitor.x + monitor.width - size - 10,
    y: workArea.y + Math.round(travel * frac),
    width: size,
    height: size
  }
}

/** Tiny transparent always-on-top orb chip — separate from opaque main window. */
export function showIconDock(anchor: BrowserWindow | null): BrowserWindow {
  const bounds = dockAnchorBounds(anchor)

  if (dockWin && !dockWin.isDestroyed()) {
    dockWin.setBounds(bounds)
    if (process.platform === 'win32') {
      dockWin.setAlwaysOnTop(true, 'screen-saver')
    } else {
      dockWin.setAlwaysOnTop(true, 'floating')
    }
    dockWin.show()
    return dockWin
  }

  dockWin = new BrowserWindow({
    ...bounds,
    width: ICON_DOCK_SIZE,
    height: ICON_DOCK_SIZE,
    minWidth: ICON_DOCK_SIZE,
    minHeight: ICON_DOCK_SIZE,
    maxWidth: ICON_DOCK_SIZE,
    maxHeight: ICON_DOCK_SIZE,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    title: 'Zarniwoop',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  if (process.platform === 'darwin') {
    dockWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    dockWin.setAlwaysOnTop(true, 'floating')
    dockWin.setWindowButtonVisibility(false)
  } else if (process.platform === 'win32') {
    dockWin.setAlwaysOnTop(true, 'screen-saver')
  } else {
    dockWin.setAlwaysOnTop(true)
  }

  // Custom vertical drag in renderer; keep movable so setPosition works on Win32.
  dockWin.setMovable(true)
  lockAppWindowNavigation(dockWin)

  if (process.env.ELECTRON_RENDERER_URL) {
    const base = process.env.ELECTRON_RENDERER_URL
    const joinChar = base.includes('?') ? '&' : '?'
    void dockWin.loadURL(`${base}${joinChar}iconDock=1`)
  } else {
    void dockWin.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { iconDock: '1' }
    })
  }

  dockWin.once('ready-to-show', () => {
    dockWin?.show()
  })

  dockWin.on('closed', () => {
    dockWin = null
  })

  return dockWin
}

export function hideIconDock(): void {
  if (!dockWin || dockWin.isDestroyed()) return
  dockWin.hide()
}

export function destroyIconDock(): void {
  if (!dockWin || dockWin.isDestroyed()) {
    dockWin = null
    return
  }
  dockWin.destroy()
  dockWin = null
}

export function getIconDockBounds(): {
  x: number
  y: number
  width: number
  height: number
} | null {
  if (!dockWin || dockWin.isDestroyed()) return null
  return dockWin.getBounds()
}

/** Move chip vertically; X stays pinned to right edge. */
export function moveIconDockToScreenY(screenY: number): {
  ok: boolean
  y: number
} {
  if (!dockWin || dockWin.isDestroyed()) return { ok: false, y: 0 }
  const next = iconDockBoundsAtY(dockWin, screenY)
  // setPosition — setBounds alone can no-op position when chrome fights it.
  dockWin.setPosition(next.x, next.y)
  return { ok: true, y: next.y }
}

/** Nudge from current bounds. */
export function moveIconDockByDelta(dy: number): { ok: boolean; y: number } {
  if (!dockWin || dockWin.isDestroyed()) return { ok: false, y: 0 }
  const cur = dockWin.getBounds()
  return moveIconDockToScreenY(cur.y + Math.round(dy))
}

/**
 * Pin window top so cursor stays at grabOffsetY inside the chip.
 * Uses main-process cursor point — correct under Win DPI.
 */
export function moveIconDockFollowCursor(grabOffsetY: number): {
  ok: boolean
  y: number
} {
  if (!dockWin || dockWin.isDestroyed()) return { ok: false, y: 0 }
  const point = screen.getCursorScreenPoint()
  return moveIconDockToScreenY(point.y - Math.round(grabOffsetY))
}

/** Persist current Y as fraction of work-area travel (survives resolution change). */
export function persistIconDockY(): { ok: boolean; yFraction: number } {
  if (!dockWin || dockWin.isDestroyed()) return { ok: false, yFraction: 0.5 }
  const frac = iconDockYFraction(dockWin.getBounds())
  setSetting(Y_FRACTION_KEY, String(frac))
  return { ok: true, yFraction: frac }
}
