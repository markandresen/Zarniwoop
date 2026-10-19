<script lang="ts">
  import { onMount } from 'svelte'
  import {
    AI_SETUP_COMPLETE_KEY,
    CLOUD_QUICK_START,
    OLLAMA_DOWNLOAD_URL
  } from './providers'
  import { formatAiError } from './aiErrors'

  type Step = 'welcome' | 'cloud' | 'local'
  type Props = { onDone: () => void; onSkip: () => void }

  let { onDone, onSkip }: Props = $props()

  let step = $state<Step>('welcome')
  let cloudProvider = $state<(typeof CLOUD_QUICK_START)[number]['id']>('google')
  let key = $state('')
  let busy = $state(false)
  let message = $state('')
  let localReady = $state(false)
  let localHint = $state('Checking this computer…')

  async function markComplete(): Promise<void> {
    await window.zarniwoop.setSetting(AI_SETUP_COMPLETE_KEY, '1')
  }

  async function refreshLocal(): Promise<void> {
    const result = await window.zarniwoop.getAiReadiness()
    localReady = Boolean(result?.localReady)
    localHint = localReady
      ? 'Ready — AI can run on this computer.'
      : 'Install the free Ollama helper, open it once, then tap Check again.'
  }

  onMount(() => {
    void refreshLocal()
  })

  async function saveAndTest(): Promise<void> {
    const trimmed = key.trim()
    if (!trimmed || busy) return
    busy = true
    message = ''
    try {
      const saved = await window.zarniwoop.saveApiKey(cloudProvider, trimmed)
      if (!saved?.ok) {
        message = saved?.error ?? 'Could not save key.'
        return
      }
      const test = await window.zarniwoop.testConnection(cloudProvider)
      if (test.ok) {
        key = ''
        message = test.message
        await markComplete()
        onDone()
      } else {
        message = formatAiError(test.message)
      }
    } catch (err) {
      message = formatAiError(err)
    } finally {
      busy = false
    }
  }

  async function finishLocal(): Promise<void> {
    busy = true
    message = ''
    try {
      await refreshLocal()
      if (!localReady) {
        message = 'Not ready yet. Install Ollama, open it, then Check again.'
        return
      }
      const test = await window.zarniwoop.testConnection('ollama')
      if (test.ok) {
        message = test.message
        await markComplete()
        onDone()
      } else {
        message = formatAiError(test.message)
      }
    } catch (err) {
      message = formatAiError(err)
    } finally {
      busy = false
    }
  }

  async function skip(): Promise<void> {
    await markComplete()
    onSkip()
  }

  const activeCloud = $derived(
    CLOUD_QUICK_START.find((c) => c.id === cloudProvider) ?? CLOUD_QUICK_START[0]
  )
</script>

<div class="setup">
  {#if step === 'welcome'}
    <h2>Set up AI help</h2>
    <p class="lead">
      Choose how you want Zarniwoop to answer. Takes about 2 minutes. You can skip and come back later.
    </p>

    <div class="cards">
      <button type="button" class="card" onclick={() => (step = 'cloud')}>
        <strong>Free online</strong>
        <span>Use a free Google or Groq key. Needs internet.</span>
      </button>
      <button type="button" class="card" onclick={() => (step = 'local')}>
        <strong>On this computer</strong>
        <span>Private and offline after a free helper install.</span>
      </button>
    </div>

    <button type="button" class="linkish" onclick={() => void skip()}>Skip for now</button>
  {:else if step === 'cloud'}
    <button type="button" class="back" onclick={() => (step = 'welcome')}>← Back</button>
    <h2>Free online</h2>
    <p class="lead">Pick one, get a free key, paste it here, then Save &amp; test.</p>

    <div class="tabs">
      {#each CLOUD_QUICK_START as opt}
        <button
          type="button"
          class="tab"
          class:active={cloudProvider === opt.id}
          onclick={() => (cloudProvider = opt.id)}
        >
          {opt.label}
        </button>
      {/each}
    </div>

    <button
      type="button"
      class="secondary"
      onclick={() => void window.zarniwoop.openExternal(activeCloud.signupUrl)}
    >
      {activeCloud.signupLabel}
    </button>

    <label>
      Paste access key
      <input type="password" bind:value={key} autocomplete="off" placeholder="Paste key here" />
    </label>

    <button type="button" class="primary" disabled={busy || !key.trim()} onclick={() => void saveAndTest()}>
      {busy ? 'Testing…' : 'Save & test'}
    </button>

    {#if message}
      <p class="msg">{message}</p>
    {/if}
  {:else}
    <button type="button" class="back" onclick={() => (step = 'welcome')}>← Back</button>
    <h2>On this computer</h2>
    <p class="lead">
      1) Install the free Ollama helper<br />
      2) Open Ollama once so it is running<br />
      3) Come back and tap Check again
    </p>

    <button
      type="button"
      class="secondary"
      onclick={() => void window.zarniwoop.openExternal(OLLAMA_DOWNLOAD_URL)}
    >
      Download Ollama
    </button>

    <p class="status">{localHint}</p>

    <div class="row">
      <button type="button" class="secondary" disabled={busy} onclick={() => void refreshLocal()}>
        Check again
      </button>
      <button type="button" class="primary" disabled={busy || !localReady} onclick={() => void finishLocal()}>
        {busy ? 'Testing…' : 'Start chatting'}
      </button>
    </div>

    {#if message}
      <p class="msg">{message}</p>
    {/if}
  {/if}
</div>

<style>
  .setup {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    height: 100%;
    overflow: auto;
  }

  h2 {
    margin: 0;
    font-size: 1.05rem;
  }

  .lead {
    margin: 0;
    color: var(--zw-muted);
    font-size: 0.88rem;
    line-height: 1.45;
  }

  .cards {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .card {
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.85rem 0.9rem;
    border-radius: 10px;
    border: 1px solid var(--zw-border);
    background: var(--zw-solid);
    color: var(--zw-text);
    cursor: pointer;
  }

  .card:hover {
    border-color: color-mix(in srgb, var(--zw-brand) 45%, var(--zw-border));
  }

  .card strong {
    font-size: 0.95rem;
  }

  .card span {
    font-size: 0.8rem;
    color: var(--zw-muted);
  }

  .tabs {
    display: flex;
    gap: 0.35rem;
  }

  .tab {
    flex: 1;
    height: 32px;
    border-radius: 6px;
    border: 1px solid var(--zw-border);
    background: transparent;
    color: var(--zw-text);
    cursor: pointer;
  }

  .tab.active {
    background: color-mix(in srgb, var(--zw-brand) 22%, transparent);
    border-color: var(--zw-brand);
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.8rem;
    color: var(--zw-muted);
  }

  input {
    height: 36px;
    border-radius: 8px;
    border: 1px solid var(--zw-border);
    background: var(--zw-solid);
    color: var(--zw-text);
    padding: 0 0.65rem;
  }

  .primary,
  .secondary,
  .linkish,
  .back {
    cursor: pointer;
  }

  .primary {
    height: 36px;
    border: none;
    border-radius: 6px;
    background: var(--zw-accent);
    color: #041018;
    font-weight: 600;
  }

  .secondary {
    height: 36px;
    border-radius: 6px;
    border: 1px solid var(--zw-border);
    background: transparent;
    color: var(--zw-text);
  }

  .linkish,
  .back {
    align-self: flex-start;
    border: none;
    background: transparent;
    color: var(--zw-muted);
    padding: 0;
    font-size: 0.85rem;
  }

  .row {
    display: flex;
    gap: 0.5rem;
  }

  .row .primary {
    flex: 1;
  }

  .status,
  .msg {
    margin: 0;
    font-size: 0.85rem;
    color: var(--zw-muted);
  }

  .msg {
    color: var(--zw-text);
  }

  button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
</style>
