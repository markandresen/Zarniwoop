# ARCHIVED — superseded by project_plan/

Original root draft kept for history only. Authoritative docs: `project_plan/README.md`.

---

# Zarniwoop: Complete Product Architecture & Execution Plan

## 1. Executive Summary & Project Vision

**Zarniwoop** is a desktop-native workspace shell and docked OS companion that combines an embedded browser engine, a persistent AI sidebar agent, and a unified productivity dashboard. 

The application functions as an intelligent top-level operating frame. It provides zero-latency, privacy-first local operations (note-taking, local vector memory search, background indexing) alongside cloud capabilities for complex multi-step browser automation and live web research.

### Core Architectural Stack
* **Desktop Shell & UI:** Electron + Svelte 5 + Tailwind CSS (via Vite)
* **Local Intelligence Engine:** **OpenJarvis** (Stanford on-device AI runtime for local model execution, hardware VRAM auto-probing, SQLite vector memory, and power profiling)
* **Cloud API Gateway:** **LiteLLM** (Unified translator for cloud LLM model agnosticism, automatic retries, and provider fallback)
* **Primary Cloud Models:** **xAI Grok** (Fast/Reasoning & Live Web Search), with support for Anthropic Claude, OpenAI, and Google Gemini
* **Automation Bridge:** Chrome DevTools Protocol (CDP) & `browser-use`
* **Local Persistence & Vault:** SQLite (`sqlite-vec` / `FTS5`) + OS Native Key Vault (`safeStorage`)

---

## 2. System Architecture
