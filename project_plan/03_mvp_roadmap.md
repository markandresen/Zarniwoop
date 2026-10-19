# Zarniwoop — 12-Week MVP Roadmap

```text
Phase 1 (W1-3): Shell & UI  --->  Phase 2 (W4-6): Hybrid AI Core
        |                                    |
Phase 4 (W10-12): Polish & Release  <---  Phase 3 (W7-9): Automation
```

**Platforms:** every phase must remain viable on **macOS and Windows**. Primary day-to-day workstation is **Windows (PC)**; still smoke Mac before closing a phase. Docking: **Windows AppBar first**, macOS overlay next (shared shell is the Phase 1 gate).

---

## Phase 1 — Shell & window orchestration (weeks 1–3)

- Bootstrap Electron + Svelte 5 + Tailwind via Vite.  
- Dual-pane layout, edge resize, collapse AI sidebar.  
- Window docking controls: Windows AppBar first; macOS overlay next.  
- `safeStorage` vault for API keys; initialize SQLite schemas.  
- Git repo initialized; Phase 1 work committed so other machines pull the same tree.  
- **Exit:** app launches on PC and Mac as browser + AI sidebar shell (PC is primary verify target).

## Phase 2 — Hybrid AI router & engines (weeks 4–6)

- Wire local engine from Electron main over **HTTP** to Ollama (`:11434/v1`) and optional OpenJarvis serve (`:8000/v1`); probe RAM/VRAM — do **not** bundle Python OpenJarvis inside the app.  
- Node OpenAI-compatible gateway: free providers + frontier BYOK.  
- Hybrid router: **free-first** (local → free cloud → frontier opt-in), plus battery-aware throttling hooks.  
- Svelte 5 chat sidebar with streaming tokens; model picker lists full catalog.  
- **Exit:** chat works offline/local and via at least one free cloud path; frontier works when keys set.

## Phase 3 — Web automation & memory (weeks 7–9)

- `WebContentsView` manager (spawn/destroy views).  
- CDP bindings for DOM inspect and form fill.  
- OpenJarvis vector indexing (`sqlite-vec` / FTS5) for notes and tab memory.  
- MCP tool connectors.  
- **Exit:** agent can read page context and perform basic DOM actions; local memory search works.

## Phase 4 — Dashboard, energy, release (weeks 10–12)

- Dashboard widgets (tasks, unread email, local notes) — not required for Phase 1 launch UX.  
- `powerMonitor` throttling for local models on battery.  
- Global hotkey (`Alt + Z`) and accessibility context capture.  
- Packaging, `electron-updater`, footprint pass for Mac + Windows.  
- **Exit:** installable builds for both OS; free-first routing and privacy bounds intact.
