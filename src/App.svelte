<script lang="ts">
  import Toolbar from './lib/Toolbar.svelte'
  import AiSidebar from './lib/AiSidebar.svelte'
  import SettingsPanel from './lib/SettingsPanel.svelte'

  const SIDEBAR_DEFAULT = 380

  let sidebarCollapsed = $state(false)
  let sidebarWidth = $state(SIDEBAR_DEFAULT)
  let showSettings = $state(false)
  let dragging = $state(false)

  $effect(() => {
    void window.zarniwoop.setSidebarCollapsed(sidebarCollapsed)
  })

  $effect(() => {
    void window.zarniwoop.setSidebarWidth(sidebarWidth)
  })

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

<div class="shell" class:dragging>
  <Toolbar
    onToggleSidebar={() => (sidebarCollapsed = !sidebarCollapsed)}
    onOpenSettings={() => (showSettings = !showSettings)}
    {sidebarCollapsed}
  />

  <div class="workspace">
    <div class="browser-slot" aria-hidden="true"></div>

    {#if !sidebarCollapsed}
      <div
        class="resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize AI sidebar"
        onpointerdown={onResizePointerDown}
      ></div>
      <aside class="sidebar" style={`width: ${sidebarWidth}px`}>
        {#if showSettings}
          <SettingsPanel onClose={() => (showSettings = false)} />
        {:else}
          <AiSidebar />
        {/if}
      </aside>
    {/if}
  </div>
</div>

<style>
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
    flex: 1;
    min-width: 0;
    /* WebContentsView paints here from the main process */
    background: transparent;
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
    display: flex;
    flex-direction: column;
    min-height: 0;
    z-index: 1;
  }
</style>
