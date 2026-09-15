/** FanDuel NFL / NCAAF event catalog: exact tab layout, market names, and calibrated pricing. */
import { normCdf, priceFromProb, toHalfLine } from '../odds'
import { flatJuice, marginSigmaCal, pMax, periodRatio, periodTie, poissonTail, scorerRatio, twoWay } from '../pricing'
import type { Grading, Market } from '../types'
import { TAB, add, altSpread, altTotal, espnLines, fmtLine, gameModel, intLine, ladder, leaderLines, list, mkm, overUnder, overUnderJuice, pOverInt, signed, teamShort, threeWay, twoTeam, yesNo, type Ctx, type PlayerLine } from './common'

export const NFL_TABS = [TAB.SGP, TAB.POPULAR, TAB.QUICK, TAB.PASSING, TAB.RECEIVING, TAB.RUSHING, TAB.TD, TAB.DST, TAB.Q1, TAB.H1, TAB.H2, TAB.SCORING, TAB.PARLAYS, TAB.Q2, TAB.Q3, TAB.Q4]
export const NCAAF_TABS = [TAB.SGP, TAB.POPULAR, TAB.PASSING, TAB.RECEIVING, TAB.RUSHING, TAB.TD, TAB.TEAM_YARDS, TAB.Q1, TAB.H1, TAB.SCORING, TAB.PARLAYS, TAB.Q2, TAB.Q3, TAB.Q4]

const YDS_THRESH = [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250, 275, 300, 325, 350, 375, 400, 425, 450, 475, 500]

function yardsLadder(mainLine: number, coarse: boolean): number[] {
  const set = coarse ? YDS_THRESH.filter((t) => t >= 150) : YDS_THRESH.filter((t) => t < 250 || t % 25 === 0)
  return set.filter((t) => t >= mainLine * 0.35 && t <= mainLine * 2.4 + 15)
}

interface Skill extends PlayerLine {
  rush?: number
  rec?: number
  pass?: number
  receptions?: number
  passTds?: number
  pAny: number
}

export function buildFootball(ctx: Ctx): Market[] {
  const { ev, league, lines } = ctx
  const isNFL = league.id === 'nfl'
  const gm = gameModel(ctx)
  const out: Market[] = []
  const S = gm.spread
  const T = gm.total
  const sigma = marginSigmaCal(ctx.cal, isNFL ? 10.7 : 15.2) // FanDuel's ML↔spread sigma
  const sigmaMargin = isNFL ? 13.4 : 16.5 // realised margin sd (alternates)
  const sigmaTotal = isNFL ? 11.5 : 14
  const sigmaTeam = isNFL ? 9.6 : 12
  const home = ev.home
  const away = ev.away
  const pHomeReg = normCdf(-S / sigma)
  let sort = 1

  /* ---------- game lines ---------- */
  if (lines.homeML !== undefined && lines.awayML !== undefined) {
    const m = mkm(ctx, 'ml', 'Moneyline', { tabs: [TAB.SGP, TAB.POPULAR], group: 'game', kind: 'moneyline', sort: sort++, fdType: 'MONEY_LINE' })
    add(m, 'away', away.team.displayName, lines.awayML, { kind: 'moneyline', side: 'away', teamId: away.team.id }, { teamId: away.team.id })
    add(m, 'home', home.team.displayName, lines.homeML, { kind: 'moneyline', side: 'home', teamId: home.team.id }, { teamId: home.team.id })
    out.push(m)
  }
  if (lines.spread !== undefined && lines.homeSpreadOdds !== undefined && lines.awaySpreadOdds !== undefined) {
    const m = mkm(ctx, 'spread', 'Spread', { tabs: [TAB.SGP, TAB.POPULAR], group: 'game', kind: 'spread', sort: sort++, line: S, fdType: 'MATCH_HANDICAP_(2-WAY)' })
    add(m, 'away', `${away.team.displayName} (${signed(-S)})`, lines.awaySpreadOdds, { kind: 'spread', side: 'away', teamId: away.team.id, line: -S }, { line: -S, teamId: away.team.id })
    add(m, 'home', `${home.team.displayName} (${signed(S)})`, lines.homeSpreadOdds, { kind: 'spread', side: 'home', teamId: home.team.id, line: S }, { line: S, teamId: home.team.id })
    out.push(m)
  }
  if (lines.total !== undefined && lines.overOdds !== undefined && lines.underOdds !== undefined) {
    const m = mkm(ctx, 'total', 'Total Points', { tabs: [TAB.SGP, TAB.POPULAR], group: 'game', kind: 'total', sort: sort++, line: T, fdType: 'TOTAL_POINTS_(OVER/UNDER)' })
    add(m, 'over', `Over (${fmtLine(T)})`, lines.overOdds, { kind: 'total', side: 'over', line: T }, { line: T })
    add(m, 'under', `Under (${fmtLine(T)})`, lines.underOdds, { kind: 'total', side: 'under', line: T }, { line: T })
    out.push(m)
  }
  if (!T || lines.spread === undefined) return out

  /* ---------- skill players ---------- */
  const passL = espnLines(ctx, /^Total Passing Yards/i)
  const rushL = espnLines(ctx, /^Total Rushing Yards/i)
  const recL = espnLines(ctx, /^Total Receiving Yards/i)
  const recepL = espnLines(ctx, /^Total Receptions/i)
  const passTdL = espnLines(ctx, /^Total Passing Touchdowns/i)
  const compL = espnLines(ctx, /^Total Pass Completions/i)
  const attL = espnLines(ctx, /^Total Passing Attempts/i)
  const intL = espnLines(ctx, /^Total Passing Interceptions/i)
  const kickL = espnLines(ctx, /^Total Kicking Points/i)
  const fgL = espnLines(ctx, /^Total Field Goals Made/i)
  const players = new Map<string, Skill>()
  const upsert = (p: PlayerLine, k: keyof Skill) => {
    const s = players.get(p.id) ?? { ...p, pAny: 0 }
    ;(s as unknown as Record<string, number>)[k] = p.line
    players.set(p.id, s)
  }
  passL.forEach((p) => upsert(p, 'pass'))
  rushL.forEach((p) => upsert(p, 'rush'))
  recL.forEach((p) => upsert(p, 'rec'))
  recepL.forEach((p) => upsert(p, 'receptions'))
  passTdL.forEach((p) => upsert(p, 'passTds'))
  // team leaders fill whatever ESPN's prop feed does not carry (NCAAF, early week, depth players)
  const fill = (p: PlayerLine, k: keyof Skill) => {
    const s = players.get(p.id)
    if (s && (s as unknown as Record<string, number | undefined>)[k] !== undefined) return
    upsert(p, k)
  }
  leaderLines(ctx, 'passingYards', 1, (pg) => toHalfLine(Math.max(120, pg))).forEach((p) => fill(p, 'pass'))
  leaderLines(ctx, 'passingTouchdowns', 1, (pg) => (pg > 2.2 ? 2.5 : 1.5)).forEach((p) => fill(p, 'passTds'))
  leaderLines(ctx, 'rushingYards', 4, (pg, i) => toHalfLine(Math.max(15, pg * (i === 0 ? 1 : 0.85)))).forEach((p) => fill(p, 'rush'))
  leaderLines(ctx, 'receivingYards', 6, (pg) => toHalfLine(Math.max(12, pg))).forEach((p) => fill(p, 'rec'))
  leaderLines(ctx, 'receptions', 6, (pg) => toHalfLine(Math.max(1.5, pg))).forEach((p) => fill(p, 'receptions'))
  for (const s of players.values()) {
    const isQB = s.position === 'QB' || (s.pass !== undefined && s.pass > 100)
    if (s.position === 'K' || s.position === 'P') continue
    if (isQB) s.pAny = Math.min(0.6, Math.max(0.05, 0.12 + 0.009 * (s.rush ?? 3)))
    else s.pAny = Math.min(0.78, Math.max(0.04, 0.11 + 0.0048 * (s.rush ?? 0) + 0.0038 * (s.rec ?? 0)))
  }
  const skill = [...players.values()].filter((s) => s.pAny > 0)
  const qbs = skill.filter((s) => s.pass !== undefined).sort((a, b) => (b.pass ?? 0) - (a.pass ?? 0))
  const rbs = skill.filter((s) => s.rush !== undefined && s.pass === undefined).sort((a, b) => (b.rush ?? 0) - (a.rush ?? 0))
  const receivers = skill.filter((s) => s.rec !== undefined).sort((a, b) => (b.rec ?? 0) - (a.rec ?? 0))
  const scorers = [...skill].sort((a, b) => b.pAny - a.pAny)
  const meta = (s: Skill) => ({ id: s.id, name: s.name, teamId: s.teamId, position: s.position, headshot: s.headshot })
  const jY = flatJuice(ctx.cal, 'PLAYER_X_PASSING_YARDS_HIGH', [-114, -114])

  /* ---------- TD scorer family ---------- */
  const anyName = isNFL ? 'Any Time Touchdown Scorer' : 'Anytime Touchdown Scorer'
  const tdTabs = [TAB.SGP, TAB.POPULAR, TAB.TD]
  const anyM = list(ctx, 'scorer|any_td', anyName, { tabs: tdTabs, group: 'td', sort: 10, category: 'TD Scorer Props', fdType: 'ANY_TIME_TOUCHDOWN_SCORER' }, scorers.map((s) => ({ key: s.id, label: s.name, p: s.pAny, grading: { kind: 'td_scorer', playerId: s.id, statKey: 'td', teamId: s.teamId } as Grading, extra: { playerId: s.id, teamId: s.teamId } })), 0.14)
  if (anyM) out.push(anyM)
  if (scorers.length) {
    const exp = 1.3
    const sumPow = scorers.reduce((a, s) => a + Math.pow(s.pAny, exp), 0) + 0.5
    const firstRows = scorers.map((s) => ({ key: s.id, label: s.name, p: (Math.pow(s.pAny, exp) / sumPow) * 1.28, grading: { kind: 'first_td', playerId: s.id, statKey: 'td', teamId: s.teamId } as Grading, extra: { playerId: s.id, teamId: s.teamId } }))
    const firstM = list(ctx, 'scorer|first_td', 'First Touchdown Scorer', { tabs: [TAB.SGP, TAB.TD], group: 'td', sort: 11, category: 'TD Scorer Props', fdType: 'FIRST_TOUCHDOWN_SCORER' }, firstRows, 0)
    if (firstM) out.push(firstM)
    const lastM = list(ctx, 'scorer|last_td', 'Last Touchdown Scorer', { tabs: [TAB.SGP, TAB.TD], group: 'td', sort: 12, category: 'TD Scorer Props', fdType: 'LAST_TOUCHDOWN_SCORER' }, firstRows.map((r) => ({ ...r, p: r.p * 0.96, grading: { ...r.grading, kind: 'last_td' } as Grading })), 0)
    if (lastM) out.push(lastM)
    const r2 = scorerRatio(ctx.cal, 'TO_SCORE_2+_TOUCHDOWNS', 'ratio2', 0.55)
    const r3 = scorerRatio(ctx.cal, 'TO_SCORE_3+_TOUCHDOWNS', 'ratio3', 0.22)
    const two = list(ctx, 'scorer|td2', 'To Score 2+ Touchdowns', { tabs: [TAB.SGP, TAB.POPULAR, TAB.TD], group: 'td', sort: 13, category: 'TD Scorer Props', fdType: 'TO_SCORE_2+_TOUCHDOWNS' }, scorers.map((s) => ({ key: s.id, label: s.name, p: s.pAny * s.pAny * (r2 * (0.8 + 0.4 * s.pAny)), grading: { kind: 'multi_td', playerId: s.id, statKey: 'td', count: 2, teamId: s.teamId } as Grading, extra: { playerId: s.id, teamId: s.teamId } })), 0.16, 0.008)
    if (two) out.push(two)
    const three = list(ctx, 'scorer|td3', 'To Score 3+ Touchdowns', { tabs: [TAB.SGP, TAB.POPULAR, TAB.TD], group: 'td', sort: 14, category: 'TD Scorer Props', fdType: 'TO_SCORE_3+_TOUCHDOWNS' }, scorers.map((s) => ({ key: s.id, label: s.name, p: Math.pow(s.pAny, 3) * (r3 * (0.7 + 0.6 * s.pAny)), grading: { kind: 'multi_td', playerId: s.id, statKey: 'td', count: 3, teamId: s.teamId } as Grading, extra: { playerId: s.id, teamId: s.teamId } })), 0.18, 0.004)
    if (three) out.push(three)
    if (isNFL) {
      const four = list(ctx, 'scorer|td4', 'To Score 4+ Touchdowns', { tabs: [TAB.POPULAR, TAB.TD], group: 'td', sort: 15, category: 'TD Scorer Props', fdType: 'TO_SCORE_4+_TOUCHDOWNS' }, scorers.slice(0, 6).map((s) => ({ key: s.id, label: s.name, p: Math.pow(s.pAny, 4) * 0.12, grading: { kind: 'multi_td', playerId: s.id, statKey: 'td', count: 4, teamId: s.teamId } as Grading, extra: { playerId: s.id, teamId: s.teamId } })), 0.2, 0.002)
      if (four) out.push(four)
      // 1st team TD scorer
      for (const c of [away, home]) {
        const team = scorers.filter((s) => s.teamId === c.team.id)
        const sum = team.reduce((a, s) => a + Math.pow(s.pAny, exp), 0) + 0.25
        const m = list(ctx, `scorer|ftd|${c.team.id}`, '1st Team Touchdown Scorer', { tabs: [TAB.SGP, TAB.TD], group: 'td', sort: 16, category: `${c.team.abbreviation} ${c.team.name}`, fdType: '1ST_TEAM_TOUCHDOWN_SCORER' }, team.map((s) => ({ key: s.id, label: s.name, p: (Math.pow(s.pAny, exp) / sum) * 1.2, grading: { kind: 'first_td', playerId: s.id, statKey: 'td', teamId: c.team.id } as Grading, extra: { playerId: s.id, teamId: c.team.id } })), 0)
        if (m) out.push(m)
      }
      // halves / quarters
      const halfR1 = scorerRatio(ctx.cal, 'ANYTIME_1ST_HALF_TD_SCORER', 'halfRatio', 1.0)
      const halfR2 = scorerRatio(ctx.cal, 'ANYTIME_2ND_HALF_TD_SCORER', 'halfRatio', 1.2)
      for (const [key, name, period, ratio, fd] of [
        ['h1_td', 'Anytime 1st Half TD Scorer', 'h1', halfR1, 'ANYTIME_1ST_HALF_TD_SCORER'],
        ['h2_td', 'Anytime 2nd Half TD Scorer', 'h2', halfR2, 'ANYTIME_2ND_HALF_TD_SCORER'],
      ] as const) {
        const m = list(ctx, `scorer|${key}`, name, { tabs: [TAB.SGP, TAB.TD, period === 'h1' ? TAB.H1 : TAB.H2], group: 'td', sort: 95, category: 'TD Scorer Props', fdType: fd }, scorers.map((s) => ({ key: s.id, label: s.name, p: Math.min(0.9, (1 - Math.sqrt(1 - s.pAny)) * ratio), grading: { kind: 'td_scorer', playerId: s.id, statKey: 'td', period, teamId: s.teamId } as Grading, extra: { playerId: s.id, teamId: s.teamId } })), 0.15)
        if (m) out.push(m)
      }
      for (const [q, name, period, tab, fd] of [
        [1, 'Anytime 1st Quarter TD Scorer', 'q1', TAB.Q1, 'ANYTIME_1ST_QTR_TD_SCORER'],
        [2, 'Anytime 2nd Quarter TD Scorer', 'q2', TAB.Q2, 'ANYTIME_2ND_QTR_TD_SCORER'],
        [3, 'Anytime 3rd Quarter TD Scorer', 'q3', TAB.Q3, 'ANYTIME_3RD_QTR_TD_SCORER'],
        [4, 'Anytime 4th Quarter TD Scorer', 'q4', TAB.Q4, 'ANYTIME_4TH_QTR_TD_SCORER'],
      ] as const) {
        const qr = scorerRatio(ctx.cal, fd, 'quarterRatio', q === 2 || q === 4 ? 1.25 : 0.9)
        const m = list(ctx, `scorer|q${q}_td`, name, { tabs: [TAB.SGP, TAB.TD, tab], group: 'td', sort: 96 + q, category: 'TD Scorer Props', fdType: fd }, scorers.map((s) => ({ key: s.id, label: s.name, p: Math.min(0.8, (1 - Math.pow(1 - s.pAny, 0.25)) * qr), grading: { kind: 'td_scorer', playerId: s.id, statKey: 'td', period, teamId: s.teamId } as Grading, extra: { playerId: s.id, teamId: s.teamId } })), 0.18)
        if (m) out.push(m)
      }
      // either player markets (top 6 pairs)
      const top = scorers.slice(0, 6)
      const pairs: [Skill, Skill][] = []
      for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) pairs.push([top[i], top[j]])
      const eitherAny = list(ctx, 'scorer|either_any', 'Either Player - Anytime Touchdown Scorer', { tabs: [TAB.SGP, TAB.TD], group: 'td', sort: 24, category: 'TD Scorer Props', fdType: 'EITHER_PLAYER_-_ANY_TIME_TOUCHDOWN_SCORER' }, pairs.map(([a, b]) => ({ key: `${a.id}-${b.id}`, label: `${a.name} or ${b.name}`, p: 1 - (1 - a.pAny) * (1 - b.pAny) * 1.03, grading: { kind: 'either_player', playerIds: [a.id, b.id], statKey: 'td', label: 'any' } as Grading })), 0.12)
      if (eitherAny) out.push(eitherAny)
      const eitherFirst = list(ctx, 'scorer|either_first', 'Either Player - First Touchdown Scorer', { tabs: [TAB.SGP, TAB.TD], group: 'td', sort: 25, category: 'TD Scorer Props', fdType: 'EITHER_PLAYER_-_FIRST_TOUCHDOWN_SCORER' }, pairs.map(([a, b]) => ({ key: `${a.id}-${b.id}`, label: `${a.name} or ${b.name}`, p: ((Math.pow(a.pAny, exp) + Math.pow(b.pAny, exp)) / sumPow) * 1.2, grading: { kind: 'either_player', playerIds: [a.id, b.id], statKey: 'td', label: 'first' } as Grading })), 0)
      if (eitherFirst) out.push(eitherFirst)
      const eitherTwo = list(ctx, 'scorer|either_two', 'Either Player - To Score 2+ Touchdowns', { tabs: [TAB.SGP, TAB.TD], group: 'td', sort: 26, category: 'TD Scorer Props', fdType: 'EITHER_PLAYER_-_TO_SCORE_2+_TOUCHDOWNS' }, pairs.map(([a, b]) => { const pa = a.pAny * a.pAny * r2; const pb = b.pAny * b.pAny * r2; return { key: `${a.id}-${b.id}`, label: `${a.name} or ${b.name}`, p: pa + pb - pa * pb, grading: { kind: 'either_player', playerIds: [a.id, b.id], statKey: 'td', label: 'multi', count: 2 } as Grading } }), 0.14)
      if (eitherTwo) out.push(eitherTwo)
    }
  }

  /* ---------- passing props ---------- */
  for (const q of qbs) {
    const pm = meta(q)
    if (q.pass !== undefined) {
      out.push(overUnderJuice(ctx, `prop|pass_yds|${q.id}`, `${q.name} - Passing Yds`, q.pass, jY, { tabs: [TAB.SGP, TAB.POPULAR, TAB.PASSING], sort: 30, category: 'Passing Props', player: pm, fdType: 'PLAYER_X_PASSING_YARDS_HIGH' }, { kind: 'player_stat', statKey: 'passing.passingYards', playerId: q.id }, { playerId: q.id, teamId: q.teamId }))
      const alt = ladder(ctx, `alt|pass_yds|${q.id}`, `${q.name} - Alt Passing Yds`, { tabs: [TAB.SGP, TAB.POPULAR, TAB.PASSING], sort: 31, category: 'Passing Props', player: pm, group: 'alt', fdType: 'PLAYER_X_ALT_PASSING_YARDS_HIGH' }, { stat: 'PASSING_YARDS', statKey: 'passing.passingYards', playerId: q.id, mainLine: q.pass, thresholds: yardsLadder(q.pass, true), unit: (t) => `${t}+ Yards`, sigma: Math.max(40, 0.22 * q.pass), prefix: q.name, teamId: q.teamId })
      if (alt) out.push(alt)
    }
    const tdMean = q.passTds !== undefined ? q.passTds : Math.max(0.8, (q.pass ?? 200) / 130)
    const tdLine = q.passTds ?? intLine(tdMean)
    const pOverTd = 1 - normCdf((tdLine - (q.passTds !== undefined ? q.passTds + 0.15 : tdMean)) / 1.05)
    out.push(overUnder(ctx, `prop|pass_tds|${q.id}`, `${q.name} - Passing TDs`, tdLine, pOverTd, 0.07, { tabs: [TAB.SGP, TAB.POPULAR, TAB.PASSING], sort: 32, category: 'Passing Props', player: pm, fdType: 'PLAYER_X_PASSING_TOUCHDOWNS_HIGH' }, { kind: 'player_stat', statKey: 'passing.passingTouchdowns', playerId: q.id }, { playerId: q.id, teamId: q.teamId }))
    const altTd = ladder(ctx, `alt|pass_tds|${q.id}`, `${q.name} - Alt Passing TDs`, { tabs: [TAB.SGP, TAB.POPULAR, TAB.PASSING], sort: 33, category: 'Passing Props', player: pm, group: 'alt', fdType: 'PLAYER_X_ALT_PASSING_TOUCHDOWNS_HIGH' }, { stat: 'PASSING_TOUCHDOWNS', statKey: 'passing.passingTouchdowns', playerId: q.id, mainLine: tdLine, thresholds: [1, 2, 3, 4, 5], unit: (t) => `${t}+ Passing Touchdowns`, sigma: 1.05, integer: true, prefix: q.name, teamId: q.teamId })
    if (altTd) out.push(altTd)
    const comp = compL.find((c) => c.id === q.id)
    if (comp) out.push(overUnderJuice(ctx, `prop|completions|${q.id}`, `${q.name} - Pass Completions`, comp.line, jY, { tabs: [TAB.SGP, TAB.PASSING], sort: 34, category: 'Passing Props', player: pm }, { kind: 'player_stat', statKey: 'passing.completions/passingAttempts#0', playerId: q.id }, { playerId: q.id, teamId: q.teamId }))
    const att = attL.find((c) => c.id === q.id)
    if (att) out.push(overUnderJuice(ctx, `prop|pass_att|${q.id}`, `${q.name} - Pass Attempts`, att.line, jY, { tabs: [TAB.SGP, TAB.PASSING], sort: 35, category: 'Passing Props', player: pm }, { kind: 'player_stat', statKey: 'passing.completions/passingAttempts#1', playerId: q.id }, { playerId: q.id, teamId: q.teamId }))
    const ints = intL.find((c) => c.id === q.id)
    if (ints) out.push(overUnder(ctx, `prop|ints|${q.id}`, `${q.name} - Interceptions Thrown`, ints.line, 1 - normCdf((ints.line - (ints.line + 0.2)) / 0.85), 0.07, { tabs: [TAB.SGP, TAB.PASSING], sort: 36, category: 'Passing Props', player: pm }, { kind: 'player_stat', statKey: 'passing.interceptions', playerId: q.id }, { playerId: q.id, teamId: q.teamId }))
    if (q.rush !== undefined) {
      out.push(overUnderJuice(ctx, `prop|rush_yds|${q.id}`, `${q.name} - Rushing Yds`, q.rush, jY, { tabs: [TAB.SGP, TAB.POPULAR, TAB.RUSHING], sort: 40, category: 'Rushing Props', player: pm, fdType: 'PLAYER_X_RUSHING_YARDS_HIGH' }, { kind: 'player_stat', statKey: 'rushing.rushingYards', playerId: q.id }, { playerId: q.id, teamId: q.teamId }))
      const alt = ladder(ctx, `alt|rush_yds|${q.id}`, `${q.name} - Alt Rushing Yds`, { tabs: [TAB.SGP, TAB.POPULAR, TAB.RUSHING], sort: 41, category: 'Rushing Props', player: pm, group: 'alt', fdType: 'PLAYER_X_ALT_RUSHING_YARDS_HIGH' }, { stat: 'RUSHING_YARDS', statKey: 'rushing.rushingYards', playerId: q.id, mainLine: q.rush, thresholds: yardsLadder(q.rush, false), unit: (t) => `${t}+ Yards`, sigma: Math.max(12, 0.5 * q.rush), prefix: q.name, teamId: q.teamId })
      if (alt) out.push(alt)
    }
  }
  if (qbs.length >= 2) {
    const ps = pMax(qbs.map((q) => q.pass ?? 0), qbs.map((q) => Math.max(40, 0.22 * (q.pass ?? 200))))
    const m = list(ctx, 'most|pass', 'Most Passing Yards', { tabs: [TAB.POPULAR, TAB.PASSING], sort: 29, category: 'Passing Props', fdType: 'MOST_PASSING_YARDS' }, qbs.map((q, i) => ({ key: q.id, label: q.name, p: ps[i], grading: { kind: 'most_stat', playerId: q.id, playerIds: qbs.map((x) => x.id), statKey: 'passing.passingYards' } as Grading, extra: { playerId: q.id, teamId: q.teamId } })), 0.06)
    if (m) out.push(m)
  }

  /* ---------- rushing props ---------- */
  for (const r of rbs) {
    const pm = meta(r)
    out.push(overUnderJuice(ctx, `prop|rush_yds|${r.id}`, `${r.name} - Rushing Yds`, r.rush!, jY, { tabs: [TAB.SGP, TAB.POPULAR, TAB.RUSHING], sort: 40, category: 'Rushing Props', player: pm, fdType: 'PLAYER_X_RUSHING_YARDS_HIGH' }, { kind: 'player_stat', statKey: 'rushing.rushingYards', playerId: r.id }, { playerId: r.id, teamId: r.teamId }))
    const alt = ladder(ctx, `alt|rush_yds|${r.id}`, `${r.name} - Alt Rushing Yds`, { tabs: [TAB.SGP, TAB.POPULAR, TAB.RUSHING], sort: 41, category: 'Rushing Props', player: pm, group: 'alt', fdType: 'PLAYER_X_ALT_RUSHING_YARDS_HIGH' }, { stat: 'RUSHING_YARDS', statKey: 'rushing.rushingYards', playerId: r.id, mainLine: r.rush!, thresholds: yardsLadder(r.rush!, false), unit: (t) => `${t}+ Yards`, sigma: Math.max(12, 0.5 * r.rush!), prefix: r.name, teamId: r.teamId })
    if (alt) out.push(alt)
    if (r.rec !== undefined && isNFL) {
      const combo = toHalfLine(r.rush! + r.rec)
      out.push(overUnderJuice(ctx, `prop|rush_rec_yds|${r.id}`, `${r.name} - Rushing + Receiving Yds`, combo, jY, { tabs: [TAB.SGP, TAB.RUSHING, TAB.RECEIVING], sort: 42, category: 'Rushing Props', player: pm, fdType: 'PLAYER_X_RUSHING_+_RECEIVING_YARDS' }, { kind: 'player_stat', statKey: 'rushing.rushingYards+receiving.receivingYards', playerId: r.id }, { playerId: r.id, teamId: r.teamId }))
    }
  }
  const rushers = [...rbs, ...qbs.filter((q) => (q.rush ?? 0) >= 15)]
  if (rushers.length >= 2) {
    const ps = pMax(rushers.map((q) => q.rush ?? 0), rushers.map((q) => Math.max(12, 0.5 * (q.rush ?? 30))))
    const m = list(ctx, 'most|rush', 'Most Rushing Yards', { tabs: [TAB.POPULAR, TAB.RUSHING], sort: 39, category: 'Rushing Props', fdType: 'MOST_RUSHING_YARDS' }, rushers.map((q, i) => ({ key: q.id, label: q.name, p: ps[i], grading: { kind: 'most_stat', playerId: q.id, playerIds: rushers.map((x) => x.id), statKey: 'rushing.rushingYards' } as Grading, extra: { playerId: q.id, teamId: q.teamId } })), 0.08, 0.005)
    if (m) out.push(m)
  }

  /* ---------- receiving props ---------- */
  for (const r of receivers) {
    const pm = meta(r)
    const hi = (r.rec ?? 0) >= 25
    out.push(overUnderJuice(ctx, `prop|rec_yds|${r.id}`, `${r.name} - Receiving Yds`, r.rec!, jY, { tabs: [TAB.SGP, TAB.POPULAR, TAB.RECEIVING], sort: 50, category: 'Receiving Props', player: pm, fdType: hi ? 'PLAYER_X_RECEIVING_YARDS_HIGH' : 'PLAYER_X_RECEIVING_YARDS_LOW' }, { kind: 'player_stat', statKey: 'receiving.receivingYards', playerId: r.id }, { playerId: r.id, teamId: r.teamId }))
    const alt = ladder(ctx, `alt|rec_yds|${r.id}`, `${r.name} - Alt Receiving Yds`, { tabs: [TAB.SGP, TAB.POPULAR, TAB.RECEIVING], sort: 51, category: 'Receiving Props', player: pm, group: 'alt', fdType: 'PLAYER_X_ALT_RECEIVING_YARDS_HIGH' }, { stat: 'RECEIVING_YARDS', statKey: 'receiving.receivingYards', playerId: r.id, mainLine: r.rec!, thresholds: yardsLadder(r.rec!, false), unit: (t) => `${t}+ Yards`, sigma: Math.max(10, 0.55 * r.rec!), prefix: r.name, teamId: r.teamId })
    if (alt) out.push(alt)
    const recMean = r.receptions !== undefined ? r.receptions + 0.1 : Math.max(1.2, r.rec! / 11.5)
    const recLine = r.receptions ?? intLine(recMean)
    out.push(overUnder(ctx, `prop|receptions|${r.id}`, `${r.name} - Total Receptions`, recLine, pOverInt(recMean, Math.max(1.3, 0.38 * recMean), recLine), 0.07, { tabs: [TAB.SGP, TAB.POPULAR, TAB.RECEIVING], sort: 52, category: 'Receiving Props', player: pm, fdType: recLine >= 2.5 ? 'PLAYER_X_RECEPTIONS_HIGH' : 'PLAYER_X_RECEPTIONS_LOW' }, { kind: 'player_stat', statKey: 'receiving.receptions', playerId: r.id }, { playerId: r.id, teamId: r.teamId }))
    const altRec = ladder(ctx, `alt|receptions|${r.id}`, `${r.name} - Alt Receptions`, { tabs: [TAB.SGP, TAB.POPULAR, TAB.RECEIVING], sort: 53, category: 'Receiving Props', player: pm, group: 'alt', fdType: 'PLAYER_X_ALT_RECEPTIONS_HIGH' }, { stat: 'RECEPTIONS', statKey: 'receiving.receptions', playerId: r.id, mainLine: recLine, thresholds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], unit: (t) => `${t}+ Receptions`, sigma: Math.max(1.3, 0.38 * recMean), integer: true, prefix: r.name, teamId: r.teamId })
    if (altRec) out.push(altRec)
  }
  if (receivers.length >= 2) {
    const cands = receivers.slice(0, 10)
    const ps = pMax(cands.map((q) => q.rec ?? 0), cands.map((q) => Math.max(10, 0.55 * (q.rec ?? 30))))
    const m = list(ctx, 'most|rec', 'Most Receiving Yards', { tabs: [TAB.POPULAR, TAB.RECEIVING], sort: 49, category: 'Receiving Props', fdType: 'MOST_RECEIVING_YARDS' }, cands.map((q, i) => ({ key: q.id, label: q.name, p: ps[i], grading: { kind: 'most_stat', playerId: q.id, playerIds: cands.map((x) => x.id), statKey: 'receiving.receivingYards' } as Grading, extra: { playerId: q.id, teamId: q.teamId } })), 0.1, 0.004)
    if (m) out.push(m)
    if (isNFL) {
      // longest reception milestones: logit(p) = 0.95*(ln L - 3.8) + f(N)
      const f: Record<number, number> = { 10: 2.7, 15: 1.1, 20: 0, 30: -1.4 }
      for (const n of [10, 15, 20, 30]) {
        const rows = receivers.map((r) => {
          const lg = 0.95 * (Math.log(Math.max(5, r.rec!)) - 3.8) + f[n]
          const p = 1 / (1 + Math.exp(-lg))
          return { key: r.id, label: r.name, p, grading: { kind: 'long_reception', playerId: r.id, statKey: 'receiving.longReception', line: n, teamId: r.teamId } as Grading, extra: { playerId: r.id, teamId: r.teamId, line: n } }
        })
        const m = list(ctx, `long_rec|${n}`, n === 10 ? 'Player to Record a 10+ Yard Reception' : n === 15 ? 'Player to Record a 15+ Yard Reception' : `Player To Record a ${n}+ Yard Reception`, { tabs: [TAB.SGP, TAB.RECEIVING], sort: 55 + n / 10, category: 'Receiving Props', fdType: `PLAYERS_WITH_${n}+_YARDS_RECEPTION` }, rows, 0.1)
        if (m) out.push(m)
      }
    }
  }

  /* ---------- kicking / D-ST ---------- */
  for (const k of kickL) {
    out.push(overUnderJuice(ctx, `prop|kick_pts|${k.id}`, `${k.name} - Kicking Points`, k.line, jY, { tabs: [TAB.SGP, TAB.SCORING], sort: 60, category: 'Scoring', player: k }, { kind: 'player_stat', statKey: 'kicking.totalKickingPoints', playerId: k.id }, { playerId: k.id, teamId: k.teamId }))
  }
  for (const k of fgL) {
    out.push(overUnder(ctx, `prop|fg_made|${k.id}`, `${k.name} - Field Goals Made`, k.line, pOverInt(k.line + 0.1, 1.0, k.line), 0.07, { tabs: [TAB.SGP, TAB.SCORING], sort: 61, category: 'Scoring', player: k }, { kind: 'player_stat', statKey: 'kicking.fieldGoalsMade/fieldGoalAttempts#0', playerId: k.id }, { playerId: k.id, teamId: k.teamId }))
  }
  if (isNFL) {
    const sackers = leaderLines(ctx, 'sacks', 6, (pg) => pg)
    if (sackers.length) {
      const m = list(ctx, 'sack', 'Player To Record A Sack', { tabs: [TAB.SGP, TAB.POPULAR, TAB.DST], sort: 62, category: 'D/ST', fdType: 'TO_RECORD_1+_SACK' }, sackers.map((s) => ({ key: s.id, label: s.name, p: 1 - Math.exp(-(0.28 + 0.95 * s.line)), grading: { kind: 'player_ladder', playerId: s.id, statKey: 'defensive.sacks', line: 1, teamId: s.teamId } as Grading, extra: { playerId: s.id, teamId: s.teamId, line: 1 } })), 0.12)
      if (m) out.push(m)
    }
    out.push(twoTeam(ctx, 'first_fg', 'Team To Have 1st Field Goal', { tabs: [TAB.DST], group: 'specials', sort: 63, category: 'D/ST', fdType: 'TEAM_TO_HAVE_1ST_FIELD_GOAL' }, 0.5 + (pHomeReg - 0.5) * 0.25, 0.05, { kind: 'team_first_fg' }))
  }

  /* ---------- alternates, team totals ---------- */
  out.push(altSpread(ctx, 'altspread', 'Alternate Spread', { tabs: [TAB.SGP, TAB.POPULAR], group: 'alt', sort: 70, fdType: 'ALTERNATE_HANDICAP' }, S, sigmaMargin, -20, 20, 1))
  out.push(altTotal(ctx, 'alttotal', 'Alternate Total Points', { tabs: [TAB.SGP, TAB.POPULAR], group: 'alt', sort: 71, fdType: 'ALTERNATE_TOTAL' }, T, sigmaTotal, -25, 25, 1, { kind: 'total' }))
  for (const c of [home, away]) {
    const isH = c.homeAway === 'home'
    const exp = isH ? gm.expHome : gm.expAway
    const line = toHalfLine(exp)
    const pOver = 1 - normCdf((line - exp) / sigmaTeam)
    out.push(overUnder(ctx, `tt|${c.team.id}`, `${teamShort(c)} Total Points`, line, pOver, 0.06, { tabs: [TAB.SGP, TAB.POPULAR], group: 'team', kind: 'team_total', sort: 72, category: 'Team Totals', fdType: isH ? 'HOME_TEAM_TOTAL_POINTS' : 'AWAY_TEAM_TOTAL_POINTS' }, { kind: 'team_total', teamId: c.team.id }, { teamId: c.team.id }))
    const altT = mkm(ctx, `alttt|${c.team.id}`, `${teamShort(c)} Alternate Total`, { tabs: [TAB.SGP, TAB.POPULAR], group: 'alt', kind: 'alt_total', layout: 'grid', sort: 73, category: 'Team Totals', fdType: isH ? 'HOME_TEAM_ALTERNATE_TOTAL' : 'AWAY_TEAM_ALTERNATE_TOTAL' })
    for (let k = -14; k <= 14; k++) {
      const t = toHalfLine(exp + k)
      if (t < 0.5) continue
      const po = Math.min(0.995, Math.max(0.005, 1 - normCdf((t - exp) / sigmaTeam)))
      add(altT, `over|${t}`, `Over (${fmtLine(t)})`, priceFromProb(po, 0.04 + 0.1 * Math.abs(po - 0.5)), { kind: 'team_total', side: 'over', teamId: c.team.id, line: t }, { line: t, teamId: c.team.id })
      add(altT, `under|${t}`, `Under (${fmtLine(t)})`, priceFromProb(1 - po, 0.04 + 0.1 * Math.abs(po - 0.5)), { kind: 'team_total', side: 'under', teamId: c.team.id, line: t }, { line: t, teamId: c.team.id })
    }
    out.push(altT)
  }

  /* ---------- halves & quarters ---------- */
  const periods: { key: string; name: string; tab: string; spreadR: number; totalR: number; tie: number; fdBase: string; twoWayWinner: boolean }[] = [
    { key: 'h1', name: '1st Half', tab: TAB.H1, spreadR: periodRatio(ctx.cal, 'FIRST_HALF_HANDICAP', 0.62), totalR: periodRatio(ctx.cal, 'FIRST_HALF_TOTAL', 0.495), tie: periodTie(ctx.cal, '1ST_HALF_WINNER_THREE_WAY', 0.1), fdBase: 'FIRST_HALF', twoWayWinner: true },
    { key: 'q1', name: '1st Quarter', tab: TAB.Q1, spreadR: periodRatio(ctx.cal, '1ST_QUARTER_HANDICAP', 0.33), totalR: periodRatio(ctx.cal, '1ST_QUARTER_TOTAL', 0.18), tie: periodTie(ctx.cal, '1ST_QUARTER_WINNER_THREE_WAY', 0.23), fdBase: '1ST_QUARTER', twoWayWinner: true },
    { key: 'q2', name: '2nd Quarter', tab: TAB.Q2, spreadR: periodRatio(ctx.cal, '2ND_QUARTER_HANDICAP', 0.45), totalR: periodRatio(ctx.cal, '2ND_QUARTER_TOTAL', 0.31), tie: periodTie(ctx.cal, '2ND_QUARTER_WINNER_THREE_WAY', 0.13), fdBase: '2ND_QUARTER', twoWayWinner: true },
    { key: 'q3', name: '3rd Quarter', tab: TAB.Q3, spreadR: periodRatio(ctx.cal, '3RD_QUARTER_HANDICAP', 0.33), totalR: periodRatio(ctx.cal, '3RD_QUARTER_TOTAL', 0.2), tie: periodTie(ctx.cal, '3RD_QUARTER_WINNER_THREE_WAY', 0.19), fdBase: '3RD_QUARTER', twoWayWinner: true },
    { key: 'q4', name: '4th Quarter', tab: TAB.Q4, spreadR: periodRatio(ctx.cal, '4TH_QUARTER_HANDICAP', 0.33), totalR: periodRatio(ctx.cal, '4TH_QUARTER_TOTAL', 0.27), tie: periodTie(ctx.cal, '4TH_QUARTER_WINNER_THREE_WAY', 0.13), fdBase: '4TH_QUARTER', twoWayWinner: true },
    { key: 'h2', name: '2nd Half', tab: TAB.H2, spreadR: periodRatio(ctx.cal, 'SECOND_HALF_HANDICAP', 0.55), totalR: periodRatio(ctx.cal, 'SECOND_HALF_TOTAL', 0.495), tie: 0.08, fdBase: 'SECOND_HALF', twoWayWinner: true },
  ]
  for (const p of periods) {
    if (p.key === 'h2' && !isNFL) continue
    const expMargin = -S * p.spreadR // expected home margin in the period
    const pTotal = toHalfLine(T * p.totalR)
    const pSpread = toHalfLine(-expMargin) === 0 ? (expMargin > 0 ? -0.5 : 0.5) : toHalfLine(-expMargin)
    const psig = sigmaMargin * Math.sqrt(p.key.startsWith('h') ? 0.5 : 0.25)
    const tsig = sigmaTotal * Math.sqrt(p.key.startsWith('h') ? 0.5 : 0.25)
    const pHomeP = normCdf(expMargin / psig)
    const pCover = 1 - normCdf((-pSpread - expMargin) / psig)
    const pOver = 1 - normCdf((pTotal - T * p.totalR) / tsig)
    const tabs = [TAB.SGP, p.tab, ...(p.key === 'h1' || p.key.startsWith('q') ? [TAB.POPULAR] : [])]
    const sp = mkm(ctx, `ps|${p.key}`, `${p.name} Spread`, { tabs, group: 'periods', kind: 'period_spread', sort: 80, line: pSpread, category: p.name, fdType: `${p.fdBase}_HANDICAP` })
    const [hj, aj] = twoWay(pCover, 0.048)
    add(sp, 'away', `${away.team.displayName} (${signed(-pSpread)})`, aj, { kind: 'period_spread', side: 'away', teamId: away.team.id, line: -pSpread, period: p.key }, { line: -pSpread, teamId: away.team.id })
    add(sp, 'home', `${home.team.displayName} (${signed(pSpread)})`, hj, { kind: 'period_spread', side: 'home', teamId: home.team.id, line: pSpread, period: p.key }, { line: pSpread, teamId: home.team.id })
    out.push(sp)
    out.push(overUnder(ctx, `pt|${p.key}`, `${p.name} Total`, pTotal, pOver, 0.048, { tabs, group: 'periods', kind: 'period_total', sort: 81, category: p.name, fdType: `${p.fdBase}_TOTAL` }, { kind: 'period_total', period: p.key }))
    if (isNFL) out.push(threeWay(ctx, `pw3|${p.key}`, `${p.name} Winner (3-Way)`, { tabs: [TAB.SGP, p.tab], group: 'periods', sort: 82, category: p.name, fdType: `${p.fdBase.replace('FIRST_HALF', '1ST_HALF').replace('SECOND_HALF', '2ND_HALF')}_WINNER_THREE_WAY` }, pHomeP * (1 - p.tie), p.tie, p.key.startsWith('q') ? 0.11 : 0.07, { kind: 'period_ml', period: p.key }))
    if (p.twoWayWinner) out.push(twoTeam(ctx, `pw|${p.key}`, `${p.name} Winner`, { tabs: [p.tab, ...(p.key === 'h1' ? [TAB.POPULAR] : [])], group: 'periods', kind: 'period_ml', sort: 83, category: p.name, fdType: `${p.fdBase.replace('FIRST_HALF', '1ST_HALF').replace('SECOND_HALF', '2ND_HALF')}_WINNER` }, pHomeP, 0.05, { kind: 'period_ml', period: p.key, label: '2way' }))
    if (isNFL && p.key.startsWith('q')) {
      const qn = parseInt(p.key[1], 10)
      const lam = (T / 5.5 / 4) * [1.0, 1.45, 1.05, 1.35][qn - 1]
      const pScoreH = 1 - Math.exp(-lam * (gm.expHome / T) * 2 * 1.25)
      const pScoreA = 1 - Math.exp(-lam * (gm.expAway / T) * 2 * 1.25)
      out.push(yesNo(ctx, `btts|${p.key}`, `${p.name} Both Teams to Score`, pScoreH * pScoreA, 0.06, { tabs: [TAB.SGP, p.tab], group: 'specials', sort: 84, category: p.name, fdType: `BOTH_TEAMS_TO_SCORE_-_QTR_${qn}` }, { kind: 'btts_period', period: p.key }))
      if (qn === 1 || qn === 3) {
        const lamTd = (T / 7.5 / 4) * [0.95, 1.2, 0.95, 1.15][qn - 1]
        out.push(yesNo(ctx, `qtd|${p.key}`, `${p.name} Touchdown`, 1 - Math.exp(-lamTd), 0.07, { tabs: [p.tab], group: 'specials', sort: 85, category: p.name, fdType: `${p.fdBase}_TOUCHDOWN_(YES/NO)` }, { kind: 'period_td', period: p.key }))
      }
      if (qn === 1) out.push(yesNo(ctx, `oe|${p.key}`, `${p.name} Total Points Odd/Even`, 0.5, 0.048, { tabs: [p.tab], group: 'specials', sort: 86, category: p.name, fdType: '1ST_QUARTER_TOTAL_POINTS_ODD/EVEN' }, { kind: 'odd_even', period: p.key }, ['Odd', 'Even']))
    }
    if (isNFL && p.key.startsWith('h')) {
      // alternates + team totals for halves
      out.push(altSpread(ctx, `altps|${p.key}`, `${p.name} Alternate Spread`, { tabs: [TAB.SGP, p.tab], group: 'alt', sort: 87, category: p.name, fdType: `${p.fdBase}_ALTERNATE_HANDICAP` }, pSpread, psig, -10, 10, 1, p.key))
      out.push(altTotal(ctx, `altpt|${p.key}`, `${p.name} Alternate Total Points`, { tabs: [TAB.SGP, p.tab], group: 'alt', sort: 88, category: p.name, fdType: `${p.fdBase}_ALTERNATE_TOTAL_POINTS` }, pTotal, tsig, -12, 12, 1, { kind: 'period_total', period: p.key }))
      for (const c of [home, away]) {
        const isH = c.homeAway === 'home'
        const exp = (isH ? gm.expHome : gm.expAway) * p.totalR
        const line = toHalfLine(exp)
        const po = 1 - normCdf((line - exp) / (sigmaTeam * Math.sqrt(0.5)))
        out.push(overUnder(ctx, `ptt|${p.key}|${c.team.id}`, `${p.name} ${teamShort(c)} Total Points`, line, po, 0.06, { tabs: [TAB.SGP, p.tab], group: 'periods', kind: 'period_total', sort: 89, category: p.name, fdType: `${p.key === 'h1' ? '1ST_HALF' : '2ND_HALF'}_${isH ? 'HOME' : 'AWAY'}_TEAM_TOTAL_POINTS` }, { kind: 'team_stat', teamId: c.team.id, period: p.key, statKey: 'points' }, { teamId: c.team.id }))
      }
      if (p.key === 'h1') {
        const lamTd = T / 7.5 / 2
        out.push(overUnder(ctx, 'tds|h1', '1st Half Total Touchdowns', intLine(lamTd), poissonTail(lamTd, Math.ceil(intLine(lamTd))), 0.06, { tabs: [TAB.SGP, TAB.H1], group: 'specials', sort: 90, category: p.name, fdType: 'TOTAL_TOUCHDOWNS_1ST_HALF' }, { kind: 'total_tds', period: 'h1' }))
        for (const c of [home, away]) {
          const lam = ((c.homeAway === 'home' ? gm.expHome : gm.expAway) / 7.3) * 0.5
          const line = intLine(lam)
          out.push(overUnder(ctx, `tds|h1|${c.team.id}`, `1st Half Total Touchdowns - ${teamShort(c)}`, line, poissonTail(lam, Math.ceil(line)), 0.06, { tabs: [TAB.SGP, TAB.H1], group: 'specials', sort: 91, category: p.name, fdType: `1ST_HALF_TOTAL_TOUCHDOWNS_-_${c.homeAway === 'home' ? 'HOME' : 'AWAY'}_TEAM` }, { kind: 'total_tds', period: 'h1', teamId: c.team.id }, { teamId: c.team.id }))
        }
        out.push(twoTeam(ctx, 'last_score_h1', 'Team To Score Last 1st Half', { tabs: [TAB.SGP, TAB.H1], group: 'specials', sort: 92, category: p.name, fdType: 'TEAM_TO_SCORE_LAST_1ST_HALF' }, 0.5 + (pHomeReg - 0.5) * 0.2, 0.048, { kind: 'team_last_score', period: 'h1' }))
        // double result
        const dr = mkm(ctx, 'double_result', 'First Half Winner / End of Regulation Winner Parlay', { tabs: [TAB.SGP, TAB.H1], group: 'specials', kind: 'period_ml', layout: 'list', sort: 93, category: p.name, fdType: 'DOUBLE_RESULT' })
        const ph1 = pHomeP * (1 - p.tie)
        const pa1 = (1 - pHomeP) * (1 - p.tie)
        const cond = (pWinFt: number) => pWinFt + 0.55 * (1 - pWinFt)
        const combos: [string, string, number, string][] = [
          ['home', 'home', ph1 * cond(gm.pHome), `${home.team.displayName} - ${home.team.displayName}`],
          ['home', 'away', ph1 * (1 - cond(gm.pHome)) * 0.9, `${home.team.displayName} - ${away.team.displayName}`],
          ['home', 'draw', ph1 * 0.012, `${home.team.displayName} - Tie`],
          ['away', 'away', pa1 * cond(gm.pAway), `${away.team.displayName} - ${away.team.displayName}`],
          ['away', 'home', pa1 * (1 - cond(gm.pAway)) * 0.9, `${away.team.displayName} - ${home.team.displayName}`],
          ['away', 'draw', pa1 * 0.012, `${away.team.displayName} - Tie`],
          ['draw', 'home', p.tie * (gm.pHome * 0.9), `Tie - ${home.team.displayName}`],
          ['draw', 'away', p.tie * (gm.pAway * 0.9), `Tie - ${away.team.displayName}`],
          ['draw', 'draw', p.tie * 0.02, 'Tie - Tie'],
        ]
        for (const [a, b, pr, label] of combos) add(dr, `${a}-${b}`, label, priceFromProb(pr, 0.1), { kind: 'double_result', combo: [a, b] })
        dr.selections.sort((x, y) => x.odds - y.odds)
        out.push(dr)
      }
    }
  }

  /* ---------- scoring specials ---------- */
  if (isNFL) {
    const pFirst = 0.5 + (pHomeReg - 0.5) * 0.2
    out.push(twoTeam(ctx, 'first_score', 'Team to Score First', { tabs: [TAB.SGP, TAB.SCORING], group: 'specials', sort: 100, category: 'Scoring', fdType: 'TEAM_TO_SCORE_FIRST' }, pFirst, 0.048, { kind: 'team_first_score' }))
    out.push(twoTeam(ctx, 'last_score', 'Team to Score Last', { tabs: [TAB.SGP, TAB.SCORING], group: 'specials', sort: 101, category: 'Scoring', fdType: 'TEAM_TO_SCORE_LAST' }, pFirst, 0.048, { kind: 'team_last_score' }))
    const sfw = mkm(ctx, 'score_first_win', 'To Score First And Win', { tabs: [TAB.SGP, TAB.SCORING], group: 'specials', kind: 'prop_yesno', sort: 102, category: 'Scoring', fdType: 'TO_SCORE_FIRST_AND_WIN' })
    add(sfw, 'away', away.team.displayName, priceFromProb((1 - pFirst) * (gm.pAway + 0.12), 0.06), { kind: 'score_first_and', teamId: away.team.id, side: 'yes' }, { teamId: away.team.id })
    add(sfw, 'home', home.team.displayName, priceFromProb(pFirst * (gm.pHome + 0.12), 0.06), { kind: 'score_first_and', teamId: home.team.id, side: 'yes' }, { teamId: home.team.id })
    out.push(sfw)
    const sfl = mkm(ctx, 'score_first_lose', 'To Score First And Lose', { tabs: [TAB.SGP, TAB.SCORING], group: 'specials', kind: 'prop_yesno', sort: 103, category: 'Scoring', fdType: 'TO_SCORE_FIRST_AND_LOSE' })
    add(sfl, 'away', away.team.displayName, priceFromProb((1 - pFirst) * (1 - gm.pAway - 0.12), 0.06), { kind: 'score_first_and', teamId: away.team.id, side: 'no' }, { teamId: away.team.id })
    add(sfl, 'home', home.team.displayName, priceFromProb(pFirst * (1 - gm.pHome - 0.12), 0.06), { kind: 'score_first_and', teamId: home.team.id, side: 'no' }, { teamId: home.team.id })
    out.push(sfl)
    const fsp = mkm(ctx, 'first_scoring_play', 'First Scoring Play', { tabs: [TAB.SGP, TAB.QUICK, TAB.SCORING], group: 'specials', kind: 'scorer', layout: 'list', sort: 104, category: 'Scoring', fdType: 'FIRST_SCORING_PLAY' })
    for (const c of [away, home]) {
      const pf = c.homeAway === 'home' ? pFirst : 1 - pFirst
      add(fsp, `${c.team.id}|TD`, `${c.team.displayName} - Touchdown`, priceFromProb(pf * 0.6, 0.08), { kind: 'first_scoring_play', teamId: c.team.id, label: 'TD' }, { teamId: c.team.id })
      add(fsp, `${c.team.id}|FG`, `${c.team.displayName} - Field Goal`, priceFromProb(pf * 0.38, 0.08), { kind: 'first_scoring_play', teamId: c.team.id, label: 'FG' }, { teamId: c.team.id })
      add(fsp, `${c.team.id}|SAFETY`, `${c.team.displayName} - Safety`, priceFromProb(pf * 0.012, 0.1), { kind: 'first_scoring_play', teamId: c.team.id, label: 'SAFETY' }, { teamId: c.team.id })
    }
    out.push(fsp)
    const eq = mkm(ctx, 'every_quarter', 'To Score Every Quarter', { tabs: [TAB.SGP, TAB.SCORING], group: 'specials', kind: 'prop_yesno', layout: 'grid', sort: 105, category: 'Scoring', fdType: 'TO_SCORE_EVERY_QUARTER' })
    for (const c of [away, home]) {
      const lam = (c.homeAway === 'home' ? gm.expHome : gm.expAway) / 5.5 / 4 * 1.25
      const pq = 1 - Math.exp(-lam)
      const p = Math.pow(pq, 4)
      const [y, n] = twoWay(p, 0.07)
      add(eq, `${c.team.id}|yes`, `${c.team.displayName} - Yes`, y, { kind: 'every_quarter', teamId: c.team.id, side: 'yes' }, { teamId: c.team.id })
      add(eq, `${c.team.id}|no`, `${c.team.displayName} - No`, n, { kind: 'every_quarter', teamId: c.team.id, side: 'no' }, { teamId: c.team.id })
    }
    out.push(eq)
    const lamTds = T / 7.5
    out.push(overUnder(ctx, 'tds', 'Total Touchdowns Scored', intLine(lamTds) + (lamTds - Math.floor(lamTds) > 0.6 ? 1 : 0), poissonTail(lamTds, Math.ceil(intLine(lamTds) + (lamTds - Math.floor(lamTds) > 0.6 ? 1 : 0))), 0.06, { tabs: [TAB.SGP, TAB.SCORING], group: 'specials', sort: 106, category: 'Scoring', fdType: 'TOTAL_TOUCHDOWNS_SCORED' }, { kind: 'total_tds' }))
    for (const c of [away, home]) {
      const lam = (c.homeAway === 'home' ? gm.expHome : gm.expAway) / 7.3
      const line = intLine(lam)
      out.push(overUnder(ctx, `tds|${c.team.id}`, `Total Touchdowns - ${teamShort(c)}`, line, poissonTail(lam, Math.ceil(line)), 0.06, { tabs: [TAB.SGP, TAB.SCORING], group: 'specials', sort: 107, category: 'Scoring', fdType: `TOTAL_TOUCHDOWNS_-_${c.homeAway === 'home' ? 'HOME' : 'AWAY'}_TEAM` }, { kind: 'total_tds', teamId: c.team.id }, { teamId: c.team.id }))
    }
    for (const n of [5, 10, 15, 20, 25, 30]) {
      const p = 0.5 + (pHomeReg - 0.5) * (0.6 + 0.4 * Math.min(1, n / 30))
      out.push(twoTeam(ctx, `race|${n}`, `Race To ${n}`, { tabs: [TAB.SGP, TAB.SCORING], group: 'specials', sort: 108 + n / 100, category: 'Scoring', fdType: `RACE_TO_${n}` }, p, 0.058, { kind: 'race_to', line: n }))
    }
    const lamH = gm.expHome / 7.3 / 2
    const lamA = gm.expAway / 7.3 / 2
    const p1 = Math.pow(1 - Math.exp(-lamH), 2) * Math.pow(1 - Math.exp(-lamA), 2)
    const p2 = Math.pow(1 - Math.exp(-lamH) * (1 + lamH), 2) * Math.pow(1 - Math.exp(-lamA) * (1 + lamA), 2)
    out.push(yesNo(ctx, 'td_each_half|1', 'Both Teams to Score 1+ TD in Each Half', p1, 0.06, { tabs: [TAB.SGP, TAB.SCORING], group: 'specials', sort: 110, category: 'Scoring', fdType: 'BOTH_TEAMS_TO_SCORE_1+_TD_IN_EACH_HALF' }, { kind: 'td_each_half', count: 1 }))
    out.push(yesNo(ctx, 'td_each_half|2', 'Both Teams to Score 2+ TD in Each Half', p2, 0.05, { tabs: [TAB.SGP, TAB.SCORING], group: 'specials', sort: 111, category: 'Scoring', fdType: 'BOTH_TEAMS_TO_SCORE_2+_TD_IN_EACH_HALF' }, { kind: 'td_each_half', count: 2 }))
    for (const n of [10, 15, 20, 25]) {
      const p = (1 - normCdf((n - 0.5 - gm.expHome) / sigmaTeam)) * (1 - normCdf((n - 0.5 - gm.expAway) / sigmaTeam))
      out.push(yesNo(ctx, `both_score|${n}`, `Both Teams to Score ${n}+ Points`, p, 0.05, { tabs: [TAB.SGP, TAB.SCORING], group: 'specials', sort: 112 + n / 100, category: 'Scoring', fdType: `BOTH_TEAMS_TO_SCORE_${n}_POINTS` }, { kind: 'both_score_n', line: n }))
    }
  }
  // winning margin (all leagues)
  const wm = (id: string, name: string, bands: [number, number][], fd: string, sortN: number, includeOther = false) => {
    const m = mkm(ctx, id, name, { tabs: [TAB.SGP, TAB.SCORING], group: 'specials', kind: 'winning_margin', layout: 'grid', sort: sortN, category: 'Scoring', fdType: fd })
    for (const c of [away, home]) {
      const exp = c.homeAway === 'home' ? -S : S
      for (const [lo, hi] of bands) {
        const pr = normCdf((Math.min(hi, 80) + 0.5 - exp) / sigmaMargin) - normCdf((lo - 0.5 - exp) / sigmaMargin)
        add(m, `${c.team.id}|${lo}`, `${c.team.displayName} by ${hi >= 80 ? `${lo}+` : `${lo}-${hi}`}`, priceFromProb(Math.max(0.004, pr), 0.12), { kind: 'winning_margin', teamId: c.team.id, rangeLow: lo, rangeHigh: hi }, { teamId: c.team.id })
      }
    }
    if (includeOther) add(m, 'tie', 'Tie', priceFromProb(0.004, 0.12), { kind: 'winning_margin', rangeLow: 0, rangeHigh: 0 })
    out.push(m)
  }
  wm('margin', 'Winning Margin', [[1, 6], [7, 12], [13, 18], [19, 24], [25, 30], [31, 36], [37, 80]], 'WINNING_MARGIN', 115, true)
  if (isNFL) {
    wm('margin4', 'Winning Margin (4-Way)', [[1, 7], [8, 80]], 'WINNING_MARGIN_(4-WAY)', 116)
    wm('margin5', 'Winning Margin (5-Point Bands)', [[1, 5], [6, 10], [11, 15], [16, 20], [21, 25], [26, 30], [31, 80]], 'WINNING_MARGIN_(5-POINT_BANDS)', 117)
    wm('margin10', 'Winning Margin (10-Point Bands)', [[1, 10], [11, 20], [21, 30], [31, 80]], 'WINNING_MARGIN_(10-POINT_BANDS)', 118)
    out.push(yesNo(ctx, 'ot', 'Will There Be Overtime?', 0.06, 0.05, { tabs: [TAB.SGP, TAB.POPULAR], group: 'specials', sort: 119, category: 'Game Specials', fdType: 'WILL_THERE_BE_OVERTIME' }, { kind: 'overtime' }))
    // drive results (Quick Bets)
    for (const c of [home, away]) {
      const exp = c.homeAway === 'home' ? gm.expHome : gm.expAway
      const pTD = Math.min(0.6, Math.max(0.12, 0.28 + 0.018 * (exp - 24.5)))
      const pPunt = Math.min(0.6, Math.max(0.15, 0.36 - 0.01 * (exp - 24.5)))
      const pFG = 0.185
      const pOther = Math.max(0.05, 1 - pTD - pPunt - pFG)
      const m = mkm(ctx, `drive1|${c.team.id}`, `${teamShort(c)} Drive 1 - Result`, { tabs: [TAB.SGP, TAB.QUICK], group: 'specials', kind: 'scorer', layout: 'grid', sort: 120, category: 'Quick Bets', fdType: `${c.homeAway === 'home' ? 'HOME' : 'AWAY'}_TEAM_X_DRIVE_-_RESULT` })
      add(m, 'TD', 'Offensive Touchdown', priceFromProb(pTD, 0.1), { kind: 'drive_result', teamId: c.team.id, count: 1, label: 'TD' }, { teamId: c.team.id })
      add(m, 'FGA', 'Field Goal Attempt', priceFromProb(pFG, 0.1), { kind: 'drive_result', teamId: c.team.id, count: 1, label: 'FGA' }, { teamId: c.team.id })
      add(m, 'PUNT', 'Punt', priceFromProb(pPunt, 0.1), { kind: 'drive_result', teamId: c.team.id, count: 1, label: 'PUNT' }, { teamId: c.team.id })
      add(m, 'OTHER', 'Any Other', priceFromProb(pOther, 0.1), { kind: 'drive_result', teamId: c.team.id, count: 1, label: 'OTHER' }, { teamId: c.team.id })
      out.push(m)
    }
  } else {
    // NCAAF team yards
    for (const c of [home, away]) {
      const exp = c.homeAway === 'home' ? gm.expHome : gm.expAway
      const yds = toHalfLine(exp * 13.5)
      const rush = toHalfLine(exp * 5.6)
      out.push(overUnderJuice(ctx, `ty|${c.team.id}`, `${c.team.displayName} - Total Yards`, yds, [-114, -114], { tabs: [TAB.SGP, TAB.TEAM_YARDS], group: 'team', sort: 130, category: 'Team Yards', fdType: `${c.homeAway === 'home' ? 'HOME' : 'AWAY'}_TOTAL_YARDS_-_O/U_CFB` }, { kind: 'team_stat', teamId: c.team.id, statKey: 'totalYards' }, { teamId: c.team.id }))
      out.push(overUnderJuice(ctx, `try|${c.team.id}`, `${c.team.displayName} - Total Rushing Yards`, rush, [-114, -114], { tabs: [TAB.SGP, TAB.TEAM_YARDS, TAB.RUSHING], group: 'team', sort: 131, category: 'Team Yards', fdType: `${c.homeAway === 'home' ? 'HOME' : 'AWAY'}_TOTAL_RUSHING_YARDS_-_O/U_CFB` }, { kind: 'team_stat', teamId: c.team.id, statKey: 'rushingYards' }, { teamId: c.team.id }))
      const l1 = ladder(ctx, `alt_ty|${c.team.id}`, `${c.team.displayName} - Alt Total Yards`, { tabs: [TAB.SGP, TAB.TEAM_YARDS], group: 'alt', sort: 132, category: 'Team Yards', fdType: `${c.homeAway === 'home' ? 'HOME' : 'AWAY'}_ALT_TOTAL_YARDS_CFB` }, { stat: 'TEAM_YARDS', statKey: 'totalYards', mainLine: yds, thresholds: [200, 225, 250, 275, 300, 325, 350, 375, 400, 425, 450, 475, 500, 550, 600], unit: (t) => `${t}+ Yards`, sigma: 75, prefix: c.team.displayName, teamId: c.team.id })
      if (l1) out.push({ ...l1, selections: l1.selections.map((s) => ({ ...s, grading: { ...s.grading, kind: 'team_stat', teamId: c.team.id } })) })
      const l2 = ladder(ctx, `alt_try|${c.team.id}`, `${c.team.displayName} - Alt Total Rushing Yards`, { tabs: [TAB.SGP, TAB.TEAM_YARDS, TAB.RUSHING], group: 'alt', sort: 133, category: 'Team Yards', fdType: `${c.homeAway === 'home' ? 'HOME' : 'AWAY'}_ALT_TOTAL_RUSHING_YARDS_CFB` }, { stat: 'TEAM_RUSH_YARDS', statKey: 'rushingYards', mainLine: rush, thresholds: [50, 60, 70, 80, 90, 100, 125, 150, 175, 200, 225, 250, 275, 300], unit: (t) => `${t}+ Yards`, sigma: 45, prefix: c.team.displayName, teamId: c.team.id })
      if (l2) out.push({ ...l2, selections: l2.selections.map((s) => ({ ...s, grading: { ...s.grading, kind: 'team_stat', teamId: c.team.id } })) })
    }
    for (const c of [home, away]) {
      const exp = c.homeAway === 'home' ? gm.expHome : gm.expAway
      const p = 1 - normCdf((49.5 - exp) / sigmaTeam)
      if (p > 0.03) out.push(yesNo(ctx, `score50|${c.team.id}`, 'Team to Score 50+ Points', p, 0.08, { tabs: [TAB.SCORING], group: 'specials', sort: 134, category: 'Scoring', fdType: 'TEAM_TO_SCORE_50+_POINTS' }, { kind: 'both_score_n', line: 50, teamId: c.team.id }, [c.team.displayName, `${c.team.displayName} - No`]))
    }
  }

  /* ---------- parlays tab (pre-built doubles) ---------- */
  if (lines.homeML !== undefined && lines.awayML !== undefined) {
    const mt = mkm(ctx, 'dbl|ml_total', 'Moneyline / Total Points Parlay', { tabs: [TAB.PARLAYS], group: 'specials', kind: 'scorer', layout: 'grid', sort: 140, category: 'Parlays', sgp: false, fdType: 'MATCH_/_TOTAL_POINTS_DOUBLE.' })
    for (const c of [away, home]) {
      const pw = c.homeAway === 'home' ? gm.pHome : gm.pAway
      for (const side of ['over', 'under'] as const) {
        const corr = (c.homeAway === 'home') === gm.homeFav ? (side === 'over' ? 1.06 : 0.94) : side === 'over' ? 0.98 : 1.02
        add(mt, `${c.team.id}|${side}`, `${c.team.displayName} to win & ${side === 'over' ? 'Over' : 'Under'} (${fmtLine(T)}) points`, priceFromProb(pw * 0.5 * corr, 0.08), { kind: 'combo', combo: [c.homeAway, side, String(T)] }, { teamId: c.team.id })
      }
    }
    out.push(mt)
    const lt = mkm(ctx, 'dbl|spread_total', 'Spread / Total Points Parlay', { tabs: [TAB.PARLAYS], group: 'specials', kind: 'scorer', layout: 'grid', sort: 141, category: 'Parlays', sgp: false, fdType: 'LINE_/_TOTAL_POINTS_DOUBLE' })
    for (const c of [away, home]) {
      const sp = c.homeAway === 'home' ? S : -S
      for (const side of ['over', 'under'] as const) {
        const corr = (c.homeAway === 'home') === gm.homeFav ? (side === 'over' ? 1.06 : 0.94) : side === 'over' ? 0.98 : 1.02
        add(lt, `${c.team.id}|${side}`, `${c.team.displayName} (${signed(sp)}) & ${side === 'over' ? 'Over' : 'Under'} (${fmtLine(T)}) points`, priceFromProb(0.5 * 0.5 * corr, 0.08), { kind: 'combo', combo: [`${c.homeAway}:${sp}`, side, String(T)] }, { teamId: c.team.id, line: sp })
      }
    }
    out.push(lt)
  }

  return out
}

export function footballTabs(leagueId: string): string[] {
  return leagueId === 'nfl' ? NFL_TABS : NCAAF_TABS
}

