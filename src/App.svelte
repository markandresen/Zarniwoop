<script lang="ts">
  import { onMount } from 'svelte'
  import Toolbar from './lib/Toolbar.svelte'
  import AiSidebar from './lib/AiSidebar.svelte'
  import SettingsPanel from './lib/SettingsPanel.svelte'
  import StatusOrb from './lib/StatusOrb.svelte'
  import {
    applyBrandTheme,
    BRAND_COLOR_SETTING_KEY,
    DEFAULT_BRAND_COLOR
  } from './lib/brandTheme'

  const SIDEBAR_DEFAULT = 380
  const TOOLBAR_HEIGHT = 56
  const isIconDockShell = new URLSearchParams(window.location.search).has('iconDock')

  /** Default: companion mode — browser collapsed, AI + tools only, docked right. */
  let browserCollapsed = $state(true)
  let sidebarCollapsed = $state(false)
  let sidebarWidth = $state(SIDEBAR_DEFAULT)
  let showSettings = $state(false)
  let dragging = $state(false)

  onMount(() => {
    applyBrandTheme(DEFAULT_BRAND_COLOR)
    void window.zarniwoop.getSetting(BRAND_COLOR_SETTING_KEY).then((value) => {
      applyBrandTheme(value ?? DEFAULT_BRAND_COLOR)
    })
    const offBrand = window.zarniwoop.onSettingChanged(({ key, value }) => {
      if (key === BRAND_COLOR_SETTING_KEY) applyBrandTheme(value)
    })

    if (isIconDockShell) {
      document.documentElement.classList.add('icon-dock-mode')
      return () => {
        offBrand()
      }
    }
    const offSidebar = window.zarniwoop.onSidebarCollapsed((collapsed) => {
      sidebarCollapsed = collapsed
    })
    return () => {
      offBrand()
      offSidebar()
    }
  })

  $effect(() => {
    if (isIconDockShell || sidebarCollapsed) return
    void window.zarniwoop.setBrowserCollapsed(browserCollapsed)
  })

  $effect(() => {
    if (isIconDockShell || sidebarCollapsed || browserCollapsed) {
      if (!isIconDockShell) {
        void window.zarniwoop.setChromeLayout({
          toolbarHeight: TOOLBAR_HEIGHT,
          rightChrome: 0
        })
      }
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
    const result = await window.zarniwoop.setSidebarCollapsed(next)
    sidebarCollapsed = Boolean(result?.sidebarCollapsed ?? next)
    if (!sidebarCollapsed && result && typeof result.browserCollapsed === 'boolean') {
      browserCollapsed = result.browserCollapsed
    }
  }

  async function openFromIconDock(): Promise<void> {
    await window.zarniwoop.setSidebarCollapsed(false)
  }

  function onIconDockContextMenu(event: MouseEvent): void {
    event.preventDefault()
    const ok = window.confirm('Quit Zarniwoop?')
    if (ok) void window.zarniwoop.quit()
  }

  /** Vertical slide: click = open, drag = move + persist. */
  let dockDrag = $state(false)
  let dockMoved = $state(false)
  let startScreenY = 0
  let grabOffsetY = 0

  function onIconDockPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return
    event.preventDefault()
    const target = event.currentTarget as HTMLElement
    target.setPointerCapture(event.pointerId)
    dockDrag = true
    dockMoved = false
    startScreenY = event.screenY
    // Offset of cursor inside the chip window (DIP).
    grabOffsetY = event.clientY
  }

  function onIconDockPointerMove(event: PointerEvent): void {
    if (!dockDrag) return
    if (!dockMoved) {
      if (Math.abs(event.screenY - startScreenY) < 4) return
      dockMoved = true
    }
    void window.zarniwoop.moveIconDockFollow(grabOffsetY)
  }

  function onIconDockPointerUp(event: PointerEvent): void {
    if (!dockDrag) return
    const target = event.currentTarget as HTMLElement
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId)
    }
    const moved = dockMoved
    dockDrag = false
    dockMoved = false
    if (moved) {
      void window.zarniwoop.persistIconDockY()
      return
    }
    void openFromIconDock()
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

{#if isIconDockShell}
  <!-- Separate transparent window — only the restore chip. -->
  <div class="icon-dock">
    <button
      type="button"
      class="icon-dock-btn"
      class:dragging={dockDrag && dockMoved}
      onpointerdown={onIconDockPointerDown}
      onpointermove={onIconDockPointerMove}
      onpointerup={onIconDockPointerUp}
      onpointercancel={onIconDockPointerUp}
      title="Open Zarniwoop — drag to move · right-click to quit"
      aria-label="Open Zarniwoop"
      oncontextmenu={onIconDockContextMenu}
    >
      <StatusOrb visual="zarniwoop" size="icon" orbState="idle" />
    </button>
  </div>
{:else}
  <div class="shell" class:companion={browserCollapsed} class:dragging>
    <Toolbar
      {browserCollapsed}
      {sidebarCollapsed}
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
  }

  /* 14px plate on transparent window — no OS square behind. */
  .icon-dock-btn {
    width: 56px;
    height: 56px;
    border: 1px solid color-mix(in srgb, var(--zw-brand) 35%, var(--zw-border));
    border-radius: 14px;
    background: #0b0d10;
    color: #fff;
    display: grid;
    place-items: center;
    cursor: grab;
    touch-action: none;
    box-shadow:
      0 4px 14px rgba(0, 0, 0, 0.45),
      0 1px 3px rgba(0, 0, 0, 0.35);
    padding: 0;
    overflow: hidden;
  }

  .icon-dock-btn.dragging {
    cursor: grabbing;
  }

  .icon-dock-btn:hover {
    border-color: color-mix(in srgb, var(--zw-brand) 60%, var(--zw-border));
    filter: brightness(1.08);
    box-shadow:
      0 6px 18px rgba(0, 0, 0, 0.5),
      0 2px 6px rgba(0, 0, 0, 0.35);
  }

  .icon-dock-btn :global(.orb),
  .icon-dock-btn :global(canvas) {
    border-radius: 10px;
  }

  .shell {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--zw-bg);
    backdrop-filter: blur(2px);
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
