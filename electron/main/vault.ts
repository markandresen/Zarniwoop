import { app, ipcMain, safeStorage } from 'electron'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

type VaultFile = Record<string, string>

function vaultPath(): string {
  const dir = join(app.getPath('userData'), 'vault')
  mkdirSync(dir, { recursive: true })
  return join(dir, 'keys.json')
}

function readVault(): VaultFile {
  const path = vaultPath()
  if (!existsSync(path)) return {}
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as VaultFile
  } catch {
    return {}
  }
}

function writeVault(data: VaultFile): void {
  writeFileSync(vaultPath(), JSON.stringify(data, null, 2), 'utf8')
}

// No plaintext fallback: refuse to store or read keys without OS encryption.
function encrypt(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS encryption unavailable')
  }
  return safeStorage.encryptString(value).toString('base64')
}

function decrypt(encoded: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS encryption unavailable')
  }
  return safeStorage.decryptString(Buffer.from(encoded, 'base64'))
}

export function registerVaultIpc(): void {
  ipcMain.handle('vault:save-key', (_event, payload: { provider: string; key: string }) => {
    const provider = String(payload?.provider ?? '').trim()
    const key = String(payload?.key ?? '')
    if (!provider || !key) {
      return { ok: false, error: 'provider and key required' }
    }
    if (!safeStorage.isEncryptionAvailable()) {
      return { ok: false, error: 'Secure storage unavailable on this system; key not saved' }
    }
    const vault = readVault()
    vault[provider] = encrypt(key)
    writeVault(vault)
    return { ok: true }
  })

  ipcMain.handle('vault:has-key', (_event, provider: string) => {
    const vault = readVault()
    return Boolean(vault[String(provider)])
  })

  ipcMain.handle('vault:list-providers', () => {
    return Object.keys(readVault())
  })

  ipcMain.handle('vault:delete-key', (_event, provider: string) => {
    const vault = readVault()
    delete vault[String(provider)]
    writeVault(vault)
    return { ok: true }
  })
}

/** Main-process only — never expose raw keys to renderer. */
export function getApiKey(provider: string): string | null {
  const encoded = readVault()[provider]
  if (!encoded) return null
  try {
    return decrypt(encoded)
  } catch {
    return null
  }
}
