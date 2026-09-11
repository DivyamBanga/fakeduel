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

/* ------------------------- throttled, retrying fetch ------------------------- */

const MAX_CONCURRENT = 5
let active = 0
const queue: (() => void)[] = []

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active++
    return Promise.resolve()
  }
  return new Promise((resolve) => queue.push(() => { active++; resolve() }))
}

function release() {
  active--
  const next = queue.shift()
  if (next) next()
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Fetch JSON with a small concurrency limit and retries (ESPN's edge drops CORS headers when rate-limited). */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  await acquire()
  try {
    let lastErr: unknown
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, init)
        if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`)
        if (!res.ok) throw new NonRetryableError(`HTTP ${res.status} for ${url}`)
        return (await res.json()) as T
      } catch (e) {
        if (e instanceof NonRetryableError) throw e
        lastErr = e
        await sleep(400 * (attempt + 1) + Math.random() * 300)
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(`Failed to fetch ${url}`)
  } finally {
    release()
  }
}

class NonRetryableError extends Error {}

export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR
