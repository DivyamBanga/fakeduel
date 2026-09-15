import type { LeagueDef } from '@/data/sports'
import { useOddsStore } from '@/store/odds'
import { liveLines } from './live'
import { resolveLines } from './markets'
import type { GameEvent, GameLines } from './types'

const PREFIX = 'fd.pre.'
const TTL = 3 * 86400_000
const mem = new Map<string, GameLines>()

function readPre(id: string): GameLines | null {
  const m = mem.get(id)
  if (m) return m
  try {
    const raw = localStorage.getItem(PREFIX + id)
    if (!raw) return null
    const { exp, lines } = JSON.parse(raw)
    if (exp < Date.now()) return null
    mem.set(id, lines)
    return lines
  } catch {
    return null
  }
}

function writePre(id: string, lines: GameLines) {
  mem.set(id, lines)
  try {
    localStorage.setItem(PREFIX + id, JSON.stringify({ exp: Date.now() + TTL, lines }))
  } catch {
    /* ignore */
  }
}

/** Pregame lines for an event; FanDuel's real lines when available, frozen at the last pregame observation once the game starts. */
export function getPregameLines(ev: GameEvent, league: LeagueDef): GameLines {
  if (ev.status.state !== 'pre') {
    const saved = readPre(ev.id)
    if (saved) return saved
  }
  const fd = useOddsStore.getState().lines[ev.id]
  const base = resolveLines(ev, league)
  const lines = fd ? { ...base, ...stripUndef(fd), provider: 'FanDuel', synthesized: false } : base
  if (ev.status.state === 'pre') writePre(ev.id, lines)
  return lines
}

function stripUndef<T extends object>(o: T): Partial<T> {
  const out: Partial<T> = {}
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] !== undefined) out[k] = o[k]
  return out
}

/** Lines to display now: live-modelled during play, pregame otherwise. */
export function getDisplayLines(ev: GameEvent, league: LeagueDef): { lines: GameLines; live: boolean; pregame: GameLines } {
  const pregame = getPregameLines(ev, league)
  if (ev.status.state === 'in') return { lines: liveLines(ev, league, pregame), live: true, pregame }
  return { lines: pregame, live: false, pregame }
}

export function pruneLineMemory() {
  try {
    const now = Date.now()
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (!k?.startsWith(PREFIX)) continue
      try {
        const { exp } = JSON.parse(localStorage.getItem(k) ?? '{}')
        if (!exp || exp < now) localStorage.removeItem(k)
      } catch {
        localStorage.removeItem(k)
      }
    }
  } catch {
    /* ignore */
  }
}
