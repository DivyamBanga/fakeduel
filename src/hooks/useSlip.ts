import { useCallback } from 'react'
import type { GameEvent, Market, Selection } from '@/lib/types'
import { useBetslip, type SlipSelection } from '@/store/betslip'

export function toSlipSelection(ev: GameEvent, market: Market, selection: Selection): SlipSelection {
  return {
    selection,
    market: { id: market.id, name: market.name, kind: market.kind, group: market.group, sgp: market.sgp, playerName: market.playerName, playerId: market.playerId, line: market.line },
    event: {
      id: ev.id,
      leagueId: ev.leagueId,
      sport: ev.sport,
      name: ev.name,
      shortName: ev.shortName,
      date: ev.date,
      status: ev.status,
      homeAbbr: ev.home.team.abbreviation,
      awayAbbr: ev.away.team.abbreviation,
      homeName: ev.home.team.displayName,
      awayName: ev.away.team.displayName,
    },
    addedAt: Date.now(),
    live: ev.status.state === 'in',
  }
}

export function useSlip() {
  const selections = useBetslip((s) => s.selections)
  const toggle = useBetslip((s) => s.toggle)
  const has = useCallback((id: string) => selections.some((x) => x.selection.id === id), [selections])
  const toggleSel = useCallback((ev: GameEvent, market: Market, selection: Selection) => toggle(toSlipSelection(ev, market, selection)), [toggle])
  return { has, toggle: toggleSel, count: selections.length }
}

export function eventPath(ev: Pick<GameEvent, 'id' | 'leagueId' | 'sport' | 'name'> & { away?: { team: { displayName: string } }; home?: { team: { displayName: string } } }): string {
  const name = ev.away && ev.home ? `${ev.away.team.displayName}-@-${ev.home.team.displayName}` : ev.name
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9@]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `/${ev.sport}/${ev.leagueId}/${slug}-${ev.id}`
}
