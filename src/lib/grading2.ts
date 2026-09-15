/** Grading for FanDuel's game-flow markets (scoring sequence, drives, periods). */
import type { LeagueDef } from '@/data/sports'
import type { EventSummary } from './espn'
import { periodDefs } from './markets'
import type { BetLeg, BetStatus } from './types'

export interface Res {
  status: BetStatus
  resultText?: string
}

const isTD = (p: EventSummary['scoringPlays'][number]) => /touchdown/i.test(p.scoringType ?? '') || /\bTD\b|touchdown/i.test(p.text)
const isFG = (p: EventSummary['scoringPlays'][number]) => /field.?goal/i.test(p.scoringType ?? '') || /\bFG\b|field goal/i.test(p.text)
const isSafety = (p: EventSummary['scoringPlays'][number]) => /safety/i.test(p.scoringType ?? '') || /safety/i.test(p.text)

function periodOf(league: LeagueDef, key: string): number[] {
  return periodDefs(league).find((p) => p.key === key)?.periods ?? []
}

function periodTotals(summary: EventSummary, league: LeagueDef, key: string): { home: number; away: number } | null {
  const ev = summary.event
  if (!ev?.home.linescores || !ev.away.linescores) return null
  const ps = periodOf(league, key)
  let home = 0
  let away = 0
  for (const p of ps) {
    if (ev.home.linescores[p - 1] === undefined || ev.away.linescores[p - 1] === undefined) return null
    home += ev.home.linescores[p - 1]
    away += ev.away.linescores[p - 1]
  }
  return { home, away }
}

export function gradeSpecial(leg: BetLeg, summary: EventSummary, league: LeagueDef, playerId: (g: { playerId?: string; playerName?: string }) => string | undefined, stat: (pid: string, key: string) => number | null): Res | null {
  const ev = summary.event
  if (!ev) return null
  const g = leg.grading
  const home = ev.home.score
  const away = ev.away.score
  const plays = summary.scoringPlays
  const score = `${ev.away.team.abbreviation} ${away} - ${ev.home.team.abbreviation} ${home}`
  const wl = (won: boolean, text = score): Res => ({ status: won ? 'won' : 'lost', resultText: text })
  const teamOfPlay = (p: EventSummary['scoringPlays'][number]) => p.teamId
  const noData = (): Res => ({ status: 'void', resultText: 'Scoring data unavailable' })

  switch (g.kind) {
    case 'team_first_score': {
      const nth = (g.count ?? 1) - 1
      const scoped = g.period ? plays.filter((p) => periodOf(league, g.period!).includes(p.period)) : plays
      if (!scoped.length && home + away > 0 && !g.period) return noData()
      const play = scoped[nth]
      if (g.side === 'no') return wl(!play, play ? play.text : 'No goal')
      if (!play) return home + away === 0 || nth > 0 || g.period ? wl(false, 'No score') : noData()
      return wl(teamOfPlay(play) === g.teamId)
    }
    case 'team_last_score': {
      if (!plays.length) return home + away === 0 ? { status: 'push', resultText: 'No score' } : noData()
      return wl(teamOfPlay(plays[plays.length - 1]) === g.teamId)
    }
    case 'score_first_and': {
      if (!plays.length) return noData()
      const first = teamOfPlay(plays[0]) === g.teamId
      const won = (g.teamId === ev.home.team.id && home > away) || (g.teamId === ev.away.team.id && away > home)
      const lost = (g.teamId === ev.home.team.id && home < away) || (g.teamId === ev.away.team.id && away < home)
      return wl(first && (g.side === 'yes' ? won : lost))
    }
    case 'first_scoring_play': {
      if (!plays.length) return noData()
      const p = plays[0]
      const type = isTD(p) ? 'TD' : isFG(p) ? 'FG' : isSafety(p) ? 'SAFETY' : 'OTHER'
      return wl(teamOfPlay(p) === g.teamId && type === g.label, `${p.text}`)
    }
    case 'every_quarter': {
      const ls = g.teamId === ev.home.team.id ? ev.home.linescores : ev.away.linescores
      const ols = g.teamId === ev.home.team.id ? ev.away.linescores : ev.home.linescores
      if (!ls || ls.length < 4) return noData()
      if (g.label === 'lead') {
        if (!ols || ols.length < 4) return noData()
        let me = 0
        let other = 0
        let lead = true
        for (let i = 0; i < 4; i++) {
          me += ls[i]
          other += ols[i]
          if (me <= other) lead = false
        }
        return wl(lead)
      }
      const every = ls.slice(0, 4).every((x) => x > 0)
      return wl(g.side === 'yes' ? every : !every)
    }
    case 'race_to': {
      const n = g.line ?? 0
      let winner: string | null = null
      for (const p of plays) {
        if (p.homeScore === undefined || p.awayScore === undefined) continue
        if (p.homeScore >= n && p.awayScore >= n) {
          winner = p.homeScore > p.awayScore ? ev.home.team.id : ev.away.team.id
          break
        }
        if (p.homeScore >= n) {
          winner = ev.home.team.id
          break
        }
        if (p.awayScore >= n) {
          winner = ev.away.team.id
          break
        }
      }
      if (winner === null && (home >= n || away >= n)) return noData()
      if (g.side === 'no') return wl(winner === null, winner ? 'Reached' : 'Neither')
      return wl(winner === g.teamId)
    }
    case 'btts_period': {
      const pt = periodTotals(summary, league, g.period ?? 'q1')
      if (!pt) return noData()
      const both = pt.home > 0 && pt.away > 0
      return wl(g.side === 'yes' ? both : !both, `${pt.away}-${pt.home}`)
    }
    case 'td_each_half': {
      if (!plays.length && home + away > 0) return noData()
      const need = g.count ?? 1
      const count = (teamId: string, half: 1 | 2) => plays.filter((p) => isTD(p) && p.teamId === teamId && (half === 1 ? p.period <= 2 : p.period >= 3)).length
      const ok = [ev.home.team.id, ev.away.team.id].every((t) => count(t, 1) >= need && count(t, 2) >= need)
      return wl(g.side === 'yes' ? ok : !ok)
    }
    case 'both_score_n': {
      const n = g.line ?? 0
      const ok = home >= n && away >= n
      return wl(g.side === 'yes' ? ok : !ok)
    }
    case 'team_first_fg': {
      const fg = plays.find(isFG)
      if (!fg) return { status: 'push', resultText: 'No field goal' }
      return wl(fg.teamId === g.teamId, fg.text)
    }
    case 'either_player': {
      const ids = (g.playerIds ?? []).map((id) => (id.startsWith('n:') ? id : id))
      if (!ids.length) return { status: 'void' }
      const mode = g.label ?? 'any'
      if (mode === 'first') {
        const tds = plays.filter(isTD)
        if (!tds.length) return wl(false, 'No touchdown')
        const first = tds[0]
        const firstIds = [...first.athleteIds, ...nameIds(summary, first.text)]
        return wl(ids.some((id) => firstIds.includes(id)))
      }
      const need = mode === 'multi' ? (g.count ?? 2) : 1
      const vals = ids.map((id) => stat(id, g.statKey ?? 'td'))
      if (vals.every((v) => v === null)) return summary.boxscore.length ? { status: 'void', resultText: 'Did not play' } : { status: 'open' }
      return wl(vals.some((v) => (v ?? 0) >= need))
    }
    case 'most_stat': {
      const ids = g.playerIds ?? []
      const me = g.playerId ? playerId(g) : undefined
      if (!me || !ids.length || !g.statKey) return { status: 'void' }
      const vals = ids.map((id) => ({ id, v: stat(id, g.statKey!) ?? -Infinity }))
      const mine = vals.find((x) => x.id === me)?.v ?? -Infinity
      const max = Math.max(...vals.map((x) => x.v))
      if (!isFinite(max)) return summary.boxscore.length ? { status: 'void' } : { status: 'open' }
      const winners = vals.filter((x) => x.v === max)
      if (mine === max && winners.length > 1) return { status: 'push', resultText: `Tie at ${max}` }
      return wl(mine === max, `${mine}`)
    }
    case 'drive_result': {
      const idx = (g.count ?? 1) - 1
      const teamDrives = summary.drives.filter((d) => d.teamId === g.teamId)
      const d = teamDrives[idx]
      if (!d) return summary.drives.length ? { status: 'void', resultText: 'No drive' } : noData()
      const r = d.result
      const cls = /TD|TOUCHDOWN/.test(r) ? 'TD' : /FG|FIELD GOAL/.test(r) ? 'FGA' : /PUNT/.test(r) ? 'PUNT' : 'OTHER'
      return wl(cls === g.label, r)
    }
    case 'total_tds': {
      if (!plays.length && home + away > 0) return noData()
      let tds = plays.filter(isTD)
      if (g.teamId) tds = tds.filter((p) => p.teamId === g.teamId)
      if (g.period) {
        const ps = periodOf(league, g.period)
        tds = tds.filter((p) => ps.includes(p.period))
      }
      const n = tds.length
      if (n === g.line) return { status: 'push', resultText: `${n} TDs` }
      return wl(g.side === 'over' ? n > (g.line ?? 0) : n < (g.line ?? 0), `${n} TDs`)
    }
    case 'period_td': {
      if (!plays.length && home + away > 0) return noData()
      const ps = periodOf(league, g.period ?? 'q1')
      const any = plays.some((p) => isTD(p) && ps.includes(p.period))
      return wl(g.side === 'yes' ? any : !any)
    }
    case 'odd_even': {
      let total = home + away
      if (g.period) {
        const pt = periodTotals(summary, league, g.period)
        if (!pt) return noData()
        total = pt.home + pt.away
      }
      const odd = total % 2 === 1
      return wl(g.side === 'yes' ? odd : !odd, `Total ${total}`)
    }
    case 'long_reception': {
      const pid = playerId(g)
      if (!pid) return { status: 'void' }
      const v = stat(pid, g.statKey ?? 'receiving.longReception')
      if (v === null) return summary.boxscore.length ? { status: 'void', resultText: 'Did not play' } : { status: 'open' }
      return wl(v >= (g.line ?? 0), `${v} yds`)
    }
    case 'team_stat': {
      if (!g.teamId) return { status: 'void' }
      let v: number | null = null
      if (g.statKey === 'points' && g.period) {
        const pt = periodTotals(summary, league, g.period)
        if (!pt) return noData()
        v = g.teamId === ev.home.team.id ? pt.home : pt.away
      } else {
        const ts = summary.teamStats[g.teamId]
        v = ts && g.statKey && ts[g.statKey] !== undefined ? ts[g.statKey] : null
      }
      if (v === null) return noData()
      if (g.side === undefined) return wl(v >= (g.line ?? 0), `${v}`)
      if (g.side === 'yes' || g.side === 'no') return wl(g.side === 'yes' ? v >= (g.line ?? 1) : v < (g.line ?? 1), `${v}`)
      if (v === g.line) return { status: 'push', resultText: `${v}` }
      return wl(g.side === 'over' ? v > (g.line ?? 0) : v < (g.line ?? 0), `${v}`)
    }
    case 'combo': {
      if (!g.combo || g.combo.length < 3) return noData()
      const [sideSpec, ouSide, totalStr] = g.combo
      const total = parseFloat(totalStr)
      const t = home + away
      const [side, lineStr] = sideSpec.split(':')
      const my = side === 'home' ? home : away
      const other = side === 'home' ? away : home
      const btts = home > 0 && away > 0
      let first: boolean | null
      if (side === 'btts') first = lineStr === 'yes' ? btts : !btts
      else if (side === 'draw') first = home === away
      else if (lineStr !== undefined) {
        const diff = my - other + parseFloat(lineStr)
        first = diff === 0 ? null : diff > 0
      } else first = my === other ? null : my > other
      const second = ouSide === 'btts' ? (totalStr === 'yes' ? btts : !btts) : t === total ? null : ouSide === 'over' ? t > total : t < total
      if (first === false || second === false) return wl(false)
      if (first === null || second === null) return { status: 'push', resultText: score }
      return wl(true)
    }
    case 'total_band': {
      let sc = { home, away }
      if (g.period) {
        const pt = periodTotals(summary, league, g.period)
        if (!pt) return noData()
        sc = pt
      }
      const v = g.teamId ? (g.teamId === ev.home.team.id ? sc.home : sc.away) : sc.home + sc.away
      return wl(v >= (g.rangeLow ?? 0) && v <= (g.rangeHigh ?? 999), `${v}`)
    }
    case 'method':
    case 'distance':
    case 'rounds': {
      if (ev.status.state !== 'post') return { status: 'open' }
      const d = `${ev.status.detail} ${ev.status.shortDetail}`
      const method = /KO|TKO/i.test(d) ? 'KO' : /sub/i.test(d) ? 'SUB' : /dec|points|unanimous|split|majority/i.test(d) ? 'DEC' : /draw|no contest|\bNC\b/i.test(d) ? 'DRAW' : null
      if (!method) return { status: 'void', resultText: 'Result unavailable' }
      const rm = d.match(/R(?:d|ound)?\.?\s*(\d+)/i)
      const tm = d.match(/(\d+):(\d\d)/)
      const maxRounds = league.id === 'boxing' ? 12 : 3
      const roundLen = league.id === 'boxing' ? 180 : 300
      const round = method === 'DEC' ? maxRounds : rm ? parseInt(rm[1], 10) : null
      const secs = tm ? parseInt(tm[1], 10) * 60 + parseInt(tm[2], 10) : 0
      const hw = (ev.home as { winner?: boolean }).winner
      const aw = (ev.away as { winner?: boolean }).winner
      const winnerId = hw ? ev.home.team.id : aw ? ev.away.team.id : home > away ? ev.home.team.id : away > home ? ev.away.team.id : null
      if (g.kind === 'distance') return wl(g.side === 'yes' ? method === 'DEC' : method !== 'DEC', d)
      if (g.kind === 'method') {
        if (g.label === 'DRAW') return wl(method === 'DRAW', d)
        return wl(winnerId === g.teamId && method === g.label, d)
      }
      if (round === null) return { status: 'void', resultText: d }
      if (g.side === 'over' || g.side === 'under') {
        const completed = method === 'DEC' ? maxRounds : round - 1 + secs / roundLen
        if (completed === g.line) return { status: 'push', resultText: d }
        return wl(g.side === 'over' ? completed > (g.line ?? 0) : completed < (g.line ?? 0), d)
      }
      return wl(winnerId === g.teamId && method !== 'DEC' && round >= (g.rangeLow ?? 1) && round <= (g.rangeHigh ?? 99), d)
    }
    case 'double_result': {
      const h1 = periodTotals(summary, league, 'h1')
      if (!h1 || !g.combo || g.combo.length < 2) return noData()
      const res = (h: number, a: number) => (h > a ? 'home' : a > h ? 'away' : 'draw')
      return wl(res(h1.home, h1.away) === g.combo[0] && res(home, away) === g.combo[1], `1H ${h1.away}-${h1.home} · FT ${away}-${home}`)
    }
  }
  return null
}

function nameIds(summary: EventSummary, text: string): string[] {
  const m = text.match(/^(.+?)\s\d+\s?(?:Yd|Yard|yd)/i)
  if (!m) return []
  const nm = m[1].trim()
  const norm = nm
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const ids = ['n:' + norm]
  for (const team of summary.boxscore) for (const g of team.groups) for (const a of g.athletes) if (a.athlete.name === nm || a.athlete.shortName === nm) ids.push(a.athlete.id)
  return ids
}
