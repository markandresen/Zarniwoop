import { BrowserWindow, screen } from 'electron'
import type { DockEdge } from './docking'

/**
 * Windows AppBar (SHAppBarMessage) — shrinks the system work area so other
 * windows maximize/tile beside Zarniwoop instead of under it.
 *
 * No-op on non-Windows (macOS cannot reserve desktop work area for 3rd-party apps).
 */

const ABM_NEW = 0x00000000
const ABM_REMOVE = 0x00000001
const ABM_QUERYPOS = 0x00000002
const ABM_SETPOS = 0x00000003
const ABM_ACTIVATE = 0x00000006

const ABE_LEFT = 0
const ABE_TOP = 1
const ABE_RIGHT = 2

type Rect = { left: number; top: number; right: number; bottom: number }

type AppBarApi = {
  size: number
  is64: boolean
  SHAppBarMessage: (msg: number, data: Buffer) => unknown
}

let api: AppBarApi | null | undefined
const registered = new WeakSet<BrowserWindow>()

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
    const is64 = process.arch !== 'ia32'
    // Pack manually — koffi struct packing differs by host; Win ABI is fixed.
    const size = is64 ? 48 : 36
    const SHAppBarMessage = shell32.func(
      'uintptr __stdcall SHAppBarMessage(uint32 dwMessage, void *pData)'
    )
    api = { size, is64, SHAppBarMessage }
    return api
  } catch (err) {
    console.error('[zarniwoop] Failed to load Win32 AppBar API', err)
    api = null
    return api
  }
}

function hwndOf(win: BrowserWindow): bigint | null {
  try {
    const handle = win.getNativeWindowHandle()
    if (handle.byteLength >= 8) return handle.readBigUInt64LE(0)
    if (handle.byteLength >= 4) return BigInt(handle.readUInt32LE(0))
    return null
  } catch {
    return null
  }
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
    buf.writeBigUInt64LE(hwnd, 8)
    buf.writeUInt32LE(0, 16) // uCallbackMessage
    buf.writeUInt32LE(edge >>> 0, 20)
    buf.writeInt32LE(rc.left, 24)
    buf.writeInt32LE(rc.top, 28)
    buf.writeInt32LE(rc.right, 32)
    buf.writeInt32LE(rc.bottom, 36)
    buf.writeBigInt64LE(BigInt(lParam), 40)
  } else {
    buf.writeUInt32LE(Number(hwnd & 0xffffffffn), 4)
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

function proposeRect(edge: Exclude<DockEdge, 'none'>, thickness: number, win: BrowserWindow): Rect {
  const display = screen.getDisplayMatching(win.getBounds())
  // Full monitor bounds (not workArea) — QUERYPOS adjusts for taskbar/other bars.
  const { x, y, width, height } = display.bounds
  if (edge === 'right') {
    return { left: x + width - thickness, top: y, right: x + width, bottom: y + height }
  }
  if (edge === 'left') {
    return { left: x, top: y, right: x + thickness, bottom: y + height }
  }
  return { left: x, top: y, right: x + width, bottom: y + thickness }
}

function reapplyThickness(edge: Exclude<DockEdge, 'none'>, thickness: number, rc: Rect): Rect {
  const next = { ...rc }
  if (edge === 'right') next.left = next.right - thickness
  else if (edge === 'left') next.right = next.left + thickness
  else next.bottom = next.top + thickness
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

/** Register / update AppBar reservation. Returns approved Electron bounds, or null. */
export function reserveAppBar(
  win: BrowserWindow,
  edge: Exclude<DockEdge, 'none'>,
  thickness: number
): { x: number; y: number; width: number; height: number } | null {
  if (process.platform !== 'win32' || win.isDestroyed()) return null
  const loaded = loadApi()
  const hwnd = hwndOf(win)
  const uEdge = edgeCode(edge)
  if (!loaded || hwnd === null || uEdge === null) return null

  if (!registered.has(win)) {
    send(ABM_NEW, hwnd, uEdge, { left: 0, top: 0, right: 0, bottom: 0 })
    registered.add(win)
  }

  let rc = proposeRect(edge, thickness, win)
  const queried = send(ABM_QUERYPOS, hwnd, uEdge, rc)
  if (queried) rc = reapplyThickness(edge, thickness, queried)
  const set = send(ABM_SETPOS, hwnd, uEdge, rc)
  if (set) rc = set
  send(ABM_ACTIVATE, hwnd, uEdge, rc, 1)

  return {
    x: rc.left,
    y: rc.top,
    width: Math.max(1, rc.right - rc.left),
    height: Math.max(1, rc.bottom - rc.top)
  }
}

/** Release work-area reservation (required on undock / quit). */
export function removeAppBar(win: BrowserWindow): void {
  if (process.platform !== 'win32' || win.isDestroyed()) return
  if (!registered.has(win)) return
  const hwnd = hwndOf(win)
  if (hwnd === null) return
  send(ABM_REMOVE, hwnd, 0, { left: 0, top: 0, right: 0, bottom: 0 })
  registered.delete(win)
}

export function appBarSupported(): boolean {
  return process.platform === 'win32' && loadApi() !== null
}
