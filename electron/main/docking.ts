import { BrowserWindow, screen } from 'electron'

export type DockEdge = 'none' | 'left' | 'right' | 'top'

export type DockResult = {
  ok: boolean
  platform: NodeJS.Platform
  edge: DockEdge
  mode: 'windows-workarea' | 'macos-overlay' | 'unsupported' | 'undocked'
  note?: string
}

/**
 * Phase 1 docking:
 * - Windows (primary): reserve against work area (AppBar-quality native SHAppBarMessage later).
 * - macOS: always-on-top overlay strip along an edge.
 */
export function applyDocking(win: BrowserWindow, edge: DockEdge): DockResult {
  const platform = process.platform

  if (edge === 'none') {
    win.setAlwaysOnTop(false)
    win.setMovable(true)
    win.setResizable(true)
    return { ok: true, platform, edge, mode: 'undocked' }
  }

  const display = screen.getDisplayMatching(win.getBounds())
  const { workArea } = display
  const strip = Math.min(420, Math.floor(workArea.width * 0.32))
  const topStrip = Math.min(320, Math.floor(workArea.height * 0.36))

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
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setMovable(false)
    win.setBounds(bounds)
    return {
      ok: true,
      platform,
      edge,
      mode: 'windows-workarea',
      note: 'Work-area dock. Native SHAppBarMessage screen reservation comes next.'
    }
  }

  if (platform === 'darwin') {
    win.setAlwaysOnTop(true, 'floating')
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    win.setBounds(bounds)
    return {
      ok: true,
      platform,
      edge,
      mode: 'macos-overlay',
      note: 'Overlay companion mode along edge.'
    }
  }

  win.setBounds(bounds)
  return {
    ok: true,
    platform,
    edge,
    mode: 'unsupported',
    note: 'Basic edge snap only on this platform.'
  }
}
