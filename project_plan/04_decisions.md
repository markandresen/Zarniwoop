# Zarniwoop — Locked Decisions

Change these only deliberately; update this file in the same change as any conflicting doc or code.

## ADR summary

| ID | Topic | Decision |
| --- | --- | --- |
| ADR-001 | Ownership | `project_plan/` is **product/architecture** law. Root `AGENTS.md` points agents here. Code may refine implementation detail only if it does not contradict these docs (update docs in the same change when APIs evolve). |
| ADR-002 | Multi-machine + Git | Same Dropbox folder on multiple PCs/Macs. **Git is the version source of truth** (commits/history/branches). Dropbox is the sync vehicle — never treat Dropbox conflict copies (`* (Conflicted copy)*`) as authoritative. Init a git repo in this project root; commit on one machine, pull/sync before editing on another. |
| ADR-003 | Platforms | Ship macOS and Windows. **Primary workstation: Windows (PC).** Phase 1 = shared Electron shell on both; docking = **Windows AppBar first**, macOS overlay next. |
| ADR-009 | App identity | Product name **Zarniwoop**. Use that for window title, packaging display name, and user-facing brand. Package id at scaffold: `com.zarniwoop.app` (adjust only if store requirements force it). |
| ADR-004 | Cloud gateway | Node in-process OpenAI-compatible router in Electron main (LiteLLM *pattern*). **Not** a Python LiteLLM sidecar. |
| ADR-005 | Model policy | Multi-provider: major frontier + free/open tiers. **Free path is first choice** in routing and default UX; frontier is opt-in or escalate. |
| ADR-006 | Default routing | Prefer OpenJarvis local when capable → else first configured free cloud route → frontier only if user selects, intent requires (e.g. live search / heavy agent), or free path fails and failover is allowed. |
| ADR-007 | Local stack | OpenJarvis + SQLite (`sqlite-vec` / FTS5) + `safeStorage`. Local is the primary free/offline default when hardware allows. |
| ADR-008 | Launch UX | Dual-pane: main browser + collapsible AI sidebar. Dashboard widgets are Phase 4, not first paint. |

## Resolved from earlier clarifying questions

| Question | Resolution |
| --- | --- |
| LiteLLM packaging | Node in-process translator/gateway — not embedded Python sidecar |
| Default model preset | Free-first (local, then free cloud) — not `xai/grok-fast` as forced default |
| Phase 1 OS priority | Both OS; **PC primary** — docking starts with Windows AppBar, then macOS overlay |
| App name | Zarniwoop |
| Version control | Git repo in project root; git wins over Dropbox file history |

## Model catalog (living)

Add rows freely; do not invent a single-vendor product.

### Free-first tier (default)

| Provider / path | Example models / notes | MVP |
| --- | --- | --- |
| OpenJarvis local | Quantized local LLMs (e.g. Qwen 2.5 3B/7B class) via Ollama / llama.cpp | Yes — default when capable |
| OpenRouter | Free-route catalog models (ids vary; pin stable free ids at integration time) | Yes — when key present |
| Groq | Free-tier eligible models per current Groq limits | Yes — when key present |
| Google AI Studio | Gemini free-tier where ToS/key allow | Yes — when key present |

### Frontier tier (BYOK, secondary)

| Provider | Example model ids | MVP |
| --- | --- | --- |
| xAI | `xai/grok-fast`, `xai/grok-3`, heavier Grok for agentic work | Yes |
| Anthropic | Claude current Sonnet / Opus class | Yes |
| OpenAI | GPT current flagship / mini class | Yes |
| Google | Gemini frontier (paid / advanced) | Yes |

### Post-MVP (allowed later without architecture change)

- Additional aggregators or regional providers behind the same OpenAI-compatible adapter interface.  
- Broader open-weight hosts if they speak the same gateway shape.

## Failover policy

1. Honor an explicit user model pin.  
2. Else stay on free-first chain.  
3. On failure: next free route, then frontier only if user enabled cross-tier failover or task was already frontier.
