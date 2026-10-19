import { BrowserWindow, screen } from 'electron'
import type { DockEdge } from './docking'

/**
 * Windows AppBar (SHAppBarMessage) + native window placement.
 *
 * Electron's getNativeWindowHandle() may be a child HWND. The top-level root
 * often lives in physical pixels while BrowserWindow bounds stay in Electron
 * screen space (commonly 2× apart at 200% DPI). We detect that ratio and scale
 * Win32 calls accordingly.
 */

const ABM_NEW = 0x00000000
const ABM_REMOVE = 0x00000001
const ABM_QUERYPOS = 0x00000002
const ABM_SETPOS = 0x00000003
const ABM_ACTIVATE = 0x00000006
const ABM_SETSTATE = 0x0000000a

const ABE_LEFT = 0
const ABE_TOP = 1
const ABE_RIGHT = 2

const ABS_ALWAYSONTOP = 0x0000002

const SWP_NOZORDER = 0x0004
const SWP_NOACTIVATE = 0x0010
const GA_ROOT = 2

const SPI_SETWORKAREA = 0x002f
const SPI_GETWORKAREA = 0x0030
const SPIF_UPDATE = 0x0001
const SPIF_SENDCHANGE = 0x0002

type Rect = { left: number; top: number; right: number; bottom: number }
type ElectronRect = { x: number; y: number; width: number; height: number }

type AppBarApi = {
  size: number
  is64: boolean
  SHAppBarMessage: (msg: number, data: Buffer) => unknown
  SetWindowPos: (
    hwnd: bigint,
    insertAfter: bigint,
    x: number,
    y: number,
    cx: number,
    cy: number,
    flags: number
  ) => boolean
  GetWindowRect: (hwnd: bigint, rect: Buffer) => boolean
  GetAncestor: (hwnd: bigint, flags: number) => bigint | number
  SystemParametersInfo: (
    action: number,
    uiParam: number,
    pvParam: Buffer,
    fWinIni: number
  ) => boolean
}

let api: AppBarApi | null | undefined
const registered = new WeakSet<BrowserWindow>()
/** Survives BrowserWindow GC — needed so quit can ABM_REMOVE after destroy. */
let lastAppBarHwnd: bigint | null = null
/** Last dock place per window — re-assert after Electron work-area clamp. */
const lastPlace = new WeakMap<
  BrowserWindow,
  { edge: Exclude<DockEdge, 'none'>; bounds: ElectronRect }
>()
let metricsHooked = false

function hookDisplayMetrics(): void {
  if (metricsHooked) return
  metricsHooked = true
  screen.on('display-metrics-changed', () => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed() || !registered.has(win)) continue
      const saved = lastPlace.get(win)
      if (!saved) continue
      const d = screen.getDisplayMatching(win.getBounds())
      let place = { ...saved.bounds }
      if (saved.edge === 'left' || saved.edge === 'right') {
        place = {
          x:
            saved.edge === 'right'
              ? d.bounds.x + d.bounds.width - place.width
              : d.bounds.x,
          y: d.workArea.y,
          width: place.width,
          height: d.workArea.height
        }
      }
      setNativeBounds(win, place)
    }
  })
}

function loadApi(): AppBarApi | null {
  if (api !== undefined) return api
  if (process.platform !== 'win32') {
    api = null
    return api
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const koffi = require('koffi') as typeof import('koffi')
    const shell32 = koffi.load('shell32.dll')
    const user32 = koffi.load('user32.dll')
    const is64 = process.arch !== 'ia32'
    const size = is64 ? 48 : 36
    api = {
      size,
      is64,
      SHAppBarMessage: shell32.func(
        'uintptr __stdcall SHAppBarMessage(uint32 dwMessage, void *pData)'
      ),
      SetWindowPos: user32.func(
        'bool __stdcall SetWindowPos(uintptr hWnd, uintptr hWndInsertAfter, int X, int Y, int cx, int cy, uint32 uFlags)'
      ),
      GetWindowRect: user32.func('bool __stdcall GetWindowRect(uintptr hWnd, void *lpRect)'),
      GetAncestor: user32.func('uintptr __stdcall GetAncestor(uintptr hwnd, uint32 gaFlags)'),
      SystemParametersInfo: user32.func(
        'bool __stdcall SystemParametersInfoW(uint32 uiAction, uint32 uiParam, void *pvParam, uint32 fWinIni)'
      )
    }
    return api
  } catch (err) {
    console.error('[zarniwoop] Failed to load Win32 AppBar API', err)
    api = null
    return api
  }
}

function asBigInt(value: bigint | number): bigint {
  return typeof value === 'bigint' ? value : BigInt(value)
}

function electronHwnd(win: BrowserWindow): bigint | null {
  try {
    const handle = win.getNativeWindowHandle()
    if (handle.byteLength >= 8) return handle.readBigUInt64LE(0)
    if (handle.byteLength >= 4) return BigInt(handle.readUInt32LE(0))
    return null
  } catch {
    return null
  }
}

/** Top-level HWND (AppBar + SetWindowPos target). */
function rootHwnd(win: BrowserWindow): bigint | null {
  const loaded = loadApi()
  const hwnd = electronHwnd(win)
  if (!loaded || hwnd === null) return hwnd
  try {
    const root = loaded.GetAncestor(hwnd, GA_ROOT)
    return root ? asBigInt(root) : hwnd
  } catch {
    return hwnd
  }
}

function readNativeRect(hwnd: bigint): ElectronRect | null {
  const loaded = loadApi()
  if (!loaded) return null
  const buf = Buffer.alloc(16)
  if (!loaded.GetWindowRect(hwnd, buf)) return null
  const left = buf.readInt32LE(0)
  const top = buf.readInt32LE(4)
  const right = buf.readInt32LE(8)
  const bottom = buf.readInt32LE(12)
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/**
 * DPI note (Electron on Windows @ 150%/200%):
 * - BrowserWindow / screen / setBounds use DIP
 * - GetWindowRect / SetWindowPos / SHAppBarMessage RECT use physical pixels
 *   (≈ DIP * display.scaleFactor)
 *
 * Never feed DIP*scale into AppBar when QUERYPOS already saw a mixed space —
 * instead: setBounds while work area is still full, then pass the live
 * GetWindowRect() to SHAppBarMessage unchanged.
 */

function measureScale(win: BrowserWindow, hwnd: bigint): number {
  const electron = win.getBounds()
  const native = readNativeRect(hwnd)
  if (native && electron.width > 8 && electron.height > 8) {
    const ratioW = native.width / electron.width
    const ratioH = native.height / electron.height
    const measured = (ratioW + ratioH) / 2
    if (Number.isFinite(measured) && measured > 0.5 && measured < 4.5) {
      if (measured < 1.15) return 1
      return Math.round(measured * 100) / 100
    }
  }
  return screen.getDisplayMatching(electron).scaleFactor || 1
}

function toNativeRect(bounds: ElectronRect, scale: number): Rect {
  const x = Math.round(bounds.x * scale)
  const y = Math.round(bounds.y * scale)
  const w = Math.round(bounds.width * scale)
  const h = Math.round(bounds.height * scale)
  return { left: x, top: y, right: x + w, bottom: y + h }
}

function toElectron(rc: Rect, scale: number): ElectronRect {
  return {
    x: Math.round(rc.left / scale),
    y: Math.round(rc.top / scale),
    width: Math.max(1, Math.round((rc.right - rc.left) / scale)),
    height: Math.max(1, Math.round((rc.bottom - rc.top) / scale))
  }
}

const HWND_TOPMOST = -1n
const SWP_SHOWWINDOW = 0x0040

/**
 * Move top-level HWND using physical pixels (GetWindowRect space).
 * Prefer display.scaleFactor for writes — measured ratio can drift while Electron
 * is mid-clamp into the work area.
 */
export function setNativeBounds(win: BrowserWindow, bounds: ElectronRect): boolean {
  const loaded = loadApi()
  const hwnd = rootHwnd(win)
  if (!loaded || hwnd === null) return false

  const sf = screen.getDisplayMatching(bounds).scaleFactor || 1
  const measured = measureScale(win, hwnd)
  // Prefer scaleFactor when it matches measured; else try both.
  const scales =
    Math.abs(measured - sf) < 0.2 ? [sf] : [sf, measured, 1].filter((v, i, a) => a.indexOf(v) === i)

  for (const scale of scales) {
    const rc = toNativeRect(bounds, scale)
    loaded.SetWindowPos(
      hwnd,
      HWND_TOPMOST,
      rc.left,
      rc.top,
      rc.right - rc.left,
      rc.bottom - rc.top,
      SWP_NOACTIVATE | SWP_SHOWWINDOW
    )
    const got = win.getBounds()
    if (
      Math.abs(got.x - bounds.x) <= 24 &&
      Math.abs(got.width - bounds.width) <= 32
    ) {
      return true
    }
  }
  return false
}

function writeAppBarData(
  buf: Buffer,
  loaded: AppBarApi,
  hwnd: bigint,
  edge: number,
  rc: Rect,
  lParam = 0
): void {
  buf.fill(0)
  buf.writeUInt32LE(loaded.size, 0)
  if (loaded.is64) {
    buf.writeBigUInt64LE(asBigInt(hwnd), 8)
    buf.writeUInt32LE(0, 16)
    buf.writeUInt32LE(edge >>> 0, 20)
    buf.writeInt32LE(rc.left, 24)
    buf.writeInt32LE(rc.top, 28)
    buf.writeInt32LE(rc.right, 32)
    buf.writeInt32LE(rc.bottom, 36)
    buf.writeBigInt64LE(BigInt(lParam), 40)
  } else {
    buf.writeUInt32LE(Number(asBigInt(hwnd) & 0xffffffffn), 4)
    buf.writeUInt32LE(0, 8)
    buf.writeUInt32LE(edge >>> 0, 12)
    buf.writeInt32LE(rc.left, 16)
    buf.writeInt32LE(rc.top, 20)
    buf.writeInt32LE(rc.right, 24)
    buf.writeInt32LE(rc.bottom, 28)
    buf.writeInt32LE(lParam, 32)
  }
}

function readRect(buf: Buffer, loaded: AppBarApi): Rect {
  const o = loaded.is64 ? 24 : 16
  return {
    left: buf.readInt32LE(o),
    top: buf.readInt32LE(o + 4),
    right: buf.readInt32LE(o + 8),
    bottom: buf.readInt32LE(o + 12)
  }
}

function edgeCode(edge: Exclude<DockEdge, 'none'>): number | null {
  if (edge === 'left') return ABE_LEFT
  if (edge === 'right') return ABE_RIGHT
  if (edge === 'top') return ABE_TOP
  return null
}

function proposeRectElectron(
  edge: Exclude<DockEdge, 'none'>,
  thickness: number,
  win: BrowserWindow
): ElectronRect {
  const display = screen.getDisplayMatching(win.getBounds())
  const { x, y, width, height } = display.bounds
  const t = Math.max(1, Math.round(thickness))
  if (edge === 'right') return { x: x + width - t, y, width: t, height }
  if (edge === 'left') return { x, y, width: t, height }
  return { x, y, width, height: t }
}

function reapplyThickness(edge: Exclude<DockEdge, 'none'>, thickness: number, rc: Rect): Rect {
  const next = { ...rc }
  const t = Math.max(1, Math.round(thickness))
  if (edge === 'right') next.left = next.right - t
  else if (edge === 'left') next.right = next.left + t
  else next.bottom = next.top + t
  return next
}

function send(msg: number, hwnd: bigint, edge: number, rc: Rect, lParam = 0): Rect | null {
  const loaded = loadApi()
  if (!loaded) return null
  const buf = Buffer.alloc(loaded.size)
  writeAppBarData(buf, loaded, hwnd, edge, rc, lParam)
  loaded.SHAppBarMessage(msg, buf)
  return readRect(buf, loaded)
}

function readSpiWorkArea(): Rect | null {
  const loaded = loadApi()
  if (!loaded) return null
  const buf = Buffer.alloc(16)
  if (!loaded.SystemParametersInfo(SPI_GETWORKAREA, 0, buf, 0)) return null
  return {
    left: buf.readInt32LE(0),
    top: buf.readInt32LE(4),
    right: buf.readInt32LE(8),
    bottom: buf.readInt32LE(12)
  }
}

function writeSpiWorkArea(rc: Rect): boolean {
  const loaded = loadApi()
  if (!loaded) return false
  const buf = Buffer.alloc(16)
  buf.writeInt32LE(rc.left, 0)
  buf.writeInt32LE(rc.top, 4)
  buf.writeInt32LE(rc.right, 8)
  buf.writeInt32LE(rc.bottom, 12)
  return Boolean(
    loaded.SystemParametersInfo(SPI_SETWORKAREA, 0, buf, SPIF_UPDATE | SPIF_SENDCHANGE)
  )
}

/**
 * Expand work area on the dock edge if a prior (ghost) AppBar left an inset.
 * Prevents double-reserve: [apps][empty 400][Zarniwoop 400] after restart.
 * SPI work area is primary-display; matches our primary-dock MVP.
 */
function reclaimStaleDockInset(
  edge: Exclude<DockEdge, 'none'>,
  thickness: number
): void {
  const work = readSpiWorkArea()
  if (!work) return
  const primary = screen.getPrimaryDisplay()
  const mon = primary.bounds
  const t = Math.max(1, Math.round(thickness))
  const next = { ...work }
  let changed = false

  if (edge === 'right') {
    const inset = mon.x + mon.width - work.right
    if (inset >= t * 0.5) {
      next.right = mon.x + mon.width
      changed = true
    }
  } else if (edge === 'left') {
    const inset = work.left - mon.x
    if (inset >= t * 0.5) {
      next.left = mon.x
      changed = true
    }
  } else if (edge === 'top') {
    const inset = work.top - mon.y
    if (inset >= t * 0.5) {
      next.top = mon.y
      changed = true
    }
  }

  if (changed) {
    writeSpiWorkArea(next)
    console.log(
      `[zarniwoop] reclaimed stale ${edge} work-area inset (was ${JSON.stringify(work)} now ${JSON.stringify(next)})`
    )
  }
}

function abmRemoveHwnd(hwnd: bigint): void {
  send(ABM_REMOVE, hwnd, 0, { left: 0, top: 0, right: 0, bottom: 0 })
}

/**
 * Flush approved AppBar rect to the monitor edge in Electron space.
 * After reservation, Electron workArea excludes the strip — callers must not
 * trust workArea for x; keep physical flush via monitor.bounds.
 */
function flushToMonitorEdge(
  edge: Exclude<DockEdge, 'none'>,
  place: ElectronRect,
  win: BrowserWindow
): ElectronRect {
  const monitor = screen.getDisplayMatching(win.getBounds()).bounds
  if (edge === 'right') {
    return {
      x: monitor.x + monitor.width - place.width,
      y: place.y,
      width: place.width,
      height: place.height
    }
  }
  if (edge === 'left') {
    return {
      x: monitor.x,
      y: place.y,
      width: place.width,
      height: place.height
    }
  }
  return {
    x: place.x,
    y: monitor.y,
    width: place.width,
    height: place.height
  }
}

/**
 * Register / update AppBar reservation.
 * Returns approved bounds in Electron screen space (flush to monitor edge).
 *
 * Reliable DPI order:
 * 1. Electron setBounds to monitor-edge strip WHILE work area is still full
 * 2. Read GetWindowRect (physical) — feed that RECT straight to SHAppBarMessage
 * 3. Do not convert DIP↔physical by hand for AppBar
 * 4. After reserve, only SetWindowPos (never setBounds — clamps into workArea)
 */
export function reserveAppBar(
  win: BrowserWindow,
  edge: Exclude<DockEdge, 'none'>,
  thickness: number
): ElectronRect | null {
  if (process.platform !== 'win32' || win.isDestroyed()) return null
  const loaded = loadApi()
  const hwnd = rootHwnd(win)
  const uEdge = edgeCode(edge)
  if (!loaded || hwnd === null || uEdge === null) return null

  // Drop any prior registration for this HWND, then reclaim ghost insets from
  // a previous process that quit without ABM_REMOVE (double work-area gap).
  abmRemoveHwnd(hwnd)
  if (lastAppBarHwnd !== null && lastAppBarHwnd !== hwnd) {
    abmRemoveHwnd(lastAppBarHwnd)
  }
  registered.delete(win)
  lastAppBarHwnd = null
  reclaimStaleDockInset(edge, thickness)

  const display = screen.getDisplayMatching(win.getBounds())
  const proposed = proposeRectElectron(edge, thickness, win)
  // Prefer workArea vertical extent so we don't cover the taskbar strip.
  if (edge === 'left' || edge === 'right') {
    proposed.y = display.workArea.y
    proposed.height = display.workArea.height
  }

  // 1. Place with Electron before work area shrinks (setBounds allowed here).
  try {
    win.setBounds(proposed)
  } catch {
    /* ignore */
  }
  setNativeBounds(win, proposed)

  send(ABM_NEW, hwnd, uEdge, { left: 0, top: 0, right: 0, bottom: 0 })
  registered.add(win)
  lastAppBarHwnd = hwnd
  hookDisplayMetrics()

  // 2. AppBar RECT = live physical GetWindowRect (no DIP math).
  const native = readNativeRect(hwnd)
  if (!native) {
    removeAppBar(win)
    return null
  }
  let rc: Rect = {
    left: native.x,
    top: native.y,
    right: native.x + native.width,
    bottom: native.y + native.height
  }
  const scale = measureScale(win, hwnd)
  const queried = send(ABM_QUERYPOS, hwnd, uEdge, rc)
  if (queried) rc = reapplyThickness(edge, Math.round(thickness * scale), queried)
  const set = send(ABM_SETPOS, hwnd, uEdge, rc)
  if (set) rc = set
  send(ABM_SETSTATE, hwnd, uEdge, rc, ABS_ALWAYSONTOP)
  send(ABM_ACTIVATE, hwnd, uEdge, rc, 1)

  // 3. Stay flush on monitor edge in Electron space; SetWindowPos only.
  const t = Math.max(1, Math.round(thickness))
  let electron = flushToMonitorEdge(edge, { ...proposed, width: t }, win)
  if (edge === 'left' || edge === 'right') {
    electron = {
      ...electron,
      width: t,
      y: display.workArea.y,
      height: display.workArea.height
    }
    electron = flushToMonitorEdge(edge, electron, win)
  }
  setNativeBounds(win, electron)

  lastPlace.set(win, { edge, bounds: { ...electron } })

  // Electron reacts to work-area change and clamps the window into the new
  // workArea (strip slides left). Re-assert physical edge after the shell settles.
  const snap = (): void => {
    if (win.isDestroyed() || !registered.has(win)) return
    const again = flushToMonitorEdge(edge, { ...electron, width: t }, win)
    if (edge === 'left' || edge === 'right') {
      const d = screen.getDisplayMatching(win.getBounds())
      const place = {
        x: again.x,
        y: d.workArea.y,
        width: t,
        height: d.workArea.height
      }
      lastPlace.set(win, { edge, bounds: place })
      setNativeBounds(win, place)
    } else {
      lastPlace.set(win, { edge, bounds: again })
      setNativeBounds(win, again)
    }
  }
  setImmediate(snap)
  setTimeout(snap, 50)
  setTimeout(() => {
    snap()
    if (!win.isDestroyed()) {
      const b = win.getBounds()
      console.log(
        `[zarniwoop] appbar after-snap live=${b.x},${b.y} ${b.width}x${b.height}`
      )
    }
  }, 250)

  const live = win.getBounds()
  const hwndRect = readNativeRect(hwnd)
  console.log(
    `[zarniwoop] appbar scale=${scale}` +
      ` place=${electron.x},${electron.y} ${electron.width}x${electron.height}` +
      ` live=${live.x},${live.y} ${live.width}x${live.height}` +
      (hwndRect
        ? ` hwnd=${hwndRect.x},${hwndRect.y} ${hwndRect.width}x${hwndRect.height}`
        : '')
  )
  return electron
}

export function removeAppBar(win: BrowserWindow): void {
  if (process.platform !== 'win32') return
  const hwnd =
    !win.isDestroyed() ? rootHwnd(win) : lastAppBarHwnd
  const target = hwnd ?? lastAppBarHwnd
  if (target !== null) {
    abmRemoveHwnd(target)
  }
  if (lastAppBarHwnd !== null && lastAppBarHwnd !== target) {
    abmRemoveHwnd(lastAppBarHwnd)
  }
  lastAppBarHwnd = null
  if (!win.isDestroyed()) {
    registered.delete(win)
    lastPlace.delete(win)
  }
}

/** Best-effort AppBar teardown without a live BrowserWindow (quit / crash path). */
export function removeAppBarForce(): void {
  if (process.platform !== 'win32') return
  if (lastAppBarHwnd !== null) {
    abmRemoveHwnd(lastAppBarHwnd)
    lastAppBarHwnd = null
  }
  // Reclaim primary right inset up to companion width if a ghost remains.
  reclaimStaleDockInset('right', 400)
}

export function appBarSupported(): boolean {
  return process.platform === 'win32' && loadApi() !== null
}
