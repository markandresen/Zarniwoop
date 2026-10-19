import { contextBridge, ipcRenderer } from 'electron'

export type DockEdge = 'none' | 'left' | 'right' | 'top'

export type AiIntent = 'fast' | 'deep' | 'local'

export type AiStreamChunk = { requestId: string; delta: string }

export type AiStreamEnd = {
  requestId: string
  ok: boolean
  error?: string
  routedTo?: string
  model?: string
}

const zarniwoopAPI = {
  sendPrompt: (payload: {
    prompt: string
    intent: AiIntent
    model?: string | null
    context?: unknown
    allowCrossTierFailover?: boolean
  }) =>
    ipcRenderer.invoke('ai:send-prompt', payload) as Promise<{
      ok: boolean
      requestId?: string
      routedTo?: string
      model?: string
      provider?: string
      error?: string
    }>,

  listModels: () => ipcRenderer.invoke('ai:list-models'),

  getAiReadiness: () =>
    ipcRenderer.invoke('ai:get-readiness') as Promise<{
      ok: boolean
      ready?: boolean
      localReady?: boolean
      cloudReady?: boolean
      reason?: string
      error?: string
    }>,

  testConnection: (provider?: string) =>
    ipcRenderer.invoke('ai:test-connection', provider) as Promise<{
      ok: boolean
      message: string
    }>,

  abortPrompt: (requestId: string) => ipcRenderer.invoke('ai:abort', requestId),

  openExternal: (url: string) =>
    ipcRenderer.invoke('shell:open-external', url) as Promise<{ ok: boolean; error?: string }>,

  onAiStreamChunk: (handler: (payload: AiStreamChunk) => void) => {
    const listener = (_event: unknown, payload: AiStreamChunk) => {
      handler(payload)
    }
    ipcRenderer.on('ai:stream-chunk', listener)
    return () => {
      ipcRenderer.removeListener('ai:stream-chunk', listener)
    }
  },

  onAiStreamEnd: (handler: (payload: AiStreamEnd) => void) => {
    const listener = (_event: unknown, payload: AiStreamEnd) => {
      handler(payload)
    }
    ipcRenderer.on('ai:stream-end', listener)
    return () => {
      ipcRenderer.removeListener('ai:stream-end', listener)
    }
  },

  saveApiKey: (provider: string, key: string) =>
    ipcRenderer.invoke('vault:save-key', { provider, key }),

  hasApiKey: (provider: string) => ipcRenderer.invoke('vault:has-key', provider),

  listKeyProviders: () => ipcRenderer.invoke('vault:list-providers'),

  searchLocalMemory: (query: string) => ipcRenderer.invoke('memory:search', query),

  upsertMemory: (item: { id?: string; kind: string; title: string; body: string }) =>
    ipcRenderer.invoke('memory:upsert', item),

  executeDOMAction: (action: {
    type: 'click' | 'fill' | 'extract'
    selector: string
    value?: string
  }) => ipcRenderer.invoke('cdp:execute-action', action),

  navigate: (url: string) => ipcRenderer.invoke('shell:navigate', url),

  getUrl: () => ipcRenderer.invoke('shell:get-url') as Promise<string>,

  setBrowserCollapsed: (collapsed: boolean) =>
    ipcRenderer.invoke('shell:set-browser-collapsed', collapsed),

  getBrowserCollapsed: () =>
    ipcRenderer.invoke('shell:get-browser-collapsed') as Promise<boolean>,

  setChromeLayout: (layout: { toolbarHeight: number; rightChrome: number }) =>
    ipcRenderer.invoke('shell:set-chrome-layout', layout),

  setSidebarCollapsed: (collapsed: boolean) =>
    ipcRenderer.invoke('shell:set-sidebar-collapsed', collapsed),

  getSidebarCollapsed: () =>
    ipcRenderer.invoke('shell:get-sidebar-collapsed') as Promise<boolean>,

  onSidebarCollapsed: (handler: (collapsed: boolean) => void) => {
    const listener = (_event: unknown, collapsed: boolean) => {
      handler(Boolean(collapsed))
    }
    ipcRenderer.on('shell:sidebar-collapsed', listener)
    return () => {
      ipcRenderer.removeListener('shell:sidebar-collapsed', listener)
    }
  },

  getIconDockBounds: () =>
    ipcRenderer.invoke('shell:get-icon-dock-bounds') as Promise<{
      x: number
      y: number
      width: number
      height: number
    } | null>,

  moveIconDockY: (screenY: number) =>
    ipcRenderer.invoke('shell:move-icon-dock-y', screenY) as Promise<{
      ok: boolean
      y: number
    }>,

  moveIconDockDy: (dy: number) =>
    ipcRenderer.invoke('shell:move-icon-dock-dy', dy) as Promise<{
      ok: boolean
      y: number
    }>,

  moveIconDockFollow: (grabOffsetY: number) =>
    ipcRenderer.invoke('shell:move-icon-dock-follow', grabOffsetY) as Promise<{
      ok: boolean
      y: number
    }>,

  persistIconDockY: () =>
    ipcRenderer.invoke('shell:persist-icon-dock-y') as Promise<{
      ok: boolean
      yFraction: number
    }>,

  getSetting: (key: string) =>
    ipcRenderer.invoke('settings:get', key) as Promise<string | null>,

  setSetting: (key: string, value: string) =>
    ipcRenderer.invoke('settings:set', { key, value }) as Promise<{
      ok: boolean
      key?: string
      value?: string
      error?: string
    }>,

  onSettingChanged: (handler: (payload: { key: string; value: string }) => void) => {
    const listener = (_event: unknown, payload: { key: string; value: string }) => {
      handler(payload)
    }
    ipcRenderer.on('settings:changed', listener)
    return () => {
      ipcRenderer.removeListener('settings:changed', listener)
    }
  },

  dock: (edge: DockEdge) => ipcRenderer.invoke('shell:dock', edge),

  quit: () => ipcRenderer.invoke('shell:quit') as Promise<{ ok: boolean }>
}

contextBridge.exposeInMainWorld('zarniwoop', zarniwoopAPI)

export type ZarniwoopAPI = typeof zarniwoopAPI
