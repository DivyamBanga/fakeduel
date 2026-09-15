/** FanDuel NBA / WNBA / NCAAB event catalog. */
import { normCdf, priceFromProb, toHalfLine } from '../odds'
import { marginSigmaCal, pMax, twoWay } from '../pricing'
import type { Grading, Market } from '../types'
import { TAB, add, altSpread, altTotal, espnLines, fmtLine, gameModel, intLine, leaderLines, list, mkm, overUnder, pOverInt, signed, teamShort, threeWay, twoTeam, yesNo, type Ctx, type PlayerLine } from './common'

export const NBA_TABS = [TAB.SGP, TAB.POPULAR, TAB.QUICK, TAB.PTS, TAB.THREES, TAB.REB, TAB.AST, TAB.COMBOS, TAB.HALF, TAB.Q1, TAB.Q2, TAB.Q3, TAB.Q4, TAB.MARGIN, TAB.TOTAL_PARLAYS]

interface Hooper extends PlayerLine {
  pts: number
  reb: number
  ast: number
  threes: number
  stl?: number
  blk?: number
}

const sdPts = (l: number) => Math.max(4, 0.32 * l)
const sdReb = (l: number) => Math.max(2.2, 0.4 * l)
const sdAst = (l: number) => Math.max(1.8, 0.42 * l)
const sd3 = (l: number) => Math.max(1.1, 0.5 * l)

function nPlus(ctx: Ctx, id: string, name: string, tabs: string[], sort: number, rows: { p: Hooper; mean: number; sd: number }[], n: number, statKey: string, fd: string): Market | null {
  return list(ctx, id, name, { tabs, sort, category: name, fdType: fd }, rows.map(({ p, mean, sd }) => ({ key: p.id, label: p.name, p: 1 - normCdf((n - 0.5 - mean) / sd), grading: { kind: 'player_ladder', playerId: p.id, statKey, line: n, teamId: p.teamId } as Grading, extra: { playerId: p.id, teamId: p.teamId, line: n } })), 0.08, 0.02)
}

export function buildBasketball(ctx: Ctx): Market[] {
  const { ev, league, lines } = ctx
  const gm = gameModel(ctx)
  const out: Market[] = []
  const S = gm.spread
  const T = gm.total
  const isW = league.id === 'wnba'
  const isCollege = league.id === 'ncaab' || league.id === 'ncaaw'
  const sigma = marginSigmaCal(ctx.cal, isW ? 11.5 : isCollege ? 11 : 12.5)
  const sigmaMargin = isW ? 12 : isCollege ? 11.5 : 13
  const sigmaTotal = isW ? 14 : isCollege ? 15 : 18
  const sigmaTeam = isW ? 10 : isCollege ? 10.5 : 12.5
  const home = ev.home
  const away = ev.away
  const pHomeReg = normCdf(-S / sigma)
  let sort = 1
  const halves = isCollege

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

  /* ---------- players ---------- */
  const pool = new Map<string, Hooper>()
  const put = (p: PlayerLine, k: keyof Hooper) => {
    const h = pool.get(p.id) ?? { ...p, pts: 0, reb: 0, ast: 0, threes: 0 }
    ;(h as unknown as Record<string, number>)[k] = p.line
    pool.set(p.id, h)
  }
  espnLines(ctx, /^Total Points/i).forEach((p) => put(p, 'pts'))
  espnLines(ctx, /^Total Rebounds/i).forEach((p) => put(p, 'reb'))
  espnLines(ctx, /^Total Assists/i).forEach((p) => put(p, 'ast'))
  espnLines(ctx, /Three|3-Point/i).forEach((p) => put(p, 'threes'))
  const fill = (p: PlayerLine, k: keyof Hooper) => {
    const h = pool.get(p.id)
    if (h && (h as unknown as Record<string, number>)[k]) return
    put(p, k)
  }
  leaderLines(ctx, 'pointsPerGame', 9, (pg) => toHalfLine(pg), true).forEach((p) => fill(p, 'pts'))
  leaderLines(ctx, 'reboundsPerGame', 9, (pg) => toHalfLine(pg), true).forEach((p) => fill(p, 'reb'))
  leaderLines(ctx, 'assistsPerGame', 9, (pg) => toHalfLine(pg), true).forEach((p) => fill(p, 'ast'))
  leaderLines(ctx, '3PointMadePerGame', 9, (pg) => toHalfLine(pg), true).forEach((p) => fill(p, 'threes'))
  leaderLines(ctx, 'stealsPerGame', 3, (pg) => pg, true).forEach((p) => fill(p, 'stl'))
  leaderLines(ctx, 'blocksPerGame', 3, (pg) => pg, true).forEach((p) => fill(p, 'blk'))
  const players = [...pool.values()].filter((p) => p.pts > 0 || p.reb > 0 || p.ast > 0)
  for (const p of players) {
    if (!p.pts) p.pts = toHalfLine(Math.max(4.5, (p.reb + p.ast) * 1.4))
    if (!p.reb) p.reb = toHalfLine(Math.max(1.5, p.pts * 0.25))
    if (!p.ast) p.ast = toHalfLine(Math.max(0.5, p.pts * 0.16))
    if (!p.threes) p.threes = toHalfLine(Math.max(0.5, p.pts * 0.07))
  }
  players.sort((a, b) => b.pts - a.pts)
  const meta = (p: Hooper) => ({ id: p.id, name: p.name, teamId: p.teamId, position: p.position, headshot: p.headshot })
  const ptsRows = players.map((p) => ({ p, mean: p.pts + 0.25, sd: sdPts(p.pts) }))
  const rebRows = players.map((p) => ({ p, mean: p.reb + 0.15, sd: sdReb(p.reb) }))
  const astRows = players.map((p) => ({ p, mean: p.ast + 0.15, sd: sdAst(p.ast) }))
  const thrRows = players.map((p) => ({ p, mean: p.threes + 0.1, sd: sd3(p.threes) }))
  const praRows = players.map((p) => ({ p, mean: p.pts + p.reb + p.ast + 0.5, sd: Math.sqrt(sdPts(p.pts) ** 2 + sdReb(p.reb) ** 2 + sdAst(p.ast) ** 2) * 0.85 }))
  const prRows = players.map((p) => ({ p, mean: p.pts + p.reb + 0.4, sd: Math.sqrt(sdPts(p.pts) ** 2 + sdReb(p.reb) ** 2) * 0.9 }))
  const paRows = players.map((p) => ({ p, mean: p.pts + p.ast + 0.4, sd: Math.sqrt(sdPts(p.pts) ** 2 + sdAst(p.ast) ** 2) * 0.9 }))
  const raRows = players.map((p) => ({ p, mean: p.reb + p.ast + 0.3, sd: Math.sqrt(sdReb(p.reb) ** 2 + sdAst(p.ast) ** 2) * 0.9 }))

  const ptsTabs = [TAB.SGP, TAB.POPULAR, TAB.PTS]
  for (const n of isW ? [5, 10, 15, 20, 25, 30] : [10, 15, 20, 25, 30, 35, 40, 45, 50]) {
    const m = nPlus(ctx, `pts${n}`, `To Score ${n}+ Points`, ptsTabs, 20 + n / 100, ptsRows, n, '*.points', `TO_SCORE_${n}+_POINTS`)
    if (m) out.push(m)
  }
  for (const n of isW ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6, 7]) {
    const m = nPlus(ctx, `threes${n}`, `${n}+ Made Threes`, [TAB.SGP, TAB.POPULAR, TAB.THREES], 30 + n / 100, thrRows, n, '*.threePointFieldGoalsMade-threePointFieldGoalsAttempted#0', `${n}+_MADE_THREES`)
    if (m) out.push(m)
  }
  for (const n of [4, 6, 8, 10, 12, 14, 16]) {
    const m = nPlus(ctx, `reb${n}`, `To Record ${n}+ Rebounds`, [TAB.SGP, TAB.POPULAR, TAB.REB], 40 + n / 100, rebRows, n, '*.rebounds', `TO_RECORD_${n}+_REBOUNDS`)
    if (m) out.push(m)
  }
  for (const n of isW ? [2, 4, 6, 8, 10, 12] : [4, 6, 8, 10, 12, 14]) {
    const m = nPlus(ctx, `ast${n}`, `To Record ${n}+ Assists`, [TAB.SGP, TAB.POPULAR, TAB.AST], 50 + n / 100, astRows, n, '*.assists', `TO_RECORD_${n}+_ASSISTS`)
    if (m) out.push(m)
  }
  for (const n of [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70]) {
    const m = nPlus(ctx, `pra${n}`, `To Record ${n}+ Pts + Reb + Ast`, [TAB.SGP, TAB.POPULAR, TAB.COMBOS], 60 + n / 100, praRows, n, '*.points+*.rebounds+*.assists', `TO_RECORD_${n}+_PTS_+_REB_+_AST`)
    if (m) out.push(m)
  }
  for (const n of [15, 20, 25, 30, 35, 40, 45, 50]) {
    const m = nPlus(ctx, `pr${n}`, `To Record ${n}+ Pts + Reb`, [TAB.SGP, TAB.COMBOS], 61 + n / 100, prRows, n, '*.points+*.rebounds', `TO_RECORD_${n}+_PTS_+_REB`)
    if (m) out.push(m)
  }
  for (const n of [15, 20, 25, 30, 35, 40, 45]) {
    const m = nPlus(ctx, `pa${n}`, `To Record ${n}+ Pts + Ast`, [TAB.SGP, TAB.COMBOS], 62 + n / 100, paRows, n, '*.points+*.assists', `TO_RECORD_${n}+_PTS_+_AST`)
    if (m) out.push(m)
  }
  for (const n of [10, 15, 20, 25]) {
    const m = nPlus(ctx, `ra${n}`, `To Record ${n}+ Reb + Ast`, [TAB.SGP, TAB.COMBOS], 63 + n / 100, raRows, n, '*.rebounds+*.assists', `TO_RECORD_${n}+_REB_+_AST`)
    if (m) out.push(m)
  }
  // double / triple double
  const dd = list(ctx, 'scorer|player_double_double', 'To Record A Double Double', { tabs: [TAB.SGP, TAB.POPULAR, TAB.COMBOS], sort: 64, category: 'Player Combos', fdType: 'TO_RECORD_A_DOUBLE_DOUBLE' }, players.map((p) => { const cats = [[p.pts, sdPts(p.pts)], [p.reb, sdReb(p.reb)], [p.ast, sdAst(p.ast)]].map(([m, s]) => 1 - normCdf((9.5 - m) / s)); cats.sort((a, b) => b - a); const pr = cats[0] * cats[1] * 1.15 + cats[0] * cats[2] * 0.3 * (1 - cats[1]); return { key: p.id, label: p.name, p: Math.min(0.92, pr), grading: { kind: 'double_double', playerId: p.id, count: 2, teamId: p.teamId } as Grading, extra: { playerId: p.id, teamId: p.teamId } } }), 0.08, 0.02)
  if (dd) out.push(dd)
  const td = list(ctx, 'scorer|player_triple_double', 'To Record A Triple Double', { tabs: [TAB.SGP, TAB.COMBOS], sort: 65, category: 'Player Combos', fdType: 'TO_RECORD_A_TRIPLE_DOUBLE' }, players.map((p) => { const cats = [[p.pts, sdPts(p.pts)], [p.reb, sdReb(p.reb)], [p.ast, sdAst(p.ast)]].map(([m, s]) => 1 - normCdf((9.5 - m) / s)); return { key: p.id, label: p.name, p: cats[0] * cats[1] * cats[2] * 1.3, grading: { kind: 'double_double', playerId: p.id, count: 3, teamId: p.teamId } as Grading, extra: { playerId: p.id, teamId: p.teamId } } }), 0.1, 0.004)
  if (td) out.push(td)
  // per-player O/U
  const ouJ = 0.065
  players.forEach((p, i) => {
    const pm = meta(p)
    out.push(overUnder(ctx, `prop|points|${p.id}`, `${p.name} - Points`, p.pts, pOverInt(p.pts + 0.25, sdPts(p.pts), p.pts), ouJ, { tabs: [TAB.SGP, TAB.POPULAR, TAB.PTS], sort: 21 + i / 100, category: 'Player Points', player: pm, fdType: 'PLAYER_A_TOTAL_POINTS' }, { kind: 'player_stat', statKey: '*.points', playerId: p.id }, { playerId: p.id, teamId: p.teamId }))
    out.push(overUnder(ctx, `prop|rebounds|${p.id}`, `${p.name} - Rebounds`, p.reb, pOverInt(p.reb + 0.15, sdReb(p.reb), p.reb), ouJ, { tabs: [TAB.SGP, TAB.REB], sort: 41 + i / 100, category: 'Player Rebounds', player: pm, fdType: 'PLAYER_A_TOTAL_REBOUNDS' }, { kind: 'player_stat', statKey: '*.rebounds', playerId: p.id }, { playerId: p.id, teamId: p.teamId }))
    out.push(overUnder(ctx, `prop|assists|${p.id}`, `${p.name} - Assists`, p.ast, pOverInt(p.ast + 0.15, sdAst(p.ast), p.ast), ouJ, { tabs: [TAB.SGP, TAB.AST], sort: 51 + i / 100, category: 'Player Assists', player: pm, fdType: 'PLAYER_A_TOTAL_ASSISTS' }, { kind: 'player_stat', statKey: '*.assists', playerId: p.id }, { playerId: p.id, teamId: p.teamId }))
    if (p.threes >= 0.5) out.push(overUnder(ctx, `prop|threes|${p.id}`, `${p.name} - Made Threes`, p.threes, pOverInt(p.threes + 0.1, sd3(p.threes), p.threes), 0.07, { tabs: [TAB.SGP, TAB.THREES], sort: 31 + i / 100, category: 'Player Threes', player: pm, fdType: 'PLAYER_A_TOTAL_MADE_3_POINT_FIELD_GOALS' }, { kind: 'player_stat', statKey: '*.threePointFieldGoalsMade-threePointFieldGoalsAttempted#0', playerId: p.id }, { playerId: p.id, teamId: p.teamId }))
    const pra = toHalfLine(p.pts + p.reb + p.ast)
    out.push(overUnder(ctx, `prop|pra|${p.id}`, `${p.name} - Pts + Reb + Ast`, pra, pOverInt(p.pts + p.reb + p.ast + 0.5, praRows[i].sd, pra), ouJ, { tabs: [TAB.SGP, TAB.COMBOS], sort: 66 + i / 100, category: 'Player Combos', player: pm, fdType: 'PLAYER_A_TOTAL_POINTS_+_REB_+_AST' }, { kind: 'player_stat', statKey: '*.points+*.rebounds+*.assists', playerId: p.id }, { playerId: p.id, teamId: p.teamId }))
    const pr = toHalfLine(p.pts + p.reb)
    out.push(overUnder(ctx, `prop|pr|${p.id}`, `${p.name} - Pts + Reb`, pr, pOverInt(p.pts + p.reb + 0.4, prRows[i].sd, pr), ouJ, { tabs: [TAB.SGP, TAB.COMBOS], sort: 67 + i / 100, category: 'Player Combos', player: pm, fdType: 'PLAYER_A_TOTAL_POINTS_+_REBOUNDS' }, { kind: 'player_stat', statKey: '*.points+*.rebounds', playerId: p.id }, { playerId: p.id, teamId: p.teamId }))
    const pa = toHalfLine(p.pts + p.ast)
    out.push(overUnder(ctx, `prop|pa|${p.id}`, `${p.name} - Pts + Ast`, pa, pOverInt(p.pts + p.ast + 0.4, paRows[i].sd, pa), ouJ, { tabs: [TAB.SGP, TAB.COMBOS], sort: 68 + i / 100, category: 'Player Combos', player: pm, fdType: 'PLAYER_A_TOTAL_POINTS_+_ASSISTS' }, { kind: 'player_stat', statKey: '*.points+*.assists', playerId: p.id }, { playerId: p.id, teamId: p.teamId }))
    const ra = toHalfLine(p.reb + p.ast)
    out.push(overUnder(ctx, `prop|ra|${p.id}`, `${p.name} - Reb + Ast`, ra, pOverInt(p.reb + p.ast + 0.3, raRows[i].sd, ra), ouJ, { tabs: [TAB.SGP, TAB.COMBOS], sort: 69 + i / 100, category: 'Player Combos', player: pm, fdType: 'PLAYER_A_TOTAL_REBOUNDS_+_ASSISTS' }, { kind: 'player_stat', statKey: '*.rebounds+*.assists', playerId: p.id }, { playerId: p.id, teamId: p.teamId }))
    if (!halves) {
      const q1 = toHalfLine(p.pts * 0.27)
      out.push(overUnder(ctx, `prop|q1pts|${p.id}`, `${p.name} - 1st Quarter Points`, q1, pOverInt(p.pts * 0.27 + 0.2, sdPts(p.pts) * 0.5, q1), 0.075, { tabs: [TAB.QUICK, TAB.Q1, TAB.PTS], sort: 25 + i / 100, category: 'Player Points', player: pm, fdType: 'PLAYER_A_1ST_QUARTER_POINTS' }, { kind: 'manual', playerId: p.id }, { playerId: p.id, teamId: p.teamId }))
    }
    if (p.stl) out.push(overUnder(ctx, `prop|steals|${p.id}`, `${p.name} - Steals`, intLine(p.stl), pOverInt(p.stl, 0.95, intLine(p.stl)), 0.08, { tabs: [TAB.SGP, TAB.COMBOS], sort: 70 + i / 100, category: 'Player Combos', player: pm }, { kind: 'player_stat', statKey: '*.steals', playerId: p.id }, { playerId: p.id, teamId: p.teamId }))
    if (p.blk) out.push(overUnder(ctx, `prop|blocks|${p.id}`, `${p.name} - Blocks`, intLine(p.blk), pOverInt(p.blk, 0.95, intLine(p.blk)), 0.08, { tabs: [TAB.SGP, TAB.COMBOS], sort: 71 + i / 100, category: 'Player Combos', player: pm }, { kind: 'player_stat', statKey: '*.blocks', playerId: p.id }, { playerId: p.id, teamId: p.teamId }))
  })
  // first basket
  if (players.length >= 4) {
    const sumPts = players.reduce((a, p) => a + p.pts, 0)
    const fb = list(ctx, 'first_basket', 'First Basket', { tabs: [TAB.SGP, TAB.QUICK], sort: 15, category: 'Quick Bets', fdType: 'FIRST_BASKET_(SAME_GAME_MULTIS)' }, players.map((p) => ({ key: p.id, label: p.name, p: (p.pts / sumPts) * 0.95, grading: { kind: 'manual', playerId: p.id, teamId: p.teamId } as Grading, extra: { playerId: p.id, teamId: p.teamId } })), 0.2, 0.01)
    if (fb) out.push(fb)
    for (const c of [away, home]) {
      const team = players.filter((p) => p.teamId === c.team.id)
      const sum = team.reduce((a, p) => a + p.pts, 0)
      const m = list(ctx, `first_team_basket|${c.team.id}`, `First Team Basket Scorer`, { tabs: [TAB.SGP, TAB.QUICK], sort: 16, category: `${c.team.abbreviation} ${c.team.name}`, fdType: 'FIRST_TEAM_BASKET_SCORER' }, team.map((p) => ({ key: p.id, label: p.name, p: (p.pts / sum) * 0.95, grading: { kind: 'manual', playerId: p.id, teamId: c.team.id } as Grading, extra: { playerId: p.id, teamId: c.team.id } })), 0.15, 0.01)
      if (m) out.push(m)
    }
  }

  /* ---------- team & alternates ---------- */
  out.push(altSpread(ctx, 'altspread', 'Alternate Spread', { tabs: [TAB.SGP, TAB.POPULAR], group: 'alt', sort: 80, fdType: 'ALTERNATE_HANDICAP' }, S, sigmaMargin, -15, 15, 1))
  out.push(altTotal(ctx, 'alttotal', 'Alternate Total Points', { tabs: [TAB.SGP, TAB.POPULAR], group: 'alt', sort: 81, fdType: 'ALTERNATE_TOTAL' }, T, sigmaTotal, -20, 20, 1, { kind: 'total' }))
  for (const c of [home, away]) {
    const exp = c.homeAway === 'home' ? gm.expHome : gm.expAway
    const line = toHalfLine(exp)
    out.push(overUnder(ctx, `tt|${c.team.id}`, `${teamShort(c)} Total Points`, line, 1 - normCdf((line - exp) / sigmaTeam), 0.06, { tabs: [TAB.SGP, TAB.POPULAR], group: 'team', kind: 'team_total', sort: 82, category: 'Team Totals', fdType: `${c.homeAway === 'home' ? 'HOME' : 'AWAY'}_TEAM_TOTAL_POINTS_(INCL_OVERTIME)` }, { kind: 'team_total', teamId: c.team.id }, { teamId: c.team.id }))
  }
  // periods
  const periods = halves
    ? [{ key: 'h1', name: '1st Half', tab: TAB.HALF, sr: 0.6, tr: 0.49 }, { key: 'h2', name: '2nd Half', tab: TAB.HALF, sr: 0.52, tr: 0.51 }]
    : [
        { key: 'h1', name: '1st Half', tab: TAB.HALF, sr: 0.6, tr: 0.495 },
        { key: 'h2', name: '2nd Half', tab: TAB.HALF, sr: 0.5, tr: 0.5 },
        { key: 'q1', name: '1st Quarter', tab: TAB.Q1, sr: 0.32, tr: 0.25 },
        { key: 'q2', name: '2nd Quarter', tab: TAB.Q2, sr: 0.3, tr: 0.245 },
        { key: 'q3', name: '3rd Quarter', tab: TAB.Q3, sr: 0.28, tr: 0.25 },
        { key: 'q4', name: '4th Quarter', tab: TAB.Q4, sr: 0.27, tr: 0.26 },
      ]
  for (const p of periods) {
    const expM = -S * p.sr
    const frac = p.key.startsWith('h') ? 0.5 : 0.25
    const psig = sigmaMargin * Math.sqrt(frac)
    const tsig = sigmaTotal * Math.sqrt(frac)
    const pSpread = toHalfLine(-expM) || (expM > 0 ? -0.5 : 0.5)
    const pTotal = toHalfLine(T * p.tr)
    const pHomeP = normCdf(expM / psig)
    const pCover = 1 - normCdf((-pSpread - expM) / psig)
    const tabs = [TAB.SGP, p.tab]
    const sp = mkm(ctx, `ps|${p.key}`, `${p.name} Spread`, { tabs, group: 'periods', kind: 'period_spread', sort: 90, line: pSpread, category: p.name })
    const [hj, aj] = twoWay(pCover, 0.05)
    add(sp, 'away', `${away.team.displayName} (${signed(-pSpread)})`, aj, { kind: 'period_spread', side: 'away', teamId: away.team.id, line: -pSpread, period: p.key }, { line: -pSpread, teamId: away.team.id })
    add(sp, 'home', `${home.team.displayName} (${signed(pSpread)})`, hj, { kind: 'period_spread', side: 'home', teamId: home.team.id, line: pSpread, period: p.key }, { line: pSpread, teamId: home.team.id })
    out.push(sp)
    out.push(overUnder(ctx, `pt|${p.key}`, `${p.name} Total Points`, pTotal, 1 - normCdf((pTotal - T * p.tr) / tsig), 0.05, { tabs, group: 'periods', kind: 'period_total', sort: 91, category: p.name }, { kind: 'period_total', period: p.key }))
    out.push(twoTeam(ctx, `pw|${p.key}`, `${p.name} Moneyline`, { tabs, group: 'periods', kind: 'period_ml', sort: 92, category: p.name }, pHomeP, 0.05, { kind: 'period_ml', period: p.key, label: '2way' }))
    if (p.key.startsWith('q') || p.key === 'h1') out.push(threeWay(ctx, `pw3|${p.key}`, `${p.name} Winner (3-Way)`, { tabs: [TAB.SGP, p.tab], group: 'periods', sort: 93, category: p.name }, pHomeP * 0.93, 0.07, 0.09, { kind: 'period_ml', period: p.key }))
    if (p.key.startsWith('q')) out.push(yesNo(ctx, `oe|${p.key}`, `${p.name} Total Points Odd / Even`, 0.5, 0.048, { tabs: [p.tab], group: 'specials', sort: 94, category: p.name }, { kind: 'odd_even', period: p.key }, ['Odd', 'Even']))
  }
  // double result / quarter+game combos
  const cond = (pWin: number) => pWin + 0.5 * (1 - pWin)
  const ph1 = normCdf((-S * 0.6) / (sigmaMargin * Math.sqrt(0.5)))
  const dr = mkm(ctx, 'double_result', 'First Half Winner / Game Winner', { tabs: [TAB.SGP, TAB.POPULAR, TAB.HALF], group: 'specials', kind: 'period_ml', layout: 'list', sort: 95, category: 'Half', fdType: 'DOUBLE_RESULT' })
  for (const [a, b, pr, label] of [
    ['home', 'home', ph1 * 0.96 * cond(gm.pHome), `${home.team.displayName} / ${home.team.displayName}`],
    ['home', 'away', ph1 * 0.96 * (1 - cond(gm.pHome)), `${home.team.displayName} / ${away.team.displayName}`],
    ['away', 'away', (1 - ph1) * 0.96 * cond(gm.pAway), `${away.team.displayName} / ${away.team.displayName}`],
    ['away', 'home', (1 - ph1) * 0.96 * (1 - cond(gm.pAway)), `${away.team.displayName} / ${home.team.displayName}`],
    ['draw', 'home', 0.04 * gm.pHome, `Tie / ${home.team.displayName}`],
    ['draw', 'away', 0.04 * gm.pAway, `Tie / ${away.team.displayName}`],
  ] as const) add(dr, `${a}-${b}`, label, priceFromProb(pr, 0.1), { kind: 'double_result', combo: [a, b] })
  dr.selections.sort((x, y) => x.odds - y.odds)
  out.push(dr)
  if (!halves) {
    const eq = mkm(ctx, 'every_quarter_lead', 'Winning At End Of Every Quarter', { tabs: [TAB.SGP, TAB.POPULAR], group: 'specials', kind: 'prop_yesno', layout: 'grid', sort: 96, category: 'Popular', fdType: 'WINNING_AT_END_OF_EVERY_QUARTER' })
    for (const c of [away, home]) {
      const pw = c.homeAway === 'home' ? gm.pHome : gm.pAway
      const p = Math.pow(pw, 1.4) * 0.55
      add(eq, `${c.team.id}`, c.team.displayName, priceFromProb(p, 0.12), { kind: 'every_quarter', teamId: c.team.id, side: 'yes', label: 'lead' }, { teamId: c.team.id })
    }
    out.push(eq)
  }
  // margins
  const wm = (id: string, name: string, bands: [number, number][], fd: string, sortN: number) => {
    const m = mkm(ctx, id, name, { tabs: [TAB.SGP, TAB.MARGIN], group: 'specials', kind: 'winning_margin', layout: 'grid', sort: sortN, category: 'Margin', fdType: fd })
    for (const c of [away, home]) {
      const exp = c.homeAway === 'home' ? -S : S
      for (const [lo, hi] of bands) {
        const pr = normCdf((Math.min(hi, 80) + 0.5 - exp) / sigmaMargin) - normCdf((lo - 0.5 - exp) / sigmaMargin)
        add(m, `${c.team.id}|${lo}`, `${c.team.displayName} by ${hi >= 80 ? `${lo}+` : `${lo}-${hi}`}`, priceFromProb(Math.max(0.004, pr), 0.12), { kind: 'winning_margin', teamId: c.team.id, rangeLow: lo, rangeHigh: hi }, { teamId: c.team.id })
      }
    }
    out.push(m)
  }
  wm('margin', 'Winning Margin', [[1, 5], [6, 10], [11, 15], [16, 20], [21, 80]], 'WIN_MARGIN', 100)
  wm('margin4', 'Winning Margin (Four Bands)', [[1, 10], [11, 80]], 'WINNING_MARGIN_(FOUR_BANDS)', 101)
  wm('margin12', 'Margin of Victory 12', [[1, 3], [4, 6], [7, 9], [10, 12], [13, 15], [16, 80]], 'MARGIN_OF_VICTORY_12', 102)
  out.push(yesNo(ctx, 'ot', 'Will There Be Overtime?', 0.065, 0.05, { tabs: [TAB.SGP, TAB.POPULAR], group: 'specials', sort: 103, category: 'Popular' }, { kind: 'overtime' }))
  for (const n of isW ? [10, 20, 30, 40, 50] : [20, 30, 40, 50, 60]) {
    const p = 0.5 + (pHomeReg - 0.5) * (0.5 + 0.5 * Math.min(1, n / 60))
    out.push(twoTeam(ctx, `race|${n}`, `Race To ${n} Points`, { tabs: [TAB.SGP, TAB.POPULAR], group: 'specials', sort: 104 + n / 100, category: 'Popular', fdType: `RACE_TO_${n}` }, p, 0.06, { kind: 'race_to', line: n }))
  }
  // total parlays
  if (lines.homeML !== undefined) {
    const mt = mkm(ctx, 'dbl|ml_total', 'Moneyline / Total Points Parlay', { tabs: [TAB.TOTAL_PARLAYS], group: 'specials', kind: 'scorer', layout: 'grid', sort: 110, category: 'Total Parlays', sgp: false, fdType: 'MATCH_/_TOTAL_POINTS_DOUBLE' })
    const lt = mkm(ctx, 'dbl|spread_total', 'Spread / Total Points Parlay', { tabs: [TAB.TOTAL_PARLAYS], group: 'specials', kind: 'scorer', layout: 'grid', sort: 111, category: 'Total Parlays', sgp: false, fdType: 'LINE_/_TOTAL_DOUBLE' })
    for (const c of [away, home]) {
      const pw = c.homeAway === 'home' ? gm.pHome : gm.pAway
      const sp = c.homeAway === 'home' ? S : -S
      for (const side of ['over', 'under'] as const) {
        const corr = (c.homeAway === 'home') === gm.homeFav ? (side === 'over' ? 1.05 : 0.95) : side === 'over' ? 0.98 : 1.02
        add(mt, `${c.team.id}|${side}`, `${c.team.displayName} & ${side === 'over' ? 'Over' : 'Under'} ${fmtLine(T)}`, priceFromProb(pw * 0.5 * corr, 0.08), { kind: 'combo', combo: [c.homeAway, side, String(T)] }, { teamId: c.team.id })
        add(lt, `${c.team.id}|${side}`, `${c.team.displayName} ${signed(sp)} & ${side === 'over' ? 'Over' : 'Under'} ${fmtLine(T)}`, priceFromProb(0.25 * corr, 0.08), { kind: 'combo', combo: [`${c.homeAway}:${sp}`, side, String(T)] }, { teamId: c.team.id, line: sp })
      }
    }
    out.push(mt, lt)
  }
  // most points
  if (players.length >= 3) {
    const cands = players.slice(0, 8)
    const ps = pMax(cands.map((p) => p.pts), cands.map((p) => sdPts(p.pts)))
    const m = list(ctx, 'most|pts', 'Most Points', { tabs: [TAB.POPULAR, TAB.PTS], sort: 19, category: 'Player Points' }, cands.map((p, i) => ({ key: p.id, label: p.name, p: ps[i], grading: { kind: 'most_stat', playerId: p.id, playerIds: cands.map((x) => x.id), statKey: '*.points' } as Grading, extra: { playerId: p.id, teamId: p.teamId } })), 0.1, 0.005)
    if (m) out.push(m)
  }
  return out
}
