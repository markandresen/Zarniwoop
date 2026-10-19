/** AI provider choices and setup links shown in onboarding and settings. */

export const AI_SETUP_COMPLETE_KEY = 'ai.setupComplete'

/** Free cloud options offered in first-run setup. */
export const CLOUD_QUICK_START = [
  {
    id: 'google' as const,
    label: 'Google',
    signupUrl: 'https://aistudio.google.com/apikey',
    signupLabel: 'Get a free Google key'
  },
  {
    id: 'groq' as const,
    label: 'Groq',
    signupUrl: 'https://console.groq.com/keys',
    signupLabel: 'Get a free Groq key'
  }
]

export const OLLAMA_DOWNLOAD_URL = 'https://ollama.com/download'

export const PRIMARY_PROVIDERS = [
  { id: 'google', label: 'Google (free tier)' },
  { id: 'groq', label: 'Groq (free tier)' },
  { id: 'openrouter', label: 'OpenRouter (free models)' }
] as const

export const MORE_PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'xai', label: 'xAI' }
] as const
