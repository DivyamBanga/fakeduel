import { create } from 'zustand'
import type { EventSummary } from '@/lib/espn'
import type { GameEvent } from '@/lib/types'

interface LiveState {
  events: Record<string, GameEvent>
  summaries: Record<string, EventSummary>
  liveCount: number
  setEvents: (evs: GameEvent[]) => void
  setSummary: (eventId: string, s: EventSummary) => void
  setLiveCount: (n: number) => void
}

export const useLiveStore = create<LiveState>()((set) => ({
  events: {},
  summaries: {},
  liveCount: 0,
  setEvents: (evs) =>
    set((st) => {
      const events = { ...st.events }
      for (const e of evs) events[e.id] = e
      return { events }
    }),
  setSummary: (eventId, s) =>
    set((st) => ({ summaries: { ...st.summaries, [eventId]: s }, events: s.event ? { ...st.events, [eventId]: s.event } : st.events })),
  setLiveCount: (liveCount) => set({ liveCount }),
}))
