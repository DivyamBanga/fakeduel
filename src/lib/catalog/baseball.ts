/** FanDuel MLB event catalog: batter/pitcher lists, First 5 Innings, Hits & Runs, inning-by-inning grid. */
import { priceFromProb, toHalfLine } from '../odds'
import { poissonTail, twoWay } from '../pricing'
import type { Grading, Market } from '../types'
import { TAB, add, espnLines, fmtLine, gameModel, leaderLines, list, mkm, overUnder, signed, teamShort, threeWay, twoTeam, yesNo, type Ctx, type PlayerLine } from './common'

export const MLB_TABS = [TAB.SGP, TAB.POPULAR, TAB.QUICK, TAB.BATTER, TAB.PITCHER, TAB.F5, TAB.HITS_RUNS, TAB.INNINGS]

function lnFact(k: number): number {
  let s = 0
  for (let i = 2; i <= k; i++) s += Math.log(i)
  return s
}
const pois = (lam: number, k: number) => Math.exp(-lam + k * Math.log(lam) - lnFact(k))

/** Joint run distribution for a stretch of innings with negative-binomial-ish overdispersion approximated by mixing Poissons. */
function jointRuns(lh: number, la: number, N = 16): { joint: number[][]; pH: number; pT: number; pA: number } {
  const joint: number[][] = []
  let pH = 0
  let pT = 0
  let pA = 0
  const mix = [0.7, 1.0, 1.3]
  const w = [0.25, 0.5, 0.25]
  for (let h = 0; h <= N; h++) {
    joint[h] = []
    for (let a = 0; a <= N; a++) {
      let p = 0
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) p += w[i] * w[j] * pois(lh * mix[i], h) * pois(la * mix[j], a)
      joint[h][a] = p
      if (h > a) pH += p
      else if (a > h) pA += p
      else pT += p
    }
  }
  return { joint, pH, pT, pA }
}

interface Batter extends PlayerLine {
  hits: number // per game
  hr: number
  rbi: number
  runs: number
  tb: number
  sb: number
}

export function buildBaseball(ctx: Ctx): Market[] {
  const { ev, lines } = ctx
  const gm = gameModel(ctx)
  const out: Market[] = []
  const home = ev.home
  const away = ev.away
  const T = gm.total || 8.5
  const sup = Math.max(-2, Math.min(2, (gm.pHome - gm.pAway) * 2.4))
  const lamH = Math.max(2, (T + sup) / 2)
  const lamA = Math.max(2, (T - sup) / 2)
  const full = jointRuns(lamH, lamA)
  const pTotalOver = (j: number[][], line: number) => {
    let s = 0
    for (let h = 0; h < j.length; h++) for (let a = 0; a < j[h].length; a++) if (h + a > line) s += j[h][a]
    return s
  }
  const pMarginOver = (j: number[][], line: number) => {
    let s = 0
    for (let h = 0; h < j.length; h++) for (let a = 0; a < j[h].length; a++) if (h - a > line) s += j[h][a]
    return s
  }
  let sort = 1

  if (lines.homeML !== undefined && lines.awayML !== undefined) {
    const m = mkm(ctx, 'ml', 'Moneyline', { tabs: [TAB.SGP, TAB.POPULAR], group: 'game', kind: 'moneyline', sort: sort++, fdType: 'MONEY_LINE' })
    add(m, 'away', away.team.displayName, lines.awayML, { kind: 'moneyline', side: 'away', teamId: away.team.id }, { teamId: away.team.id })
    add(m, 'home', home.team.displayName, lines.homeML, { kind: 'moneyline', side: 'home', teamId: home.team.id }, { teamId: home.team.id })
    out.push(m)
  }
  if (lines.spread !== undefined && lines.homeSpreadOdds !== undefined && lines.awaySpreadOdds !== undefined) {
    const S = lines.spread
    const m = mkm(ctx, 'spread', 'Run Line', { tabs: [TAB.SGP, TAB.POPULAR], group: 'game', kind: 'spread', sort: sort++, line: S, fdType: 'RUN_LINE' })
    add(m, 'away', `${away.team.displayName} (${signed(-S)})`, lines.awaySpreadOdds, { kind: 'spread', side: 'away', teamId: away.team.id, line: -S }, { line: -S, teamId: away.team.id })
    add(m, 'home', `${home.team.displayName} (${signed(S)})`, lines.homeSpreadOdds, { kind: 'spread', side: 'home', teamId: home.team.id, line: S }, { line: S, teamId: home.team.id })
    out.push(m)
  }
  if (lines.total !== undefined && lines.overOdds !== undefined && lines.underOdds !== undefined) {
    const m = mkm(ctx, 'total', 'Total Runs', { tabs: [TAB.SGP, TAB.POPULAR], group: 'game', kind: 'total', sort: sort++, line: lines.total, fdType: 'TOTAL_RUNS' })
    add(m, 'over', `Over (${fmtLine(lines.total)})`, lines.overOdds, { kind: 'total', side: 'over', line: lines.total }, { line: lines.total })
    add(m, 'under', `Under (${fmtLine(lines.total)})`, lines.underOdds, { kind: 'total', side: 'under', line: lines.total }, { line: lines.total })
    out.push(m)
  }
  if (lines.homeML === undefined) return out

  /* ---------- alternates & team totals ---------- */
  const ars = mkm(ctx, 'altspread', 'Alternate Run Line', { tabs: [TAB.SGP, TAB.POPULAR], group: 'alt', kind: 'alt_spread', layout: 'grid', sort: 5, fdType: 'ALTERNATE_RUN_LINE' })
  for (const hs of [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5]) {
    const pH = Math.abs(hs) === 0.5 ? (hs < 0 ? gm.pHome : 1 - gm.pAway) : Math.min(0.99, Math.max(0.01, pMarginOver(full.joint, -hs) + (hs > 0 ? full.pT * 0 : 0)))
    const pHome = Math.abs(hs) === 0.5 ? pH : hs < 0 ? pH : pMarginOver(full.joint, -hs) + full.pT
    add(ars, `away|${-hs}`, `${away.team.displayName} (${signed(-hs)})`, priceFromProb(1 - pHome, 0.05), { kind: 'spread', side: 'away', teamId: away.team.id, line: -hs }, { line: -hs, teamId: away.team.id })
    add(ars, `home|${hs}`, `${home.team.displayName} (${signed(hs)})`, priceFromProb(pHome, 0.05), { kind: 'spread', side: 'home', teamId: home.team.id, line: hs }, { line: hs, teamId: home.team.id })
  }
  out.push(ars)
  const at = mkm(ctx, 'alttotal', 'Alternate Total Runs', { tabs: [TAB.SGP, TAB.POPULAR], group: 'alt', kind: 'alt_total', layout: 'grid', sort: 6, fdType: 'ALTERNATE_TOTAL_RUNS' })
  for (const t of [5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5, 12.5]) {
    const po = Math.min(0.99, Math.max(0.01, pTotalOver(full.joint, t)))
    add(at, `over|${t}`, `Over (${fmtLine(t)})`, priceFromProb(po, 0.05), { kind: 'total', side: 'over', line: t }, { line: t })
    add(at, `under|${t}`, `Under (${fmtLine(t)})`, priceFromProb(1 - po, 0.05), { kind: 'total', side: 'under', line: t }, { line: t })
  }
  out.push(at)
  for (const c of [home, away]) {
    const lam = c.homeAway === 'home' ? lamH : lamA
    const line = toHalfLine(lam)
    out.push(overUnder(ctx, `tt|${c.team.id}`, `${teamShort(c)} Total Runs`, line, poissonTail(lam * 1.02, Math.ceil(line)), 0.055, { tabs: [TAB.SGP, TAB.POPULAR, TAB.HITS_RUNS], group: 'team', kind: 'team_total', sort: 7, category: 'Hits & Runs', fdType: `${c.homeAway === 'home' ? 'HOME' : 'AWAY'}_TEAM_TOTAL_RUNS` }, { kind: 'team_total', teamId: c.team.id }, { teamId: c.team.id }))
    const alt = mkm(ctx, `alttt|${c.team.id}`, `${teamShort(c)} Alternate Total Runs`, { tabs: [TAB.SGP, TAB.HITS_RUNS], group: 'alt', kind: 'alt_total', layout: 'grid', sort: 8, category: 'Hits & Runs' })
    for (const t of [1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5]) {
      const po = Math.min(0.99, Math.max(0.01, poissonTail(lam, Math.ceil(t))))
      add(alt, `over|${t}`, `Over (${fmtLine(t)})`, priceFromProb(po, 0.06), { kind: 'team_total', side: 'over', teamId: c.team.id, line: t }, { line: t, teamId: c.team.id })
      add(alt, `under|${t}`, `Under (${fmtLine(t)})`, priceFromProb(1 - po, 0.06), { kind: 'team_total', side: 'under', teamId: c.team.id, line: t }, { line: t, teamId: c.team.id })
    }
    out.push(alt)
    const hitsLam = 4.6 + 1.2 * (lam - 4.3)
    out.push(overUnder(ctx, `th|${c.team.id}`, `${teamShort(c)} Total Hits`, toHalfLine(hitsLam), poissonTail(hitsLam + 0.1, Math.ceil(toHalfLine(hitsLam))), 0.06, { tabs: [TAB.SGP, TAB.HITS_RUNS], group: 'team', sort: 9, category: 'Hits & Runs', fdType: `${c.homeAway === 'home' ? 'HOME' : 'AWAY'}_TEAM_TOTAL_HITS` }, { kind: 'team_stat', teamId: c.team.id, statKey: 'hits' }, { teamId: c.team.id }))
  }
  const gameHits = 9.2 + 1.2 * (T - 8.6)
  out.push(overUnder(ctx, 'hits', 'Total Hits', toHalfLine(gameHits), poissonTail(gameHits + 0.1, Math.ceil(toHalfLine(gameHits))), 0.06, { tabs: [TAB.SGP, TAB.HITS_RUNS], group: 'specials', sort: 10, category: 'Hits & Runs', fdType: 'TOTAL_HITS' }, { kind: 'total', statKey: 'hits' }))
  // total runs bands
  const bands = mkm(ctx, 'run_bands', 'Total Runs (Bands)', { tabs: [TAB.SGP, TAB.HITS_RUNS], group: 'specials', kind: 'winning_margin', layout: 'grid', sort: 11, category: 'Hits & Runs', fdType: 'TOTAL_RUNS_BANDS' })
  for (const [lo, hi] of [[0, 4], [5, 6], [7, 8], [9, 10], [11, 12], [13, 99]] as const) {
    let p = 0
    for (let h = 0; h < full.joint.length; h++) for (let a = 0; a < full.joint[h].length; a++) if (h + a >= lo && h + a <= hi) p += full.joint[h][a]
    add(bands, `${lo}`, hi >= 99 ? `${lo}+ Runs` : `${lo}-${hi} Runs`, priceFromProb(Math.max(0.005, p), 0.12), { kind: 'total_band', rangeLow: lo, rangeHigh: hi })
  }
  out.push(bands)
  out.push(yesNo(ctx, 'oe', 'Total Runs Odd/Even', 0.5, 0.048, { tabs: [TAB.HITS_RUNS], group: 'specials', sort: 12, category: 'Hits & Runs', fdType: 'TOTAL_RUNS_ODD/EVEN' }, { kind: 'odd_even' }, ['Odd', 'Even']))
  const pFirstH = 0.5 + (gm.pHome - 0.5) * 0.55
  out.push(twoTeam(ctx, 'first_run', 'Team To Score First', { tabs: [TAB.SGP, TAB.POPULAR, TAB.HITS_RUNS], group: 'specials', sort: 13, category: 'Hits & Runs', fdType: 'TEAM_TO_SCORE_FIRST' }, pFirstH, 0.05, { kind: 'team_first_score' }))
  out.push(twoTeam(ctx, 'last_run', 'Team To Score Last', { tabs: [TAB.SGP, TAB.HITS_RUNS], group: 'specials', sort: 14, category: 'Hits & Runs', fdType: 'TEAM_TO_SCORE_LAST' }, 0.5 + (gm.pHome - 0.5) * 0.7, 0.05, { kind: 'team_last_score' }))
  for (const n of [3, 5]) {
    const pReach = 1 - (1 - poissonTail(lamH, n)) * (1 - poissonTail(lamA, n))
    const pH = 0.5 + (gm.pHome - 0.5) * (0.8 + 0.1 * n)
    const m = mkm(ctx, `race|${n}`, `Race To ${n} Runs`, { tabs: [TAB.SGP, TAB.HITS_RUNS], group: 'specials', kind: 'moneyline', layout: 'three-col', sort: 15 + n / 10, category: 'Hits & Runs', fdType: `RACE_TO_${n}_RUNS` })
    add(m, 'away', away.team.displayName, priceFromProb((1 - pH) * pReach, 0.06), { kind: 'race_to', side: 'away', teamId: away.team.id, line: n }, { teamId: away.team.id })
    add(m, 'neither', 'Neither', priceFromProb(1 - pReach, 0.06), { kind: 'race_to', side: 'no', line: n })
    add(m, 'home', home.team.displayName, priceFromProb(pH * pReach, 0.06), { kind: 'race_to', side: 'home', teamId: home.team.id, line: n }, { teamId: home.team.id })
    out.push(m)
  }
  out.push(yesNo(ctx, 'extra', 'Will There Be Extra Innings?', full.pT * 0.85, 0.06, { tabs: [TAB.SGP, TAB.POPULAR], group: 'specials', sort: 16, category: 'Popular', fdType: 'EXTRA_INNINGS' }, { kind: 'overtime' }))
  const wm = mkm(ctx, 'margin', 'Winning Margin', { tabs: [TAB.SGP, TAB.HITS_RUNS], group: 'specials', kind: 'winning_margin', layout: 'grid', sort: 17, category: 'Hits & Runs', fdType: 'WINNING_MARGIN' })
  for (const c of [away, home]) {
    const isH = c.homeAway === 'home'
    const share = full.pT * ((isH ? gm.pHome : gm.pAway) / (gm.pHome + gm.pAway))
    for (const [lo, hi] of [[1, 1], [2, 2], [3, 3], [4, 5], [6, 99]] as const) {
      const p = (isH ? pMarginOver(full.joint, lo - 1) - pMarginOver(full.joint, Math.min(hi, 40)) : pMarginOver(full.joint, -Math.min(hi, 40) - 1) - pMarginOver(full.joint, -lo)) + (lo === 1 ? share : 0)
      add(wm, `${c.team.id}|${lo}`, `${c.team.displayName} by ${hi >= 99 ? `${lo}+` : lo === hi ? `${lo}` : `${lo}-${hi}`}`, priceFromProb(Math.max(0.004, p), 0.12), { kind: 'winning_margin', teamId: c.team.id, rangeLow: lo, rangeHigh: hi }, { teamId: c.team.id })
    }
  }
  out.push(wm)
  const tl = lines.total ?? 8.5
  const pov = pTotalOver(full.joint, tl)
  const mt = mkm(ctx, 'dbl|ml_total', 'Moneyline / Total Runs Parlay', { tabs: [TAB.POPULAR], group: 'specials', kind: 'scorer', layout: 'grid', sort: 18, category: 'Popular', sgp: false, fdType: 'MATCH_/_TOTAL_RUNS_DOUBLE' })
  for (const c of [away, home]) {
    const pw = c.homeAway === 'home' ? gm.pHome : gm.pAway
    add(mt, `${c.team.id}|over`, `${c.team.displayName} & Over ${fmtLine(tl)}`, priceFromProb(pw * pov * 1.06, 0.08), { kind: 'combo', combo: [c.homeAway, 'over', String(tl)] }, { teamId: c.team.id })
    add(mt, `${c.team.id}|under`, `${c.team.displayName} & Under ${fmtLine(tl)}`, priceFromProb(pw * (1 - pov) * 0.94, 0.08), { kind: 'combo', combo: [c.homeAway, 'under', String(tl)] }, { teamId: c.team.id })
  }
  out.push(mt)

  /* ---------- First 5 Innings ---------- */
  const f5 = jointRuns(lamH * (5 / 9) * 1.04, lamA * (5 / 9) * 1.04, 12)
  const f5Tabs = [TAB.SGP, TAB.POPULAR, TAB.F5]
  const f5ml = twoTeam(ctx, 'f5ml', '1st 5 Innings Moneyline', { tabs: f5Tabs, group: 'periods', kind: 'period_ml', sort: 20, category: 'First 5 Innings', fdType: '1ST_5_INNINGS_MONEYLINE' }, f5.pH / (f5.pH + f5.pA), 0.05, { kind: 'period_ml', period: 'f5', label: '2way' })
  out.push(f5ml)
  out.push(threeWay(ctx, 'f5res', '1st 5 Innings Result', { tabs: f5Tabs, group: 'periods', sort: 21, category: 'First 5 Innings', fdType: '1ST_5_INNINGS_RESULT' }, f5.pH, f5.pT, 0.06, { kind: 'period_ml', period: 'f5' }))
  const f5fav = f5.pH >= f5.pA
  const f5rl = mkm(ctx, 'f5rl', '1st 5 Innings Run Line', { tabs: f5Tabs, group: 'periods', kind: 'period_spread', sort: 22, category: 'First 5 Innings', line: f5fav ? -0.5 : 0.5, fdType: '1ST_5_INNINGS_RUN_LINE' })
  {
    const hs = f5fav ? -0.5 : 0.5
    const [hj, aj] = twoWay(f5fav ? f5.pH : f5.pH + f5.pT, 0.05)
    add(f5rl, 'away', `${away.team.displayName} (${signed(-hs)})`, aj, { kind: 'period_spread', side: 'away', teamId: away.team.id, line: -hs, period: 'f5' }, { line: -hs, teamId: away.team.id })
    add(f5rl, 'home', `${home.team.displayName} (${signed(hs)})`, hj, { kind: 'period_spread', side: 'home', teamId: home.team.id, line: hs, period: 'f5' }, { line: hs, teamId: home.team.id })
  }
  out.push(f5rl)
  const f5T = toHalfLine(T * (5 / 9) * 1.04)
  out.push(overUnder(ctx, 'f5total', '1st 5 Innings Total Runs', f5T, pTotalOver(f5.joint, f5T), 0.05, { tabs: f5Tabs, group: 'periods', kind: 'period_total', sort: 23, category: 'First 5 Innings', fdType: '1ST_5_INNINGS_TOTAL_RUNS' }, { kind: 'period_total', period: 'f5' }))
  const f5alt = mkm(ctx, 'f5altrl', '1st 5 Innings Alternate Run Line', { tabs: [TAB.SGP, TAB.F5], group: 'alt', kind: 'alt_spread', layout: 'grid', sort: 24, category: 'First 5 Innings' })
  for (const hs of [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5]) {
    const pH = Math.min(0.99, Math.max(0.01, pMarginOver(f5.joint, -hs)))
    add(f5alt, `away|${-hs}`, `${away.team.displayName} (${signed(-hs)})`, priceFromProb(1 - pH, 0.055), { kind: 'period_spread', side: 'away', teamId: away.team.id, line: -hs, period: 'f5' }, { line: -hs, teamId: away.team.id })
    add(f5alt, `home|${hs}`, `${home.team.displayName} (${signed(hs)})`, priceFromProb(pH, 0.055), { kind: 'period_spread', side: 'home', teamId: home.team.id, line: hs, period: 'f5' }, { line: hs, teamId: home.team.id })
  }
  out.push(f5alt)
  const f5at = mkm(ctx, 'f5alttotal', '1st 5 Innings Alternate Total Runs', { tabs: [TAB.SGP, TAB.F5], group: 'alt', kind: 'alt_total', layout: 'grid', sort: 25, category: 'First 5 Innings' })
  for (const t of [2.5, 3.5, 4.5, 5.5, 6.5, 7.5]) {
    const po = Math.min(0.99, Math.max(0.01, pTotalOver(f5.joint, t)))
    add(f5at, `over|${t}`, `Over (${fmtLine(t)})`, priceFromProb(po, 0.055), { kind: 'period_total', side: 'over', line: t, period: 'f5' }, { line: t })
    add(f5at, `under|${t}`, `Under (${fmtLine(t)})`, priceFromProb(1 - po, 0.055), { kind: 'period_total', side: 'under', line: t, period: 'f5' }, { line: t })
  }
  out.push(f5at)
  for (const c of [home, away]) {
    const lam = (c.homeAway === 'home' ? lamH : lamA) * (5 / 9) * 1.04
    const line = toHalfLine(lam)
    out.push(overUnder(ctx, `f5tt|${c.team.id}`, `1st 5 Innings ${teamShort(c)} Total Runs`, line, poissonTail(lam, Math.ceil(line)), 0.06, { tabs: [TAB.SGP, TAB.F5], group: 'periods', kind: 'period_total', sort: 26, category: 'First 5 Innings' }, { kind: 'team_stat', teamId: c.team.id, period: 'f5', statKey: 'points' }, { teamId: c.team.id }))
  }
  const f5wm = mkm(ctx, 'f5margin', '1st 5 Innings Winning Margin', { tabs: [TAB.SGP, TAB.F5], group: 'specials', kind: 'winning_margin', layout: 'grid', sort: 27, category: 'First 5 Innings' })
  for (const c of [away, home]) {
    const isH = c.homeAway === 'home'
    for (const [lo, hi] of [[1, 1], [2, 2], [3, 99]] as const) {
      const p = isH ? pMarginOver(f5.joint, lo - 1) - pMarginOver(f5.joint, Math.min(hi, 30)) : pMarginOver(f5.joint, -Math.min(hi, 30) - 1) - pMarginOver(f5.joint, -lo)
      add(f5wm, `${c.team.id}|${lo}`, `${c.team.displayName} by ${hi >= 99 ? `${lo}+` : `${lo}`}`, priceFromProb(Math.max(0.004, p), 0.12), { kind: 'winning_margin', teamId: c.team.id, rangeLow: lo, rangeHigh: hi, period: 'f5' }, { teamId: c.team.id })
    }
  }
  add(f5wm, 'tie', 'Tie', priceFromProb(f5.pT, 0.12), { kind: 'winning_margin', rangeLow: 0, rangeHigh: 0, period: 'f5' })
  out.push(f5wm)

  /* ---------- inning grid ---------- */
  for (let inn = 1; inn <= 9; inn++) {
    const key = `i${inn}`
    const name = `${inn}${inn === 1 ? 'st' : inn === 2 ? 'nd' : inn === 3 ? 'rd' : 'th'} Inning`
    const mult = inn === 1 ? 1.12 : inn === 9 ? 0.85 : 1.0
    const lh = (lamH / 9) * mult * (inn === 9 ? 0.6 : 1)
    const la = (lamA / 9) * mult
    const j = jointRuns(lh, la, 8)
    const tabs = inn === 1 ? [TAB.SGP, TAB.QUICK, TAB.INNINGS] : [TAB.SGP, TAB.INNINGS]
    out.push(threeWay(ctx, `res|${key}`, `${name} Result`, { tabs, group: 'periods', sort: 30 + inn, category: name, fdType: `${inn}_INNING_RESULT` }, j.pH, j.pT, 0.07, { kind: 'period_ml', period: key }))
    const rl = mkm(ctx, `rl|${key}`, `${name} Run Line`, { tabs, group: 'periods', kind: 'period_spread', sort: 30.1 + inn, category: name, line: 0.5 })
    const fav = j.pH >= j.pA
    const hs = fav ? -0.5 : 0.5
    const [hj, aj] = twoWay(fav ? j.pH : j.pH + j.pT, 0.06)
    add(rl, 'away', `${away.team.displayName} (${signed(-hs)})`, aj, { kind: 'period_spread', side: 'away', teamId: away.team.id, line: -hs, period: key }, { line: -hs, teamId: away.team.id })
    add(rl, 'home', `${home.team.displayName} (${signed(hs)})`, hj, { kind: 'period_spread', side: 'home', teamId: home.team.id, line: hs, period: key }, { line: hs, teamId: home.team.id })
    out.push(rl)
    const p0 = j.joint[0][0]
    const p1 = j.joint[1][0] + j.joint[0][1]
    const p2 = 1 - p0 - p1
    const tr = mkm(ctx, `tr|${key}`, `${name} Total Runs`, { tabs, group: 'periods', kind: 'total_band', layout: 'three-col', sort: 30.2 + inn, category: name })
    add(tr, '0', '0', priceFromProb(p0, 0.07), { kind: 'total_band', rangeLow: 0, rangeHigh: 0, period: key })
    add(tr, '1', '1', priceFromProb(p1, 0.07), { kind: 'total_band', rangeLow: 1, rangeHigh: 1, period: key })
    add(tr, '2', '2+', priceFromProb(p2, 0.07), { kind: 'total_band', rangeLow: 2, rangeHigh: 99, period: key })
    out.push(tr)
    out.push(overUnder(ctx, `ou05|${key}`, `${name} Over/Under 0.5 Runs`, 0.5, 1 - p0, 0.055, { tabs, group: 'periods', kind: 'period_total', sort: 30.3 + inn, category: name }, { kind: 'period_total', period: key }))
    out.push(overUnder(ctx, `ou15|${key}`, `${name} Over/Under 1.5 Runs`, 1.5, p2, 0.055, { tabs, group: 'periods', kind: 'period_total', sort: 30.4 + inn, category: name }, { kind: 'period_total', period: key }))
    const cs = mkm(ctx, `cs|${key}`, `${name} Correct Score`, { tabs, group: 'specials', kind: 'correct_score', layout: 'grid', sort: 30.5 + inn, category: name })
    for (let h = 0; h <= 3; h++)
      for (let a = 0; a <= 3; a++) {
        const p = j.joint[h][a]
        if (p < 0.006) continue
        add(cs, `${h}-${a}`, `${away.team.abbreviation} ${a} - ${home.team.abbreviation} ${h}`, priceFromProb(p, 0.14), { kind: 'correct_score', homeGoals: h, awayGoals: a, period: key })
      }
    cs.selections.sort((x, y) => x.odds - y.odds)
    out.push(cs)
    out.push(yesNo(ctx, `oe|${key}`, `${name} Total Runs Odd/Even`, 1 - p0 - (j.joint[1][1] + j.joint[2][0] + j.joint[0][2]) - 0.02, 0.06, { tabs, group: 'specials', sort: 30.6 + inn, category: name }, { kind: 'odd_even', period: key }, ['Odd', 'Even']))
    for (const c of [away, home]) {
      const lam = c.homeAway === 'home' ? lh : la
      out.push(yesNo(ctx, `score|${key}|${c.team.id}`, `${teamShort(c)} To Score In ${name}`, 1 - Math.exp(-lam), 0.06, { tabs, group: 'specials', sort: 30.7 + inn, category: name }, { kind: 'team_stat', teamId: c.team.id, period: key, statKey: 'points', line: 1 }))
    }
    if (inn >= 3 && inn <= 8) {
      const lead = jointRuns(lamH * (inn / 9), lamA * (inn / 9), 12)
      out.push(threeWay(ctx, `lead|${key}`, `Lead After ${inn} Innings`, { tabs: [TAB.SGP, TAB.INNINGS], group: 'periods', sort: 30.8 + inn, category: name }, lead.pH, lead.pT, 0.06, { kind: 'period_ml', period: `f${inn}` }))
    }
  }

  /* ---------- batters ---------- */
  const pool = new Map<string, Batter>()
  const put = (p: PlayerLine, k: keyof Batter) => {
    const b = pool.get(p.id) ?? { ...p, hits: 0, hr: 0, rbi: 0, runs: 0, tb: 0, sb: 0 }
    ;(b as unknown as Record<string, number>)[k] = p.line
    pool.set(p.id, b)
  }
  // season per-game rates from team leaders (15 per category); ESPN prop players without leader stats get average rates
  leaderLines(ctx, 'hits', 15, (pg) => pg).forEach((p) => put(p, 'hits'))
  leaderLines(ctx, 'homeRuns', 15, (pg) => pg).forEach((p) => put(p, 'hr'))
  leaderLines(ctx, 'RBIs', 15, (pg) => pg).forEach((p) => put(p, 'rbi'))
  leaderLines(ctx, 'runs', 15, (pg) => pg).forEach((p) => put(p, 'runs'))
  leaderLines(ctx, 'stolenBases', 15, (pg) => pg).forEach((p) => put(p, 'sb'))
  for (const p of [...espnLines(ctx, /^Total Hits$/i), ...espnLines(ctx, /^Total Home Runs/i), ...espnLines(ctx, /^Total Bases/i)]) if (!pool.has(p.id)) pool.set(p.id, { ...p, hits: 0.85, hr: 0.1, rbi: 0.45, runs: 0.5, tb: 0, sb: 0.05 })
  const batters = [...pool.values()].filter((b) => !/^(SP|RP|P)$/.test(b.position ?? '') && (b.hits > 0.3 || b.hr > 0.05)).slice(0, 22)
  for (const b of batters) {
    const lam = b.teamId === home.team.id ? lamH : lamA
    const adj = lam / 4.4
    b.hits = Math.max(0.5, b.hits || 0.9) * adj
    b.hr = Math.max(0.03, b.hr || 0.14 * b.hits) * adj
    b.rbi = Math.max(0.2, b.rbi || 0.5 * b.hits) * adj
    b.runs = Math.max(0.2, b.runs || 0.55 * b.hits) * adj
    b.tb = Math.max(0.8, b.tb || b.hits * 1.55 + b.hr * 2) * adj
    b.sb = b.sb * adj
  }
  batters.sort((a, b) => b.hits + b.hr * 2 - (a.hits + a.hr * 2))
  const meta = (b: Batter) => ({ id: b.id, name: b.name, teamId: b.teamId, position: b.position, headshot: b.headshot })
  const bRows = (f: (b: Batter) => number, statKey: string, line: number) => batters.map((b) => ({ key: b.id, label: b.name, p: f(b), grading: { kind: 'player_ladder', playerId: b.id, statKey, line, teamId: b.teamId } as Grading, extra: { playerId: b.id, teamId: b.teamId, line } }))
  if (batters.length) {
    const bt = [TAB.SGP, TAB.POPULAR, TAB.BATTER]
    const push = (m: Market | null) => m && out.push(m)
    push(list(ctx, 'hr|1', 'To Hit A Home Run', { tabs: bt, group: 'td', sort: 50, category: 'Batter Props', fdType: 'TO_HIT_A_HOME_RUN' }, bRows((b) => 1 - Math.exp(-b.hr), 'batting.homeRuns', 1), 0.12, 0.03))
    push(list(ctx, 'hr|2', 'To Hit 2+ Home Runs', { tabs: [TAB.BATTER], group: 'td', sort: 51, category: 'Batter Props', fdType: 'TO_HIT_2+_HOME_RUNS' }, bRows((b) => poissonTail(b.hr, 2), 'batting.homeRuns', 2), 0.18, 0.006))
    push(list(ctx, 'hit|1', 'To Record A Hit', { tabs: bt, group: 'td', sort: 52, category: 'Batter Props', fdType: 'TO_RECORD_A_HIT' }, bRows((b) => 1 - Math.exp(-b.hits), 'batting.hits', 1), 0.1, 0.2))
    push(list(ctx, 'hit|2', 'To Record 2+ Hits', { tabs: bt, group: 'td', sort: 53, category: 'Batter Props', fdType: 'TO_RECORD_2+_HITS' }, bRows((b) => poissonTail(b.hits, 2), 'batting.hits', 2), 0.12, 0.05))
    push(list(ctx, 'hit|3', 'To Record 3+ Hits', { tabs: [TAB.BATTER], group: 'td', sort: 54, category: 'Batter Props', fdType: 'TO_RECORD_3+_HITS' }, bRows((b) => poissonTail(b.hits, 3), 'batting.hits', 3), 0.16, 0.01))
    for (const n of [2, 3, 4, 5]) push(list(ctx, `tb|${n}`, `To Record ${n}+ Total Bases`, { tabs: n === 2 ? bt : [TAB.BATTER], group: 'td', sort: 55 + n / 10, category: 'Batter Props', fdType: `TO_RECORD_${n}+_TOTAL_BASES` }, bRows((b) => poissonTail(b.tb, n), 'batting.totalBases', n), 0.12, 0.02))
    push(list(ctx, 'run|1', 'To Record A Run', { tabs: [TAB.SGP, TAB.BATTER], group: 'td', sort: 56, category: 'Batter Props', fdType: 'TO_RECORD_A_RUN' }, bRows((b) => 1 - Math.exp(-b.runs), 'batting.runs', 1), 0.1, 0.1))
    push(list(ctx, 'run|2', 'To Record 2+ Runs', { tabs: [TAB.BATTER], group: 'td', sort: 57, category: 'Batter Props', fdType: 'TO_RECORD_2+_RUNS' }, bRows((b) => poissonTail(b.runs, 2), 'batting.runs', 2), 0.15, 0.02))
    push(list(ctx, 'rbi|1', 'To Record An RBI', { tabs: [TAB.SGP, TAB.BATTER], group: 'td', sort: 58, category: 'Batter Props', fdType: 'TO_RECORD_AN_RBI' }, bRows((b) => 1 - Math.exp(-b.rbi), 'batting.RBIs', 1), 0.1, 0.1))
    push(list(ctx, 'rbi|2', 'To Record 2+ RBIs', { tabs: [TAB.BATTER], group: 'td', sort: 59, category: 'Batter Props', fdType: 'TO_RECORD_2+_RBIS' }, bRows((b) => poissonTail(b.rbi, 2), 'batting.RBIs', 2), 0.15, 0.02))
    push(list(ctx, 'sb|1', 'To Record A Stolen Base', { tabs: [TAB.SGP, TAB.BATTER], group: 'td', sort: 60, category: 'Batter Props', fdType: 'TO_RECORD_A_STOLEN_BASE' }, bRows((b) => 1 - Math.exp(-Math.max(0.03, b.sb)), 'batting.stolenBases', 1), 0.15, 0.04))
    push(list(ctx, 'double|1', 'To Hit A Double', { tabs: [TAB.BATTER], group: 'td', sort: 61, category: 'Batter Props', fdType: 'TO_HIT_A_DOUBLE' }, bRows((b) => 1 - Math.exp(-b.hits * 0.2), 'batting.doubles', 1), 0.14, 0.05))
    push(list(ctx, 'triple|1', 'To Hit A Triple', { tabs: [TAB.BATTER], group: 'td', sort: 62, category: 'Batter Props', fdType: 'TO_HIT_A_TRIPLE' }, bRows((b) => 1 - Math.exp(-b.hits * 0.02), 'batting.triples', 1), 0.2, 0.008))
    for (const n of [1, 2, 3]) push(list(ctx, `hrr|${n}`, `Player To Record ${n}+ Hits + Runs + RBIs`, { tabs: [TAB.SGP, TAB.BATTER], group: 'td', sort: 63 + n / 10, category: 'Batter Props', fdType: `TO_RECORD_${n}+_HITS_+_RUNS_+_RBIS` }, bRows((b) => poissonTail(b.hits + b.runs + b.rbi, n), 'batting.hits+batting.runs+batting.RBIs', n), 0.11, 0.03))
    batters.slice(0, 10).forEach((b, i) => {
      out.push(overUnder(ctx, `prop|hits|${b.id}`, `${b.name} - Hits`, 0.5, 1 - Math.exp(-b.hits), 0.08, { tabs: [TAB.BATTER], sort: 64 + i / 100, category: 'Batter Props', player: meta(b), fdType: 'PLAYER_A_TOTAL_HITS' }, { kind: 'player_stat', statKey: 'batting.hits', playerId: b.id }, { playerId: b.id, teamId: b.teamId }))
      out.push(overUnder(ctx, `prop|tb|${b.id}`, `${b.name} - Total Bases`, 1.5, poissonTail(b.tb, 2), 0.08, { tabs: [TAB.BATTER], sort: 65 + i / 100, category: 'Batter Props', player: meta(b), fdType: 'PLAYER_A_TOTAL_BASES' }, { kind: 'player_stat', statKey: 'batting.totalBases', playerId: b.id }, { playerId: b.id, teamId: b.teamId }))
      out.push(overUnder(ctx, `prop|hrr|${b.id}`, `${b.name} - Hits + Runs + RBIs`, 1.5, poissonTail(b.hits + b.runs + b.rbi, 2), 0.08, { tabs: [TAB.BATTER], sort: 66 + i / 100, category: 'Batter Props', player: meta(b), fdType: 'PLAYER_A_HITS_+_RUNS_+_RBIS' }, { kind: 'player_stat', statKey: 'batting.hits+batting.runs+batting.RBIs', playerId: b.id }, { playerId: b.id, teamId: b.teamId }))
    })
  }

  /* ---------- pitchers ---------- */
  const kLines = espnLines(ctx, /Strikeouts/i).filter((p) => /P/.test(p.position ?? 'P'))
  const pitchers: PlayerLine[] = kLines.length ? kLines : (ev.probables ?? []).map((p) => ({ id: p.athleteId, name: p.name, teamId: p.teamId, position: 'SP', headshot: ctx.athletes[p.athleteId]?.headshot, line: 5.5 }))
  const pt = [TAB.SGP, TAB.POPULAR, TAB.PITCHER]
  const kRows = (n: number) => pitchers.map((p) => ({ key: p.id, label: p.name, p: poissonTail(p.line + 0.3, n), grading: { kind: 'player_ladder', playerId: p.id, statKey: 'pitching.strikeouts', line: n, teamId: p.teamId } as Grading, extra: { playerId: p.id, teamId: p.teamId, line: n } }))
  for (const n of [3, 4, 5, 6, 7, 8, 9, 10]) {
    const m = list(ctx, `k|${n}`, `To Record ${n}+ Strikeouts`, { tabs: n === 5 || n === 6 ? pt : [TAB.PITCHER], group: 'td', sort: 70 + n / 10, category: 'Pitcher Props', fdType: `TO_RECORD_${n}+_STRIKEOUTS` }, kRows(n), 0.1, 0.02)
    if (m) out.push(m)
  }
  pitchers.forEach((p, i) => {
    const pm = { id: p.id, name: p.name, teamId: p.teamId, position: p.position, headshot: p.headshot }
    out.push(overUnder(ctx, `prop|p_k|${p.id}`, `${p.name} - Strikeouts`, p.line, poissonTail(p.line + 0.3, Math.ceil(p.line)), 0.07, { tabs: pt, sort: 71 + i / 100, category: 'Pitcher Props', player: pm, fdType: 'PITCHER_A_STRIKEOUTS' }, { kind: 'player_stat', statKey: 'pitching.strikeouts', playerId: p.id }, { playerId: p.id, teamId: p.teamId }))
    out.push(overUnder(ctx, `prop|p_outs|${p.id}`, `${p.name} - Outs Recorded`, 16.5, 0.5 + 0.03 * (p.line - 5.5), 0.07, { tabs: [TAB.PITCHER], sort: 72 + i / 100, category: 'Pitcher Props', player: pm, fdType: 'PITCHER_A_OUTS_RECORDED' }, { kind: 'player_stat', statKey: 'pitching.outs', playerId: p.id }, { playerId: p.id, teamId: p.teamId }))
    const oppLam = p.teamId === home.team.id ? lamA : lamH
    const er = oppLam * 0.62
    out.push(overUnder(ctx, `prop|p_er|${p.id}`, `${p.name} - Earned Runs`, 2.5, poissonTail(er, 3), 0.07, { tabs: [TAB.PITCHER], sort: 73 + i / 100, category: 'Pitcher Props', player: pm, fdType: 'PITCHER_A_EARNED_RUNS' }, { kind: 'player_stat', statKey: 'pitching.earnedRuns', playerId: p.id }, { playerId: p.id, teamId: p.teamId }))
    const ha = 4.9 + 0.6 * (oppLam - 4.4)
    out.push(overUnder(ctx, `prop|p_hits|${p.id}`, `${p.name} - Hits Allowed`, toHalfLine(ha), poissonTail(ha + 0.1, Math.ceil(toHalfLine(ha))), 0.07, { tabs: [TAB.PITCHER], sort: 74 + i / 100, category: 'Pitcher Props', player: pm, fdType: 'PITCHER_A_HITS_ALLOWED' }, { kind: 'player_stat', statKey: 'pitching.hits', playerId: p.id }, { playerId: p.id, teamId: p.teamId }))
    out.push(overUnder(ctx, `prop|p_walks|${p.id}`, `${p.name} - Walks`, 1.5, poissonTail(1.9, 2), 0.07, { tabs: [TAB.PITCHER], sort: 75 + i / 100, category: 'Pitcher Props', player: pm, fdType: 'PITCHER_A_WALKS' }, { kind: 'player_stat', statKey: 'pitching.walks', playerId: p.id }, { playerId: p.id, teamId: p.teamId }))
  })
  if (pitchers.length === 2) {
    const m = list(ctx, 'most|k', 'Most Strikeouts', { tabs: [TAB.POPULAR, TAB.PITCHER], sort: 69, category: 'Pitcher Props', fdType: 'MOST_STRIKEOUTS' }, pitchers.map((p, i) => ({ key: p.id, label: p.name, p: 1 / (1 + Math.exp(-(p.line - pitchers[1 - i].line) * 0.55)), grading: { kind: 'most_stat', playerId: p.id, playerIds: pitchers.map((x) => x.id), statKey: 'pitching.strikeouts' } as Grading, extra: { playerId: p.id, teamId: p.teamId } })), 0.06)
    if (m) out.push(m)
  }
  return out
}
