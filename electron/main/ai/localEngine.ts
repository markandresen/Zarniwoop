import { fetchJson, streamOpenAiChat, type ChatMessage } from './openaiStream'

export type LocalBackend = 'ollama' | 'openjarvis'

export type LocalModel = {
  id: string
  label: string
  provider: LocalBackend
  rawName: string
  small: boolean
}

const OLLAMA_BASE = 'http://127.0.0.1:11434'
const OPENJARVIS_BASE = 'http://127.0.0.1:8000'

const SMALL_HINTS = /(:?[1-3]b\b)|tiny|mini|phi|gemma:2b|qwen.*2b|qwen.*3b|llama.*3b/i

export type LocalStatus = {
  ollama: boolean
  openjarvis: boolean
  models: LocalModel[]
}

export async function probeLocalEngines(): Promise<LocalStatus> {
  const [ollamaModels, jarvisUp] = await Promise.all([listOllamaModels(), probeOpenJarvis()])
  const models = [...ollamaModels]
  if (jarvisUp.up) {
    // Prefer listing via OpenAI-compat /v1/models when available.
    const jarvisModels = jarvisUp.models
    if (jarvisModels.length > 0) {
      models.push(...jarvisModels)
    } else {
      models.push({
        id: 'openjarvis/default',
        label: 'OpenJarvis (default)',
        provider: 'openjarvis',
        rawName: 'default',
        small: true
      })
    }
  }
  return {
    ollama: ollamaModels.length > 0 || (await ping(`${OLLAMA_BASE}/api/tags`)),
    openjarvis: jarvisUp.up,
    models
  }
}

async function ping(url: string): Promise<boolean> {
  try {
    await fetchJson(url, { timeoutMs: 1500 })
    return true
  } catch {
    return false
  }
}

async function listOllamaModels(): Promise<LocalModel[]> {
  try {
    const data = await fetchJson<{ models?: Array<{ name: string }> }>(`${OLLAMA_BASE}/api/tags`, {
      timeoutMs: 2500
    })
    return (data.models ?? []).map((m) => {
      const name = m.name
      return {
        id: `ollama/${name}`,
        label: `${name} (Ollama)`,
        provider: 'ollama' as const,
        rawName: name,
        small: SMALL_HINTS.test(name)
      }
    })
  } catch {
    return []
  }
}

async function probeOpenJarvis(): Promise<{ up: boolean; models: LocalModel[] }> {
  try {
    const data = await fetchJson<{ data?: Array<{ id: string }> }>(`${OPENJARVIS_BASE}/v1/models`, {
      timeoutMs: 2000
    })
    const models = (data.data ?? []).map((m) => ({
      id: `openjarvis/${m.id}`,
      label: `${m.id} (OpenJarvis)`,
      provider: 'openjarvis' as const,
      rawName: m.id,
      small: SMALL_HINTS.test(m.id)
    }))
    return { up: true, models }
  } catch {
    // Server may be up without /v1/models — try root health lightly.
    try {
      const res = await fetch(`${OPENJARVIS_BASE}/v1/models`, {
        method: 'GET',
        signal: AbortSignal.timeout(1500)
      })
      return { up: res.ok || res.status === 401 || res.status === 404, models: [] }
    } catch {
      return { up: false, models: [] }
    }
  }
}

export function pickDefaultLocalModel(
  models: LocalModel[],
  preferSmall: boolean
): LocalModel | null {
  if (models.length === 0) return null
  const ollama = models.filter((m) => m.provider === 'ollama')
  const pool = ollama.length > 0 ? ollama : models
  if (preferSmall) {
    const small = pool.find((m) => m.small)
    if (small) return small
  }
  return pool[0] ?? null
}

export async function streamLocalChat(opts: {
  backend: LocalBackend
  model: string
  messages: ChatMessage[]
  onDelta: (text: string) => void
  signal?: AbortSignal
}): Promise<void> {
  const base = opts.backend === 'ollama' ? OLLAMA_BASE : OPENJARVIS_BASE
  await streamOpenAiChat({
    url: `${base}/v1/chat/completions`,
    body: {
      model: opts.model,
      messages: opts.messages
    },
    onDelta: opts.onDelta,
    signal: opts.signal
  })
}
