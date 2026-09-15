/** FanDuel soccer catalog: 3-way lines, goals bands, goalscorers (score or assist), team props, halves, corners & cards. */
import { priceFromProb } from '../odds'
import { poissonTail } from '../pricing'
import type { Grading, Market } from '../types'
import { TAB, add, gameModel, leaderLines, list, mkm, overUnder, threeWay, yesNo, type Ctx } from './common'

export const SOCCER_TABS = [TAB.SGP, TAB.POPULAR, TAB.GOALS, TAB.GOALSCORER, TAB.PLAYER_PROPS, TAB.TEAM_PROPS, TAB.HALF, TAB.CORNERS]

function lnFact(k: number): number {
  let s = 0
  for (let i = 2; i <= k; i++) s += Math.log(i)
  return s
}
const pois = (lam: number, k: number) => Math.exp(-lam + k * Math.log(lam) - lnFact(k))

function joint(lh: number, la: number, N = 9): number[][] {
  const j: number[][] = []
  let sum = 0
  for (let h = 0; h <= N; h++) {
    j[h] = []
    for (let a = 0; a <= N; a++) {
      let p = pois(lh, h) * pois(la, a)
      if ((h === 0 && a === 0) || (h === 1 && a === 1)) p *= 1.08 // Dixon-Coles low-score bump
      if ((h === 1 && a === 0) || (h === 0 && a === 1)) p *= 0.96
      j[h][a] = p
      sum += p
    }
  }
  for (let h = 0; h <= N; h++) for (let a = 0; a <= N; a++) j[h][a] /= sum
  return j
}
const sumWhere = (j: number[][], f: (h: number, a: number) => boolean) => {
  let s = 0
  for (let h = 0; h < j.length; h++) for (let a = 0; a < j[h].length; a++) if (f(h, a)) s += j[h][a]
  return s
}

const BANDS: [number, number][] = [[0, 0], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [2, 3], [2, 4], [2, 5], [2, 6], [3, 4], [3, 5], [3, 6], [4, 5], [4, 6], [7, 99]]
const TEAM_BANDS: [number, number][] = [[0, 0], [1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4], [4, 99]]
const bandLabel = ([lo, hi]: [number, number]) => (hi >= 99 ? `${lo}+` : lo === hi ? `${lo}` : `${lo}-${hi}`)

export function buildSoccer(ctx: Ctx): Market[] {
  const { ev, lines, athletes } = ctx
  const gm = gameModel(ctx)
  const out: Market[] = []
  const home = ev.home
  const away = ev.away
  const T = lines.total ?? 2.6
  const sup = Math.max(-2, Math.min(2, (gm.pHome - gm.pAway) * 1.6))
  const lamH = Math.max(0.4, (T + sup) / 2)
  const lamA = Math.max(0.3, (T - sup) / 2)
  const J = joint(lamH, lamA)
  const pH = sumWhere(J, (h, a) => h > a)
  const pD = sumWhere(J, (h, a) => h === a)
  const pA = 1 - pH - pD
  const pOver = (line: number) => sumWhere(J, (h, a) => h + a > line)
  const pBtts = (1 - Math.exp(-lamH)) * (1 - Math.exp(-lamA))
  const pop = [TAB.SGP, TAB.POPULAR]
  let sort = 1

  /* ---------- match result ---------- */
  const ml = mkm(ctx, 'ml', 'Moneyline (3-way)', { tabs: pop, group: 'game', kind: 'three_way', layout: 'three-col', sort: sort++, fdType: 'WIN-DRAW-WIN' })
  const useReal = lines.homeML !== undefined && lines.awayML !== undefined && lines.drawML !== undefined
  add(ml, 'home', home.team.displayName, useReal ? lines.homeML! : priceFromProb(pH, 0.06), { kind: 'moneyline', side: 'home', teamId: home.team.id }, { teamId: home.team.id })
  add(ml, 'draw', 'Draw', useReal ? lines.drawML! : priceFromProb(pD, 0.06), { kind: 'draw', side: 'draw' })
  add(ml, 'away', away.team.displayName, useReal ? lines.awayML! : priceFromProb(pA, 0.06), { kind: 'moneyline', side: 'away', teamId: away.team.id }, { teamId: away.team.id })
  out.push(ml)
  const dc = mkm(ctx, 'dc', 'Double Chance', { tabs: pop, group: 'game', kind: 'double_chance', layout: 'three-col', sort: sort++, fdType: 'DOUBLE_CHANCE' })
  add(dc, 'home_draw', `${home.team.displayName} And Draw`, priceFromProb(pH + pD, 0.06), { kind: 'double_chance', dc: 'home_draw' })
  add(dc, 'home_away', `${home.team.displayName} And ${away.team.displayName}`, priceFromProb(pH + pA, 0.06), { kind: 'double_chance', dc: 'home_away' })
  add(dc, 'away_draw', `${away.team.displayName} And Draw`, priceFromProb(pA + pD, 0.06), { kind: 'double_chance', dc: 'away_draw' })
  out.push(dc)
  const dnb = mkm(ctx, 'dnb', 'Draw No Bet', { tabs: pop, group: 'game', kind: 'draw_no_bet', layout: 'two-col', sort: sort++, fdType: 'DRAW_NO_BET' })
  add(dnb, 'home', home.team.displayName, priceFromProb(pH / (pH + pA), 0.05), { kind: 'draw_no_bet', side: 'home', teamId: home.team.id }, { teamId: home.team.id })
  add(dnb, 'away', away.team.displayName, priceFromProb(pA / (pH + pA), 0.05), { kind: 'draw_no_bet', side: 'away', teamId: away.team.id }, { teamId: away.team.id })
  out.push(dnb)
  const tot = mkm(ctx, 'total', 'Over/Under 2.5 Goals', { tabs: pop, group: 'game', kind: 'total', layout: 'two-col', sort: sort++, line: 2.5, fdType: 'OVER_UNDER_25' })
  const realT = lines.total === 2.5 && lines.overOdds !== undefined && lines.underOdds !== undefined
  add(tot, 'over', 'Over 2.5 Goals', realT ? lines.overOdds! : priceFromProb(pOver(2.5), 0.06), { kind: 'total', side: 'over', line: 2.5 }, { line: 2.5 })
  add(tot, 'under', 'Under 2.5 Goals', realT ? lines.underOdds! : priceFromProb(1 - pOver(2.5), 0.06), { kind: 'total', side: 'under', line: 2.5 }, { line: 2.5 })
  out.push(tot)
  out.push(yesNo(ctx, 'btts', 'Both Teams To Score', pBtts, 0.06, { tabs: [...pop, TAB.GOALS, TAB.TEAM_PROPS], group: 'specials', sort: sort++, category: 'Goals', fdType: 'BOTH_TEAMS_TO_SCORE' }, { kind: 'btts' }))

  /* ---------- goals ---------- */
  const goalsTabs = [TAB.SGP, TAB.GOALS]
  for (const line of [0.5, 1.5, 3.5, 4.5, 5.5, 6.5]) {
    const po = pOver(line)
    if (po < 0.015 || po > 0.985) continue
    const m = mkm(ctx, `ou|${line}`, `Over/Under ${line} Goals`, { tabs: line <= 1.5 || line === 3.5 || line === 4.5 ? [...pop, TAB.GOALS] : goalsTabs, group: 'alt', kind: 'total', layout: 'two-col', sort: 10 + line, line, fdType: `OVER_UNDER_${line * 10}` })
    add(m, 'over', `Over ${line} Goals`, priceFromProb(po, 0.06), { kind: 'total', side: 'over', line }, { line })
    add(m, 'under', `Under ${line} Goals`, priceFromProb(1 - po, 0.06), { kind: 'total', side: 'under', line }, { line })
    out.push(m)
  }
  const bands = mkm(ctx, 'bands', 'Total Goals Bands', { tabs: [...pop, TAB.GOALS], group: 'specials', kind: 'total_band', layout: 'grid', sort: 20, category: 'Goals', fdType: 'MULTIGOL_-_MATCH' })
  for (const b of BANDS) add(bands, `${b[0]}-${b[1]}`, bandLabel(b), priceFromProb(Math.max(0.004, sumWhere(J, (h, a) => h + a >= b[0] && h + a <= b[1])), 0.08), { kind: 'total_band', rangeLow: b[0], rangeHigh: b[1] })
  out.push(bands)
  for (const c of [home, away]) {
    const lam = c.homeAway === 'home' ? lamH : lamA
    const isH = c.homeAway === 'home'
    const tb = mkm(ctx, `bands|${c.team.id}`, `Total Goals Bands - ${isH ? 'Home' : 'Away'} Team`, { tabs: [TAB.SGP, TAB.GOALS, TAB.TEAM_PROPS], group: 'specials', kind: 'total_band', layout: 'grid', sort: 21, category: 'Team Props', fdType: `MULTIGOL_-_${isH ? 'HOME' : 'AWAY'}` })
    for (const b of TEAM_BANDS) add(tb, `${b[0]}-${b[1]}`, `${c.team.displayName} ${bandLabel(b)}`, priceFromProb(Math.max(0.004, poissonTail(lam, b[0]) - poissonTail(lam, b[1] + 1)), 0.08), { kind: 'total_band', rangeLow: b[0], rangeHigh: b[1], teamId: c.team.id }, { teamId: c.team.id })
    out.push(tb)
    for (const line of [0.5, 1.5, 2.5, 3.5]) {
      const po = poissonTail(lam, Math.ceil(line))
      if (po < 0.015) continue
      const m = mkm(ctx, `tou|${c.team.id}|${line}`, `${isH ? 'Home' : 'Away'} Team Over/Under ${line} Goals`, { tabs: line <= 1.5 ? [TAB.SGP, TAB.GOALS, TAB.TEAM_PROPS] : [TAB.SGP, TAB.TEAM_PROPS], group: 'team', kind: 'team_total', layout: 'two-col', sort: 22 + line, line, category: 'Team Props', fdType: `${isH ? 'HOME' : 'AWAY'}_TEAM_OVER/UNDER_${line}` })
      add(m, 'over', 'Over', priceFromProb(po, 0.06), { kind: 'team_total', side: 'over', teamId: c.team.id, line }, { line, teamId: c.team.id })
      add(m, 'under', 'Under', priceFromProb(1 - po, 0.06), { kind: 'team_total', side: 'under', teamId: c.team.id, line }, { line, teamId: c.team.id })
      out.push(m)
    }
    const ex = mkm(ctx, `exact|${c.team.id}`, 'Number of Team Goals', { tabs: [TAB.SGP, TAB.TEAM_PROPS], group: 'specials', kind: 'total_band', layout: 'grid', sort: 27, category: 'Team Props', fdType: 'NUMBER_OF_TEAM_GOALS' })
    for (const n of [1, 2, 3, 4]) add(ex, `${n}`, `${c.team.displayName} to Score Exactly ${n} Goal${n > 1 ? 's' : ''}`, priceFromProb(Math.max(0.004, pois(lam, n)), 0.08), { kind: 'total_band', rangeLow: n, rangeHigh: n, teamId: c.team.id }, { teamId: c.team.id })
    out.push(ex)
  }
  for (const [n, word] of [[1, 'First'], [2, 'Second'], [3, 'Third']] as const) {
    const pReach = pOver(n - 0.5)
    const m = mkm(ctx, `nth_goal|${n}`, `Team To Score the ${word} Goal`, { tabs: n === 1 ? [...pop, TAB.GOALS] : [TAB.SGP, TAB.GOALS], group: 'specials', kind: 'moneyline', layout: 'three-col', sort: 28 + n / 10, category: 'Goals', fdType: `TEAM_TO_SCORE_THE_${word.toUpperCase()}_GOAL` })
    const shareH = lamH / (lamH + lamA)
    add(m, 'home', home.team.displayName, priceFromProb(pReach * shareH, 0.07), { kind: 'team_first_score', side: 'home', teamId: home.team.id, count: n }, { teamId: home.team.id })
    add(m, 'away', away.team.displayName, priceFromProb(pReach * (1 - shareH), 0.07), { kind: 'team_first_score', side: 'away', teamId: away.team.id, count: n }, { teamId: away.team.id })
    add(m, 'none', 'No Goals', priceFromProb(1 - pReach, 0.07), { kind: 'team_first_score', side: 'no', count: n })
    out.push(m)
  }
  const rb = mkm(ctx, 'result_btts', 'Result & Both to Score', { tabs: [TAB.SGP, TAB.GOALS], group: 'specials', kind: 'special', layout: 'three-col', sort: 30, category: 'Goals', fdType: 'RESULT_&_BOTH_TO_SCORE' })
  add(rb, 'home', home.team.displayName, priceFromProb(sumWhere(J, (h, a) => h > a && a > 0), 0.08), { kind: 'combo', combo: ['home', 'btts', 'yes'] }, { teamId: home.team.id })
  add(rb, 'draw', 'Draw', priceFromProb(sumWhere(J, (h, a) => h === a && h > 0), 0.08), { kind: 'combo', combo: ['draw', 'btts', 'yes'] })
  add(rb, 'away', away.team.displayName, priceFromProb(sumWhere(J, (h, a) => a > h && h > 0), 0.08), { kind: 'combo', combo: ['away', 'btts', 'yes'] }, { teamId: away.team.id })
  out.push(rb)
  for (const line of [1.5, 2.5, 3.5, 4.5]) {
    const m = mkm(ctx, `wdw_ou|${line}`, `WDW & O/U ${line} Goals`, { tabs: [TAB.SGP, TAB.GOALS], group: 'specials', kind: 'special', layout: 'grid', sort: 31 + line / 10, category: 'Goals', fdType: `WDW_&_O/U_${line}_GOALS` })
    for (const [side, name, f] of [['home', home.team.displayName, (h: number, a: number) => h > a], ['draw', 'Draw', (h: number, a: number) => h === a], ['away', away.team.displayName, (h: number, a: number) => a > h]] as const) {
      add(m, `${side}|over`, `${name} And Over ${line}`, priceFromProb(Math.max(0.004, sumWhere(J, (h, a) => f(h, a) && h + a > line)), 0.09), { kind: 'combo', combo: [side, 'over', String(line)] })
      add(m, `${side}|under`, `${name} And Under ${line}`, priceFromProb(Math.max(0.004, sumWhere(J, (h, a) => f(h, a) && h + a < line)), 0.09), { kind: 'combo', combo: [side, 'under', String(line)] })
    }
    out.push(m)
  }
  const bo = mkm(ctx, 'btts_ou', 'Both Teams To Score & O/U 2.5 Goals', { tabs: [TAB.SGP, TAB.TEAM_PROPS], group: 'specials', kind: 'special', layout: 'grid', sort: 32, category: 'Team Props', fdType: 'BOTH_TEAMS_TO_SCORE_&_O/U_2.5_GOALS' })
  add(bo, 'yes|over', 'Yes & Over 2.5', priceFromProb(sumWhere(J, (h, a) => h > 0 && a > 0 && h + a > 2.5), 0.08), { kind: 'combo', combo: ['btts:yes', 'over', '2.5'] })
  add(bo, 'yes|under', 'Yes & Under 2.5', priceFromProb(sumWhere(J, (h, a) => h > 0 && a > 0 && h + a < 2.5), 0.08), { kind: 'combo', combo: ['btts:yes', 'under', '2.5'] })
  add(bo, 'no|over', 'No & Over 2.5', priceFromProb(sumWhere(J, (h, a) => (h === 0 || a === 0) && h + a > 2.5), 0.08), { kind: 'combo', combo: ['btts:no', 'over', '2.5'] })
  add(bo, 'no|under', 'No & Under 2.5', priceFromProb(sumWhere(J, (h, a) => (h === 0 || a === 0) && h + a < 2.5), 0.08), { kind: 'combo', combo: ['btts:no', 'under', '2.5'] })
  out.push(bo)
  const cs = mkm(ctx, 'cs', 'Correct Score', { tabs: [...pop, TAB.GOALS], group: 'specials', kind: 'correct_score', layout: 'grid', sort: 33, category: 'Goals', fdType: 'CORRECT_SCORE' })
  for (let h = 0; h <= 6; h++)
    for (let a = 0; a <= 6; a++) {
      const p = J[h][a]
      if (p < 0.003) continue
      add(cs, `${h}-${a}`, h === a ? `Draw ${h}-${a}` : h > a ? `${home.team.displayName} ${h}-${a}` : `${away.team.displayName} ${a}-${h}`, priceFromProb(p, 0.16), { kind: 'correct_score', homeGoals: h, awayGoals: a })
    }
  cs.selections.sort((x, y) => x.odds - y.odds)
  out.push(cs)
  const wm = mkm(ctx, 'margin', 'Winning Margin', { tabs: [TAB.SGP, TAB.GOALS], group: 'specials', kind: 'winning_margin', layout: 'grid', sort: 34, category: 'Goals', fdType: 'WINNING_MARGIN' })
  for (const c of [home, away]) {
    const f = c.homeAway === 'home' ? (h: number, a: number) => h - a : (h: number, a: number) => a - h
    for (const [lo, hi] of [[1, 1], [2, 2], [3, 99]] as const) add(wm, `${c.team.id}|${lo}`, `${c.team.displayName} by ${hi >= 99 ? '3+' : lo}`, priceFromProb(Math.max(0.004, sumWhere(J, (h, a) => f(h, a) >= lo && f(h, a) <= hi)), 0.1), { kind: 'winning_margin', teamId: c.team.id, rangeLow: lo, rangeHigh: hi }, { teamId: c.team.id })
  }
  add(wm, 'draw', 'Draw', priceFromProb(pD, 0.1), { kind: 'winning_margin', rangeLow: 0, rangeHigh: 0 })
  out.push(wm)
  out.push(yesNo(ctx, 'oe', 'Total Goals Odd/Even', sumWhere(J, (h, a) => (h + a) % 2 === 1), 0.05, { tabs: [TAB.GOALS], group: 'specials', sort: 35, category: 'Goals', fdType: 'TOTAL_GOALS_ODD/EVEN' }, { kind: 'odd_even' }, ['Odd', 'Even']))

  /* ---------- halves ---------- */
  const J1 = joint(lamH * 0.45, lamA * 0.45, 7)
  const J2 = joint(lamH * 0.55, lamA * 0.55, 7)
  const half = [TAB.SGP, TAB.HALF]
  out.push(threeWay(ctx, 'ht', 'Half Time Result', { tabs: [...pop, TAB.HALF], group: 'periods', sort: 40, category: 'Half', fdType: 'HALF_TIME_RESULT' }, sumWhere(J1, (h, a) => h > a), sumWhere(J1, (h, a) => h === a), 0.07, { kind: 'period_ml', period: 'h1' }, 'Draw'))
  out.push(threeWay(ctx, 'h2res', 'To Win the Second-Half', { tabs: half, group: 'periods', sort: 41, category: 'Half', fdType: 'TO_WIN_THE_SECOND-HALF' }, sumWhere(J2, (h, a) => h > a), sumWhere(J2, (h, a) => h === a), 0.07, { kind: 'period_ml', period: 'h2' }, 'Draw'))
  for (const line of [0.5, 1.5, 2.5]) {
    const po = sumWhere(J1, (h, a) => h + a > line)
    out.push(overUnder(ctx, `h1ou|${line}`, `1st Half Over/Under ${line} Goals`, line, po, 0.06, { tabs: half, group: 'periods', kind: 'period_total', sort: 42 + line / 10, category: 'Half', fdType: `1ST_HALF_OVER/UNDER_${line}` }, { kind: 'period_total', period: 'h1' }))
  }
  out.push(yesNo(ctx, 'h1btts', '1st Half Both Teams To Score', sumWhere(J1, (h, a) => h > 0 && a > 0), 0.06, { tabs: half, group: 'specials', sort: 43, category: 'Half', fdType: '1ST_HALF_BOTH_TEAMS_TO_SCORE' }, { kind: 'btts_period', period: 'h1' }))
  const b2 = mkm(ctx, 'bands|h2', 'Total Goals Bands - 2nd Half', { tabs: half, group: 'specials', kind: 'total_band', layout: 'grid', sort: 44, category: 'Half', fdType: 'MULTIGOL_-_2ND_HALF' })
  for (const b of TEAM_BANDS) add(b2, `${b[0]}-${b[1]}`, bandLabel(b), priceFromProb(Math.max(0.004, sumWhere(J2, (h, a) => h + a >= b[0] && h + a <= b[1])), 0.08), { kind: 'total_band', rangeLow: b[0], rangeHigh: b[1], period: 'h2' })
  out.push(b2)
  const htft = mkm(ctx, 'htft', 'Half Time/Full Time', { tabs: half, group: 'specials', kind: 'period_ml', layout: 'list', sort: 45, category: 'Half', fdType: 'HALF_TIME_/_FULL_TIME' })
  const p1 = { home: sumWhere(J1, (h, a) => h > a), draw: sumWhere(J1, (h, a) => h === a), away: sumWhere(J1, (h, a) => a > h) }
  const cond: Record<string, Record<string, number>> = {
    home: { home: 0.82, draw: 0.12, away: 0.06 },
    draw: { home: pH * 0.95, draw: 0.32, away: pA * 0.95 },
    away: { home: 0.06, draw: 0.12, away: 0.82 },
  }
  const nm = (k: string) => (k === 'home' ? home.team.displayName : k === 'away' ? away.team.displayName : 'Draw')
  for (const a of ['home', 'draw', 'away'] as const)
    for (const b of ['home', 'draw', 'away'] as const) {
      const c = cond[a]
      const norm = c.home + c.draw + c.away
      add(htft, `${a}-${b}`, `${nm(a)} / ${nm(b)}`, priceFromProb(Math.max(0.004, p1[a] * (c[b] / norm)), 0.12), { kind: 'double_result', combo: [a, b] })
    }
  htft.selections.sort((x, y) => x.odds - y.odds)
  out.push(htft)

  /* ---------- corners & cards ---------- */
  const cornersLam = 9.6 + 0.6 * (T - 2.6)
  const cTabs = [TAB.SGP, TAB.CORNERS]
  out.push(overUnder(ctx, 'corners', 'Total Corners', 9.5, poissonTail(cornersLam, 10), 0.06, { tabs: [TAB.SGP, TAB.POPULAR, TAB.CORNERS], group: 'specials', sort: 50, category: 'Corners & Cards', fdType: 'TOTAL_CORNERS' }, { kind: 'total', statKey: 'wonCorners' }))
  const tc = mkm(ctx, 'corners_over', 'Total Over Corners', { tabs: cTabs, group: 'specials', kind: 'prop_ladder', layout: 'ladder', sort: 51, category: 'Corners & Cards', fdType: 'TOTAL_OVER_CORNERS' })
  for (const n of [8, 9, 10, 11, 12, 13, 14, 15, 16]) add(tc, `${n}`, `${n} Or More Corners`, priceFromProb(poissonTail(cornersLam, n), 0.07), { kind: 'total', statKey: 'wonCorners', side: 'over', line: n - 0.5 }, { line: n - 0.5 })
  out.push(tc)
  const each = mkm(ctx, 'corners_each', 'Each Team Total Corners', { tabs: cTabs, group: 'specials', kind: 'prop_ladder', layout: 'ladder', sort: 52, category: 'Corners & Cards', fdType: 'EACH_TEAM_TOTAL_CORNERS' })
  for (const n of [3, 4, 5, 6, 7, 8]) add(each, `${n}`, `${n}+ Corners Each Team`, priceFromProb(poissonTail(cornersLam * (lamH / (lamH + lamA)), n) * poissonTail(cornersLam * (lamA / (lamH + lamA)), n), 0.08), { kind: 'both_score_n', line: n, statKey: 'wonCorners' }, { line: n })
  out.push(each)
  for (const c of [home, away]) {
    const lam = cornersLam * ((c.homeAway === 'home' ? lamH : lamA) / (lamH + lamA))
    const line = Math.round(lam) - 0.5
    out.push(overUnder(ctx, `corners|${c.team.id}`, `${c.team.displayName} Total Corners`, line, poissonTail(lam, Math.ceil(line)), 0.065, { tabs: cTabs, group: 'specials', sort: 53, category: 'Corners & Cards', fdType: 'TEAM_TOTAL_CORNERS' }, { kind: 'team_stat', teamId: c.team.id, statKey: 'wonCorners' }, { teamId: c.team.id }))
  }
  const cardsLam = 4.1
  out.push(overUnder(ctx, 'cards', 'Total Cards', 4.5, poissonTail(cardsLam, 5), 0.065, { tabs: cTabs, group: 'specials', sort: 54, category: 'Corners & Cards', fdType: 'TOTAL_CARDS' }, { kind: 'card', label: 'total' }))

  /* ---------- players ---------- */
  const players = Object.values(athletes).filter((a) => a.teamId && (a.teamId === home.team.id || a.teamId === away.team.id))
  const posRank = (p?: string) => (/^F|FW|ST|CF|LW|RW|Forward|Attacker/i.test(p ?? '') ? 0 : /^M|CM|AM|DM|LM|RM|Mid/i.test(p ?? '') ? 1 : /^D|CB|LB|RB|Def/i.test(p ?? '') ? 2 : 3)
  const pool: { id: string; name: string; teamId: string; headshot?: string; position?: string; pG: number; pA: number; sot: number; shots: number; pCard: number }[] = []
  // season per-game rates from team leaders (goals, assists, shots, cards); fall back to position heuristics
  const lead = (cat: string) => new Map(leaderLines(ctx, cat, 15, (pg) => pg).map((p) => [p.id, p] as const))
  const lg = lead('goals')
  const la = lead('assists')
  const lsot = lead('shotsOnTarget')
  const lsh = lead('totalShots')
  const lyc = lead('yellowCards')
  const ids = new Set([...lg.keys(), ...la.keys(), ...lsot.keys(), ...lsh.keys()])
  for (const id of ids) {
    const any = lg.get(id) ?? la.get(id) ?? lsot.get(id) ?? lsh.get(id)!
    if (!any.teamId || posRank(any.position) >= 3) continue
    const lam = any.teamId === home.team.id ? lamH : lamA
    const adj = lam / 1.35
    // shrink early-season per-game rates toward a league-average prior (8 games' worth)
    const gp = ctx.leaders.find((t) => t.teamId === any.teamId)?.gamesPlayed ?? 12
    const shrink = (rate: number, prior: number) => (rate * gp + prior * 8) / (gp + 8)
    const g = shrink(lg.get(id)?.line ?? 0, 0.1)
    const a = shrink(la.get(id)?.line ?? 0, 0.08)
    const sot = lsot.get(id)?.line ?? Math.max(0.15, g * 2.4)
    const shots = lsh.get(id)?.line ?? Math.max(0.3, sot * 2.2)
    const yc = lyc.get(id)?.line ?? 0.15
    pool.push({ id, name: any.name, teamId: any.teamId, headshot: any.headshot, position: any.position, pG: Math.min(0.7, 1 - Math.exp(-(g + 0.03) * adj)), pA: Math.min(0.6, 1 - Math.exp(-(a + 0.03) * adj)), sot: sot * adj, shots: shots * adj, pCard: Math.min(0.5, 1 - Math.exp(-(yc + 0.05))) })
  }
  for (const c of pool.length ? [] : [home, away]) {
    const lam = c.homeAway === 'home' ? lamH : lamA
    const team = players.filter((a) => a.teamId === c.team.id && posRank(a.position) < 3).sort((x, y) => posRank(x.position) - posRank(y.position))
    const counts = [0, 0, 0]
    for (const a of team) {
      const r = posRank(a.position)
      if (counts[r] >= [4, 5, 3][r]) continue
      counts[r]++
      const base = [0.3, 0.13, 0.05][r]
      const pG = Math.min(0.7, base * (lam / 1.35) * (counts[r] === 1 ? 1.15 : 1))
      const pA = Math.min(0.6, [0.17, 0.15, 0.07][r] * (lam / 1.35))
      pool.push({ id: a.id, name: a.name, teamId: c.team.id, headshot: a.headshot, position: a.position, pG, pA, sot: [1.1, 0.55, 0.2][r] * (lam / 1.35), shots: [2.4, 1.2, 0.5][r] * (lam / 1.35), pCard: [0.12, 0.2, 0.24][r] })
    }
  }
  pool.sort((x, y) => y.pG - x.pG)
  if (pool.length) {
    const gs = [TAB.SGP, TAB.POPULAR, TAB.GOALSCORER]
    const rows = (f: (p: (typeof pool)[number]) => number, kind: Grading['kind'], extra: Partial<Grading> = {}) => pool.map((p) => ({ key: p.id, label: p.name, p: f(p), grading: { kind, playerId: p.id, teamId: p.teamId, ...extra } as Grading, extra: { playerId: p.id, teamId: p.teamId } }))
    const push = (m: Market | null) => m && out.push(m)
    push(list(ctx, 'scorer|any_goal', 'Anytime Goalscorer', { tabs: gs, group: 'td', sort: 60, category: 'Goalscorer', fdType: 'ANY_TIME_GOAL_SCORER' }, rows((p) => p.pG, 'td_scorer', { statKey: '*.goals' }), 0.12, 0.03))
    const sumG = pool.reduce((s, p) => s + p.pG, 0)
    push(list(ctx, 'scorer|first_goal', 'First Goalscorer', { tabs: [TAB.SGP, TAB.GOALSCORER], group: 'td', sort: 61, category: 'Goalscorer', fdType: 'FIRST_GOAL_SCORER' }, rows((p) => (p.pG / sumG) * pOver(0.5), 'first_td', { statKey: '*.goals' }), 0.06, 0.012))
    push(list(ctx, 'scorer|last_goal', 'Last Goalscorer', { tabs: [TAB.SGP, TAB.GOALSCORER], group: 'td', sort: 62, category: 'Goalscorer', fdType: 'LAST_GOAL_SCORER' }, rows((p) => (p.pG / sumG) * pOver(0.5), 'last_td', { statKey: '*.goals' }), 0.06, 0.012))
    push(list(ctx, 'scorer|2', 'To Score 2+ Goals', { tabs: [TAB.SGP, TAB.GOALSCORER], group: 'td', sort: 63, category: 'Goalscorer', fdType: 'TO_SCORE_2_OR_MORE_GOALS' }, rows((p) => Math.pow(p.pG, 2) * 0.55, 'multi_td', { statKey: '*.goals', count: 2 }), 0.14, 0.01))
    push(list(ctx, 'scorer|3', 'To Score A Hat-Trick', { tabs: [TAB.GOALSCORER], group: 'td', sort: 64, category: 'Goalscorer', fdType: 'TO_SCORE_A_HAT-TRICK' }, rows((p) => Math.pow(p.pG, 3) * 0.3, 'multi_td', { statKey: '*.goals', count: 3 }), 0.18, 0.004))
    push(list(ctx, 'score_assist', 'To Score or Assist', { tabs: [...gs, TAB.PLAYER_PROPS], group: 'td', sort: 65, category: 'Goalscorer', fdType: 'TO_SCORE_OR_ASSIST' }, rows((p) => 1 - (1 - p.pG) * (1 - p.pA) * 0.97, 'player_ladder', { statKey: '*.goals+*.goalAssists', line: 1 }), 0.11, 0.05))
    push(list(ctx, 'assist', 'Anytime Assist', { tabs: [TAB.SGP, TAB.GOALSCORER, TAB.PLAYER_PROPS], group: 'td', sort: 66, category: 'Goalscorer', fdType: 'ANYTIME_ASSIST' }, rows((p) => p.pA, 'player_ladder', { statKey: '*.goalAssists', line: 1 }), 0.13, 0.03))
    for (const n of [1, 2, 3]) push(list(ctx, `sot|${n}`, `To Have ${n}+ Shots On Target`, { tabs: [TAB.SGP, TAB.PLAYER_PROPS], group: 'td', sort: 67 + n / 10, category: 'Player Props', fdType: `${n}+_SHOTS_ON_TARGET` }, rows((p) => poissonTail(p.sot, n), 'player_ladder', { statKey: '*.shotsOnTarget', line: n }), 0.1, 0.03))
    for (const n of [1, 2, 3, 4]) push(list(ctx, `shots|${n}`, `To Have ${n}+ Shots`, { tabs: [TAB.SGP, TAB.PLAYER_PROPS], group: 'td', sort: 68 + n / 10, category: 'Player Props', fdType: `${n}+_SHOTS` }, rows((p) => poissonTail(p.shots, n), 'player_ladder', { statKey: '*.totalShots', line: n }), 0.1, 0.03))
    push(list(ctx, 'scorer|player_to_receive_card', 'To Be Booked', { tabs: [TAB.SGP, TAB.CORNERS, TAB.PLAYER_PROPS], group: 'td', sort: 69, category: 'Corners & Cards', fdType: 'PLAYER_TO_BE_BOOKED' }, rows((p) => p.pCard, 'card', { count: 1 }), 0.14, 0.05))
    const top = pool.slice(0, 5)
    const pairs: [(typeof pool)[number], (typeof pool)[number]][] = []
    for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) pairs.push([top[i], top[j]])
    push(list(ctx, 'scorer|either', 'Either Player - Anytime Goalscorer', { tabs: [TAB.SGP, TAB.GOALSCORER], group: 'td', sort: 70, category: 'Goalscorer' }, pairs.map(([a, b]) => ({ key: `${a.id}-${b.id}`, label: `${a.name} or ${b.name}`, p: 1 - (1 - a.pG) * (1 - b.pG), grading: { kind: 'either_player', playerIds: [a.id, b.id], statKey: '*.goals', label: 'any' } as Grading })), 0.1))
  }
  return out
}
