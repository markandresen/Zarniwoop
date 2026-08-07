<script lang="ts">
  type Props = { onClose: () => void; onCollapse: () => void }
  let { onClose, onCollapse }: Props = $props()

  let provider = $state('openrouter')
  let key = $state('')
  let message = $state('')
  let providers = $state<string[]>([])

  async function refresh(): Promise<void> {
    providers = (await window.zarniwoop.listKeyProviders()) ?? []
  }

  $effect(() => {
    void refresh()
  })

  async function save(): Promise<void> {
    const result = await window.zarniwoop.saveApiKey(provider, key)
    if (result?.ok) {
      key = ''
      message = `Saved key for ${provider} (safeStorage).`
      await refresh()
    } else {
      message = result?.error ?? 'Save failed'
    }
  }
</script>

<div class="panel">
  <header class="head">
    <h1>Settings</h1>
    <div class="head-actions">
      <button type="button" class="link" onclick={onClose}>Back to chat</button>
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
    </div>
  </header>

  <section class="body">
    <p class="hint">
      BYOK keys stay in the OS keychain via Electron safeStorage. Free-first routing uses these in
      Phase 2.
    </p>

    <label>
      Provider
      <select bind:value={provider}>
        <option value="openrouter">OpenRouter</option>
        <option value="groq">Groq</option>
        <option value="google">Google AI Studio</option>
        <option value="xai">xAI</option>
        <option value="anthropic">Anthropic</option>
        <option value="openai">OpenAI</option>
      </select>
    </label>

    <label>
      API key
      <input type="password" bind:value={key} autocomplete="off" placeholder="Paste key" />
    </label>

    <button type="button" class="save" onclick={save} disabled={!key.trim()}>Save key</button>

    {#if message}
      <p class="msg">{message}</p>
    {/if}

    <div class="stored">
      <h2>Stored providers</h2>
      {#if providers.length === 0}
        <p class="hint">None yet.</p>
      {:else}
        <ul>
          {#each providers as p}
            <li>{p}</li>
          {/each}
        </ul>
      {/if}
    </div>
  </section>
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    padding: 0.7rem 0.75rem 0.7rem 1rem;
    border-bottom: 1px solid var(--zw-border);
    background: var(--zw-chrome);
  }

  .head-actions {
    display: flex;
    align-items: center;
    gap: 0.55rem;
  }

  h1 {
    margin: 0;
    font-size: 1rem;
  }

  h2 {
    margin: 1rem 0 0.4rem;
    font-size: 0.8rem;
    color: var(--zw-muted);
    font-weight: 600;
  }

  .link {
    border: none;
    background: none;
    color: var(--zw-accent);
    cursor: pointer;
    padding: 0;
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

  .body {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    overflow: auto;
    background: var(--zw-solid);
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.8rem;
    color: var(--zw-muted);
  }

  input,
  select {
    height: 36px;
    border-radius: 6px;
    border: 1px solid var(--zw-border);
    background: rgba(15, 20, 25, 0.9);
    color: var(--zw-text);
    padding: 0 0.65rem;
  }

  .save {
    height: 36px;
    border: none;
    border-radius: 6px;
    background: var(--zw-accent);
    color: #041018;
    font-weight: 600;
    cursor: pointer;
  }

  .save:disabled {
    opacity: 0.45;
  }

  .hint,
  .msg {
    margin: 0;
    font-size: 0.8rem;
    color: var(--zw-muted);
    line-height: 1.4;
  }

  ul {
    margin: 0;
    padding-left: 1.1rem;
    color: var(--zw-text);
  }
</style>
