/** Brand accent — matches official Zarniwoop orb violet by default. */
export const DEFAULT_BRAND_COLOR = '#a878ff'

const HEX_RE = /^#([0-9a-f]{6})$/i

export function normalizeBrandColor(input: string | null | undefined): string {
  if (!input) return DEFAULT_BRAND_COLOR
  const raw = input.trim()
  const withHash = raw.startsWith('#') ? raw : `#${raw}`
  if (!HEX_RE.test(withHash)) return DEFAULT_BRAND_COLOR
  return withHash.toLowerCase()
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const n = normalizeBrandColor(hex).slice(1)
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16)
  }
}

/** RGB → hue degrees [0, 360). */
export function hexToHue(hex: string): number {
  const { r, g, b } = parseHex(hex)
  const R = r / 255
  const G = g / 255
  const B = b / 255
  const max = Math.max(R, G, B)
  const min = Math.min(R, G, B)
  const d = max - min
  if (d === 0) return 0
  let h = 0
  if (max === R) h = ((G - B) / d) % 6
  else if (max === G) h = (B - R) / d + 2
  else h = (R - G) / d + 4
  h *= 60
  if (h < 0) h += 360
  return h
}

function mixTowardBlack(hex: string, amount: number): string {
  const { r, g, b } = parseHex(hex)
  const f = Math.min(1, Math.max(0, amount))
  const to = (c: number) => Math.round(c * (1 - f))
  const h = (c: number) => to(c).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

/** Push brand CSS vars onto :root (active chrome + orb hue shift). */
export function applyBrandTheme(input: string | null | undefined): string {
  const color = normalizeBrandColor(input)
  const root = document.documentElement
  root.style.setProperty('--zw-brand', color)
  root.style.setProperty('--zw-brand-dim', mixTowardBlack(color, 0.28))
  // Legacy alias — older copper tokens follow brand.
  root.style.setProperty('--zw-copper', color)
  const shift = hexToHue(color) - hexToHue(DEFAULT_BRAND_COLOR)
  root.style.setProperty('--zw-brand-hue-shift', `${shift.toFixed(2)}deg`)
  return color
}

export const BRAND_COLOR_PRESETS: { id: string; label: string; value: string }[] = [
  { id: 'logo', label: 'Logo purple', value: DEFAULT_BRAND_COLOR },
  { id: 'orange', label: 'Orange', value: '#ff7a1a' },
  { id: 'blue', label: 'Blue', value: '#3b9eff' },
  { id: 'green', label: 'Green', value: '#22e07a' },
  { id: 'red', label: 'Red', value: '#ff3b4a' }
]

export const BRAND_COLOR_SETTING_KEY = 'ui.brandColor'
