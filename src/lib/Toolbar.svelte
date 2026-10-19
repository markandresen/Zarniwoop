<script lang="ts">
  import { Icon } from './icons'
  import StatusOrb from './StatusOrb.svelte'

  type Props = {
    browserCollapsed: boolean
    sidebarCollapsed: boolean
    onToggleBrowser: () => void
    onToggleSidebar: () => void
    onOpenSettings: () => void
  }

  let {
    browserCollapsed,
    sidebarCollapsed,
    onToggleBrowser,
    onToggleSidebar,
    onOpenSettings
  }: Props = $props()

  let url = $state('https://example.com')
  let status = $state('')
  /** Launch docks right (ADR-008); update when user picks a mode. */
  let dockEdge = $state<'none' | 'left' | 'right'>('right')

  async function go(event?: Event): Promise<void> {
    event?.preventDefault()
    status = 'Loading…'
    const result = await window.zarniwoop.navigate(url)
    if (result?.ok) {
      url = result.url
      status = ''
    } else {
      status = result?.error ?? 'Navigation failed'
    }
  }

  async function dock(edge: 'none' | 'left' | 'right'): Promise<void> {
    const result = await window.zarniwoop.dock(edge)
    if (result?.ok) {
      dockEdge = edge
      status = result.note ?? `Docked: ${edge}`
    } else {
      status = result?.note ?? 'Dock failed'
    }
  }
</script>

<header class="toolbar" class:browser-open={!browserCollapsed}>
  <div class="brand" title="Zarniwoop">
    <span class="brand-name">Zarniwoop</span>
    <span class="brand-mark" aria-hidden="true">Z</span>
  </div>

  <nav class="tools" aria-label="Workspace tools">
    <button
      type="button"
      class="tool"
      class:active={!browserCollapsed}
      onclick={onToggleBrowser}
      title={browserCollapsed ? 'Show browser' : 'Hide browser'}
      aria-label={browserCollapsed ? 'Show browser' : 'Hide browser'}
      aria-pressed={!browserCollapsed}
    >
      <span class="tool-icon">
        <Icon name="Globe01" size={20} strokeWidth={1.75} />
      </span>
      <span class="tool-label">Browser</span>
    </button>
  </nav>

  {#if !browserCollapsed}
    <form class="nav" onsubmit={go}>
      <span class="nav-globe" aria-hidden="true">
        <Icon name="Globe01" size={14} strokeWidth={1.75} />
      </span>
      <input
        class="url"
        type="text"
        bind:value={url}
        spellcheck="false"
        aria-label="Address"
        placeholder="Navigate the web…"
      />
      <button type="submit" class="icon-btn" title="Load URL" aria-label="Load URL">
        <Icon name="RefreshCw01" size={16} strokeWidth={1.75} />
      </button>
    </form>
  {:else}
    <p class="prompt">Open the wire globe — look outward.</p>
  {/if}

  <div class="actions">
    <div class="action-group" role="group" aria-label="Docking">
      <button
        type="button"
        class="icon-btn"
        class:active={dockEdge === 'left'}
        onclick={() => dock('left')}
        title="Dock left"
        aria-label="Dock left"
        aria-pressed={dockEdge === 'left'}
      >
        <Icon name="LayoutLeft" size={16} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        class="icon-btn"
        class:active={dockEdge === 'right'}
        onclick={() => dock('right')}
        title="Dock right"
        aria-label="Dock right"
        aria-pressed={dockEdge === 'right'}
      >
        <Icon name="LayoutRight" size={16} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        class="icon-btn"
        class:active={dockEdge === 'none'}
        onclick={() => dock('none')}
        title="Float window"
        aria-label="Float window"
        aria-pressed={dockEdge === 'none'}
      >
        <Icon name="LayoutAlt01" size={16} strokeWidth={1.75} />
      </button>
    </div>
    <button
      type="button"
      class="icon-btn"
      onclick={onOpenSettings}
      title="Settings"
      aria-label="Settings"
    >
      <Icon name="Settings01" size={16} strokeWidth={1.75} />
    </button>
    <button
      type="button"
      class="icon-btn orb-btn"
      class:active={!sidebarCollapsed}
      onclick={onToggleSidebar}
      title={sidebarCollapsed ? 'Show chat panel' : 'Collapse chat panel'}
      aria-label={sidebarCollapsed ? 'Show chat panel' : 'Collapse chat panel'}
    >
      <StatusOrb visual="work" size="icon" orbState="idle" />
    </button>
  </div>

  {#if status}
    <p class="status">{status}</p>
  {/if}
</header>

<style>
  .toolbar {
    --tb-h: 56px;
    height: var(--tb-h);
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding: 0 0.85rem;
    border-bottom: 1px solid color-mix(in srgb, var(--zw-copper) 18%, var(--zw-border));
    background:
      radial-gradient(120% 180% at 0% 0%, color-mix(in srgb, var(--zw-copper) 14%, transparent), transparent 55%),
      linear-gradient(180deg, color-mix(in srgb, var(--zw-chrome) 88%, transparent) 0%, var(--zw-chrome) 100%);
    backdrop-filter: blur(18px);
    position: relative;
    z-index: 3;
    flex-shrink: 0;
  }

  .toolbar::after {
    content: '';
    position: absolute;
    inset: auto 0 0 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      color-mix(in srgb, var(--zw-copper) 45%, transparent) 22%,
      color-mix(in srgb, var(--zw-accent) 35%, transparent) 55%,
      transparent 100%
    );
    pointer-events: none;
  }

  .brand {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    min-width: 0;
  }

  .brand-name {
    font-family: var(--zw-display);
    font-weight: 650;
    letter-spacing: 0.01em;
    font-size: 0.95rem;
    color: #ffffff;
    white-space: nowrap;
  }

  .brand-mark {
    display: none;
    font-family: var(--zw-display);
    font-weight: 700;
    font-size: 0.95rem;
    letter-spacing: -0.02em;
    color: #ffffff;
    line-height: 1;
  }

  .tools {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-shrink: 0;
  }

  .tool {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.12rem;
    min-width: 3.4rem;
    height: 2.7rem;
    padding: 0.2rem 0.45rem 0.28rem;
    border: 1px solid transparent;
    border-radius: 0.55rem;
    background: transparent;
    color: var(--zw-muted);
    cursor: pointer;
    transition:
      color 160ms ease,
      background 160ms ease,
      border-color 160ms ease,
      transform 160ms ease;
  }

  .tool-icon {
    display: grid;
    place-items: center;
    width: 1.35rem;
    height: 1.35rem;
  }

  .tool-label {
    font-family: var(--zw-ui);
    font-size: 0.62rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    line-height: 1;
  }

  .tool:hover {
    color: var(--zw-text);
    background: color-mix(in srgb, var(--zw-solid) 70%, transparent);
    border-color: var(--zw-border);
  }

  .tool.active {
    color: var(--zw-brand);
    background: color-mix(in srgb, var(--zw-brand) 12%, transparent);
    border-color: color-mix(in srgb, var(--zw-brand) 40%, transparent);
  }

  .tool:active {
    transform: translateY(1px);
  }

  .prompt {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-family: var(--zw-ui);
    font-size: 0.78rem;
    font-style: italic;
    color: color-mix(in srgb, var(--zw-muted) 85%, transparent);
    letter-spacing: 0.01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .nav {
    display: flex;
    flex: 1;
    gap: 0.35rem;
    min-width: 0;
    align-items: center;
    height: 2.15rem;
    padding: 0 0.35rem 0 0.65rem;
    border-radius: 999px;
    border: 1px solid var(--zw-border);
    background: color-mix(in srgb, var(--zw-solid) 88%, #0a0e14);
    box-shadow: inset 0 1px 0 color-mix(in srgb, white 4%, transparent);
  }

  .nav:focus-within {
    border-color: color-mix(in srgb, var(--zw-accent) 55%, var(--zw-border));
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, white 4%, transparent),
      0 0 0 1px color-mix(in srgb, var(--zw-accent) 25%, transparent);
  }

  .nav-globe {
    display: grid;
    place-items: center;
    color: var(--zw-brand);
    flex-shrink: 0;
    opacity: 0.9;
  }

  .url {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: none;
    background: transparent;
    color: var(--zw-text);
    padding: 0 0.25rem;
    font-family: var(--zw-mono);
    font-size: 0.78rem;
  }

  .url:focus {
    outline: none;
  }

  .url::placeholder {
    color: var(--zw-muted);
    font-family: var(--zw-ui);
    font-style: italic;
  }

  .actions {
    display: flex;
    gap: 0.35rem;
    flex-shrink: 0;
    align-items: center;
    margin-left: auto;
  }

  .action-group {
    display: flex;
    gap: 0.2rem;
    padding: 0.15rem;
    border-radius: 0.55rem;
    border: 1px solid var(--zw-border);
    background: color-mix(in srgb, var(--zw-solid) 55%, transparent);
  }

  .icon-btn {
    width: 1.85rem;
    height: 1.85rem;
    padding: 0;
    display: grid;
    place-items: center;
    border-radius: 0.4rem;
    border: 1px solid transparent;
    background: transparent;
    color: var(--zw-muted);
    cursor: pointer;
    flex-shrink: 0;
    transition:
      color 140ms ease,
      background 140ms ease,
      border-color 140ms ease;
  }

  .icon-btn:hover {
    color: var(--zw-text);
    background: color-mix(in srgb, var(--zw-solid) 80%, transparent);
    border-color: var(--zw-border);
  }

  .icon-btn.active {
    color: var(--zw-brand);
    background: color-mix(in srgb, var(--zw-brand) 18%, transparent);
    border-color: color-mix(in srgb, var(--zw-brand) 45%, transparent);
  }

  .action-group .icon-btn.active {
    color: var(--zw-brand);
    background: color-mix(in srgb, var(--zw-brand) 22%, transparent);
    border-color: color-mix(in srgb, var(--zw-brand) 50%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--zw-brand) 25%, transparent);
  }

  .nav .icon-btn {
    width: 1.65rem;
    height: 1.65rem;
    border-radius: 999px;
  }

  .orb-btn {
    width: 2rem;
    height: 2rem;
    border-radius: 0.45rem;
    background: #0b0d10;
    border-color: var(--zw-border);
    overflow: hidden;
  }

  .orb-btn:hover,
  .orb-btn.active {
    color: inherit;
    background: #0b0d10;
    border-color: color-mix(in srgb, var(--zw-brand) 55%, var(--zw-border));
  }

  .status {
    position: absolute;
    left: 0.85rem;
    bottom: -1.35rem;
    margin: 0;
    font-size: 0.7rem;
    color: var(--zw-muted);
    pointer-events: none;
  }

  /* Companion strip is ~400px — only collapse brand when truly cramped. */
  @media (max-width: 300px) {
    .brand-name {
      display: none;
    }

    .brand-mark {
      display: inline;
    }
  }

  @media (max-width: 720px) {
    .prompt {
      display: none;
    }

    .tool-label {
      display: none;
    }

    .tool {
      min-width: 2.4rem;
      height: 2.4rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tool,
    .icon-btn {
      transition: none;
    }
  }
</style>
