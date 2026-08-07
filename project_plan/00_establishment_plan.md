# SoT Establishment Plan

This record captures how the `project_plan/` source of truth was created. Execution status: **done** (docs written; no application code in this pass).

## Goal

Create a durable, multi-machine SoT under `project_plan/` from the old root drafts (now in `_archive/` only). Docs + agent pointer only. Root `01_Zarniwoop*` stubs were removed after archive.

## Locked decisions (summary)

Full detail lives in [04_decisions.md](04_decisions.md).

- **Ownership:** `project_plan/` is product/architecture law; root `AGENTS.md` points here. Code wins only for implementation detail that does not contradict these docs.  
- **Platforms:** macOS and Windows. Shared Electron shell first; macOS overlay docking then Windows AppBar.  
- **Cloud gateway:** Node in-process OpenAI-compatible router (LiteLLM *pattern*, not Python sidecar).  
- **Models:** Multi-provider frontier + free; **free path is first choice**; frontier opt-in / escalate.  
- **Local AI:** OpenJarvis + SQLite (`sqlite-vec` / FTS5) + `safeStorage`.

## Doc map

```text
project_plan/
  README.md
  00_establishment_plan.md
  01_vision.md
  02_architecture.md
  03_mvp_roadmap.md
  04_decisions.md
  05_ipc_api.md
AGENTS.md
project_plan/_archive/   # superseded root drafts
```

## Out of scope (this pass)

- Bootstrapping Electron/Svelte code  
- Installing OpenJarvis / packaging installers  
- Extra Cursor rules beyond root `AGENTS.md`
