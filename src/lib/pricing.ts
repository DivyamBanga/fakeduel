/**
 * Pricing calibrated to FanDuel's real markets (see data/fdcal.json, extracted from FanDuel's own catalog feed).
 * Every function returns american odds that already carry FanDuel-style vig for that market family.
 */
import cal from '@/data/fdcal.json'
import { normCdf, priceFromProb } from './odds'

type LadderCurve = { curve: [number, number, number][] }
interface SportCal {
  sigma?: { sigma: number; vig: number }
  juice?: Record<string, { a: number; b: number; vig: number }>
  ladders?: Record<string, LadderCurve>
  scorers?: Record<string, { ratio1: number; ratio2: number; ratio3: number; halfRatio: number; quarterRatio: number } | number>
  period?: Record<string, { ratio?: number; fav?: number; dog?: number; tie?: number }>
  teamTotal?: { diff: number; over: number; under: number }
  vig?: Record<string, { vig: number }>
}
const CAL = cal as unknown as Record<string, SportCal>

export function sportCal(sport: string): SportCal {
  return CAL[sport] ?? {}
}

/** Implied probability of american odds (with vig). */
export function imp(a: number): number {
  return a > 0 ? 100 / (a + 100) : -a / (-a + 100)
}

/** Sigma of final margin used by FanDuel to relate spreads to moneylines. */
export function marginSigmaCal(sport: string, fallback: number): number {
  const s = CAL[sport]?.sigma?.sigma
  return s && isFinite(s) && s > 0 ? s : fallback
}

/** Two-way price pair from a true probability with total book `vig` (e.g. 0.045 = 4.5%), split evenly. */
export function twoWay(p: number, vig = 0.045): [number, number] {
  const q = Math.min(0.995, Math.max(0.005, p))
  const a = Math.min(0.99, q + vig / 2)
  const b = Math.min(0.99, 1 - q + vig / 2)
  return [priceFromProb(a, 0), priceFromProb(b, 0)]
}

/** FanDuel's flat yardage juice. */
export function flatJuice(sport: string, marketType: string, fallback: [number, number] = [-114, -114]): [number, number] {
  const j = CAL[sport]?.juice?.[marketType]
  return j ? [j.a, j.b] : fallback
}

/**
 * Price an "N+ threshold" ladder rung from FanDuel's empirical curve for that stat.
 * `rel` = (threshold - mainLine) / mainLine. Falls back to a normal model when no curve exists.
 */
export function ladderOdds(sport: string, stat: string, mainLine: number, threshold: number, sigmaFallback: number, integer = false): number {
  const c = CAL[sport]?.ladders?.[stat]?.curve
  const rel = (threshold - mainLine) / Math.max(mainLine, 1)
  if (c && c.length >= 3) {
    const pts = c.filter((x) => x[2] >= 2)
    const use = pts.length >= 3 ? pts : c
    // linear interpolation on rel → implied p
    let p: number
    if (rel <= use[0][0]) p = use[0][1] + (rel - use[0][0]) * ((use[1][1] - use[0][1]) / (use[1][0] - use[0][0]))
    else if (rel >= use[use.length - 1][0]) {
      const a = use[use.length - 2]
      const b = use[use.length - 1]
      p = b[1] + (rel - b[0]) * ((b[1] - a[1]) / (b[0] - a[0]))
    } else {
      let i = 0
      while (i < use.length - 1 && use[i + 1][0] < rel) i++
      const a = use[i]
      const b = use[i + 1]
      p = a[1] + ((rel - a[0]) / (b[0] - a[0])) * (b[1] - a[1])
    }
    p = Math.min(0.995, Math.max(0.004, p))
    return priceFromProb(p, 0)
  }
  const t = integer ? threshold - 0.5 : threshold
  const pTrue = 1 - normCdf((t - mainLine) / sigmaFallback)
  return priceFromProb(pTrue, 0.07 + 0.08 * (1 - pTrue))
}

/** Over/Under prices for an integer-valued stat with the line at the half nearest the mean (FanDuel style). */
export function integerLine(mean: number, sigma: number, vig = 0.065): { line: number; over: number; under: number } {
  const line = Math.max(0.5, Math.floor(mean) + 0.5)
  const pOver = 1 - normCdf((line - mean) / sigma)
  const [over, under] = twoWay(pOver, vig)
  return { line, over, under }
}

/** Scorer-market ratios calibrated from FanDuel (first/last/multi/half/quarter given anytime probability). */
export function scorerRatio(sport: string, key: string, field: 'ratio1' | 'ratio2' | 'ratio3' | 'halfRatio' | 'quarterRatio', fallback: number): number {
  const s = CAL[sport]?.scorers?.[key]
  if (!s || typeof s === 'number') return fallback
  const v = s[field]
  return v && isFinite(v) && v > 0 ? v : fallback
}

export function periodRatio(sport: string, marketType: string, fallback: number): number {
  const p = CAL[sport]?.period?.[marketType]
  return p?.ratio && isFinite(p.ratio) ? p.ratio : fallback
}

export function periodTie(sport: string, marketType: string, fallback: number): number {
  const p = CAL[sport]?.period?.[marketType]
  return p?.tie && isFinite(p.tie) ? p.tie : fallback
}

export function teamTotalSkew(sport: string): { diff: number; over: number; under: number } {
  return CAL[sport]?.teamTotal ?? { diff: 0, over: -114, under: -114 }
}

/** Probability that A's stat beats B's (normal approximation). */
export function pGreater(meanA: number, sdA: number, meanB: number, sdB: number): number {
  return normCdf((meanA - meanB) / Math.sqrt(sdA * sdA + sdB * sdB))
}

/** "Most X yards" style market: P(i is max) via softmax fitted to pairwise normal probabilities. */
export function pMax(means: number[], sds: number[]): number[] {
  const n = means.length
  if (n === 1) return [1]
  const out = new Array(n).fill(0)
  // Monte-Carlo-free approximation: product of pairwise beat probabilities normalised
  for (let i = 0; i < n; i++) {
    let p = 1
    for (let j = 0; j < n; j++) if (i !== j) p *= pGreater(means[i], sds[i], means[j], sds[j])
    out[i] = p
  }
  const s = out.reduce((a, b) => a + b, 0)
  return out.map((x) => x / s)
}

/** Poisson tail P(X >= k). */
export function poissonTail(lambda: number, k: number): number {
  if (k <= 0) return 1
  let p = Math.exp(-lambda)
  let cdf = p
  for (let i = 1; i < k; i++) {
    p *= lambda / i
    cdf += p
  }
  return Math.max(0, 1 - cdf)
}
