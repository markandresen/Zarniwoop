<script lang="ts">
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

<header class="toolbar" class:compact={browserCollapsed}>
  <div class="brand">Zarniwoop</div>

  {#if !browserCollapsed}
    <form class="nav" onsubmit={go}>
      <input
        class="url"
        type="text"
        bind:value={url}
        spellcheck="false"
        aria-label="Address"
        placeholder="Enter URL"
      />
      <!-- Hide browser sits beside the address field (not Go). -->
      <button
        type="button"
        class="icon-btn"
        onclick={onToggleBrowser}
        title="Hide browser — back to chat"
        aria-label="Hide browser — back to chat"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm10 2v12h6V6h-6zM9.5 12L13 9.5v5L9.5 12z"
          />
        </svg>
      </button>
      <button type="submit" class="icon-btn ghost" title="Load URL" aria-label="Load URL">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"
          />
        </svg>
      </button>
    </form>
  {/if}

  <div class="actions">
    <button
      type="button"
      class="icon-btn ghost"
      onclick={() => dock('right')}
      title="Dock right"
      aria-label="Dock right"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          fill="currentColor"
          d="M3 5h18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm12 2v10h6V7h-6z"
        />
      </svg>
    </button>
    <button
      type="button"
      class="icon-btn ghost"
      onclick={() => dock('left')}
      title="Dock left"
      aria-label="Dock left"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          fill="currentColor"
          d="M3 5h18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm0 2v10h6V7H3z"
        />
      </svg>
    </button>
    <button
      type="button"
      class="icon-btn ghost"
      onclick={() => dock('none')}
      title="Float window"
      aria-label="Float window"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          fill="currentColor"
          d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 16H5V5h14v14zm-2-9H7V8h10v2z"
        />
      </svg>
    </button>
    <button
      type="button"
      class="icon-btn ghost"
      onclick={onOpenSettings}
      title="Settings"
      aria-label="Settings"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          fill="currentColor"
          d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.59.24-1.13.55-1.62.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.83 14.58a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.43.34.68.22l2.39-.96c.49.39 1.03.7 1.62.94l.36 2.54c.05.24.25.42.49.42h3.8c.24 0 .44-.18.49-.42l.36-2.54c.59-.24 1.13-.55 1.62-.94l2.39.96c.25.12.54.02.68-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"
        />
      </svg>
    </button>
    {#if browserCollapsed}
      <button
        type="button"
        class="icon-btn"
        onclick={onToggleBrowser}
        title="Show browser"
        aria-label="Show browser"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M3 5h18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm0 4v8h18V9H3zm14 2h2v2h-2v-2z"
          />
          <path fill="currentColor" d="M14 12l5-3v6l-5-3z" />
        </svg>
      </button>
    {/if}
    <button
      type="button"
      class="icon-btn"
      class:ghost={sidebarCollapsed}
      onclick={onToggleSidebar}
      title={sidebarCollapsed ? 'Show chat panel' : 'Collapse chat panel'}
      aria-label={sidebarCollapsed ? 'Show chat panel' : 'Collapse chat panel'}
    >
      {#if sidebarCollapsed}
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm10 2v12h6V6h-6zM8.5 12L5 9.5v5L8.5 12z"
          />
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm10 2v12h6V6h-6zM9.5 12L13 9.5v5L9.5 12z"
          />
        </svg>
      {/if}
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
    background: var(--zw-chrome);
    backdrop-filter: blur(12px);
    position: relative;
    z-index: 3;
    flex-shrink: 0;
  }

  .toolbar.compact .actions {
    margin-left: auto;
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
    align-items: center;
  }

  .url {
    flex: 1;
    min-width: 0;
    height: 32px;
    border-radius: 6px;
    border: 1px solid var(--zw-border);
    background: var(--zw-solid);
    color: var(--zw-text);
    padding: 0 0.65rem;
  }

  .url:focus {
    outline: 1px solid var(--zw-accent);
    border-color: var(--zw-accent);
  }

  .actions {
    display: flex;
    gap: 0.3rem;
    flex-shrink: 0;
    justify-content: flex-end;
  }

  .icon-btn {
    width: 32px;
    height: 32px;
    padding: 0;
    display: grid;
    place-items: center;
    border-radius: 6px;
    border: 1px solid var(--zw-accent-dim);
    background: var(--zw-accent-dim);
    color: white;
    cursor: pointer;
    flex-shrink: 0;
  }

  .icon-btn.ghost {
    background: transparent;
    border-color: var(--zw-border);
    color: var(--zw-muted);
  }

  .icon-btn:hover {
    filter: brightness(1.1);
    color: var(--zw-text);
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
