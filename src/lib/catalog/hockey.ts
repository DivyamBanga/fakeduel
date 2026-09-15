/** FanDuel NHL event catalog: goal scorer lists, points (goal or assist), shots, periods, 60-minute lines. */
import { priceFromProb, toHalfLine } from '../odds'
import { poissonTail, twoWay } from '../pricing'
import type { Grading, Market } from '../types'
import { TAB, add, fmtLine, gameModel, leaderLines, list, mkm, overUnder, signed, teamShort, threeWay, twoTeam, yesNo, type Ctx, type PlayerLine } from './common'

export const NHL_TABS = [TAB.SGP, TAB.POPULAR, TAB.GOALSCORER, TAB.PLAYER_PROPS, TAB.TEAM_PROPS, '1st Period', '2nd Period', '3rd Period', TAB.GAME_PROPS, TAB.OVERTIME]

function lnFact(k: number): number {
  let s = 0
  for (let i = 2; i <= k; i++) s += Math.log(i)
  return s
}
const pois = (lam: number, k: number) => Math.exp(-lam + k * Math.log(lam) - lnFact(k))

interface Skater extends PlayerLine {
  gpg: number
  apg: number
  sog: number
}

export function buildHockey(ctx: Ctx): Market[] {
  const { ev, lines } = ctx
  const gm = gameModel(ctx)
  const out: Market[] = []
  const home = ev.home
  const away = ev.away
  const T = gm.total || 6
  // split expected goals by win probability (goal supremacy ≈ 1.1 goals per 0.5 of win prob)
  const sup = Math.max(-1.6, Math.min(1.6, (gm.pHome - gm.pAway) * 1.1))
  const lamH = Math.max(1.2, (T + sup) / 2)
  const lamA = Math.max(1.2, (T - sup) / 2)
  const N = 10
  const joint: number[][] = []
  let pRegH = 0
  let pTie = 0
  for (let h = 0; h <= N; h++) {
    joint[h] = []
    for (let a = 0; a <= N; a++) {
      const p = pois(lamH, h) * pois(lamA, a)
      joint[h][a] = p
      if (h > a) pRegH += p
      else if (a === h) pTie += p
    }
  }
  const pTotalOver = (line: number) => {
    let s = 0
    for (let h = 0; h <= N; h++) for (let a = 0; a <= N; a++) if (h + a > line) s += joint[h][a]
    return s
  }
  const pMarginOver = (line: number) => {
    let s = 0
    for (let h = 0; h <= N; h++) for (let a = 0; a <= N; a++) if (h - a > line) s += joint[h][a]
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
    const m = mkm(ctx, 'spread', 'Puck Line', { tabs: [TAB.SGP, TAB.POPULAR], group: 'game', kind: 'spread', sort: sort++, line: S, fdType: 'PUCK_LINE' })
    add(m, 'away', `${away.team.displayName} (${signed(-S)})`, lines.awaySpreadOdds, { kind: 'spread', side: 'away', teamId: away.team.id, line: -S }, { line: -S, teamId: away.team.id })
    add(m, 'home', `${home.team.displayName} (${signed(S)})`, lines.homeSpreadOdds, { kind: 'spread', side: 'home', teamId: home.team.id, line: S }, { line: S, teamId: home.team.id })
    out.push(m)
  }
  if (lines.total !== undefined && lines.overOdds !== undefined && lines.underOdds !== undefined) {
    const m = mkm(ctx, 'total', 'Total Goals', { tabs: [TAB.SGP, TAB.POPULAR], group: 'game', kind: 'total', sort: sort++, line: lines.total, fdType: 'TOTAL_GOALS' })
    add(m, 'over', `Over (${fmtLine(lines.total)})`, lines.overOdds, { kind: 'total', side: 'over', line: lines.total }, { line: lines.total })
    add(m, 'under', `Under (${fmtLine(lines.total)})`, lines.underOdds, { kind: 'total', side: 'under', line: lines.total }, { line: lines.total })
    out.push(m)
  }
  if (lines.homeML === undefined) return out

  /* ---------- 60-minute lines & game props ---------- */
  out.push(threeWay(ctx, '60ml', '60 Min Moneyline (3 Way)', { tabs: [TAB.SGP, TAB.POPULAR, TAB.GAME_PROPS], group: 'game', sort: 4, fdType: '60_MINUTE_LINE_3WAY' }, pRegH, pTie, 0.055, { kind: 'period_ml', period: 'reg' }))
  const cs = mkm(ctx, '60cs', '60 Min Correct Score', { tabs: [TAB.SGP, TAB.GAME_PROPS], group: 'specials', kind: 'correct_score', layout: 'grid', sort: 5, category: 'Game Props', fdType: '60_MIN_CORRECT_SCORE' })
  for (let h = 0; h <= 6; h++)
    for (let a = 0; a <= 6; a++) {
      const p = joint[h][a]
      if (p < 0.004) continue
      const label = h === a ? `Tie ${h}-${a}` : h > a ? `${home.team.displayName} ${h}-${a}` : `${away.team.displayName} ${a}-${h}`
      add(cs, `${h}-${a}`, label, priceFromProb(p, 0.2), { kind: 'correct_score', homeGoals: h, awayGoals: a, period: 'reg' })
    }
  cs.selections.sort((x, y) => x.odds - y.odds)
  out.push(cs)
  out.push(yesNo(ctx, 'ot', 'Will There Be Overtime?', pTie, 0.05, { tabs: [TAB.SGP, TAB.POPULAR, TAB.OVERTIME], group: 'specials', sort: 6, category: 'Overtime', fdType: 'WILL_THERE_BE_OVERTIME' }, { kind: 'overtime' }))
  const aps = mkm(ctx, 'altspread', 'Alternate Puck Line', { tabs: [TAB.SGP, TAB.POPULAR], group: 'alt', kind: 'alt_spread', layout: 'grid', sort: 7, fdType: 'ALTERNATE_PUCK_LINE' })
  for (const hs of [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5]) {
    // home covers hs when home margin > -hs; ±0.5 resolves through OT/SO so use the full-game win prob
    const pHome = Math.abs(hs) === 0.5 ? (hs < 0 ? gm.pHome : gm.pHome + pTie * 0) : Math.min(0.99, Math.max(0.01, hs < 0 ? pMarginOver(-hs) : pMarginOver(-hs) + 0))
    const pH = Math.abs(hs) === 0.5 ? (hs < 0 ? gm.pHome : 1 - gm.pAway) : pHome
    add(aps, `away|${-hs}`, `${away.team.displayName} (${signed(-hs)})`, priceFromProb(1 - pH, 0.05), { kind: 'spread', side: 'away', teamId: away.team.id, line: -hs }, { line: -hs, teamId: away.team.id })
    add(aps, `home|${hs}`, `${home.team.displayName} (${signed(hs)})`, priceFromProb(pH, 0.05), { kind: 'spread', side: 'home', teamId: home.team.id, line: hs }, { line: hs, teamId: home.team.id })
  }
  out.push(aps)
  const at = mkm(ctx, 'alttotal', 'Alternate Total Goals', { tabs: [TAB.SGP, TAB.POPULAR], group: 'alt', kind: 'alt_total', layout: 'grid', sort: 8, fdType: 'ALTERNATE_TOTAL_GOALS' })
  for (const t of [3.5, 4.5, 5.5, 6.5, 7.5, 8.5]) {
    const po = Math.min(0.99, Math.max(0.01, pTotalOver(t)))
    add(at, `over|${t}`, `Over (${fmtLine(t)})`, priceFromProb(po, 0.05), { kind: 'total', side: 'over', line: t }, { line: t })
    add(at, `under|${t}`, `Under (${fmtLine(t)})`, priceFromProb(1 - po, 0.05), { kind: 'total', side: 'under', line: t }, { line: t })
  }
  out.push(at)
  for (const c of [home, away]) {
    const lam = c.homeAway === 'home' ? lamH : lamA
    const line = lam >= 3.2 ? 3.5 : 2.5
    out.push(overUnder(ctx, `tt|${c.team.id}`, `${teamShort(c)} Total Goals`, line, poissonTail(lam, Math.ceil(line)), 0.055, { tabs: [TAB.SGP, TAB.POPULAR, TAB.TEAM_PROPS], group: 'team', kind: 'team_total', sort: 9, category: 'Team Props', fdType: `${c.homeAway === 'home' ? 'HOME' : 'AWAY'}_TEAM_TOTAL_GOALS` }, { kind: 'team_total', teamId: c.team.id }, { teamId: c.team.id }))
    const alt = mkm(ctx, `alttt|${c.team.id}`, `${teamShort(c)} Alternate Total Goals`, { tabs: [TAB.SGP, TAB.TEAM_PROPS], group: 'alt', kind: 'alt_total', layout: 'grid', sort: 10, category: 'Team Props' })
    for (const t of [0.5, 1.5, 2.5, 3.5, 4.5, 5.5]) {
      const po = Math.min(0.99, Math.max(0.01, poissonTail(lam, Math.ceil(t))))
      add(alt, `over|${t}`, `Over (${fmtLine(t)})`, priceFromProb(po, 0.06), { kind: 'team_total', side: 'over', teamId: c.team.id, line: t }, { line: t, teamId: c.team.id })
      add(alt, `under|${t}`, `Under (${fmtLine(t)})`, priceFromProb(1 - po, 0.06), { kind: 'team_total', side: 'under', teamId: c.team.id, line: t }, { line: t, teamId: c.team.id })
    }
    out.push(alt)
  }
  const pFirstH = lamH / (lamH + lamA)
  out.push(twoTeam(ctx, 'first_goal', 'Team To Score First Goal', { tabs: [TAB.SGP, TAB.POPULAR, TAB.GAME_PROPS], group: 'specials', sort: 11, category: 'Game Props', fdType: 'TEAM_TO_SCORE_FIRST_GOAL' }, pFirstH, 0.05, { kind: 'team_first_score' }))
  out.push(twoTeam(ctx, 'last_goal', 'Team To Score Last Goal', { tabs: [TAB.SGP, TAB.GAME_PROPS], group: 'specials', sort: 12, category: 'Game Props', fdType: 'TEAM_TO_SCORE_LAST_GOAL' }, 0.5 + (gm.pHome - 0.5) * 0.7, 0.05, { kind: 'team_last_score' }))
  for (const n of [2, 3, 4]) {
    const pH = 0.5 + (pFirstH - 0.5) * (1 + 0.25 * (n - 1))
    const pReach = 1 - (1 - poissonTail(lamH, n)) * (1 - poissonTail(lamA, n))
    const m = mkm(ctx, `race|${n}`, `Race To ${n} Goals`, { tabs: [TAB.SGP, TAB.GAME_PROPS], group: 'specials', kind: 'moneyline', layout: 'three-col', sort: 13 + n / 10, category: 'Game Props', fdType: `RACE_TO_${n}_GOALS` })
    add(m, 'away', away.team.displayName, priceFromProb((1 - pH) * pReach, 0.06), { kind: 'race_to', side: 'away', teamId: away.team.id, line: n }, { teamId: away.team.id })
    add(m, 'neither', 'Neither', priceFromProb(1 - pReach, 0.06), { kind: 'race_to', side: 'no', line: n })
    add(m, 'home', home.team.displayName, priceFromProb(pH * pReach, 0.06), { kind: 'race_to', side: 'home', teamId: home.team.id, line: n }, { teamId: home.team.id })
    out.push(m)
  }
  out.push(yesNo(ctx, 'btts', 'Both Teams To Score', (1 - Math.exp(-lamH)) * (1 - Math.exp(-lamA)), 0.05, { tabs: [TAB.SGP, TAB.GAME_PROPS], group: 'specials', sort: 14, category: 'Game Props', fdType: 'BOTH_TEAMS_TO_SCORE' }, { kind: 'btts' }))
  for (const n of [2, 3]) out.push(yesNo(ctx, `btts${n}`, `Both Teams To Score ${n}+ Goals`, poissonTail(lamH, n) * poissonTail(lamA, n), 0.055, { tabs: [TAB.SGP, TAB.GAME_PROPS], group: 'specials', sort: 15 + n / 10, category: 'Game Props', fdType: `BOTH_TEAMS_TO_SCORE_${n}+_GOALS` }, { kind: 'both_score_n', line: n }))
  out.push(yesNo(ctx, 'oe', 'Total Goals Odd/Even', 0.5, 0.048, { tabs: [TAB.GAME_PROPS], group: 'specials', sort: 16, category: 'Game Props', fdType: 'TOTAL_GOALS_ODD/EVEN' }, { kind: 'odd_even' }, ['Odd', 'Even']))
  const wm = mkm(ctx, 'margin', 'Winning Margin', { tabs: [TAB.SGP, TAB.GAME_PROPS], group: 'specials', kind: 'winning_margin', layout: 'grid', sort: 17, category: 'Game Props', fdType: 'WINNING_MARGIN' })
  for (const c of [away, home]) {
    const isH = c.homeAway === 'home'
    const pw = isH ? gm.pHome : gm.pAway
    const otShare = pTie * (pw / (gm.pHome + gm.pAway))
    const by1 = (isH ? pMarginOver(0) - pMarginOver(1) : pMarginOver(-2) - pMarginOver(-1)) + otShare
    const by2 = isH ? pMarginOver(1) - pMarginOver(2) : pMarginOver(-3) - pMarginOver(-2)
    const by3 = isH ? pMarginOver(2) : 1 - pMarginOver(-3)
    add(wm, `${c.team.id}|1`, `${c.team.displayName} by 1`, priceFromProb(by1, 0.12), { kind: 'winning_margin', teamId: c.team.id, rangeLow: 1, rangeHigh: 1 }, { teamId: c.team.id })
    add(wm, `${c.team.id}|2`, `${c.team.displayName} by 2`, priceFromProb(by2, 0.12), { kind: 'winning_margin', teamId: c.team.id, rangeLow: 2, rangeHigh: 2 }, { teamId: c.team.id })
    add(wm, `${c.team.id}|3`, `${c.team.displayName} by 3+`, priceFromProb(by3, 0.12), { kind: 'winning_margin', teamId: c.team.id, rangeLow: 3, rangeHigh: 99 }, { teamId: c.team.id })
  }
  out.push(wm)
  const mt = mkm(ctx, 'dbl|ml_total', 'Moneyline / Total Goals Parlay', { tabs: [TAB.POPULAR, TAB.GAME_PROPS], group: 'specials', kind: 'scorer', layout: 'grid', sort: 18, category: 'Game Props', sgp: false, fdType: 'MATCH_/_TOTAL_GOALS_DOUBLE' })
  const tl = lines.total ?? 5.5
  const pov = pTotalOver(tl)
  for (const c of [away, home]) {
    const pw = c.homeAway === 'home' ? gm.pHome : gm.pAway
    add(mt, `${c.team.id}|over`, `${c.team.displayName} & Over ${fmtLine(tl)}`, priceFromProb(pw * pov * 1.08, 0.08), { kind: 'combo', combo: [c.homeAway, 'over', String(tl)] }, { teamId: c.team.id })
    add(mt, `${c.team.id}|under`, `${c.team.displayName} & Under ${fmtLine(tl)}`, priceFromProb(pw * (1 - pov) * 0.92, 0.08), { kind: 'combo', combo: [c.homeAway, 'under', String(tl)] }, { teamId: c.team.id })
  }
  out.push(mt)

  /* ---------- periods ---------- */
  for (const [key, name, pi] of [
    ['p1', '1st Period', 1],
    ['p2', '2nd Period', 2],
    ['p3', '3rd Period', 3],
  ] as const) {
    const lh = (lamH / 3) * (pi === 1 ? 0.92 : 1.04)
    const la = (lamA / 3) * (pi === 1 ? 0.92 : 1.04)
    let ph = 0
    let pt = 0
    for (let h = 0; h <= 6; h++)
      for (let a = 0; a <= 6; a++) {
        const p = pois(lh, h) * pois(la, a)
        if (h > a) ph += p
        else if (h === a) pt += p
      }
    const tabs = [TAB.SGP, name]
    out.push(threeWay(ctx, `pw3|${key}`, `${name} Moneyline (3 Way)`, { tabs, group: 'periods', sort: 20, category: name }, ph, pt, 0.06, { kind: 'period_ml', period: key }))
    const pl = mkm(ctx, `ps|${key}`, `${name} Puck Line`, { tabs, group: 'periods', kind: 'period_spread', layout: 'two-col', sort: 21, category: name, line: 0.5 })
    const fav = ph > 1 - ph - pt
    const hs = fav ? -0.5 : 0.5
    const [hj, aj] = twoWay(fav ? ph : ph + pt, 0.055)
    add(pl, 'away', `${away.team.displayName} (${signed(-hs)})`, aj, { kind: 'period_spread', side: 'away', teamId: away.team.id, line: -hs, period: key }, { line: -hs, teamId: away.team.id })
    add(pl, 'home', `${home.team.displayName} (${signed(hs)})`, hj, { kind: 'period_spread', side: 'home', teamId: home.team.id, line: hs, period: key }, { line: hs, teamId: home.team.id })
    out.push(pl)
    const lamP = lh + la
    const ptm = mkm(ctx, `pt|${key}`, `${name} Total Goals`, { tabs, group: 'periods', kind: 'period_total', layout: 'grid', sort: 22, category: name })
    for (const t of [0.5, 1.5, 2.5, 3.5]) {
      const po = poissonTail(lamP, Math.ceil(t))
      if (po < 0.02 || po > 0.98) continue
      add(ptm, `over|${t}`, `Over (${fmtLine(t)})`, priceFromProb(po, 0.055), { kind: 'period_total', side: 'over', line: t, period: key }, { line: t })
      add(ptm, `under|${t}`, `Under (${fmtLine(t)})`, priceFromProb(1 - po, 0.055), { kind: 'period_total', side: 'under', line: t, period: key }, { line: t })
    }
    out.push(ptm)
    out.push(yesNo(ctx, `btts|${key}`, `${name} Both Teams To Score`, (1 - Math.exp(-lh)) * (1 - Math.exp(-la)), 0.055, { tabs, group: 'specials', sort: 23, category: name }, { kind: 'btts_period', period: key }))
    for (const c of [home, away]) {
      const lam = c.homeAway === 'home' ? lh : la
      out.push(overUnder(ctx, `ptt|${key}|${c.team.id}`, `${name} ${teamShort(c)} Total Goals`, 0.5, 1 - Math.exp(-lam), 0.055, { tabs, group: 'periods', kind: 'period_total', sort: 24, category: name }, { kind: 'team_stat', teamId: c.team.id, period: key, statKey: 'points' }, { teamId: c.team.id }))
    }
    if (pi === 1) out.push(twoTeam(ctx, `first_goal|${key}`, `Team To Score First Goal - ${name}`, { tabs, group: 'specials', sort: 25, category: name }, pFirstH, 0.05, { kind: 'team_first_score', period: key }))
  }

  /* ---------- skaters ---------- */
  const pool = new Map<string, Skater>()
  const put = (p: PlayerLine, k: 'gpg' | 'apg' | 'sog') => {
    const s = pool.get(p.id) ?? { ...p, gpg: 0, apg: 0, sog: 0 }
    s[k] = p.line
    pool.set(p.id, s)
  }
  leaderLines(ctx, 'goals', 10, (pg) => pg).forEach((p) => put(p, 'gpg'))
  leaderLines(ctx, 'assists', 10, (pg) => pg).forEach((p) => put(p, 'apg'))
  leaderLines(ctx, 'points', 10, (pg) => pg).forEach((p) => {
    const s = pool.get(p.id)
    if (s && !s.apg) s.apg = Math.max(0, p.line - s.gpg)
    else if (!s) put({ ...p, line: p.line * 0.55 }, 'apg')
  })
  leaderLines(ctx, 'shotsTotal', 10, (pg) => pg).forEach((p) => put(p, 'sog'))
  const skaters = [...pool.values()].filter((s) => s.position !== 'G')
  for (const s of skaters) {
    const lam = s.teamId === home.team.id ? lamH : lamA
    const adj = lam / 3.0
    s.gpg = Math.max(0.04, s.gpg || s.apg * 0.6) * adj
    s.apg = Math.max(0.05, s.apg || s.gpg * 0.9) * adj
    if (!s.sog) s.sog = Math.max(1.2, 1.4 + 5.5 * s.gpg + 1.1 * s.apg)
  }
  skaters.sort((a, b) => b.gpg + b.apg - (a.gpg + a.apg))
  const meta = (s: Skater) => ({ id: s.id, name: s.name, teamId: s.teamId, position: s.position, headshot: s.headshot })
  if (skaters.length) {
    const rows = (f: (s: Skater) => number, kind: Grading['kind'], extra: Partial<Grading> = {}) => skaters.map((s) => ({ key: s.id, label: s.name, p: f(s), grading: { kind, playerId: s.id, teamId: s.teamId, ...extra } as Grading, extra: { playerId: s.id, teamId: s.teamId } }))
    const gTabs = [TAB.SGP, TAB.POPULAR, TAB.GOALSCORER]
    const any = list(ctx, 'scorer|any_goal', 'Any Time Goal Scorer', { tabs: gTabs, group: 'td', sort: 30, category: 'Goalscorer', fdType: 'ANY_TIME_GOAL_SCORER' }, rows((s) => 1 - Math.exp(-s.gpg), 'td_scorer', { statKey: '*.goals' }), 0.12, 0.03)
    if (any) out.push(any)
    const sumG = skaters.reduce((a, s) => a + s.gpg, 0)
    const first = list(ctx, 'scorer|first_goal', 'First Goal Scorer', { tabs: [TAB.SGP, TAB.GOALSCORER], group: 'td', sort: 31, category: 'Goalscorer', fdType: 'FIRST_GOAL_SCORER' }, rows((s) => (s.gpg / sumG) * 0.97, 'first_td', { statKey: '*.goals' }), 0.05, 0.012)
    if (first) out.push(first)
    const last = list(ctx, 'scorer|last_goal', 'Last Goal Scorer', { tabs: [TAB.SGP, TAB.GOALSCORER], group: 'td', sort: 32, category: 'Goalscorer', fdType: 'LAST_GOAL_SCORER' }, rows((s) => (s.gpg / sumG) * 0.97, 'last_td', { statKey: '*.goals' }), 0.05, 0.012)
    if (last) out.push(last)
    const two = list(ctx, 'scorer|2', 'To Score 2+ Goals', { tabs: [TAB.SGP, TAB.GOALSCORER], group: 'td', sort: 33, category: 'Goalscorer', fdType: 'TO_SCORE_2+_GOALS' }, rows((s) => poissonTail(s.gpg, 2), 'multi_td', { statKey: '*.goals', count: 2 }), 0.14, 0.012)
    if (two) out.push(two)
    const three = list(ctx, 'scorer|3', 'To Score 3+ Goals', { tabs: [TAB.GOALSCORER], group: 'td', sort: 34, category: 'Goalscorer', fdType: 'TO_SCORE_3+_GOALS' }, rows((s) => poissonTail(s.gpg, 3), 'multi_td', { statKey: '*.goals', count: 3 }), 0.16, 0.006)
    if (three) out.push(three)
    const pt1 = list(ctx, 'points|1', 'To Record A Point', { tabs: [TAB.SGP, TAB.POPULAR, TAB.GOALSCORER, TAB.PLAYER_PROPS], group: 'td', sort: 35, category: 'Player Props', fdType: 'TO_RECORD_A_POINT' }, rows((s) => 1 - Math.exp(-(s.gpg + s.apg)), 'player_ladder', { statKey: '*.goals+*.assists', line: 1 }), 0.11, 0.05)
    if (pt1) out.push(pt1)
    const pt2 = list(ctx, 'points|2', 'To Record 2+ Points', { tabs: [TAB.SGP, TAB.PLAYER_PROPS], group: 'td', sort: 36, category: 'Player Props', fdType: 'TO_RECORD_2+_POINTS' }, rows((s) => poissonTail(s.gpg + s.apg, 2), 'player_ladder', { statKey: '*.goals+*.assists', line: 2 }), 0.14, 0.02)
    if (pt2) out.push(pt2)
    const pt3 = list(ctx, 'points|3', 'To Record 3+ Points', { tabs: [TAB.PLAYER_PROPS], group: 'td', sort: 37, category: 'Player Props', fdType: 'TO_RECORD_3+_POINTS' }, rows((s) => poissonTail(s.gpg + s.apg, 3), 'player_ladder', { statKey: '*.goals+*.assists', line: 3 }), 0.16, 0.006)
    if (pt3) out.push(pt3)
    const as1 = list(ctx, 'assists|1', 'To Record An Assist', { tabs: [TAB.SGP, TAB.PLAYER_PROPS], group: 'td', sort: 38, category: 'Player Props', fdType: 'TO_RECORD_AN_ASSIST' }, rows((s) => 1 - Math.exp(-s.apg), 'player_ladder', { statKey: '*.assists', line: 1 }), 0.12, 0.04)
    if (as1) out.push(as1)
    const as2 = list(ctx, 'assists|2', 'To Record 2+ Assists', { tabs: [TAB.PLAYER_PROPS], group: 'td', sort: 39, category: 'Player Props', fdType: 'TO_RECORD_2+_ASSISTS' }, rows((s) => poissonTail(s.apg, 2), 'player_ladder', { statKey: '*.assists', line: 2 }), 0.15, 0.01)
    if (as2) out.push(as2)
    for (const n of [2, 3, 4, 5, 6]) {
      const m = list(ctx, `sog|${n}`, `To Record ${n}+ Shots On Goal`, { tabs: [TAB.SGP, TAB.PLAYER_PROPS], group: 'td', sort: 40 + n / 10, category: 'Player Props', fdType: `TO_RECORD_${n}+_SHOTS_ON_GOAL` }, rows((s) => poissonTail(s.sog, n), 'player_ladder', { statKey: '*.shotsTotal', line: n }), 0.1, 0.03)
      if (m) out.push(m)
    }
    skaters.slice(0, 12).forEach((s, i) => {
      const line = toHalfLine(s.sog)
      out.push(overUnder(ctx, `prop|shots|${s.id}`, `${s.name} - Shots On Goal`, line, poissonTail(s.sog + 0.15, Math.ceil(line)), 0.07, { tabs: [TAB.SGP, TAB.PLAYER_PROPS], sort: 41 + i / 100, category: 'Player Props', player: meta(s), fdType: 'PLAYER_A_TOTAL_SHOTS_ON_GOAL' }, { kind: 'player_stat', statKey: '*.shotsTotal', playerId: s.id }, { playerId: s.id, teamId: s.teamId }))
      out.push(overUnder(ctx, `prop|points|${s.id}`, `${s.name} - Points`, 0.5, 1 - Math.exp(-(s.gpg + s.apg)), 0.08, { tabs: [TAB.PLAYER_PROPS], sort: 42 + i / 100, category: 'Player Props', player: meta(s) }, { kind: 'player_stat', statKey: '*.goals+*.assists', playerId: s.id }, { playerId: s.id, teamId: s.teamId }))
      const bl = s.position === 'D' ? 1.7 : 0.6
      out.push(overUnder(ctx, `prop|blocked|${s.id}`, `${s.name} - Blocked Shots`, toHalfLine(bl), poissonTail(bl + 0.1, Math.ceil(toHalfLine(bl))), 0.08, { tabs: [TAB.PLAYER_PROPS], sort: 43 + i / 100, category: 'Player Props', player: meta(s) }, { kind: 'player_stat', statKey: '*.blockedShots', playerId: s.id }, { playerId: s.id, teamId: s.teamId }))
    })
    const top = skaters.slice(0, 5)
    const pairs: [Skater, Skater][] = []
    for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) pairs.push([top[i], top[j]])
    const either = list(ctx, 'scorer|either', 'Either Player - Any Time Goal Scorer', { tabs: [TAB.SGP, TAB.GOALSCORER], group: 'td', sort: 44, category: 'Goalscorer' }, pairs.map(([a, b]) => ({ key: `${a.id}-${b.id}`, label: `${a.name} or ${b.name}`, p: 1 - Math.exp(-(a.gpg + b.gpg)), grading: { kind: 'either_player', playerIds: [a.id, b.id], statKey: '*.goals', label: 'any' } as Grading })), 0.1)
    if (either) out.push(either)
  }
  return out
}
