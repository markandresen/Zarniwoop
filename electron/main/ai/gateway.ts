import { getApiKey } from '../vault'
import { parseModelId } from './catalog'
import { streamOpenAiChat, type ChatMessage } from './openaiStream'

type ProviderConfig = {
  baseUrl: string
  /** Path after base for chat completions. */
  chatPath: string
  headerStyle: 'bearer' | 'google-key' | 'anthropic'
}

const PROVIDERS: Record<string, ProviderConfig> = {
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    chatPath: '/chat/completions',
    headerStyle: 'bearer'
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    chatPath: '/chat/completions',
    headerStyle: 'bearer'
  },
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    chatPath: '/chat/completions',
    headerStyle: 'bearer'
  },
  xai: {
    baseUrl: 'https://api.x.ai/v1',
    chatPath: '/chat/completions',
    headerStyle: 'bearer'
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    chatPath: '/chat/completions',
    headerStyle: 'bearer'
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    chatPath: '/messages',
    headerStyle: 'anthropic'
  }
}

export function providerHasKey(provider: string): boolean {
  return Boolean(getApiKey(provider))
}

export async function streamCloudChat(opts: {
  catalogId: string
  messages: ChatMessage[]
  onDelta: (text: string) => void
  signal?: AbortSignal
}): Promise<{ provider: string; model: string }> {
  const { provider, model } = parseModelId(opts.catalogId)
  const cfg = PROVIDERS[provider]
  if (!cfg) throw new Error(`Unknown provider: ${provider}`)

  const apiKey = getApiKey(provider)
  if (!apiKey) throw new Error(`No API key for ${provider}`)

  if (provider === 'anthropic') {
    await streamAnthropic({
      apiKey,
      model,
      messages: opts.messages,
      onDelta: opts.onDelta,
      signal: opts.signal
    })
    return { provider, model }
  }

  const headers: Record<string, string> = {}
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://zarniwoop.local'
    headers['X-Title'] = 'Zarniwoop'
  }

  await streamOpenAiChat({
    url: `${cfg.baseUrl}${cfg.chatPath}`,
    apiKey,
    headers,
    body: {
      model,
      messages: opts.messages
    },
    onDelta: opts.onDelta,
    signal: opts.signal
  })

  return { provider, model }
}

async function streamAnthropic(opts: {
  apiKey: string
  model: string
  messages: ChatMessage[]
  onDelta: (text: string) => void
  signal?: AbortSignal
}): Promise<void> {
  const system = opts.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n')
  const messages = opts.messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }))

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': opts.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 4096,
      stream: true,
      system: system || undefined,
      messages
    }),
    signal: opts.signal
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 400) || res.statusText}`)
  }
  if (!res.body) throw new Error('No response body for stream')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (!data || data === '[DONE]') continue
      try {
        const json = JSON.parse(data) as {
          type?: string
          delta?: { type?: string; text?: string }
        }
        if (json.type === 'content_block_delta' && json.delta?.text) {
          opts.onDelta(json.delta.text)
        }
      } catch {
        /* ignore */
      }
    }
  }
}
