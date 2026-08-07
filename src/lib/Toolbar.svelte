<script lang="ts">
  type Props = {
    sidebarCollapsed: boolean
    onToggleSidebar: () => void
    onOpenSettings: () => void
  }

  let { sidebarCollapsed, onToggleSidebar, onOpenSettings }: Props = $props()

  let url = $state('https://example.com')
  let status = $state('')

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
    status = result?.note ?? (result?.ok ? `Docked: ${edge}` : 'Dock failed')
  }
</script>

<header class="toolbar">
  <div class="brand">Zarniwoop</div>

  <form class="nav" onsubmit={go}>
    <input
      class="url"
      type="text"
      bind:value={url}
      spellcheck="false"
      aria-label="Address"
      placeholder="Enter URL"
    />
    <button type="submit" class="btn">Go</button>
  </form>

  <div class="actions">
    <button type="button" class="btn ghost" onclick={() => dock('left')} title="Dock left">
      Dock L
    </button>
    <button type="button" class="btn ghost" onclick={() => dock('right')} title="Dock right">
      Dock R
    </button>
    <button type="button" class="btn ghost" onclick={() => dock('none')} title="Undock">
      Float
    </button>
    <button type="button" class="btn ghost" onclick={onOpenSettings}>Settings</button>
    <button type="button" class="btn" onclick={onToggleSidebar}>
      {sidebarCollapsed ? 'Show AI' : 'Hide AI'}
    </button>
  </div>

  {#if status}
    <p class="status">{status}</p>
  {/if}
</header>

<style>
  .toolbar {
    height: 48px;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0 0.75rem;
    border-bottom: 1px solid var(--zw-border);
    background: #121820;
    position: relative;
    z-index: 3;
    flex-shrink: 0;
  }

  .brand {
    font-weight: 700;
    letter-spacing: 0.02em;
    font-size: 0.95rem;
    color: var(--zw-text);
    white-space: nowrap;
  }

  .nav {
    display: flex;
    flex: 1;
    gap: 0.4rem;
    min-width: 0;
  }

  .url {
    flex: 1;
    min-width: 0;
    height: 32px;
    border-radius: 6px;
    border: 1px solid var(--zw-border);
    background: var(--zw-bg);
    color: var(--zw-text);
    padding: 0 0.65rem;
  }

  .url:focus {
    outline: 1px solid var(--zw-accent);
    border-color: var(--zw-accent);
  }

  .actions {
    display: flex;
    gap: 0.35rem;
    flex-shrink: 0;
  }

  .btn {
    height: 32px;
    padding: 0 0.7rem;
    border-radius: 6px;
    border: 1px solid var(--zw-accent-dim);
    background: var(--zw-accent-dim);
    color: white;
    cursor: pointer;
  }

  .btn.ghost {
    background: transparent;
    border-color: var(--zw-border);
    color: var(--zw-muted);
  }

  .btn:hover {
    filter: brightness(1.08);
  }

  .status {
    position: absolute;
    left: 0.75rem;
    bottom: -1.35rem;
    margin: 0;
    font-size: 0.7rem;
    color: var(--zw-muted);
    pointer-events: none;
  }
</style>
