import { BrowserWindow, screen } from 'electron'
import { removeAppBar, reserveAppBar } from './appBarWin32'

export type DockEdge = 'none' | 'left' | 'right' | 'top'

export type DockResult = {
  ok: boolean
  platform: NodeJS.Platform
  edge: DockEdge
  mode: 'windows-appbar' | 'windows-overlay' | 'macos-overlay' | 'unsupported' | 'undocked'
  note?: string
  reserved?: boolean
}

/**
 * Dock Zarniwoop to a screen edge.
 * - Windows: SHAppBarMessage reserves work area so other windows maximize beside us.
 * - macOS: always-on-top overlay (OS does not expose work-area reservation to apps).
 */
export function applyDocking(win: BrowserWindow, edge: DockEdge): DockResult {
  const platform = process.platform

  if (edge === 'none') {
    removeAppBar(win)
    win.setAlwaysOnTop(false)
    win.setMovable(true)
    win.setResizable(true)
    return { ok: true, platform, edge, mode: 'undocked', reserved: false }
  }

  const display = screen.getDisplayMatching(win.getBounds())
  const { workArea } = display
  const strip = Math.min(420, Math.floor(workArea.width * 0.32))
  const topStrip = Math.min(320, Math.floor(workArea.height * 0.36))
  const thickness = edge === 'top' ? topStrip : strip

  let bounds = { x: workArea.x, y: workArea.y, width: strip, height: workArea.height }
  if (edge === 'right') {
    bounds = {
      x: workArea.x + workArea.width - strip,
      y: workArea.y,
      width: strip,
      height: workArea.height
    }
  } else if (edge === 'top') {
    bounds = {
      x: workArea.x,
      y: workArea.y,
      width: workArea.width,
      height: topStrip
    }
  }

  if (platform === 'win32') {
    const reserved = reserveAppBar(win, edge, thickness)
    if (reserved) {
      win.setAlwaysOnTop(true, 'screen-saver')
      win.setMovable(false)
      win.setResizable(false)
      win.setBounds(reserved)
      return {
        ok: true,
        platform,
        edge,
        mode: 'windows-appbar',
        reserved: true,
        note: 'AppBar active — other windows use the remaining work area.'
      }
    }

    // Fallback if FFI/AppBar fails: overlay on work area (windows may still go under).
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setMovable(false)
    win.setBounds(bounds)
    return {
      ok: true,
      platform,
      edge,
      mode: 'windows-overlay',
      reserved: false,
      note: 'AppBar unavailable; overlay only (windows may go underneath).'
    }
  }

  if (platform === 'darwin') {
    removeAppBar(win)
    win.setAlwaysOnTop(true, 'floating')
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    win.setBounds(bounds)
    return {
      ok: true,
      platform,
      edge,
      mode: 'macos-overlay',
      reserved: false,
      note:
        'macOS overlay dock — OS does not let apps shrink the work area. Windows AppBar reserves space on PC.'
    }
  }

  win.setBounds(bounds)
  return {
    ok: true,
    platform,
    edge,
    mode: 'unsupported',
    reserved: false,
    note: 'Basic edge snap only on this platform.'
  }
}

/** Drop work-area reservation without changing window chrome (e.g. before slide-expand). */
export function releaseDockReservation(win: BrowserWindow): void {
  removeAppBar(win)
}

/** Tiny always-on-top restore chip on the right edge. */
export function applyIconDock(win: BrowserWindow, bounds: {
  x: number
  y: number
  width: number
  height: number
}): DockResult {
  const platform = process.platform
  releaseDockReservation(win)

  if (platform === 'darwin') {
    win.setWindowButtonVisibility(false)
    win.setAlwaysOnTop(true, 'floating')
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  } else if (platform === 'win32') {
    win.setAlwaysOnTop(true, 'screen-saver')
    const reserved = reserveAppBar(win, 'right', bounds.width + 8)
    if (reserved) {
      win.setBounds({
        x: reserved.x,
        y: Math.round(reserved.y + reserved.height / 2 - bounds.height / 2),
        width: bounds.width,
        height: bounds.height
      })
      win.setMovable(true)
      win.setResizable(false)
      return {
        ok: true,
        platform,
        edge: 'right',
        mode: 'windows-appbar',
        reserved: true,
        note: 'Icon dock AppBar.'
      }
    }
  }

  win.setBounds(bounds)
  win.setMovable(true)
  win.setResizable(false)
  return {
    ok: true,
    platform,
    edge: 'right',
    mode: platform === 'darwin' ? 'macos-overlay' : 'unsupported',
    reserved: false,
    note: 'Icon dock overlay.'
  }
}
