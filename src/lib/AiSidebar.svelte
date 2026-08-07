<script lang="ts">
  type Msg = { role: 'user' | 'assistant'; text: string }
  type Props = { onCollapse: () => void }

  let { onCollapse }: Props = $props()

  let messages = $state<Msg[]>([
    {
      role: 'assistant',
      text: 'Zarniwoop sidebar ready. Free-first routing lands in Phase 2 — for now this is a local stub.'
    }
  ])
  let draft = $state('')
  let busy = $state(false)

  async function send(): Promise<void> {
    const prompt = draft.trim()
    if (!prompt || busy) return
    messages = [...messages, { role: 'user', text: prompt }]
    draft = ''
    busy = true
    try {
      const result = await window.zarniwoop.sendPrompt({ prompt, intent: 'local' })
      messages = [
        ...messages,
        { role: 'assistant', text: result?.reply ?? 'No reply from stub.' }
      ]
    } catch (err) {
      messages = [...messages, { role: 'assistant', text: `Error: ${String(err)}` }]
    } finally {
      busy = false
    }
  }

  function onKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void send()
    }
  }
</script>

<div class="panel">
  <header class="head">
    <div class="title-row">
      <h1>AI</h1>
      <span class="badge">free-first · stub</span>
    </div>
    <button
      type="button"
      class="collapse"
      onclick={onCollapse}
      title="Collapse chat panel"
      aria-label="Collapse chat panel"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          fill="currentColor"
          d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm10 2v12h6V6h-6zM9.5 12L13 9.5v5L9.5 12z"
        />
      </svg>
    </button>
  </header>

  <div class="thread" role="log" aria-live="polite">
    {#each messages as msg}
      <div class="bubble" class:user={msg.role === 'user'}>
        <span class="role">{msg.role === 'user' ? 'You' : 'Zarniwoop'}</span>
        <p>{msg.text}</p>
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
    <button type="submit" disabled={busy || !draft.trim()}>Send</button>
  </form>
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
    text-transform: lowercase;
  }

  .collapse {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border: 1px solid var(--zw-accent-dim);
    border-radius: 6px;
    background: var(--zw-accent-dim);
    color: #fff;
    cursor: pointer;
  }

  .collapse:hover {
    filter: brightness(1.12);
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

  button {
    align-self: flex-end;
    height: 34px;
    padding: 0 1rem;
    border-radius: 6px;
    border: none;
    background: var(--zw-accent);
    color: #041018;
    font-weight: 600;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
</style>
