# ARCHIVED — superseded by project_plan/

Original root draft kept for history only. Authoritative docs: `project_plan/README.md`.

---

+-----------------------------------------------------------------------+
|                         ZARNIWOOP DESKTOP UI                          |
|         (Electron App / Svelte 5 Collapsible Dual-Pane Shell)         |
+-----------------------------------------------------------------------+
|
IPC Bridge (Sanitized)
v
+-----------------------------------------------------------------------+
|                     MAIN PROCESS & HYBRID ROUTER                      |
|                                                                       |
|   Evaluates task intent, privacy level, latency requirement, and      |
|   battery/thermal status (powerMonitor)                             |
+-----------------------------------------------------------------------+
/

/

v                                               v
+-----------------------------------+   +-----------------------------------+
|        OPENJARVIS (LOCAL)         |   |        LITELLM (CLOUD API)        |
|  - Hardware Auto-Probing (VRAM)   |   |  - Unified OpenAI API Spec        |
|  - Local LLMs (Ollama / llama.cpp)|   |  - BYOK Key Vault (safeStorage)   |
|  - SQLite Vector & FTS5 Index     |   |  - Automated Retries & Fallbacks  |
|  - MCP Tool Connectors            |   |  - Streaming Event Handlers       |
+-----------------------------------+   +-----------------------------------+
|
+-----------------+-----------------+
|                 |                 |
v                 v                 v
[xAI Grok]        [Claude]          [OpenAI]


---

## 3. Detailed Feature Specifications

### Feature 1: Dual-Pane UI & Docked Desktop Companion
* **Main Browser Pane:** Renders web pages via Electron `WebContentsView` with full Chromium extension compatibility.
* **Sidebar AI Pane:** Persistent, collapsible AI chat panel running in a dedicated renderer with streaming token output.
* **Docked OS Mode:** Supports edge-snapping on Windows (`SHAppBarMessage`) and persistent overlay modes on macOS.

### Feature 2: Hybrid AI Router & Power Management
* **Task Routing Rules:**
  * **Local Routing (OpenJarvis):** Local note/task generation, SQLite vector memory indexing, private DOM content extraction, and offline workflows.
  * **Cloud Routing (LiteLLM):** Multi-step CDP web automation, deep multi-page research, and real-time live search queries.
* **Dynamic Energy Throttling:** Listens to Electron `powerMonitor`. On battery power or high CPU heat, background indexing is paused and local model batch size is automatically throttled.

### Feature 3: Cloud API Gateway & Model Agnosticism (LiteLLM)
* **Standardized Spec:** Converts all cloud API interactions into standard OpenAI-compatible requests (`/v1/chat/completions`).
* **xAI Grok Integration:** Native integration using `xai/grok-fast` or `xai/grok-3` for fast sidebar response and live search, with `xai/grok-4.5` reserved for heavy agentic tasks.
* **Vendor Resilience:** Automatic failover between cloud models if rate limits or vendor downtime occur.

### Feature 4: Local Intelligence & Memory (OpenJarvis)
* **System Probing:** Scans host RAM, VRAM, and GPU capabilities on startup to auto-configure optimal local model parameters (e.g., Qwen 2.5 3B/7B quantized).
* **On-Device Memory:** Indexes local Markdown notes, task records, and saved tab histories into SQLite vector/FTS5 indexes without sending data off-device.
* **MCP Support:** Implements standard Model Context Protocol (MCP) handlers to interact with desktop files and tools.

### Feature 5: Cross-Context Intelligence & CDP Automation
* **DOM Scraping & Sanitization:** Inspects active web page elements, converts HTML to structured, prompt-safe JSON, and strips prompt injection threats.
* **Form Automation:** Executes browser form filling and DOM navigation actions using CDP (Chrome DevTools Protocol).

---

## 4. Security & Privacy Guardrails

1. **Context Isolation:** `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true` enforced on all WebViews.
2. **Key Storage:** Cloud API keys (xAI, OpenAI, Anthropic) are stored in encrypted OS keychains using Electron `safeStorage`.
3. **Data Privacy Bounds:** Sensitive notes, autofill data, and personal documents never leave the device and are processed exclusively via OpenJarvis.

---

## 5. 12-Week MVP Execution Roadmap

Phase 1 (W1-3): Shell & UI   ---> Phase 2 (W4-6): Hybrid AI Core
|
Phase 4 (W10-12): Polish & Release <--- Phase 3 (W7-9): Automation


### Phase 1: Shell & Window Orchestration (Weeks 1–3)
* Bootstrap Electron + Svelte 5 + Tailwind CSS build system via Vite.
* Build dual-pane layout, edge resize handlers, and window docking controls.
* Implement `safeStorage` vault for API key management and initialize local SQLite database schemas.

### Phase 2: Hybrid AI Router & Engine Integration (Weeks 4–6)
* Embed OpenJarvis runtime into Electron main process for local model execution and hardware VRAM probing.
* Integrate LiteLLM gateway client to standardize calls to cloud providers (`xAI Grok`, `Claude`, `OpenAI`).
* Implement Hybrid Router logic to assign local vs. cloud execution based on intent and battery status.
* Build Svelte 5 chat sidebar component with real-time streaming tokens.

### Phase 3: Web Automation & Split-Pane Engine (Weeks 7–9)
* Build `WebContentsView` manager for spawning and destroying browser views dynamically.
* Connect Chrome DevTools Protocol (CDP) bindings for DOM inspection and form filling.
* Connect OpenJarvis local vector indexing (`sqlite-vec` / FTS5) for local notes and open tab memory.
* Integrate MCP tool connectors.

### Phase 4: Dashboard, Energy Throttling & Release (Weeks 10–12)
* Implement unified dashboard widgets (tasks, unread emails, local notes).
* Wire up `powerMonitor` event listeners to throttle local models on battery power.
* Configure global hotkeys (`Alt + Z`) and accessibility context capture.
* Finalize packaging, auto-updater (`electron-updater`), and perform resource footprint optimizations.

---

## 6. IPC Interface Specification (`preload.ts`)

```typescript
// Shared Types & Preload Context Bridge
import { ipcRenderer } from 'electron';

export const zarniwoopAPI = {
  // AI Execution
  sendPrompt: (payload: { prompt: string; intent: 'fast' | 'deep' | 'local'; context?: any }) =>
    ipcRenderer.invoke('ai:send-prompt', payload),
  
  // Model Settings & Key Vault
  saveApiKey: (provider: string, key: string) =>
    ipcRenderer.invoke('vault:save-key', { provider, key }),
  
  // Local Notes & Vector Memory
  searchLocalMemory: (query: string) =>
    ipcRenderer.invoke('memory:search', query),

  // Web Automation Controls
  executeDOMAction: (action: { type: 'click' | 'fill' | 'extract'; selector: string; value?: string }) =>
    ipcRenderer.invoke('cdp:execute-action', action),
};
```

## 7. Clarifying Questions (resolved in project_plan/04_decisions.md)

Historical open questions from this draft are closed in the current SoT. Do not use this file for decisions.
