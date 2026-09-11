import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { OddsFormat } from '@/lib/types'

export type Theme = 'dark' | 'light'

interface SettingsState {
  theme: Theme
  oddsFormat: OddsFormat
  acceptOddsMovements: boolean
  keepSelectionsAfterBet: boolean
  quickBetAmounts: number[]
  displayName: string
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
      setTheme: (theme) => set({ theme }),
      setOddsFormat: (oddsFormat) => set({ oddsFormat }),
      setAcceptOddsMovements: (acceptOddsMovements) => set({ acceptOddsMovements }),
      setKeepSelections: (keepSelectionsAfterBet) => set({ keepSelectionsAfterBet }),
      setDisplayName: (displayName) => set({ displayName }),
    }),
    { name: 'fd.settings' },
  ),
)
