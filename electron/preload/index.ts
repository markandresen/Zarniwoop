import { contextBridge, ipcRenderer } from 'electron'

export type DockEdge = 'none' | 'left' | 'right' | 'top'

const zarniwoopAPI = {
  sendPrompt: (payload: {
    prompt: string
    intent: 'fast' | 'deep' | 'local'
    context?: unknown
  }) => ipcRenderer.invoke('ai:send-prompt', payload),

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

  setSidebarCollapsed: (collapsed: boolean) =>
    ipcRenderer.invoke('shell:set-sidebar-collapsed', collapsed),

  setSidebarWidth: (width: number) => ipcRenderer.invoke('shell:set-sidebar-width', width),

  dock: (edge: DockEdge) => ipcRenderer.invoke('shell:dock', edge)
}

contextBridge.exposeInMainWorld('zarniwoop', zarniwoopAPI)

export type ZarniwoopAPI = typeof zarniwoopAPI
