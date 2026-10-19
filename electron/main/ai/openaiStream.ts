/** Shared OpenAI-compatible SSE chat streaming helpers. */

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export type StreamHandlers = {
  onDelta: (text: string) => void
  signal?: AbortSignal
}

export async function streamOpenAiChat(opts: {
  url: string
  apiKey?: string
  headers?: Record<string, string>
  body: Record<string, unknown>
  onDelta: (text: string) => void
  signal?: AbortSignal
}): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    ...opts.headers
  }
  if (opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`

  const res = await fetch(opts.url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...opts.body, stream: true }),
    signal: opts.signal
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 400) || res.statusText}`)
  }

  if (!res.body) {
    throw new Error('No response body for stream')
  }

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
      if (!trimmed || trimmed.startsWith(':')) continue
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') return
      try {
        const json = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>
        }
        const delta = json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.message?.content
        if (delta) opts.onDelta(delta)
      } catch {
        /* ignore malformed SSE chunk */
      }
    }
  }
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const timeoutMs = init?.timeoutMs ?? 4000
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      ...init,
      signal: init?.signal ?? ctrl.signal
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}
