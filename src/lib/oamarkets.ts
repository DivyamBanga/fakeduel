/** Convert FanDuel markets from The Odds API into FakeDuel Market objects (same ids as the modelled ones so they replace them). */
import type { LeagueDef } from '@/data/sports'
import { mkMarket, sel, spreadLabel, totalLabel } from './markets'
import { formatLine } from './odds'
import { normName, playerLines, type OaMarket } from './oddsapi'
import { statDefsFor } from './props'
import type { AthleteInfo, GameEvent, Market, Selection } from './types'

const OA_TO_DEF: Record<string, string> = {
  player_pass_yds: 'pass_yds',
  player_pass_tds: 'pass_tds',
  player_pass_completions: 'completions',
  player_pass_attempts: 'pass_att',
  player_pass_interceptions: 'ints',
  player_pass_longest_completion: 'longest_comp',
  player_pass_rush_yds: 'pass_rush_yds',
  player_pass_rush_reception_yds: 'pass_rush_rec_yds',
  player_rush_yds: 'rush_yds',
  player_rush_attempts: 'carries',
  player_rush_longest: 'longest_rush',
  player_rush_reception_yds: 'rush_rec_yds',
  player_receptions: 'receptions',
  player_reception_yds: 'rec_yds',
  player_reception_longest: 'longest_rec',
  player_kicking_points: 'kick_pts',
  player_field_goals: 'fg_made',
  player_pats: 'xp_made',
  player_tackles_assists: 'tackles',
  player_sacks: 'sacks',
  player_points: 'points',
  player_rebounds: 'rebounds',
  player_assists: 'assists',
  player_threes: 'threes',
  player_points_rebounds_assists: 'pra',
  player_points_rebounds: 'pr',
  player_points_assists: 'pa',
  player_rebounds_assists: 'ra',
  player_blocks: 'blocks',
  player_steals: 'steals',
  player_blocks_steals: 'bs',
  player_turnovers: 'turnovers',
  player_shots_on_goal: 'shots',
  player_blocked_shots: 'blocked',
  player_total_saves: 'saves',
  player_goals: 'goals',
  player_power_play_points: 'ppp',
  batter_hits: 'hits',
  batter_rbis: 'rbis',
  batter_runs_scored: 'runs',
  batter_home_runs: 'hr',
  batter_hits_runs_rbis: 'hrr',
  batter_walks: 'walks',
  batter_strikeouts: 'bat_k',
  pitcher_strikeouts: 'p_k',
  pitcher_outs: 'p_outs',
  pitcher_earned_runs: 'p_er',
  pitcher_hits_allowed: 'p_hits',
  pitcher_walks: 'p_walks',
  player_shots_on_target: 'sot',
  player_shots: 'shots',
}

// hockey/soccer share 'player_assists' and 'player_points' keys with basketball; resolve by sport
function defKeyFor(oaKey: string, league: LeagueDef): string | undefined {
  if (league.sport === 'hockey') {
    if (oaKey === 'player_points') return 'points'
    if (oaKey === 'player_assists') return 'assists'
    if (oaKey === 'player_shots') return 'shots'
  }
  if (league.sport === 'soccer') {
    if (oaKey === 'player_assists') return 'assists'
    if (oaKey === 'player_shots') return 'shots'
  }
  return OA_TO_DEF[oaKey]
}

const SCORER_KEYS: Record<string, { id: string; name: string; kind: 'td_scorer' | 'first_td' | 'last_td'; statKey: string; category: string; order: number }> = {
  player_anytime_td: { id: 'any_td', name: 'Anytime Touchdown Scorer', kind: 'td_scorer', statKey: 'td', category: 'TD Scorer Props', order: 60 },
  player_1st_td: { id: 'first_td', name: 'First Touchdown Scorer', kind: 'first_td', statKey: 'td', category: 'TD Scorer Props', order: 61 },
  player_last_td: { id: 'last_td', name: 'Last Touchdown Scorer', kind: 'last_td', statKey: 'td', category: 'TD Scorer Props', order: 62 },
  player_goal_scorer_anytime: { id: 'any_goal', name: 'Anytime Goal Scorer', kind: 'td_scorer', statKey: '*.goals', category: 'Goal Scorer', order: 60 },
  player_goal_scorer_first: { id: 'first_goal', name: 'First Goal Scorer', kind: 'first_td', statKey: '*.goals', category: 'Goal Scorer', order: 61 },
  player_goal_scorer_last: { id: 'last_goal', name: 'Last Goal Scorer', kind: 'last_td', statKey: '*.goals', category: 'Goal Scorer', order: 62 },
  player_first_goal_scorer: { id: 'first_goal', name: 'First Goalscorer', kind: 'first_td', statKey: '*.totalGoals', category: 'Goal Scorer', order: 61 },
  player_last_goal_scorer: { id: 'last_goal', name: 'Last Goalscorer', kind: 'last_td', statKey: '*.totalGoals', category: 'Goal Scorer', order: 62 },
}

const PERIOD_KEYS: Record<string, { key: string; kind: 'ml' | 'ml3' | 'spread' | 'total' }> = {
  h2h_h1: { key: 'h1', kind: 'ml' }, h2h_3_way_h1: { key: 'h1', kind: 'ml3' }, spreads_h1: { key: 'h1', kind: 'spread' }, totals_h1: { key: 'h1', kind: 'total' },
  h2h_h2: { key: 'h2', kind: 'ml' }, h2h_3_way_h2: { key: 'h2', kind: 'ml3' }, spreads_h2: { key: 'h2', kind: 'spread' }, totals_h2: { key: 'h2', kind: 'total' },
  h2h_q1: { key: 'q1', kind: 'ml' }, h2h_3_way_q1: { key: 'q1', kind: 'ml3' }, spreads_q1: { key: 'q1', kind: 'spread' }, totals_q1: { key: 'q1', kind: 'total' },
  h2h_q2: { key: 'q2', kind: 'ml' }, spreads_q2: { key: 'q2', kind: 'spread' }, totals_q2: { key: 'q2', kind: 'total' },
  h2h_q3: { key: 'q3', kind: 'ml' }, spreads_q3: { key: 'q3', kind: 'spread' }, totals_q3: { key: 'q3', kind: 'total' },
  h2h_q4: { key: 'q4', kind: 'ml' }, spreads_q4: { key: 'q4', kind: 'spread' }, totals_q4: { key: 'q4', kind: 'total' },
  h2h_p1: { key: 'p1', kind: 'ml' }, h2h_3_way_p1: { key: 'p1', kind: 'ml3' }, spreads_p1: { key: 'p1', kind: 'spread' }, totals_p1: { key: 'p1', kind: 'total' },
  h2h_1st_1_innings: { key: 'i1', kind: 'ml' }, h2h_3_way_1st_1_innings: { key: 'i1', kind: 'ml3' }, totals_1st_1_innings: { key: 'i1', kind: 'total' },
  h2h_1st_5_innings: { key: 'f5', kind: 'ml' }, spreads_1st_5_innings: { key: 'f5', kind: 'spread' }, totals_1st_5_innings: { key: 'f5', kind: 'total' },
}

const PERIOD_NAMES: Record<string, string> = { h1: '1st Half', h2: '2nd Half', q1: '1st Quarter', q2: '2nd Quarter', q3: '3rd Quarter', q4: '4th Quarter', p1: '1st Period', i1: '1st Inning', f5: '1st 5 Innings' }

function isHome(name: string, ev: GameEvent): boolean {
  const n = normName(name)
  const h = normName(ev.home.team.displayName)
  return n === h || n.includes(h) || h.includes(n) || n.split(' ').pop() === h.split(' ').pop()
}

function fmtLine(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

export function marketsFromOa(ev: GameEvent, league: LeagueDef, oa: Record<string, OaMarket>, athletes: Record<string, AthleteInfo>): Market[] {
  const out: Market[] = []
  const defs = statDefsFor(league)
  const byKey = Object.fromEntries(defs.map((d) => [d.key, d]))
  const home = ev.home.team
  const away = ev.away.team
  let order = 100

  for (const [key, m] of Object.entries(oa)) {
    if (!m?.outcomes?.length) continue
    const defKey = defKeyFor(key, league)
    const def = defKey ? byKey[defKey] : undefined

    // --- player over/under props
    if (def) {
      for (const r of playerLines(m, athletes)) {
        if (r.line === undefined || (r.over === undefined && r.under === undefined)) continue
        const a = r.athleteId ? athletes[r.athleteId] : undefined
        const pid = r.athleteId ?? `n:${normName(r.player)}`
        const mk = mkMarket(ev, `prop|${def.key}|${pid}`, `${r.player} - ${def.name}`, 'props', 'prop_ou', 'two-col', {
          playerId: r.athleteId,
          playerName: r.player,
          playerTeamId: a?.teamId,
          playerPosition: a?.position,
          headshot: a?.headshot,
          line: r.line,
          category: def.category,
          sortOrder: order++,
          priced: 'fanduel',
        })
        const g = { kind: 'player_stat' as const, statKey: def.statKey, playerId: r.athleteId, playerName: r.player, line: r.line }
        if (r.over !== undefined) mk.selections.push(sel(mk, 'over', `Over ${fmtLine(r.line)}`, r.over, { ...g, side: 'over' }, { playerId: r.athleteId, line: r.line, teamId: a?.teamId, sub: `${r.player} - ${def.name}` }))
        if (r.under !== undefined) mk.selections.push(sel(mk, 'under', `Under ${fmtLine(r.line)}`, r.under, { ...g, side: 'under' }, { playerId: r.athleteId, line: r.line, teamId: a?.teamId, sub: `${r.player} - ${def.name}` }))
        out.push(mk)
      }
      continue
    }

    // --- scorer markets (yes prices per player)
    const sc = SCORER_KEYS[key]
    if (sc) {
      const mk = mkMarket(ev, `scorer|${sc.id}`, sc.name, 'td', 'scorer', 'list', { category: sc.category, sortOrder: sc.order, priced: 'fanduel' })
      for (const r of playerLines(m, athletes)) {
        const price = r.yes ?? r.over
        if (price === undefined) continue
        const a = r.athleteId ? athletes[r.athleteId] : undefined
        mk.selections.push(sel(mk, r.athleteId ?? `n:${normName(r.player)}`, r.player, price, { kind: sc.kind, playerId: r.athleteId, playerName: r.player, statKey: sc.statKey, teamId: a?.teamId }, { playerId: r.athleteId, teamId: a?.teamId, sub: sc.name }))
      }
      mk.selections.sort((x, y) => x.odds - y.odds)
      if (mk.selections.length) out.push(mk)
      continue
    }

    // --- double double / triple double
    if (key === 'player_double_double' || key === 'player_triple_double') {
      const count = key === 'player_double_double' ? 2 : 3
      const mk = mkMarket(ev, `scorer|${key}`, count === 2 ? 'To Record a Double Double' : 'To Record a Triple Double', 'td', 'scorer', 'list', { category: 'Player Specials', sortOrder: 80 + count, priced: 'fanduel' })
      for (const r of playerLines(m, athletes)) {
        const price = r.yes
        if (price === undefined) continue
        const a = r.athleteId ? athletes[r.athleteId] : undefined
        mk.selections.push(sel(mk, r.athleteId ?? `n:${normName(r.player)}`, r.player, price, { kind: 'double_double', playerId: r.athleteId, playerName: r.player, count }, { playerId: r.athleteId, teamId: a?.teamId, sub: mk.name }))
      }
      mk.selections.sort((x, y) => x.odds - y.odds)
      if (mk.selections.length) out.push(mk)
      continue
    }

    // --- cards (soccer)
    if (key === 'player_to_receive_card' || key === 'player_to_receive_red_card') {
      const red = key === 'player_to_receive_red_card'
      const mk = mkMarket(ev, `scorer|${key}`, red ? 'Player To Be Sent Off' : 'Player To Be Booked', 'td', 'scorer', 'list', { category: 'Cards', sortOrder: 85 + (red ? 1 : 0), priced: 'fanduel' })
      for (const r of playerLines(m, athletes)) {
        const price = r.yes
        if (price === undefined) continue
        mk.selections.push(sel(mk, r.athleteId ?? `n:${normName(r.player)}`, r.player, price, { kind: 'card', playerId: r.athleteId, playerName: r.player, count: red ? 2 : 1 }, { playerId: r.athleteId, sub: mk.name }))
      }
      mk.selections.sort((x, y) => x.odds - y.odds)
      if (mk.selections.length) out.push(mk)
      continue
    }

    // --- team totals
    if (key === 'team_totals') {
      const byTeam = new Map<string, { over?: number; under?: number; line?: number }>()
      for (const o of m.outcomes) {
        const team = o.description ?? ''
        const r = byTeam.get(team) ?? {}
        if (/over/i.test(o.name)) {
          r.over = o.price
          r.line = o.point
        } else if (/under/i.test(o.name)) {
          r.under = o.price
          r.line = o.point ?? r.line
        }
        byTeam.set(team, r)
      }
      for (const [team, r] of byTeam) {
        if (r.line === undefined || r.over === undefined || r.under === undefined) continue
        const c = isHome(team, ev) ? ev.home : ev.away
        const mk = mkMarket(ev, `tt|${c.team.id}`, `${c.team.abbreviation} ${c.team.name} Total ${league.sport === 'hockey' || league.sport === 'soccer' ? 'Goals' : league.sport === 'baseball' ? 'Runs' : 'Points'}`, 'team', 'team_total', 'two-col', { line: r.line, sortOrder: 30, priced: 'fanduel' })
        mk.selections = [
          sel(mk, 'over', `Over ${r.line}`, r.over, { kind: 'team_total', side: 'over', teamId: c.team.id, line: r.line }, { line: r.line, teamId: c.team.id }),
          sel(mk, 'under', `Under ${r.line}`, r.under, { kind: 'team_total', side: 'under', teamId: c.team.id, line: r.line }, { line: r.line, teamId: c.team.id }),
        ]
        out.push(mk)
      }
      continue
    }

    // --- alternate spreads
    if (key === 'alternate_spreads') {
      const mk = mkMarket(ev, 'altspread', `Alternate ${spreadLabel(league)}`, 'alt', 'alt_spread', 'grid', { sortOrder: 40, priced: 'fanduel' })
      const homeRows = m.outcomes.filter((o) => isHome(o.name, ev) && o.point !== undefined).sort((a, b) => (a.point ?? 0) - (b.point ?? 0))
      const awayByPoint = new Map<number, number>()
      for (const o of m.outcomes) if (!isHome(o.name, ev) && o.point !== undefined) awayByPoint.set(o.point, o.price)
      for (const h of homeRows) {
        const hs = h.point ?? 0
        const ap = awayByPoint.get(-hs)
        if (ap === undefined) continue
        mk.selections.push(
          sel(mk, `away|${-hs}`, `${away.displayName} ${formatLine(-hs)}`, ap, { kind: 'spread', side: 'away', teamId: away.id, line: -hs }, { line: -hs, teamId: away.id }),
          sel(mk, `home|${hs}`, `${home.displayName} ${formatLine(hs)}`, h.price, { kind: 'spread', side: 'home', teamId: home.id, line: hs }, { line: hs, teamId: home.id }),
        )
      }
      if (mk.selections.length) out.push(mk)
      continue
    }

    // --- alternate totals
    if (key === 'alternate_totals') {
      const mk = mkMarket(ev, 'alttotal', `Alternate ${totalLabel(league)}`, 'alt', 'alt_total', 'grid', { sortOrder: 41, priced: 'fanduel' })
      const overs = m.outcomes.filter((o) => /over/i.test(o.name) && o.point !== undefined).sort((a, b) => (a.point ?? 0) - (b.point ?? 0))
      const unders = new Map<number, number>()
      for (const o of m.outcomes) if (/under/i.test(o.name) && o.point !== undefined) unders.set(o.point, o.price)
      for (const o of overs) {
        const t = o.point ?? 0
        const u = unders.get(t)
        if (u === undefined) continue
        mk.selections.push(sel(mk, `over|${t}`, `Over ${t}`, o.price, { kind: 'total', side: 'over', line: t }, { line: t }), sel(mk, `under|${t}`, `Under ${t}`, u, { kind: 'total', side: 'under', line: t }, { line: t }))
      }
      if (mk.selections.length) out.push(mk)
      continue
    }

    // --- period markets
    const per = PERIOD_KEYS[key]
    if (per) {
      const pname = PERIOD_NAMES[per.key] ?? per.key
      if (per.kind === 'ml' || per.kind === 'ml3') {
        const three = per.kind === 'ml3' || m.outcomes.some((o) => /draw|tie/i.test(o.name))
        const mk = mkMarket(ev, `${three ? 'pw3' : 'pw'}|${per.key}`, three ? `${pname} Winner (3-Way)` : `${pname} Moneyline`, 'periods', 'period_ml', three ? 'three-col' : 'two-col', { sortOrder: 50, category: pname, priced: 'fanduel' })
        const h = m.outcomes.find((o) => isHome(o.name, ev))
        const a = m.outcomes.find((o) => !isHome(o.name, ev) && !/draw|tie/i.test(o.name))
        const d = m.outcomes.find((o) => /draw|tie/i.test(o.name))
        if (a) mk.selections.push(sel(mk, 'away', away.displayName, a.price, { kind: 'period_ml', side: 'away', teamId: away.id, period: per.key }, { teamId: away.id }))
        if (three && d) mk.selections.push(sel(mk, 'draw', 'Tie', d.price, { kind: 'period_ml', side: 'draw', period: per.key }))
        if (h) mk.selections.push(sel(mk, 'home', home.displayName, h.price, { kind: 'period_ml', side: 'home', teamId: home.id, period: per.key }, { teamId: home.id }))
        if (mk.selections.length >= 2) out.push(mk)
      } else if (per.kind === 'spread') {
        const h = m.outcomes.find((o) => isHome(o.name, ev))
        const a = m.outcomes.find((o) => !isHome(o.name, ev))
        if (h && a && h.point !== undefined) {
          const mk = mkMarket(ev, `ps|${per.key}`, `${pname} ${spreadLabel(league)}`, 'periods', 'period_spread', 'two-col', { sortOrder: 51, line: h.point, category: pname, priced: 'fanduel' })
          mk.selections = [
            sel(mk, 'away', `${away.displayName} ${formatLine(-h.point)}`, a.price, { kind: 'period_spread', side: 'away', teamId: away.id, line: -h.point, period: per.key }, { line: -h.point, teamId: away.id }),
            sel(mk, 'home', `${home.displayName} ${formatLine(h.point)}`, h.price, { kind: 'period_spread', side: 'home', teamId: home.id, line: h.point, period: per.key }, { line: h.point, teamId: home.id }),
          ]
          out.push(mk)
        }
      } else {
        const o = m.outcomes.find((x) => /over/i.test(x.name))
        const u = m.outcomes.find((x) => /under/i.test(x.name))
        if (o && u && o.point !== undefined) {
          const mk = mkMarket(ev, `pt|${per.key}`, `${pname} Total`, 'periods', 'period_total', 'two-col', { sortOrder: 52, line: o.point, category: pname, priced: 'fanduel' })
          mk.selections = [
            sel(mk, 'over', `Over ${o.point}`, o.price, { kind: 'period_total', side: 'over', line: o.point, period: per.key }, { line: o.point }),
            sel(mk, 'under', `Under ${o.point}`, u.price, { kind: 'period_total', side: 'under', line: o.point, period: per.key }, { line: o.point }),
          ]
          out.push(mk)
        }
      }
      continue
    }

    // --- soccer specials
    if (key === 'btts') {
      const y = m.outcomes.find((o) => /yes/i.test(o.name))
      const n = m.outcomes.find((o) => /no/i.test(o.name))
      if (y && n) {
        const mk = mkMarket(ev, 'btts', 'Both Teams To Score', 'specials', 'btts', 'two-col', { sortOrder: 91, priced: 'fanduel' })
        mk.selections = [sel(mk, 'yes', 'Yes', y.price, { kind: 'btts', side: 'yes' }), sel(mk, 'no', 'No', n.price, { kind: 'btts', side: 'no' })]
        out.push(mk)
      }
      continue
    }
    if (key === 'draw_no_bet') {
      const h = m.outcomes.find((o) => isHome(o.name, ev))
      const a = m.outcomes.find((o) => !isHome(o.name, ev))
      if (h && a) {
        const mk = mkMarket(ev, 'dnb', 'Draw No Bet', 'game', 'draw_no_bet', 'two-col', { sortOrder: 3, priced: 'fanduel' })
        mk.selections = [sel(mk, 'away', away.displayName, a.price, { kind: 'draw_no_bet', side: 'away', teamId: away.id }, { teamId: away.id }), sel(mk, 'home', home.displayName, h.price, { kind: 'draw_no_bet', side: 'home', teamId: home.id }, { teamId: home.id })]
        out.push(mk)
      }
      continue
    }
    if (key === 'double_chance') {
      const mk = mkMarket(ev, 'dc', 'Double Chance', 'game', 'double_chance', 'three-col', { sortOrder: 4, priced: 'fanduel' })
      for (const o of m.outcomes) {
        const parts = o.name.split(/\s+or\s+/i)
        const hasDraw = /draw/i.test(o.name)
        const hasHome = parts.some((p) => isHome(p, ev) && !/draw/i.test(p))
        const hasAway = parts.some((p) => !isHome(p, ev) && !/draw/i.test(p))
        const dc = hasHome && hasDraw ? 'home_draw' : hasAway && hasDraw ? 'away_draw' : hasHome && hasAway ? 'home_away' : null
        if (!dc) continue
        const label = dc === 'home_draw' ? `${home.displayName} or Draw` : dc === 'away_draw' ? `${away.displayName} or Draw` : `${home.displayName} or ${away.displayName}`
        mk.selections.push(sel(mk, dc, label, o.price, { kind: 'double_chance', dc }))
      }
      if (mk.selections.length) out.push(mk)
      continue
    }
    if (key === 'correct_score') {
      const mk = mkMarket(ev, 'cs', 'Correct Score', 'specials', 'correct_score', 'grid', { sortOrder: 93, priced: 'fanduel' })
      for (const o of m.outcomes) {
        const sc = o.name.match(/(\d+)\s*[-:]\s*(\d+)/)
        if (!sc) continue
        const isH = isHome(o.name.replace(sc[0], ''), ev) || /^home/i.test(o.name)
        const draw = /draw/i.test(o.name)
        const hg = draw ? parseInt(sc[1], 10) : isH ? parseInt(sc[1], 10) : parseInt(sc[2], 10)
        const ag = draw ? parseInt(sc[2], 10) : isH ? parseInt(sc[2], 10) : parseInt(sc[1], 10)
        mk.selections.push(sel(mk, `${hg}-${ag}`, `${home.shortDisplayName} ${hg} - ${ag} ${away.shortDisplayName}`, o.price, { kind: 'correct_score', homeGoals: hg, awayGoals: ag }))
      }
      mk.selections.sort((x, y) => x.odds - y.odds)
      if (mk.selections.length) out.push(mk)
      continue
    }
  }
  return out
}

/** Replace modelled markets with FanDuel-priced versions of the same market (matched by id, or by player+stat for name-keyed players). */
export function mergeMarkets(base: Market[], fd: Market[]): Market[] {
  if (!fd.length) return base
  const fdIds = new Set(fd.map((m) => m.id))
  const fdPropKeys = new Set(fd.filter((m) => m.kind === 'prop_ou' && m.playerName).map((m) => `${m.id.split('|')[2]}|${normName(m.playerName!)}`))
  const kept = base.filter((m) => {
    if (fdIds.has(m.id)) return false
    if (m.kind === 'prop_ou' && m.playerName && fdPropKeys.has(`${m.id.split('|')[2]}|${normName(m.playerName)}`)) return false
    return true
  })
  return [...kept, ...fd]
}

export function selectionsWithFd(markets: Market[]): Selection[] {
  return markets.filter((m) => m.priced === 'fanduel').flatMap((m) => m.selections)
}
