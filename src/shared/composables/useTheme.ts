import { useDark, useLocalStorage } from '@vueuse/core'

export const DEFAULT_ACCENT = '#1d4ed8'

export const ACCENT_PRESETS = [
  '#1d4ed8',
  '#4338ca',
  '#6d28d9',
  '#be123c',
  '#b45309',
  '#0e7490',
  '#047857',
  '#334155',
]

const SHADE_LIGHTNESS: Record<string, (lightness: number) => number> = {
  '50': (l) => l + (1 - l) * 0.8,
  '400': (l) => l + (1 - l) * 0.4,
  '500': (l) => l + (1 - l) * 0.25,
  '600': (l) => l + (1 - l) * 0.12,
  '700': (l) => l,
  '800': (l) => l * 0.6,
}

const isDark = useDark({
  storageKey: 'tandem_theme',
  attribute: 'class',
  selector: 'html',
})

const accent = useLocalStorage<string>('tandem_accent', DEFAULT_ACCENT)

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.trim().replace('#', '')
  const num = Number.parseInt(value, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
  const rN = r / 255
  const gN = g / 255
  const bN = b / 255
  const max = Math.max(rN, gN, bN)
  const min = Math.min(rN, gN, bN)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === rN) {
    h = (gN - bN) / d + (gN < bN ? 6 : 0)
  } else if (max === gN) {
    h = (bN - rN) / d + 2
  } else {
    h = (rN - gN) / d + 4
  }
  return [(h * 60) % 360, s, l]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let rgb: [number, number, number]
  if (h < 60) rgb = [c, x, 0]
  else if (h < 120) rgb = [x, c, 0]
  else if (h < 180) rgb = [0, c, x]
  else if (h < 240) rgb = [0, x, c]
  else if (h < 300) rgb = [x, 0, c]
  else rgb = [c, 0, x]
  return [
    Math.round((rgb[0] + m) * 255),
    Math.round((rgb[1] + m) * 255),
    Math.round((rgb[2] + m) * 255),
  ]
}

export function normalizeHex(value: string): string {
  const trimmed = value.trim()
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  if (/^#[0-9a-fA-F]{6}$/.test(withHash)) return withHash
  return DEFAULT_ACCENT
}

export function accentCssVars(value: string): Record<string, string> {
  const hex = normalizeHex(value)
  const [r, g, b] = hexToRgb(hex)
  const [h, s, l] = rgbToHsl([r, g, b])
  const sat = Math.min(1, Math.max(0.55, s))
  const vars: Record<string, string> = {}
  for (const [shade, lightness] of Object.entries(SHADE_LIGHTNESS)) {
    const [sr, sg, sb] = hslToRgb(h, sat, lightness(l))
    vars[`--blue-${shade}`] = `${sr} ${sg} ${sb}`
  }
  vars['--blue-700'] = `${r} ${g} ${b}`
  return vars
}

function applyAccent(value: string) {
  const vars = accentCssVars(value)
  for (const [key, val] of Object.entries(vars)) {
    document.documentElement.style.setProperty(key, val)
  }
}

applyAccent(accent.value)

export function useTheme() {
  return {
    isDark,
    accent,
    setAccent: (value: string) => {
      accent.value = normalizeHex(value)
      applyAccent(accent.value)
    },
    previewAccent: (value: string) => {
      applyAccent(value)
    },
  }
}
