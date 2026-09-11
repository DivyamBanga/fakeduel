import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GameEvent, Market, Selection } from '@/lib/types'

export interface SlipSelection {
  selection: Selection
  market: Pick<Market, 'id' | 'name' | 'kind' | 'group' | 'sgp' | 'playerName' | 'playerId' | 'line'>
  event: Pick<GameEvent, 'id' | 'leagueId' | 'sport' | 'name' | 'shortName' | 'date' | 'status'> & { homeAbbr: string; awayAbbr: string; homeName: string; awayName: string }
  addedAt: number
  live?: boolean
}

export type SlipMode = 'betslip' | 'roundrobin' | 'teaser'

interface BetslipState {
  selections: SlipSelection[]
  stakes: Record<string, number>
  sgpStakes: Record<string, number>
  parlayStake: number
  rrStakes: Record<number, number>
  teaserStake: number
  teaserPoints: number
  mode: SlipMode
  open: boolean
  boostTokenId: string | null
  noSweatTokenId: string | null
  useBonusBet: boolean
  lastReceipt: { betIds: string[]; at: number } | null
  rrDisabled: Record<string, boolean>
  add: (s: SlipSelection) => void
  remove: (selectionId: string) => void
  toggle: (s: SlipSelection) => void
  clear: () => void
  setStake: (selectionId: string, stake: number) => void
  setSgpStake: (eventId: string, stake: number) => void
  setParlayStake: (stake: number) => void
  setRrStake: (size: number, stake: number) => void
  setTeaserStake: (stake: number) => void
  setTeaserPoints: (pts: number) => void
  setMode: (m: SlipMode) => void
  setOpen: (o: boolean) => void
  setBoostToken: (id: string | null) => void
  setNoSweatToken: (id: string | null) => void
  setUseBonusBet: (v: boolean) => void
  setReceipt: (r: BetslipState['lastReceipt']) => void
  toggleRrSelection: (selectionId: string) => void
  updateOdds: (selectionId: string, odds: number, line?: number) => void
  has: (selectionId: string) => boolean
}

export const useBetslip = create<BetslipState>()(
  persist(
    (set, get) => ({
      selections: [],
      stakes: {},
      sgpStakes: {},
      parlayStake: 0,
      rrStakes: {},
      teaserStake: 0,
      teaserPoints: 6,
      mode: 'betslip',
      open: false,
      boostTokenId: null,
      noSweatTokenId: null,
      useBonusBet: false,
      lastReceipt: null,
      rrDisabled: {},
      add: (s) => {
        if (get().selections.some((x) => x.selection.id === s.selection.id)) return
        set((st) => ({ selections: [...st.selections, s], lastReceipt: null }))
      },
      remove: (id) =>
        set((st) => {
          const stakes = { ...st.stakes }
          delete stakes[id]
          const selections = st.selections.filter((x) => x.selection.id !== id)
          return { selections, stakes, mode: selections.length < 3 && st.mode === 'roundrobin' ? 'betslip' : st.mode, open: selections.length === 0 ? false : st.open }
        }),
      toggle: (s) => {
        if (get().has(s.selection.id)) get().remove(s.selection.id)
        else get().add(s)
      },
      clear: () => set({ selections: [], stakes: {}, sgpStakes: {}, parlayStake: 0, rrStakes: {}, teaserStake: 0, mode: 'betslip', boostTokenId: null, noSweatTokenId: null, useBonusBet: false, rrDisabled: {} }),
      setStake: (id, stake) => set((st) => ({ stakes: { ...st.stakes, [id]: stake } })),
      setSgpStake: (eventId, stake) => set((st) => ({ sgpStakes: { ...st.sgpStakes, [eventId]: stake } })),
      setParlayStake: (parlayStake) => set({ parlayStake }),
      setRrStake: (size, stake) => set((st) => ({ rrStakes: { ...st.rrStakes, [size]: stake } })),
      setTeaserStake: (teaserStake) => set({ teaserStake }),
      setTeaserPoints: (teaserPoints) => set({ teaserPoints }),
      setMode: (mode) => set({ mode }),
      setOpen: (open) => set({ open }),
      setBoostToken: (boostTokenId) => set({ boostTokenId }),
      setNoSweatToken: (noSweatTokenId) => set({ noSweatTokenId }),
      setUseBonusBet: (useBonusBet) => set({ useBonusBet }),
      setReceipt: (lastReceipt) => set({ lastReceipt }),
      toggleRrSelection: (id) => set((st) => ({ rrDisabled: { ...st.rrDisabled, [id]: !st.rrDisabled[id] } })),
      updateOdds: (id, odds, line) =>
        set((st) => ({
          selections: st.selections.map((x) => (x.selection.id === id ? { ...x, selection: { ...x.selection, odds, line: line ?? x.selection.line } } : x)),
        })),
      has: (id) => get().selections.some((x) => x.selection.id === id),
    }),
    { name: 'fd.betslip', partialize: (s) => ({ selections: s.selections, stakes: s.stakes, parlayStake: s.parlayStake, teaserPoints: s.teaserPoints }) },
  ),
)
