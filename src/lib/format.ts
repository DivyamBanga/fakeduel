const TZ_ABBR: Record<string, string> = { EDT: 'ET', EST: 'ET', CDT: 'CT', CST: 'CT', MDT: 'MT', MST: 'MT', PDT: 'PT', PST: 'PT', ADT: 'AT', AST: 'AT', NDT: 'NT', NST: 'NT', BST: 'UK', GMT: 'GMT' }

export function tzLabel(d = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(d)
    const tz = parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
    return TZ_ABBR[tz] ?? tz.replace(/^GMT[+-]\d+$/, (m) => m)
  } catch {
    return ''
  }
}

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

function timeStr(d: Date): string {
  let h = d.getHours()
  const m = d.getMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `${h}:${String(m).padStart(2, '0')}${ampm}`
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** "SUN 1:00PM ET" · "2:21PM ET" (today) · "FEB 14, 2027, 6:35PM ET" (far). */
export function formatStartTime(iso: string, now = new Date()): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const tz = tzLabel(d)
  const diff = d.getTime() - now.getTime()
  if (sameDay(d, now)) return `${timeStr(d)} ${tz}`
  if (diff < 6 * 86400_000 && diff > -86400_000) return `${DAYS[d.getDay()]} ${timeStr(d)} ${tz}`
  const yr = d.getFullYear() !== now.getFullYear() ? `, ${d.getFullYear()}` : ''
  return `${MONTHS[d.getMonth()]} ${d.getDate()}${yr}, ${timeStr(d)} ${tz}`
}

/** "Sun, Sep 13" */
export function formatDateShort(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** "Today" / "Tomorrow" / "Sun, Sep 13" */
export function formatDayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso)
  if (sameDay(d, now)) return 'Today'
  const tmr = new Date(now.getTime() + 86400_000)
  if (sameDay(d, tmr)) return 'Tomorrow'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${timeStr(d)} ${tzLabel(d)}`
}

/** "Sep 11, 2026 · 11:32AM" */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${timeStr(d)} ${tzLabel(d)}`
}

/** "STARTS IN 6 HOURS" style */
export function startsIn(iso: string, now = new Date()): string {
  const diff = new Date(iso).getTime() - now.getTime()
  if (diff <= 0) return 'STARTING SOON'
  const mins = Math.round(diff / 60000)
  if (mins < 60) return `STARTS IN ${mins} MIN${mins === 1 ? '' : 'S'}`
  const hrs = Math.round(mins / 60)
  if (hrs < 48) return `STARTS IN ${hrs} HOUR${hrs === 1 ? '' : 'S'}`
  const days = Math.round(hrs / 24)
  return `STARTS IN ${days} DAYS`
}

export function pluralize(n: number, word: string, plural = word + 's'): string {
  return `${n} ${n === 1 ? word : plural}`
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}
