import { ipcMain, type WebContents } from 'electron'
import { randomUUID } from 'node:crypto'
import { probeHardware } from './hardware'
import { getAiReadiness, testAiConnection } from './readiness'
import {
  listModelsForUi,
  resolveRoute,
  runRoutedStream,
  type Intent
} from './router'
import type { ChatMessage } from './openaiStream'

type ActiveRequest = {
  controller: AbortController
  sender: WebContents
}

const active = new Map<string, ActiveRequest>()

function emitChunk(sender: WebContents, requestId: string, delta: string): void {
  if (sender.isDestroyed()) return
  sender.send('ai:stream-chunk', { requestId, delta })
}

function emitEnd(
  sender: WebContents,
  payload: { requestId: string; ok: boolean; error?: string; routedTo?: string; model?: string }
): void {
  if (sender.isDestroyed()) return
  sender.send('ai:stream-end', payload)
}

export function registerAiIpc(): void {
  void probeHardware()

  ipcMain.handle('ai:list-models', async () => {
    try {
      await probeHardware()
      return { ok: true, ...(await listModelsForUi()) }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('ai:get-readiness', async () => {
    try {
      return { ok: true, ...(await getAiReadiness()) }
    } catch (err) {
      return { ok: false, error: String(err), ready: false }
    }
  })

  ipcMain.handle('ai:test-connection', async (_event, provider?: string) => {
    try {
      return await testAiConnection(provider)
    } catch (err) {
      return { ok: false, message: String(err) }
    }
  })

  ipcMain.handle('ai:abort', (_event, requestId: string) => {
    const req = active.get(String(requestId))
    if (!req) return { ok: false, error: 'unknown request' }
    req.controller.abort()
    active.delete(String(requestId))
    return { ok: true }
  })

  ipcMain.handle(
    'ai:send-prompt',
    async (
      event,
      payload: {
        prompt: string
        intent?: Intent
        model?: string | null
        context?: unknown
        allowCrossTierFailover?: boolean
      }
    ) => {
      const prompt = String(payload?.prompt ?? '').trim()
      if (!prompt) {
        return { ok: false, error: 'prompt required' }
      }

      const intent: Intent =
        payload?.intent === 'fast' || payload?.intent === 'deep' || payload?.intent === 'local'
          ? payload.intent
          : 'fast'

      const requestId = randomUUID()
      const controller = new AbortController()
      const sender = event.sender
      active.set(requestId, { controller, sender })

      try {
        await probeHardware()
        const listed = await listModelsForUi()
        const route = resolveRoute({
          intent,
          modelPin: payload?.model,
          allowCrossTierFailover: Boolean(payload?.allowCrossTierFailover),
          local: listed.local,
          hardware: listed.hardware
        })

        const messages: ChatMessage[] = [
          {
            role: 'system',
            content:
              'You are Zarniwoop, a desktop AI companion. Be concise and helpful. Prefer free/local capability when discussing options.'
          },
          { role: 'user', content: prompt }
        ]

        setImmediate(() => {
          void (async () => {
            try {
              const finalRoute = await runRoutedStream({
                route,
                messages,
                onDelta: (delta) => emitChunk(sender, requestId, delta),
                signal: controller.signal,
                allowCrossTierFailover: Boolean(payload?.allowCrossTierFailover)
              })
              emitEnd(sender, {
                requestId,
                ok: true,
                routedTo: finalRoute.routedTo,
                model: finalRoute.modelId
              })
            } catch (err) {
              const aborted = controller.signal.aborted
              emitEnd(sender, {
                requestId,
                ok: false,
                error: aborted ? 'aborted' : String(err),
                routedTo: route.routedTo,
                model: route.modelId
              })
            } finally {
              active.delete(requestId)
            }
          })()
        })

        return {
          ok: true,
          requestId,
          routedTo: route.routedTo,
          model: route.modelId,
          provider: route.provider
        }
      } catch (err) {
        active.delete(requestId)
        return { ok: false, error: String(err) }
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
