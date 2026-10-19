import { BrowserWindow, screen, type Rectangle } from 'electron'
import { removeAppBar, reserveAppBar, setNativeBounds, removeAppBarForce } from './appBarWin32'

export type DockEdge = 'none' | 'left' | 'right' | 'top'

/** Keep in sync with windowMotion / createWindow companion width. */
const COMPANION_WIDTH = 400

export type DockResult = {
  ok: boolean
  platform: NodeJS.Platform
  edge: DockEdge
  mode: 'windows-appbar' | 'windows-overlay' | 'macos-overlay' | 'unsupported' | 'undocked'
  note?: string
  reserved?: boolean
}

/**
 * Edge strip in Electron screen space.
 * Use full monitor `bounds` for x (flush to screen edge).
 * Strip width must match the real window width (COMPANION_WIDTH) — using a
 * wider strip (e.g. 420) while the window stays 400 leaves a gap on the right.
 */
export function edgeStripBounds(
  win: BrowserWindow,
  edge: Exclude<DockEdge, 'none'>
): Rectangle {
  const display = screen.getDisplayMatching(win.getBounds())
  const { bounds: monitor, workArea } = display
  const strip = Math.min(COMPANION_WIDTH, Math.floor(monitor.width * 0.32))
  const topStrip = Math.min(320, Math.floor(monitor.height * 0.36))

  if (edge === 'right') {
    return {
      x: monitor.x + monitor.width - strip,
      y: workArea.y,
      width: strip,
      height: workArea.height
    }
  }
  if (edge === 'left') {
    return {
      x: monitor.x,
      y: workArea.y,
      width: strip,
      height: workArea.height
    }
  }
  return {
    x: monitor.x,
    y: monitor.y,
    width: monitor.width,
    height: topStrip
  }
}

/** Re-snap x so right/left edge is flush. Trust wanted width — never adopt a
 * fatter live width (DPI mis-scale used to inflate 400→600 and inset the strip). */
function flushEdge(
  win: BrowserWindow,
  edge: Exclude<DockEdge, 'none'>,
  wanted: Rectangle
): Rectangle {
  const monitor = screen.getDisplayMatching(win.getBounds()).bounds
  const width = Math.max(1, wanted.width)
  if (edge === 'right') {
    return {
      x: monitor.x + monitor.width - width,
      y: wanted.y,
      width,
      height: wanted.height
    }
  }
  if (edge === 'left') {
    return {
      x: monitor.x,
      y: wanted.y,
      width,
      height: wanted.height
    }
  }
  return wanted
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

  const bounds = edgeStripBounds(win, edge)
  const thickness = edge === 'top' ? bounds.height : bounds.width

  if (platform === 'win32') {
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setMovable(false)
    win.setResizable(false)

    // AppBar reserves OS work area so maximize/snap stop at our inner edge.
    // Free (restored) windows may still be dragged under the strip — intentional.
    const reserved = reserveAppBar(win, edge, thickness)
    if (reserved) {
      const display = screen.getDisplayMatching(win.getBounds())
      let place: Rectangle = { ...reserved }
      // Keep strip flush on x; use workArea for y/height so we don't cover the taskbar.
      if (edge === 'left' || edge === 'right') {
        place = {
          ...place,
          y: display.workArea.y,
          height: display.workArea.height
        }
      }
      place = flushEdge(win, edge, place)
      // Never win.setBounds here — Electron clamps into workArea and pulls the
      // strip inward once AppBar has reserved the edge.
      setNativeBounds(win, place)
      place = flushEdge(win, edge, place)
      setNativeBounds(win, place)
      // Re-assert after display-metrics clamp (same race as reserveAppBar).
      const edgeSnap = edge
      const placeSnap = { ...place }
      const snap = (): void => {
        if (win.isDestroyed()) return
        setNativeBounds(win, flushEdge(win, edgeSnap, placeSnap))
      }
      setImmediate(snap)
      setTimeout(snap, 50)
      setTimeout(snap, 250)

      const b = win.getBounds()
      console.log(
        `[zarniwoop] dock applied place=${place.x},${place.y} ${place.width}x${place.height} live=${b.x},${b.y} ${b.width}x${b.height}`
      )

      return {
        ok: true,
        platform,
        edge,
        mode: 'windows-appbar',
        reserved: true,
        note: 'AppBar reserved — maximize stops beside Zarniwoop.'
      }
    }

    // Fallback if Win32 AppBar API unavailable.
    removeAppBar(win)
    let place = bounds
    setNativeBounds(win, place)
    place = flushEdge(win, edge, place)
    setNativeBounds(win, place)

    return {
      ok: true,
      platform,
      edge,
      mode: 'windows-overlay',
      reserved: false,
      note: 'Docked to screen edge (overlay fallback).'
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

/** Quit / crash path — remove AppBar even if BrowserWindow already gone. */
export function releaseDockReservationForce(): void {
  removeAppBarForce()
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
    removeAppBar(win)
    setNativeBounds(win, bounds)
    win.setMovable(true)
    win.setResizable(false)
    return {
      ok: true,
      platform,
      edge: 'right',
      mode: 'windows-overlay',
      reserved: false,
      note: 'Icon dock overlay.'
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
