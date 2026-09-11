import type { OddsFormat } from './types'

export function americanToDecimal(a: number): number {
  if (!isFinite(a) || a === 0) return 1
  return a > 0 ? 1 + a / 100 : 1 + 100 / Math.abs(a)
}

export function decimalToAmerican(d: number): number {
  if (!isFinite(d) || d <= 1) return -10000
  const a = d >= 2 ? (d - 1) * 100 : -100 / (d - 1)
  return normalizeAmerican(Math.round(a))
}

/** FanDuel never shows odds between -100 and +100 exclusive: -100 and +100 both render as +100. */
export function normalizeAmerican(a: number): number {
  if (a > -100 && a < 100) return 100
  if (a === -100) return 100
  return a
}

export function impliedProb(a: number): number {
  return a > 0 ? 100 / (a + 100) : Math.abs(a) / (Math.abs(a) + 100)
}

export function probToAmerican(p: number): number {
  const c = Math.min(0.995, Math.max(0.005, p))
  const dec = 1 / c
  return decimalToAmerican(dec)
}

/** Apply a bookmaker margin to a fair probability and return american odds. */
export function priceFromProb(fairProb: number, margin = 0.045): number {
  const p = Math.min(0.985, Math.max(0.01, fairProb * (1 + margin)))
  return probToAmerican(p)
}

export function parlayDecimal(legs: number[]): number {
  return legs.reduce((acc, a) => acc * americanToDecimal(a), 1)
}

export function parlayAmerican(legs: number[]): number {
  return decimalToAmerican(parlayDecimal(legs))
}

export function toWin(stake: number, american: number): number {
  return round2(stake * (americanToDecimal(american) - 1))
}

export function payout(stake: number, american: number): number {
  return round2(stake * americanToDecimal(american))
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function formatAmerican(a: number): string {
  const n = normalizeAmerican(Math.round(a))
  return n > 0 ? `+${n}` : `${n}`
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

export function formatFractional(a: number): string {
  const n = normalizeAmerican(Math.round(a))
  let num: number, den: number
  if (n > 0) { num = n; den = 100 } else { num = 100; den = Math.abs(n) }
  const g = gcd(num, den)
  return `${num / g}/${den / g}`
}

export function formatDecimal(a: number): string {
  return americanToDecimal(normalizeAmerican(a)).toFixed(2)
}

export function formatOdds(a: number, format: OddsFormat = 'american'): string {
  if (format === 'decimal') return formatDecimal(a)
  if (format === 'fractional') return formatFractional(a)
  return formatAmerican(a)
}

export function formatLine(line: number, opts: { plus?: boolean } = { plus: true }): string {
  if (line === 0) return opts.plus ? 'PK' : '0'
  const s = Math.abs(line) % 1 === 0 ? String(Math.abs(line)) : Math.abs(line).toFixed(1)
  return line > 0 ? (opts.plus ? `+${s}` : s) : `-${s}`
}

export function formatMoney(n: number, opts: { sign?: boolean } = {}): string {
  const abs = Math.abs(n)
  const s = '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (n < 0) return '-' + s
  return opts.sign && n > 0 ? '+' + s : s
}

export function combinations<T>(items: T[], k: number): T[][] {
  const out: T[][] = []
  const rec = (start: number, combo: T[]) => {
    if (combo.length === k) { out.push(combo.slice()); return }
    for (let i = start; i < items.length; i++) { combo.push(items[i]); rec(i + 1, combo); combo.pop() }
  }
  rec(0, [])
  return out
}

export function nCr(n: number, r: number): number {
  if (r < 0 || r > n) return 0
  let res = 1
  for (let i = 1; i <= r; i++) res = (res * (n - r + i)) / i
  return Math.round(res)
}

/** Teaser payout tables (american odds by number of legs). */
export const TEASER_TABLES: Record<string, Record<number, number>> = {
  'football-6': { 2: -120, 3: 150, 4: 240, 5: 400, 6: 600, 7: 900, 8: 1400, 9: 2000, 10: 3000 },
  'football-6.5': { 2: -130, 3: 140, 4: 200, 5: 350, 6: 500, 7: 800, 8: 1200, 9: 1800, 10: 2500 },
  'football-7': { 2: -140, 3: 120, 4: 180, 5: 300, 6: 450, 7: 700, 8: 1000, 9: 1500, 10: 2200 },
  'basketball-4': { 2: -120, 3: 150, 4: 240, 5: 400, 6: 600, 7: 900, 8: 1400, 9: 2000, 10: 3000 },
  'basketball-4.5': { 2: -130, 3: 140, 4: 200, 5: 350, 6: 500, 7: 800, 8: 1200, 9: 1800, 10: 2500 },
  'basketball-5': { 2: -140, 3: 120, 4: 180, 5: 300, 6: 450, 7: 700, 8: 1000, 9: 1500, 10: 2200 },
}

export function teaserPoints(sport: string): number[] {
  if (sport === 'football') return [6, 6.5, 7]
  if (sport === 'basketball') return [4, 4.5, 5]
  return []
}

export function teaserOdds(sport: string, points: number, legs: number): number | undefined {
  return TEASER_TABLES[`${sport}-${points}`]?.[legs]
}

/** Deterministic pseudo-random in [0,1) from a string seed (xmur3 + mulberry32). */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = (() => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0 })()
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Standard normal CDF. */
export function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989423 * Math.exp((-x * x) / 2)
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  if (x > 0) p = 1 - p
  return p
}

/** Round a number to the nearest half. */
export function roundHalf(n: number): number {
  return Math.round(n * 2) / 2
}

/** Ensure a line ends in .5 (no pushes). */
export function toHalfLine(n: number): number {
  const r = Math.round(n)
  return r + (n >= r ? 0.5 : -0.5)
}
