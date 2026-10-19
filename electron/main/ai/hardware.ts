import { powerMonitor } from 'electron'
import { totalmem, freemem } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export type HardwareProbe = {
  totalRamGb: number
  freeRamGb: number
  /** Approximate free VRAM GB when detectable; null if unknown. */
  freeVramGb: number | null
  onBattery: boolean
  /** Enough headroom for a small local model by default. */
  localCapable: boolean
  /** Prefer tiny models only (battery or tight RAM). */
  preferSmallLocal: boolean
}

let cachedVram: { at: number; value: number | null } | null = null
const VRAM_TTL_MS = 60_000

async function probeNvidiaVramGb(): Promise<number | null> {
  const now = Date.now()
  if (cachedVram && now - cachedVram.at < VRAM_TTL_MS) return cachedVram.value
  try {
    const { stdout } = await execFileAsync(
      'nvidia-smi',
      ['--query-gpu=memory.free', '--format=csv,noheader,nounits'],
      { timeout: 2500, windowsHide: true }
    )
    const first = stdout
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find(Boolean)
    const mb = first ? Number.parseFloat(first) : NaN
    const value = Number.isFinite(mb) ? mb / 1024 : null
    cachedVram = { at: now, value }
    return value
  } catch {
    cachedVram = { at: now, value: null }
    return null
  }
}

export function isOnBattery(): boolean {
  try {
    return powerMonitor.isOnBatteryPower()
  } catch {
    return false
  }
}

/** Sync-ish probe used by router; VRAM may be stale from last async refresh. */
export function probeHardwareSync(): HardwareProbe {
  const totalRamGb = totalmem() / 1024 ** 3
  const freeRamGb = freemem() / 1024 ** 3
  const onBattery = isOnBattery()
  const freeVramGb = cachedVram?.value ?? null
  const preferSmallLocal = onBattery || freeRamGb < 6
  const localCapable =
    freeRamGb >= 3 || (freeVramGb !== null && freeVramGb >= 2) || totalRamGb >= 8

  return {
    totalRamGb: round1(totalRamGb),
    freeRamGb: round1(freeRamGb),
    freeVramGb: freeVramGb === null ? null : round1(freeVramGb),
    onBattery,
    localCapable,
    preferSmallLocal
  }
}

export async function probeHardware(): Promise<HardwareProbe> {
  await probeNvidiaVramGb()
  return probeHardwareSync()
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
