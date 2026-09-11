const mem = new Map<string, { exp: number; value: unknown }>()
const inflight = new Map<string, Promise<unknown>>()

const LS_PREFIX = 'fd.cache.'

function readLS<T>(key: string): { exp: number; value: T } | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeLS(key: string, entry: { exp: number; value: unknown }) {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(entry))
  } catch {
    /* quota exceeded or private mode: ignore */
  }
}

export interface CacheOpts {
  ttl: number
  persist?: boolean
  force?: boolean
}

export async function cached<T>(key: string, fetcher: () => Promise<T>, opts: CacheOpts): Promise<T> {
  const now = Date.now()
  if (!opts.force) {
    const m = mem.get(key)
    if (m && m.exp > now) return m.value as T
    if (opts.persist) {
      const l = readLS<T>(key)
      if (l && l.exp > now) {
        mem.set(key, l)
        return l.value
      }
    }
  }
  const existing = inflight.get(key)
  if (existing) return existing as Promise<T>
  const p = (async () => {
    try {
      const value = await fetcher()
      const entry = { exp: Date.now() + opts.ttl, value }
      mem.set(key, entry)
      if (opts.persist) writeLS(key, entry)
      return value
    } finally {
      inflight.delete(key)
    }
  })()
  inflight.set(key, p)
  return p
}

export function peekCache<T>(key: string): T | undefined {
  const m = mem.get(key)
  if (m) return m.value as T
  const l = readLS<T>(key)
  return l?.value
}

export function pruneCacheStorage() {
  try {
    const now = Date.now()
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith(LS_PREFIX)) continue
      const raw = localStorage.getItem(k)
      if (!raw) continue
      try {
        const e = JSON.parse(raw)
        if (!e.exp || e.exp < now) localStorage.removeItem(k)
      } catch {
        localStorage.removeItem(k)
      }
    }
  } catch {
    /* ignore */
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.json() as Promise<T>
}

export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR
