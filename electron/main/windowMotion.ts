import { BrowserWindow, screen, type Rectangle } from 'electron'

const COMPANION_WIDTH = 400
const WORKSPACE_WIDTH = 1280
const WORKSPACE_MIN_WIDTH = 900
const ICON_DOCK_SIZE = 64
const ICON_DOCK_MARGIN = 10

let animToken = 0

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function companionBounds(win: BrowserWindow): Rectangle {
  const current = win.getBounds()
  // Full monitor bounds for x — workArea excludes AppBar strip and insets the window.
  const { bounds: monitor, workArea } = screen.getDisplayMatching(current)
  const width = Math.min(COMPANION_WIDTH, Math.floor(monitor.width * 0.32))
  return {
    x: monitor.x + monitor.width - width,
    y: workArea.y,
    width,
    height: workArea.height
  }
}

export function iconDockBounds(
  win: BrowserWindow,
  yFraction = 0.5
): Rectangle {
  const current = win.getBounds()
  const { bounds: monitor, workArea } = screen.getDisplayMatching(current)
  const size = ICON_DOCK_SIZE
  const frac = Number.isFinite(yFraction) ? Math.min(1, Math.max(0, yFraction)) : 0.5
  const travel = Math.max(0, workArea.height - size)
  return {
    x: monitor.x + monitor.width - size - ICON_DOCK_MARGIN,
    y: workArea.y + Math.round(travel * frac),
    width: size,
    height: size
  }
}

/** Clamp icon dock to right edge; Y stays inside work area. */
export function iconDockBoundsAtY(
  win: BrowserWindow | null,
  screenY: number
): Rectangle {
  const anchor =
    win && !win.isDestroyed()
      ? win.getBounds()
      : screen.getPrimaryDisplay().bounds
  const { bounds: monitor, workArea } = screen.getDisplayMatching(anchor)
  const size = ICON_DOCK_SIZE
  const minY = workArea.y
  const maxY = workArea.y + Math.max(0, workArea.height - size)
  return {
    x: monitor.x + monitor.width - size - ICON_DOCK_MARGIN,
    y: Math.round(Math.min(maxY, Math.max(minY, screenY))),
    width: size,
    height: size
  }
}

export function iconDockYFraction(bounds: Rectangle): number {
  const { workArea } = screen.getDisplayMatching(bounds)
  const travel = Math.max(1, workArea.height - bounds.height)
  return Math.min(1, Math.max(0, (bounds.y - workArea.y) / travel))
}

function workspaceBounds(win: BrowserWindow): Rectangle {
  const current = win.getBounds()
  const { workArea } = screen.getDisplayMatching(current)
  const width = Math.min(workArea.width, Math.max(WORKSPACE_MIN_WIDTH, WORKSPACE_WIDTH))
  const height = Math.min(workArea.height, Math.max(current.height, 800))
  const right = current.x + current.width
  return {
    x: Math.max(workArea.x, right - width),
    y: Math.min(current.y, workArea.y + workArea.height - height),
    width,
    height
  }
}

export function animateBounds(
  win: BrowserWindow,
  to: Rectangle,
  durationMs = 320
): Promise<void> {
  const token = ++animToken
  const from = win.getBounds()
  const started = Date.now()

  return new Promise((resolve) => {
    const tick = (): void => {
      if (token !== animToken || win.isDestroyed()) {
        resolve()
        return
      }
      const t = Math.min(1, (Date.now() - started) / durationMs)
      const e = easeOutCubic(t)
      win.setBounds({
        x: Math.round(from.x + (to.x - from.x) * e),
        y: Math.round(from.y + (to.y - from.y) * e),
        width: Math.round(from.width + (to.width - from.width) * e),
        height: Math.round(from.height + (to.height - from.height) * e)
      })
      if (t < 1) {
        setTimeout(tick, 16)
      } else {
        resolve()
      }
    }
    tick()
  })
}

export async function slideBrowserOut(win: BrowserWindow): Promise<void> {
  win.setAlwaysOnTop(false)
  win.setMovable(true)
  win.setResizable(true)
  await animateBounds(win, workspaceBounds(win))
}

export async function slideBrowserIn(win: BrowserWindow): Promise<void> {
  win.setResizable(true)
  win.setMovable(true)
  await animateBounds(win, companionBounds(win))
}

export async function slideToIconDock(win: BrowserWindow): Promise<void> {
  win.setMinimumSize(ICON_DOCK_SIZE, ICON_DOCK_SIZE)
  win.setResizable(false)
  win.setMovable(true)
  await animateBounds(win, iconDockBounds(win), 280)
}

export { COMPANION_WIDTH, WORKSPACE_MIN_WIDTH, WORKSPACE_WIDTH, ICON_DOCK_SIZE }
