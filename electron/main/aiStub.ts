import { ipcMain } from 'electron'

/** Phase 1 stub — real free-first router arrives in Phase 2. */
export function registerAiStubIpc(): void {
  ipcMain.handle(
    'ai:send-prompt',
    async (_event, payload: { prompt: string; intent: string }) => {
      const prompt = String(payload?.prompt ?? '').trim()
      return {
        ok: true,
        routedTo: 'stub',
        intent: payload?.intent ?? 'local',
        reply:
          prompt.length === 0
            ? 'Say something — Phase 2 wires free-first local/cloud routing.'
            : `Zarniwoop heard you (Phase 1 stub, intent=${payload.intent}): ${prompt}`
      }
    }
  )

  ipcMain.handle('cdp:execute-action', async () => {
    return {
      ok: false,
      error: 'CDP automation lands in Phase 3'
    }
  })
}
