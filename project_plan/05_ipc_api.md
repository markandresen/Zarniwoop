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
    model?: string | null;
    context?: unknown;
    allowCrossTierFailover?: boolean;
  }) => ipcRenderer.invoke('ai:send-prompt', payload),

  listModels: () => ipcRenderer.invoke('ai:list-models'),

  abortPrompt: (requestId: string) => ipcRenderer.invoke('ai:abort', requestId),

  onAiStreamChunk: (handler: (payload: { requestId: string; delta: string }) => void) => {
    /* subscribe; returns unsubscribe */
  },

  onAiStreamEnd: (
    handler: (payload: {
      requestId: string;
      ok: boolean;
      error?: string;
      routedTo?: string;
      model?: string;
    }) => void
  ) => {
    /* subscribe; returns unsubscribe */
  },

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
| `ai:send-prompt` | renderer → main | Hybrid router entry (free-first). Returns `{ ok, requestId, routedTo, model }` then streams tokens |
| `ai:stream-chunk` | main → renderer | `{ requestId, delta }` token delta |
| `ai:stream-end` | main → renderer | `{ requestId, ok, error?, routedTo?, model? }` |
| `ai:list-models` | renderer → main | Local + cloud catalog with availability / hardware probe |
| `ai:abort` | renderer → main | Cancel in-flight `requestId` |
| `vault:save-key` | renderer → main | Persist provider key via `safeStorage` |
| `memory:search` | renderer → main | Local SQLite vector / FTS5 search |
| `cdp:execute-action` | renderer → main | DOM click / fill / extract |
| `shell:set-browser-collapsed` | renderer → main | Companion mode (default `true`) vs dual-pane |
| `shell:set-chrome-layout` | renderer → main | Toolbar height + right chrome width reserved from `WebContentsView` |
| `shell:set-sidebar-collapsed` | renderer → main | Full UI vs icon-dock chip (window shrinks to restore icon) |
| `shell:dock` | renderer → main | Dock edge (`right` default on launch) |
| `settings:get` | renderer → main | Read a SQLite settings value by key |
| `settings:set` | renderer → main | Persist a settings key/value; broadcasts `settings:changed` to all windows |
| `settings:changed` | main → renderer | `{ key, value }` after a successful `settings:set` (e.g. `ui.brandColor`) |

## Notes

- Expose only via `contextBridge`; no Node integration in renderers.  
- Streaming uses `ai:stream-chunk` / `ai:stream-end` (Phase 2). Subscribe before or immediately when calling `sendPrompt`; filter by `requestId`.  
- Prefer typed payloads over `any` when implementation starts.  
- Local path: HTTP to Ollama (`:11434`) and optional OpenJarvis serve (`:8000`); cloud gateway is Node in-process OpenAI-compatible (Anthropic uses Messages API adapter).
