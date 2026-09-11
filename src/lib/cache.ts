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

const MAX_PERSIST_BYTES = 48_000

function writeLS(key: string, entry: { exp: number; value: unknown }) {
  try {
    const json = JSON.stringify(entry)
    if (json.length > MAX_PERSIST_BYTES) return
    try {
      localStorage.setItem(LS_PREFIX + key, json)
    } catch {
      // quota: drop every cached API payload (they are all re-fetchable) and try once more
      clearCacheStorage()
      localStorage.setItem(LS_PREFIX + key, json)
    }
  } catch {
    /* private mode or still over quota: ignore */
  }
}

export function clearCacheStorage() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k?.startsWith(LS_PREFIX) || k?.startsWith('fd.pre.')) localStorage.removeItem(k)
    }
  } catch {
    /* ignore */
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

const PRIMARY_HOST = 'https://site.api.espn.com/'
const FALLBACK_HOST = 'https://site.web.api.espn.com/'

/** Fetch JSON with a small concurrency limit, retries, and an alternate ESPN host (the edge sometimes 403s or drops CORS headers). */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  await acquire()
  try {
    const candidates = url.startsWith(PRIMARY_HOST) ? [url, FALLBACK_HOST + url.slice(PRIMARY_HOST.length)] : [url]
    let lastErr: unknown
    for (let attempt = 0; attempt < 3; attempt++) {
      const target = candidates[Math.min(attempt, candidates.length - 1)]
      try {
        const res = await fetch(target, init)
        if (res.status === 429 || res.status === 403 || res.status >= 500) throw new Error(`HTTP ${res.status}`)
        if (!res.ok) throw new NonRetryableError(`HTTP ${res.status} for ${target}`)
        return (await res.json()) as T
      } catch (e) {
        if (e instanceof NonRetryableError) throw e
        lastErr = e
        await sleep(300 * (attempt + 1) + Math.random() * 300)
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
