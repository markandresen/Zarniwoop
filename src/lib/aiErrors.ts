/** Turn raw AI/transport errors into short, user-facing messages. */

const RULES: Array<[RegExp, string]> = [
  [/aborted/i, 'Stopped.'],
  [/no api key|no key/i, 'No API key saved for this provider. Add one in Settings.'],
  [/HTTP 401|HTTP 403|invalid.*key|unauthorized/i, 'The API key was rejected. Check it in Settings.'],
  [/HTTP 429|rate.?limit|quota/i, 'Rate limit reached. Wait a moment or pick another model.'],
  [/HTTP 5\d\d/i, 'The provider is having trouble. Try again shortly.'],
  [/ECONNREFUSED|fetch failed|network|ENOTFOUND|timed? ?out/i, 'Could not reach the AI service. Check your connection or that the local engine is running.'],
  [/no (local )?model|no route/i, 'No model available. Install a local model or add a cloud key.']
]

export function formatAiError(raw: unknown): string {
  const text = raw instanceof Error ? raw.message : String(raw ?? '')
  for (const [pattern, message] of RULES) {
    if (pattern.test(text)) return message
  }
  return text.trim() ? `Something went wrong: ${text.trim().slice(0, 200)}` : 'Something went wrong.'
}

export function routeLabel(routedTo?: string): string {
  switch (routedTo) {
    case 'local':
      return 'Local'
    case 'free':
      return 'Free cloud'
    case 'frontier':
      return 'Cloud'
    default:
      return ''
  }
}
