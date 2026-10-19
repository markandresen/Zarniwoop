/** Model catalog from project_plan/04_decisions.md — living list for Phase 2. */

export type ModelTier = 'local' | 'free' | 'frontier'

export type CatalogEntry = {
  id: string
  label: string
  provider: string
  tier: ModelTier
  /** Prefer when on battery / low VRAM for local. */
  small?: boolean
}

/** Cloud free-tier defaults (pin stable ids; adjust as providers change). */
export const FREE_CLOUD_MODELS: CatalogEntry[] = [
  {
    id: 'openrouter/meta-llama/llama-3.2-3b-instruct:free',
    label: 'Llama 3.2 3B (OpenRouter free)',
    provider: 'openrouter',
    tier: 'free',
    small: true
  },
  {
    id: 'groq/llama-3.1-8b-instant',
    label: 'Llama 3.1 8B (Groq)',
    provider: 'groq',
    tier: 'free'
  },
  {
    id: 'google/gemini-2.0-flash',
    label: 'Gemini 2.0 Flash (AI Studio)',
    provider: 'google',
    tier: 'free',
    small: true
  }
]

export const FRONTIER_MODELS: CatalogEntry[] = [
  { id: 'xai/grok-fast', label: 'Grok Fast (xAI)', provider: 'xai', tier: 'frontier' },
  { id: 'xai/grok-3', label: 'Grok 3 (xAI)', provider: 'xai', tier: 'frontier' },
  {
    id: 'anthropic/claude-sonnet-4-20250514',
    label: 'Claude Sonnet (Anthropic)',
    provider: 'anthropic',
    tier: 'frontier'
  },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini (OpenAI)', provider: 'openai', tier: 'frontier' },
  { id: 'openai/gpt-4o', label: 'GPT-4o (OpenAI)', provider: 'openai', tier: 'frontier' },
  {
    id: 'google/gemini-2.5-pro',
    label: 'Gemini 2.5 Pro (Google)',
    provider: 'google',
    tier: 'frontier'
  }
]

export function parseModelId(id: string): { provider: string; model: string } {
  const slash = id.indexOf('/')
  if (slash <= 0) return { provider: 'unknown', model: id }
  return { provider: id.slice(0, slash), model: id.slice(slash + 1) }
}

export function findCatalogEntry(id: string): CatalogEntry | undefined {
  return [...FREE_CLOUD_MODELS, ...FRONTIER_MODELS].find((m) => m.id === id)
}

export function cloudCatalog(): CatalogEntry[] {
  return [...FREE_CLOUD_MODELS, ...FRONTIER_MODELS]
}
