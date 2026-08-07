# Zarniwoop — Project Plan (Source of Truth)

This folder is the **product and architecture source of truth** for **Zarniwoop**.  
**Git** is the **version** source of truth for the whole project tree. Dropbox syncs the folder across machines — commit/pull; ignore conflict copies.

## Documents

| File | Role |
| --- | --- |
| [00_establishment_plan.md](00_establishment_plan.md) | How this SoT was established |
| [01_vision.md](01_vision.md) | Product vision and stack summary |
| [02_architecture.md](02_architecture.md) | System architecture, features, security |
| [03_mvp_roadmap.md](03_mvp_roadmap.md) | 12-week MVP phases (macOS + Windows) |
| [04_decisions.md](04_decisions.md) | Locked decisions and model catalog |
| [05_ipc_api.md](05_ipc_api.md) | Preload / IPC contract |
| [_archive/](_archive/) | Superseded root drafts (history only) |

## Precedence (highest first)

1. **04_decisions.md** — locked product/tech calls  
2. **02_architecture.md** — structure and constraints  
3. **03_mvp_roadmap.md** — build sequence  
4. **05_ipc_api.md** — IPC surface  
5. **Code** — may refine implementation detail only if these docs are updated in the same change  

If two docs conflict, follow the higher item above. Update decisions before contradicting them in architecture or code.

## Multi-machine / Dropbox + Git rules

- **Git** owns history; Dropbox only moves bits between PCs/Macs.  
- On a machine: wait for Dropbox sync → `git status` / pull or rebase as needed → then edit.  
- Prefer one active editor session per file; delete any `*Conflicted copy*` files after recovering content into git.  
- Product/architecture truth stays under `project_plan/` (and root `AGENTS.md`).  
- After sync on a new machine: read `README.md` → `04_decisions.md` → `02_architecture.md` before coding.

## Launch UX (locked understanding)

On launch the app is a **right-docked AI companion** (not a full dual-pane workspace):

- **Default:** browser collapsed — only AI chat + tools visible, docked to the **right** edge.  
- **Expand:** “Show Browser” opens dual-pane (`WebContentsView` + AI).  
- **Docking:** Windows AppBar (`SHAppBarMessage`) reserves work area; macOS overlay only (no OS work-area API).  
- **Dashboard widgets** (tasks, mail, notes): Phase 4.
