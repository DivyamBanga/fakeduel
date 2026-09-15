import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { jsonStorage } from './storage'
import type { OddsFormat } from '@/lib/types'

export type Theme = 'dark' | 'light'

interface SettingsState {
  theme: Theme
  oddsFormat: OddsFormat
  acceptOddsMovements: boolean
  keepSelectionsAfterBet: boolean
  quickBetAmounts: number[]
  displayName: string
  oddsApiKey: string
  useFanDuelPrices: boolean
  oddsApiStatus: { remaining: number | null; used: number | null; lastError: string | null; lastFetchAt: number | null }
  setOddsApiKey: (k: string) => void
  setUseFanDuelPrices: (v: boolean) => void
  setOddsApiStatus: (p: Partial<SettingsState['oddsApiStatus']>) => void
  setTheme: (t: Theme) => void
  setOddsFormat: (f: OddsFormat) => void
  setAcceptOddsMovements: (v: boolean) => void
  setKeepSelections: (v: boolean) => void
  setDisplayName: (n: string) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      oddsFormat: 'american',
      acceptOddsMovements: false,
      keepSelectionsAfterBet: false,
      quickBetAmounts: [10, 20, 50, 100],
      displayName: 'Divyam',
      oddsApiKey: '',
      useFanDuelPrices: true,
      oddsApiStatus: { remaining: null, used: null, lastError: null, lastFetchAt: null },
      setOddsApiKey: (oddsApiKey) => set({ oddsApiKey, oddsApiStatus: { remaining: null, used: null, lastError: null, lastFetchAt: null } }),
      setUseFanDuelPrices: (useFanDuelPrices) => set({ useFanDuelPrices }),
      setOddsApiStatus: (p) => set((st) => ({ oddsApiStatus: { ...st.oddsApiStatus, ...p } })),
      setTheme: (theme) => set({ theme }),
      setOddsFormat: (oddsFormat) => set({ oddsFormat }),
      setAcceptOddsMovements: (acceptOddsMovements) => set({ acceptOddsMovements }),
      setKeepSelections: (keepSelectionsAfterBet) => set({ keepSelectionsAfterBet }),
      setDisplayName: (displayName) => set({ displayName }),
    }),
    { name: 'fd.settings', storage: jsonStorage() },
  ),
)
