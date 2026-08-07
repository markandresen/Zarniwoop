<script lang="ts">
  import Toolbar from './lib/Toolbar.svelte'
  import AiSidebar from './lib/AiSidebar.svelte'
  import SettingsPanel from './lib/SettingsPanel.svelte'

  const SIDEBAR_DEFAULT = 380
  const TOOLBAR_HEIGHT = 48

  /** Default: companion mode — browser collapsed, AI + tools only, docked right. */
  let browserCollapsed = $state(true)
  let sidebarCollapsed = $state(false)
  let sidebarWidth = $state(SIDEBAR_DEFAULT)
  let showSettings = $state(false)
  let dragging = $state(false)

  $effect(() => {
    // While icon-docked, main owns window + browser visibility.
    if (sidebarCollapsed) return
    void window.zarniwoop.setBrowserCollapsed(browserCollapsed)
  })

  $effect(() => {
    if (sidebarCollapsed || browserCollapsed) {
      void window.zarniwoop.setChromeLayout({
        toolbarHeight: TOOLBAR_HEIGHT,
        rightChrome: 0
      })
      return
    }
    void window.zarniwoop.setChromeLayout({
      toolbarHeight: TOOLBAR_HEIGHT,
      rightChrome: sidebarWidth + 5
    })
  })

  function toggleBrowser(): void {
    if (sidebarCollapsed) return
    browserCollapsed = !browserCollapsed
  }

  async function toggleSidebar(): Promise<void> {
    const next = !sidebarCollapsed
    sidebarCollapsed = next
    const result = await window.zarniwoop.setSidebarCollapsed(next)
    if (!next && result && typeof result.browserCollapsed === 'boolean') {
      browserCollapsed = result.browserCollapsed
    }
  }

  function onResizePointerDown(event: PointerEvent): void {
    dragging = true
    const startX = event.clientX
    const startWidth = sidebarWidth
    const target = event.currentTarget as HTMLElement
    target.setPointerCapture(event.pointerId)

    function onMove(e: PointerEvent): void {
      const delta = startX - e.clientX
      sidebarWidth = Math.min(640, Math.max(280, startWidth + delta))
    }

    function onUp(e: PointerEvent): void {
      dragging = false
      target.releasePointerCapture(e.pointerId)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }
</script>

{#if sidebarCollapsed}
  <!-- Icon dock: nothing but the restore control. -->
  <div class="icon-dock">
    <button
      type="button"
      class="icon-dock-btn"
      onclick={toggleSidebar}
      title="Show Zarniwoop chat"
      aria-label="Show Zarniwoop chat"
    >
      <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
        <path
          fill="currentColor"
          d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2zm3 5v2h10V9H7zm0 4v2h7v-2H7z"
        />
      </svg>
    </button>
  </div>
{:else}
  <div class="shell" class:companion={browserCollapsed} class:dragging>
    <Toolbar
      {browserCollapsed}
      sidebarCollapsed={false}
      onToggleBrowser={toggleBrowser}
      onToggleSidebar={toggleSidebar}
      onOpenSettings={() => (showSettings = !showSettings)}
    />

    <div class="workspace">
      <div class="browser-slot" class:open={!browserCollapsed} aria-hidden="true"></div>

      {#if !browserCollapsed}
        <div
          class="resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize AI sidebar"
          onpointerdown={onResizePointerDown}
        ></div>
      {/if}

      <aside
        class="sidebar"
        class:fill={browserCollapsed}
        style={browserCollapsed ? undefined : `width: ${sidebarWidth}px`}
      >
        <div class="sidebar-body">
          {#if showSettings}
            <SettingsPanel
              onClose={() => (showSettings = false)}
              onCollapse={toggleSidebar}
            />
          {:else}
            <AiSidebar onCollapse={toggleSidebar} />
          {/if}
        </div>
      </aside>
    </div>
  </div>
{/if}

<style>
  .icon-dock {
    height: 100%;
    width: 100%;
    margin: 0;
    padding: 0;
    display: grid;
    place-items: center;
    background: transparent;
    -webkit-app-region: drag;
  }

  .icon-dock-btn {
    width: 52px;
    height: 52px;
    border: none;
    border-radius: 14px;
    background: var(--zw-accent-dim);
    color: #fff;
    display: grid;
    place-items: center;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
    -webkit-app-region: no-drag;
  }

  .icon-dock-btn:hover {
    filter: brightness(1.12);
  }

  .shell {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--zw-bg);
  }

  .workspace {
    flex: 1;
    display: flex;
    min-height: 0;
    position: relative;
  }

  .browser-slot {
    flex: 0 0 0;
    width: 0;
    min-width: 0;
    overflow: hidden;
    background: transparent;
  }

  .browser-slot.open {
    flex: 1 1 auto;
  }

  .resizer {
    width: 5px;
    cursor: col-resize;
    background: transparent;
    flex-shrink: 0;
    position: relative;
    z-index: 2;
  }

  .resizer:hover,
  .dragging .resizer {
    background: var(--zw-accent-dim);
  }

  .sidebar {
    flex-shrink: 0;
    border-left: 1px solid var(--zw-border);
    background: var(--zw-panel);
    backdrop-filter: blur(14px);
    display: flex;
    flex-direction: column;
    min-height: 0;
    z-index: 1;
    overflow: hidden;
  }

  .sidebar.fill {
    flex: 1;
    width: auto;
    border-left: none;
  }

  .sidebar-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
  }

  .companion .sidebar {
    border-left: none;
  }
</style>
