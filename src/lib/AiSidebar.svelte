<script lang="ts">
  import { onMount } from 'svelte'
  import StatusOrb from './StatusOrb.svelte'
  import AiSetupPanel from './AiSetupPanel.svelte'
  import { formatAiError, routeLabel } from './aiErrors'

  type Msg = { role: 'user' | 'assistant'; text: string; streaming?: boolean }
  type Props = { onCollapse: () => void }

  let { onCollapse }: Props = $props()

  let messages = $state<Msg[]>([
    {
      role: 'assistant',
      text: 'Hi — ask me anything. If AI is not connected yet, tap Set up AI (about 2 minutes).'
    }
  ])
  let draft = $state('')
  let busy = $state(false)
  let routeBadge = $state('Auto')
  let activeRequestId = $state<string | null>(null)
  let aiReady = $state(false)
  let showSetup = $state(false)
  let showBanner = $state(false)

  async function refreshReady(): Promise<void> {
    const readyRes = await window.zarniwoop.getAiReadiness()
    aiReady = Boolean(readyRes?.ready)
    showBanner = !aiReady
  }

  onMount(() => {
    void refreshReady()

    const offChunk = window.zarniwoop.onAiStreamChunk((payload) => {
      if (!activeRequestId || payload.requestId !== activeRequestId) return
      const last = messages[messages.length - 1]
      if (!last || last.role !== 'assistant' || !last.streaming) return
      messages = [
        ...messages.slice(0, -1),
        { role: 'assistant', text: last.text + payload.delta, streaming: true }
      ]
    })

    const offEnd = window.zarniwoop.onAiStreamEnd((payload) => {
      if (!activeRequestId || payload.requestId !== activeRequestId) return
      const last = messages[messages.length - 1]
      if (last?.role === 'assistant' && last.streaming) {
        const text = payload.ok
          ? last.text || '(empty reply)'
          : last.text
            ? `${last.text}\n\n${formatAiError(payload.error)}`
            : formatAiError(payload.error)
        messages = [...messages.slice(0, -1), { role: 'assistant', text }]
      } else if (!payload.ok) {
        messages = [...messages, { role: 'assistant', text: formatAiError(payload.error) }]
      }
      if (payload.ok) routeBadge = routeLabel(payload.routedTo)
      activeRequestId = null
      busy = false
    })

    return () => {
      offChunk()
      offEnd()
    }
  })

  async function send(): Promise<void> {
    const prompt = draft.trim()
    if (!prompt || busy) return

    if (!aiReady) {
      messages = [
        ...messages,
        { role: 'user', text: prompt },
        {
          role: 'assistant',
          text: 'AI is not connected yet. Tap Set up AI above — about 2 minutes — then try again.'
        }
      ]
      draft = ''
      showBanner = true
      return
    }

    messages = [...messages, { role: 'user', text: prompt }]
    draft = ''
    busy = true
    messages = [...messages, { role: 'assistant', text: '', streaming: true }]

    try {
      const result = await window.zarniwoop.sendPrompt({
        prompt,
        intent: 'fast',
        model: null
      })
      if (!result?.ok || !result.requestId) {
        messages = [
          ...messages.slice(0, -1),
          { role: 'assistant', text: formatAiError(result?.error ?? 'send failed') }
        ]
        busy = false
        return
      }
      activeRequestId = result.requestId
      routeBadge = routeLabel(result.routedTo)
    } catch (err) {
      messages = [...messages.slice(0, -1), { role: 'assistant', text: formatAiError(err) }]
      busy = false
    }
  }

  async function abort(): Promise<void> {
    if (!activeRequestId) return
    await window.zarniwoop.abortPrompt(activeRequestId)
  }

  function onKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void send()
    }
  }

  async function onSetupDone(): Promise<void> {
    showSetup = false
    await refreshReady()
    messages = [
      ...messages,
      { role: 'assistant', text: 'You are connected. Ask me anything.' }
    ]
  }

  async function onSetupSkip(): Promise<void> {
    showSetup = false
    await refreshReady()
  }
</script>

<div class="panel">
  <header class="head">
    <div class="title-row">
      <h1>Chat</h1>
      <span class="badge">{routeBadge}</span>
    </div>
    <button
      type="button"
      class="collapse"
      onclick={onCollapse}
      title="Collapse chat panel"
      aria-label="Collapse chat panel"
    >
      <StatusOrb visual="work" size="icon" orbState={busy ? 'busy' : 'idle'} />
    </button>
  </header>

  {#if showSetup}
    <AiSetupPanel onDone={() => void onSetupDone()} onSkip={() => void onSetupSkip()} />
  {:else}
    {#if showBanner}
      <div class="banner" role="status">
        <p>Optional: connect AI for answers. Setup takes about 2 minutes when you are ready.</p>
        <button type="button" class="setup-btn" onclick={() => (showSetup = true)}>Set up AI</button>
      </div>
    {/if}

    <div class="thread" role="log" aria-live="polite">
      {#each messages as msg}
        <div class="bubble" class:user={msg.role === 'user'} class:streaming={msg.streaming}>
          <span class="role">{msg.role === 'user' ? 'You' : 'Zarniwoop'}</span>
          <p>{msg.text}{#if msg.streaming && !msg.text}<span class="cursor">▍</span>{/if}</p>
        </div>
      {/each}
    </div>

    <form
      class="composer"
      onsubmit={(e) => {
        e.preventDefault()
        void send()
      }}
    >
      <textarea
        bind:value={draft}
        onkeydown={onKey}
        rows="3"
        placeholder="Ask Zarniwoop…"
        disabled={busy}
      ></textarea>
      <div class="actions">
        {#if !aiReady}
          <button type="button" class="ghost" onclick={() => (showSetup = true)}>Set up AI</button>
        {/if}
        {#if busy}
          <button type="button" class="abort" onclick={() => void abort()}>Stop</button>
        {/if}
        <button type="submit" disabled={busy || !draft.trim()}>Send</button>
      </div>
    </form>
  {/if}
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.7rem 0.75rem 0.55rem 1rem;
    border-bottom: 1px solid var(--zw-border);
    background: var(--zw-chrome);
  }

  .title-row {
    display: flex;
    align-items: baseline;
    gap: 0.65rem;
    min-width: 0;
  }

  h1 {
    margin: 0;
    font-size: 1rem;
    font-weight: 650;
  }

  .badge {
    font-size: 0.7rem;
    color: var(--zw-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .banner {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--zw-border);
    background: color-mix(in srgb, var(--zw-brand) 12%, var(--zw-chrome));
  }

  .banner p {
    margin: 0;
    font-size: 0.82rem;
    line-height: 1.4;
    color: var(--zw-text);
  }

  .setup-btn,
  .ghost {
    align-self: flex-start;
    height: 32px;
    padding: 0 0.85rem;
    border-radius: 6px;
    border: 1px solid var(--zw-border);
    background: var(--zw-solid);
    color: var(--zw-text);
    font-weight: 600;
    cursor: pointer;
  }

  .collapse {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border: 1px solid var(--zw-border);
    border-radius: 8px;
    background: #0b0d10;
    color: #fff;
    cursor: pointer;
    padding: 0;
    overflow: hidden;
  }

  .collapse:hover {
    border-color: color-mix(in srgb, var(--zw-brand) 50%, var(--zw-border));
    filter: brightness(1.08);
  }

  .thread {
    flex: 1;
    overflow: auto;
    padding: 0.85rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .bubble {
    border-radius: 10px;
    padding: 0.65rem 0.75rem;
    background: var(--zw-bubble);
    border: 1px solid var(--zw-border);
    box-shadow: 0 1px 0 rgba(0, 0, 0, 0.2);
  }

  .bubble.user {
    background: var(--zw-bubble-user);
    border-color: var(--zw-accent-dim);
  }

  .bubble.streaming {
    border-color: color-mix(in srgb, var(--zw-brand) 35%, var(--zw-border));
  }

  .role {
    display: block;
    font-size: 0.68rem;
    color: var(--zw-muted);
    margin-bottom: 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .bubble p {
    margin: 0;
    white-space: pre-wrap;
    line-height: 1.45;
    font-size: 0.9rem;
  }

  .cursor {
    animation: blink 1s step-end infinite;
    color: var(--zw-accent);
  }

  @keyframes blink {
    50% {
      opacity: 0;
    }
  }

  .composer {
    border-top: 1px solid var(--zw-border);
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: var(--zw-chrome);
  }

  textarea {
    resize: none;
    border-radius: 8px;
    border: 1px solid var(--zw-border);
    background: var(--zw-solid);
    color: var(--zw-text);
    padding: 0.65rem 0.75rem;
  }

  textarea:focus {
    outline: 1px solid var(--zw-accent);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    align-items: center;
  }

  .actions .ghost {
    margin-right: auto;
  }

  button {
    height: 34px;
    padding: 0 1rem;
    border-radius: 6px;
    border: none;
    background: var(--zw-accent);
    color: #041018;
    font-weight: 600;
    cursor: pointer;
  }

  button.abort {
    background: transparent;
    border: 1px solid var(--zw-border);
    color: var(--zw-text);
  }

  button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
</style>
