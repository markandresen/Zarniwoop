<script lang="ts">
  import { onMount } from 'svelte'
  import StatusOrb from './StatusOrb.svelte'
  import { Icon } from './icons'
  import {
    applyBrandTheme,
    BRAND_COLOR_PRESETS,
    BRAND_COLOR_SETTING_KEY,
    DEFAULT_BRAND_COLOR,
    normalizeBrandColor
  } from './brandTheme'
  import { MORE_PROVIDERS, PRIMARY_PROVIDERS } from './providers'
  import { formatAiError } from './aiErrors'

  type Props = { onClose: () => void; onCollapse: () => void }
  let { onClose, onCollapse }: Props = $props()

  type TabId = 'appearance' | 'chat' | 'other'
  const TABS: { id: TabId; label: string }[] = [
    { id: 'appearance', label: 'Appearance' },
    { id: 'chat', label: 'Chat' },
    { id: 'other', label: 'Other' }
  ]

  const REMEMBER_CHATS_KEY = 'remember_chats'

  let activeTab = $state<TabId>('appearance')
  let provider = $state('google')
  let key = $state('')
  let message = $state('')
  let providers = $state<string[]>([])
  let moreOpen = $state(false)
  let testBusy = $state(false)
  let brandColor = $state(DEFAULT_BRAND_COLOR)
  let brandMessage = $state('')
  let rememberChats = $state(true)
  let otherMessage = $state('')
  let quitMessage = $state('')

  async function refresh(): Promise<void> {
    providers = (await window.zarniwoop.listKeyProviders()) ?? []
  }

  async function loadBrand(): Promise<void> {
    const saved = await window.zarniwoop.getSetting(BRAND_COLOR_SETTING_KEY)
    brandColor = normalizeBrandColor(saved ?? DEFAULT_BRAND_COLOR)
    applyBrandTheme(brandColor)
  }

  async function loadOther(): Promise<void> {
    const saved = await window.zarniwoop.getSetting(REMEMBER_CHATS_KEY)
    // Default on until user opts out.
    rememberChats = saved !== '0'
  }

  onMount(() => {
    void refresh()
    void loadBrand()
    void loadOther()
  })

  async function save(): Promise<void> {
    const result = await window.zarniwoop.saveApiKey(provider, key)
    if (result?.ok) {
      key = ''
      message = `Saved key for ${providerLabel(provider)}.`
      await refresh()
    } else {
      message = result?.error ?? 'Save failed'
    }
  }

  async function saveAndTest(): Promise<void> {
    const trimmed = key.trim()
    if (!trimmed) return
    testBusy = true
    message = ''
    try {
      const saved = await window.zarniwoop.saveApiKey(provider, trimmed)
      if (!saved?.ok) {
        message = saved?.error ?? 'Save failed'
        return
      }
      key = ''
      await refresh()
      const test = await window.zarniwoop.testConnection(provider)
      message = test.ok ? test.message : formatAiError(test.message)
    } catch (err) {
      message = formatAiError(err)
    } finally {
      testBusy = false
    }
  }

  function providerLabel(id: string): string {
    const all = [...PRIMARY_PROVIDERS, ...MORE_PROVIDERS]
    return all.find((p) => p.id === id)?.label ?? id
  }

  async function chooseBrand(next: string): Promise<void> {
    const color = normalizeBrandColor(next)
    brandColor = color
    applyBrandTheme(color)
    const result = await window.zarniwoop.setSetting(BRAND_COLOR_SETTING_KEY, color)
    brandMessage = result?.ok ? 'Accent saved.' : (result?.error ?? 'Save failed')
  }

  async function toggleRememberChats(next: boolean): Promise<void> {
    rememberChats = next
    const result = await window.zarniwoop.setSetting(REMEMBER_CHATS_KEY, next ? '1' : '0')
    otherMessage = result?.ok
      ? next
        ? 'Chats will be remembered when persistence lands.'
        : 'Chats will not be kept across sessions.'
      : (result?.error ?? 'Save failed')
  }

  function quitApp(): void {
    if (typeof window.zarniwoop?.quit !== 'function') {
      quitMessage = 'Quit unavailable — restart the app once, then try again.'
      return
    }
    void window.zarniwoop.quit()
  }
</script>

<div class="panel">
  <header class="head">
    <h1>Settings</h1>
    <div class="head-actions">
      <button
        type="button"
        class="back"
        onclick={onClose}
        title="Back to chat"
        aria-label="Back to chat"
      >
        <Icon name="ChevronLeft" size={14} strokeWidth={1.75} />
        <Icon name="MessageChatSquare" size={16} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        class="collapse"
        onclick={onCollapse}
        title="Collapse chat panel"
        aria-label="Collapse chat panel"
      >
        <StatusOrb visual="work" size="icon" orbState="idle" />
      </button>
    </div>
  </header>

  <div class="tabs" role="tablist" aria-label="Settings sections">
    {#each TABS as tab}
      <button
        type="button"
        class="tab"
        class:active={activeTab === tab.id}
        role="tab"
        id="tab-{tab.id}"
        aria-selected={activeTab === tab.id}
        aria-controls="panel-{tab.id}"
        tabindex={activeTab === tab.id ? 0 : -1}
        onclick={() => (activeTab = tab.id)}
      >
        {tab.label}
      </button>
    {/each}
  </div>

  <section class="body">
    {#if activeTab === 'appearance'}
      <section
        class="block"
        role="tabpanel"
        id="panel-appearance"
        aria-labelledby="tab-appearance"
      >
        <h2 id="appearance-heading">Appearance</h2>
        <p class="hint">
          Accent tints active toolbar buttons and the Zarniwoop orb (logo purple by default).
        </p>

        <div class="swatches" role="listbox" aria-label="Accent color">
          {#each BRAND_COLOR_PRESETS as preset}
            <button
              type="button"
              class="swatch"
              class:selected={brandColor === preset.value}
              style="--swatch: {preset.value}"
              title={preset.label}
              aria-label={preset.label}
              aria-selected={brandColor === preset.value}
              onclick={() => chooseBrand(preset.value)}
            ></button>
          {/each}
        </div>

        <label class="custom-color">
          Custom
          <input
            type="color"
            value={brandColor}
            oninput={(e) => void chooseBrand((e.currentTarget as HTMLInputElement).value)}
          />
          <code class="hex">{brandColor}</code>
        </label>

        {#if brandMessage}
          <p class="msg">{brandMessage}</p>
        {/if}
      </section>
    {:else if activeTab === 'chat'}
      <section class="block" role="tabpanel" id="panel-chat" aria-labelledby="tab-chat">
        <h2 id="keys-heading">Connect AI</h2>
        <p class="hint">
          New to AI? Use <strong>Set up AI</strong> in Chat (about 2 minutes). Keys stay on this computer.
          Free options first; other services are under More.
        </p>

        <label>
          Service
          <select bind:value={provider}>
            {#each PRIMARY_PROVIDERS as p}
              <option value={p.id}>{p.label}</option>
            {/each}
            {#if moreOpen}
              {#each MORE_PROVIDERS as p}
                <option value={p.id}>{p.label}</option>
              {/each}
            {/if}
          </select>
        </label>

        <button type="button" class="linkish" onclick={() => (moreOpen = !moreOpen)}>
          {moreOpen ? 'Hide more services' : 'More services'}
        </button>

        <label>
          Access key
          <input type="password" bind:value={key} autocomplete="off" placeholder="Paste key" />
        </label>

        <div class="btn-row">
          <button type="button" class="save" onclick={save} disabled={!key.trim() || testBusy}>
            Save key
          </button>
          <button
            type="button"
            class="save secondary"
            onclick={() => void saveAndTest()}
            disabled={!key.trim() || testBusy}
          >
            {testBusy ? 'Testing…' : 'Save & test'}
          </button>
        </div>

        {#if message}
          <p class="msg">{message}</p>
        {/if}

        <div class="stored">
          <h3>Connected</h3>
          {#if providers.length === 0}
            <p class="hint">None yet.</p>
          {:else}
            <ul>
              {#each providers as p}
                <li>{providerLabel(p)}</li>
              {/each}
            </ul>
          {/if}
        </div>
      </section>
    {:else}
      <section class="block" role="tabpanel" id="panel-other" aria-labelledby="tab-other">
        <h2 id="other-heading">Preferences</h2>
        <p class="hint">Session and privacy options for the AI chat.</p>

        <label class="toggle-row">
          <input
            type="checkbox"
            checked={rememberChats}
            onchange={(e) => void toggleRememberChats((e.currentTarget as HTMLInputElement).checked)}
          />
          <span class="toggle-copy">
            <span class="toggle-title">Remember chats</span>
            <span class="toggle-hint">Keep conversation history across sessions (when persistence is ready).</span>
          </span>
        </label>

        {#if otherMessage}
          <p class="msg">{otherMessage}</p>
        {/if}
      </section>
    {/if}
  </section>

  <footer class="foot">
    <p class="hint quit-hint">Fully exit the app (not just collapse to the side orb).</p>
    <button type="button" class="quit" onclick={quitApp}>
      <Icon name="Power01" size={16} strokeWidth={1.75} />
      Quit Zarniwoop
    </button>
    {#if quitMessage}
      <p class="msg">{quitMessage}</p>
    {/if}
  </footer>
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
    margin: 0 0 0.4rem;
    font-size: 0.8rem;
    color: var(--zw-muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  h3 {
    margin: 1rem 0 0.4rem;
    font-size: 0.8rem;
    color: var(--zw-muted);
    font-weight: 600;
  }

  .back,
  .collapse {
    flex-shrink: 0;
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

  .back {
    width: auto;
    min-width: 32px;
    padding: 0 0.4rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.1rem;
  }

  .collapse {
    width: 32px;
  }

  .back:hover,
  .collapse:hover {
    border-color: color-mix(in srgb, var(--zw-brand) 50%, var(--zw-border));
    filter: brightness(1.08);
  }

  .tabs {
    display: flex;
    gap: 0.15rem;
    padding: 0.45rem 0.65rem 0;
    border-bottom: 1px solid var(--zw-border);
    background: var(--zw-chrome);
    flex-shrink: 0;
  }

  .tab {
    flex: 1;
    border: none;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: var(--zw-muted);
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    padding: 0.45rem 0.35rem 0.55rem;
    cursor: pointer;
    margin-bottom: -1px;
  }

  .tab:hover {
    color: var(--zw-text);
  }

  .tab.active {
    color: var(--zw-text);
    border-bottom-color: var(--zw-brand);
  }

  .body {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    overflow: auto;
    background: var(--zw-solid);
    flex: 1;
    min-height: 0;
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }

  .swatch {
    width: 1.85rem;
    height: 1.85rem;
    border-radius: 999px;
    border: 2px solid transparent;
    background: var(--swatch);
    cursor: pointer;
    padding: 0;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, white 12%, transparent);
  }

  .swatch:hover {
    filter: brightness(1.08);
  }

  .swatch.selected {
    border-color: var(--zw-text);
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--swatch) 45%, transparent),
      inset 0 0 0 1px color-mix(in srgb, white 12%, transparent);
  }

  .custom-color {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    font-size: 0.8rem;
    color: var(--zw-muted);
  }

  .custom-color input[type='color'] {
    width: 2.25rem;
    height: 1.85rem;
    padding: 0;
    border: 1px solid var(--zw-border);
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
  }

  .hex {
    font-family: var(--zw-mono);
    font-size: 0.75rem;
    color: var(--zw-text);
  }

  label:not(.custom-color):not(.toggle-row) {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.8rem;
    color: var(--zw-muted);
  }

  .toggle-row {
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
    cursor: pointer;
    font-size: 0.8rem;
    color: var(--zw-muted);
  }

  .toggle-row input[type='checkbox'] {
    margin-top: 0.2rem;
    width: 1rem;
    height: 1rem;
    accent-color: var(--zw-brand);
    flex-shrink: 0;
  }

  .toggle-copy {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .toggle-title {
    color: var(--zw-text);
    font-weight: 600;
  }

  .toggle-hint {
    line-height: 1.35;
  }

  input:not([type='color']):not([type='checkbox']),
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
    background: var(--zw-brand);
    color: #120818;
    font-weight: 600;
    cursor: pointer;
  }

  .save.secondary {
    background: transparent;
    border: 1px solid var(--zw-border);
    color: var(--zw-text);
  }

  .btn-row {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .linkish {
    align-self: flex-start;
    border: none;
    background: transparent;
    color: var(--zw-muted);
    padding: 0;
    font-size: 0.82rem;
    cursor: pointer;
    text-align: left;
  }

  .save:disabled {
    opacity: 0.45;
  }

  .foot {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    padding: 0.85rem 1rem;
    border-top: 1px solid var(--zw-border);
    background: var(--zw-chrome);
  }

  .quit-hint {
    margin: 0;
  }

  .quit {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    height: 36px;
    padding: 0 0.85rem;
    border: 1px solid color-mix(in srgb, #c44 45%, var(--zw-border));
    border-radius: 6px;
    background: color-mix(in srgb, #c44 18%, transparent);
    color: #f0c0c0;
    font-weight: 600;
    cursor: pointer;
  }

  .quit:hover {
    background: color-mix(in srgb, #c44 28%, transparent);
    border-color: color-mix(in srgb, #c44 60%, var(--zw-border));
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
