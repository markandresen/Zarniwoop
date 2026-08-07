# Zarniwoop — IPC / Preload API

Contract for the sanitized preload bridge. Evolve carefully; update this file when channels change.

```typescript
// Shared types & preload context bridge
import { ipcRenderer } from 'electron';

export const zarniwoopAPI = {
  // AI execution — router applies free-first unless intent/user pin says otherwise
  sendPrompt: (payload: {
    prompt: string;
    intent: 'fast' | 'deep' | 'local';
    context?: unknown;
  }) => ipcRenderer.invoke('ai:send-prompt', payload),

  // Model settings & key vault
  saveApiKey: (provider: string, key: string) =>
    ipcRenderer.invoke('vault:save-key', { provider, key }),

  // Local notes & vector memory
  searchLocalMemory: (query: string) =>
    ipcRenderer.invoke('memory:search', query),

  // Web automation controls
  executeDOMAction: (action: {
    type: 'click' | 'fill' | 'extract';
    selector: string;
    value?: string;
  }) => ipcRenderer.invoke('cdp:execute-action', action),
};
```

## Channel map

| Channel | Direction | Purpose |
| --- | --- | --- |
| `ai:send-prompt` | renderer → main | Hybrid router entry (free-first) |
| `vault:save-key` | renderer → main | Persist provider key via `safeStorage` |
| `memory:search` | renderer → main | Local SQLite vector / FTS5 search |
| `cdp:execute-action` | renderer → main | DOM click / fill / extract |
| `shell:set-browser-collapsed` | renderer → main | Companion mode (default `true`) vs dual-pane |
| `shell:set-chrome-layout` | renderer → main | Toolbar height + right chrome width reserved from `WebContentsView` |
| `shell:set-sidebar-collapsed` | renderer → main | Full UI vs icon-dock chip (window shrinks to restore icon) |
| `shell:dock` | renderer → main | Dock edge (`right` default on launch) |

## Notes

- Expose only via `contextBridge`; no Node integration in renderers.  
- Streaming token events should use a dedicated main → renderer channel (to be named at Phase 2 implementation, e.g. `ai:stream-chunk`) and documented here when added.  
- Prefer typed payloads over `any` when implementation starts.
