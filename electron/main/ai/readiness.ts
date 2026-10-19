import { getApiKey } from '../vault'
import { FREE_CLOUD_MODELS } from './catalog'
import { streamCloudChat } from './gateway'
import { probeLocalEngines, streamLocalChat, pickDefaultLocalModel } from './localEngine'
import { probeHardwareSync } from './hardware'
import type { ChatMessage } from './openaiStream'

export type Readiness = {
  ready: boolean
  localReady: boolean
  cloudReady: boolean
  reason: string
}

export async function getAiReadiness(): Promise<Readiness> {
  const local = await probeLocalEngines()
  const localReady = local.models.length > 0
  const cloudReady = FREE_CLOUD_MODELS.some((m) => Boolean(getApiKey(m.provider)))
  const ready = localReady || cloudReady
  let reason = 'Connect AI to chat — about 2 minutes.'
  if (localReady) reason = 'Ready on this computer.'
  else if (cloudReady) reason = 'Ready with free online AI.'
  return { ready, localReady, cloudReady, reason }
}

/** Tiny completion to verify a saved key or local engine. */
export async function testAiConnection(provider?: string): Promise<{ ok: boolean; message: string }> {
  const messages: ChatMessage[] = [
    { role: 'user', content: 'Reply with exactly: ok' }
  ]
  let collected = ''
  const onDelta = (d: string) => {
    collected += d
  }

  try {
    if (!provider || provider === 'ollama' || provider === 'local') {
      const local = await probeLocalEngines()
      const pick = pickDefaultLocalModel(local.models, probeHardwareSync().preferSmallLocal)
      if (!pick) {
        return {
          ok: false,
          message: 'No helper found on this computer yet. Install Ollama, then tap Check again.'
        }
      }
      await streamLocalChat({
        backend: pick.provider,
        model: pick.rawName,
        messages,
        onDelta
      })
      return { ok: true, message: 'Connected — AI works on this computer.' }
    }

    const key = getApiKey(provider)
    if (!key) {
      return { ok: false, message: 'Paste an access key first, then tap Save & test.' }
    }

    const catalogId =
      FREE_CLOUD_MODELS.find((m) => m.provider === provider)?.id ??
      (provider === 'xai'
        ? 'xai/grok-fast'
        : provider === 'anthropic'
          ? 'anthropic/claude-sonnet-4-20250514'
          : provider === 'openai'
            ? 'openai/gpt-4o-mini'
            : `${provider}/default`)

    await streamCloudChat({
      catalogId,
      messages,
      onDelta
    })

    if (!collected.trim()) {
      return { ok: false, message: 'Connected, but the service sent an empty reply. Try again.' }
    }
    return { ok: true, message: 'Connected — you are ready to chat.' }
  } catch (err) {
    return { ok: false, message: String(err) }
  }
}
