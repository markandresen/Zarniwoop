# Zarniwoop — Vision

## Executive summary

**Zarniwoop** is a desktop-native workspace shell and docked OS companion that combines an embedded browser engine, a persistent AI sidebar agent, and (later) a unified productivity dashboard.

It acts as an intelligent top-level operating frame: zero-latency, privacy-first local operations (notes, local vector memory, background indexing) plus cloud capabilities for multi-step browser automation and live web research when the user or task needs them.

## Design pillars

1. **Browser + AI companion** — Dual-pane shell at launch; dashboard widgets come in a later phase.  
2. **Free-first intelligence** — Prefer local OpenJarvis and free cloud routes; frontier models available by choice or escalation.  
3. **Privacy bounds** — Sensitive notes, autofill, and personal documents stay on-device via OpenJarvis.  
4. **Cross-platform** — First-class macOS and Windows.  
5. **Model agnostic** — One OpenAI-compatible gateway shape; many providers (BYOK).

## Core stack

| Layer | Choice |
| --- | --- |
| Desktop shell & UI | Electron + Svelte 5 + Tailwind CSS (Vite); icons = Untitled UI Icons (line) |
| Local intelligence | OpenJarvis (on-device models, VRAM probing, SQLite vector memory, power profiling) |
| Cloud gateway | Node in-process OpenAI-compatible router (LiteLLM pattern; not Python sidecar) |
| Models | Free-first (local + free cloud tiers); frontier BYOK: xAI Grok, Anthropic Claude, OpenAI, Google Gemini |
| Automation | Chrome DevTools Protocol (CDP) & `browser-use` |
| Persistence & vault | SQLite (`sqlite-vec` / FTS5) + Electron `safeStorage` |

See [02_architecture.md](02_architecture.md) for system detail and [04_decisions.md](04_decisions.md) for locked calls.
