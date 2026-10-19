import {
  cloudCatalog,
  findCatalogEntry,
  FREE_CLOUD_MODELS,
  FRONTIER_MODELS,
  type CatalogEntry
} from './catalog'
import { providerHasKey, streamCloudChat } from './gateway'
import { probeHardwareSync, type HardwareProbe } from './hardware'
import {
  pickDefaultLocalModel,
  probeLocalEngines,
  streamLocalChat,
  type LocalModel,
  type LocalStatus
} from './localEngine'
import type { ChatMessage } from './openaiStream'

export type Intent = 'fast' | 'deep' | 'local'

export type RouteTarget = {
  routedTo: 'local' | 'free' | 'frontier'
  provider: string
  modelId: string
  /** Raw model name for API (without provider prefix for local). */
  apiModel: string
  backend?: 'ollama' | 'openjarvis'
}

export type ListModelsResult = {
  hardware: HardwareProbe
  local: LocalStatus
  cloud: Array<CatalogEntry & { available: boolean }>
  defaultModelId: string | null
}

export async function listModelsForUi(): Promise<ListModelsResult> {
  const hardware = probeHardwareSync()
  const local = await probeLocalEngines()
  const cloud = cloudCatalog().map((entry) => ({
    ...entry,
    available: providerHasKey(entry.provider)
  }))

  const defaultLocal = pickDefaultLocalModel(local.models, hardware.preferSmallLocal)
  let defaultModelId: string | null = defaultLocal?.id ?? null
  if (!defaultModelId) {
    const free = FREE_CLOUD_MODELS.find((m) => providerHasKey(m.provider))
    defaultModelId = free?.id ?? null
  }

  return { hardware, local, cloud, defaultModelId }
}

export function resolveRoute(opts: {
  intent: Intent
  modelPin?: string | null
  allowCrossTierFailover?: boolean
  local: LocalStatus
  hardware: HardwareProbe
}): RouteTarget {
  const pin = opts.modelPin?.trim() || null
  if (pin) {
    return resolvePinned(pin, opts.local)
  }

  // Intent local — stay local if possible.
  if (opts.intent === 'local') {
    const local = tryLocal(opts.local, opts.hardware, opts.intent)
    if (local) return local
  }

  // Free-first: local when capable, else free cloud, else frontier only if deep + key.
  if (opts.hardware.localCapable || opts.intent !== 'deep') {
    const local = tryLocal(opts.local, opts.hardware, opts.intent)
    if (local) return local
  }

  const free = tryFreeCloud(opts.intent)
  if (free) return free

  if (opts.intent === 'deep' || opts.allowCrossTierFailover) {
    const frontier = tryFrontier()
    if (frontier) return frontier
  }

  throw new Error(
    'No route available. Start Ollama (or OpenJarvis) for local, or save a free-tier API key in Settings.'
  )
}

function resolvePinned(pin: string, local: LocalStatus): RouteTarget {
  const localHit = local.models.find((m) => m.id === pin)
  if (localHit) {
    return {
      routedTo: 'local',
      provider: localHit.provider,
      modelId: localHit.id,
      apiModel: localHit.rawName,
      backend: localHit.provider
    }
  }

  const entry = findCatalogEntry(pin)
  if (!entry) {
    // Allow raw ollama/name even if probe missed it.
    if (pin.startsWith('ollama/')) {
      return {
        routedTo: 'local',
        provider: 'ollama',
        modelId: pin,
        apiModel: pin.slice('ollama/'.length),
        backend: 'ollama'
      }
    }
    if (pin.startsWith('openjarvis/')) {
      return {
        routedTo: 'local',
        provider: 'openjarvis',
        modelId: pin,
        apiModel: pin.slice('openjarvis/'.length),
        backend: 'openjarvis'
      }
    }
    throw new Error(`Unknown model: ${pin}`)
  }

  if (!providerHasKey(entry.provider)) {
    throw new Error(`No API key for ${entry.provider}`)
  }

  return {
    routedTo: entry.tier === 'free' ? 'free' : 'frontier',
    provider: entry.provider,
    modelId: entry.id,
    apiModel: entry.id.includes('/') ? entry.id.slice(entry.id.indexOf('/') + 1) : entry.id
  }
}

function tryLocal(
  local: LocalStatus,
  hardware: HardwareProbe,
  intent: Intent
): RouteTarget | null {
  if (local.models.length === 0) return null
  if (!hardware.localCapable && intent !== 'local') return null
  // On battery + deep intent: skip large local, fall through to cloud if possible.
  const preferSmall = hardware.preferSmallLocal || intent === 'fast'
  let pick: LocalModel | null = pickDefaultLocalModel(local.models, preferSmall)
  if (!pick) return null
  if (hardware.onBattery && !pick.small && intent === 'deep') {
    const small = local.models.find((m) => m.small)
    if (small) pick = small
    else return null
  }
  return {
    routedTo: 'local',
    provider: pick.provider,
    modelId: pick.id,
    apiModel: pick.rawName,
    backend: pick.provider
  }
}

function tryFreeCloud(intent: Intent): RouteTarget | null {
  const ordered =
    intent === 'fast'
      ? [...FREE_CLOUD_MODELS].sort((a, b) => Number(b.small) - Number(a.small))
      : FREE_CLOUD_MODELS
  for (const entry of ordered) {
    if (!providerHasKey(entry.provider)) continue
    return {
      routedTo: 'free',
      provider: entry.provider,
      modelId: entry.id,
      apiModel: entry.id.slice(entry.id.indexOf('/') + 1)
    }
  }
  return null
}

function tryFrontier(): RouteTarget | null {
  for (const entry of FRONTIER_MODELS) {
    if (!providerHasKey(entry.provider)) continue
    return {
      routedTo: 'frontier',
      provider: entry.provider,
      modelId: entry.id,
      apiModel: entry.id.slice(entry.id.indexOf('/') + 1)
    }
  }
  return null
}

export async function runRoutedStream(opts: {
  route: RouteTarget
  messages: ChatMessage[]
  onDelta: (text: string) => void
  signal?: AbortSignal
  allowCrossTierFailover?: boolean
}): Promise<RouteTarget> {
  const tryOnce = async (route: RouteTarget): Promise<void> => {
    if (route.routedTo === 'local') {
      await streamLocalChat({
        backend: route.backend ?? 'ollama',
        model: route.apiModel === 'default' ? 'qwen2.5:3b' : route.apiModel,
        messages: opts.messages,
        onDelta: opts.onDelta,
        signal: opts.signal
      })
      return
    }
    await streamCloudChat({
      catalogId: route.modelId,
      messages: opts.messages,
      onDelta: opts.onDelta,
      signal: opts.signal
    })
  }

  try {
    await tryOnce(opts.route)
    return opts.route
  } catch (err) {
    if (!opts.allowCrossTierFailover) throw err
    // Failover: next free, then frontier.
    const hardware = probeHardwareSync()
    const local = await probeLocalEngines()
    const next =
      tryFreeCloud('fast') ??
      (opts.route.routedTo !== 'frontier' ? tryFrontier() : null) ??
      tryLocal(local, hardware, 'fast')
    if (!next || next.modelId === opts.route.modelId) throw err
    await tryOnce(next)
    return next
  }
}
