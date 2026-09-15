import { create } from 'zustand'
import type { GameLines } from '@/lib/types'

/** FanDuel prices pulled through The Odds API, keyed by ESPN event id. */
interface OddsState {
  lines: Record<string, GameLines>
  oaIds: Record<string, string>
  fetchedAt: Record<string, number>
  setLeague: (leagueId: string, lines: Record<string, GameLines>, oaIds: Record<string, string>) => void
}

export const useOddsStore = create<OddsState>()((set) => ({
  lines: {},
  oaIds: {},
  fetchedAt: {},
  setLeague: (leagueId, lines, oaIds) =>
    set((st) => ({ lines: { ...st.lines, ...lines }, oaIds: { ...st.oaIds, ...oaIds }, fetchedAt: { ...st.fetchedAt, [leagueId]: Date.now() } })),
}))
