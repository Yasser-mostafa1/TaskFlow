/**
 * Local-naive date utilities (spec §15).
 *
 * Every stored value is 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm' WITHOUT an offset,
 * and is parsed as local wall-clock time. We never round-trip through
 * `toISOString()` on display paths, so a date-only task can never drift to a
 * neighbouring day in a different timezone.
 */

const pad = (n: number): string => String(n).padStart(2, '0')

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function timeKey(d: Date): string {
  return `${dateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function todayKey(now: Date = new Date()): string {
  return dateKey(now)
}

export function nowStamp(): number {
  return Date.now()
}

export function isDateOnly(value: string): boolean {
  return value.length === 10
}

const KEY_RE = /^\d{4}-\d{2}-\d{2}$/
const STAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

export function isValidDateValue(value: string): boolean {
  if (KEY_RE.test(value)) {
    const d = parseLocal(value)
    return dateKey(d) === value
  }
  if (STAMP_RE.test(value)) {
    const d = parseLocal(value)
    return timeKey(d) === value
  }
  return false
}

/** Parses 'YYYY-MM-DD' and 'YYYY-MM-DDTHH:mm' as LOCAL time (never UTC). */
export function parseLocal(value: string): Date {
  return new Date(value.length === 10 ? `${value}T00:00` : value)
}

/** The instant a due value is considered missed: end of day for date-only tasks. */
export function dueInstant(value: string): Date {
  return isDateOnly(value) ? parseLocal(`${value}T23:59`) : parseLocal(value)
}

export function isSameKey(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10)
}

export function addDaysKey(key: string, days: number): string {
  const d = parseLocal(key.slice(0, 10))
  d.setDate(d.getDate() + days)
  return dateKey(d)
}

/** Week starts on Monday. */
export function startOfWeekKey(key: string): string {
  const d = parseLocal(key.slice(0, 10))
  const shift = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - shift)
  return dateKey(d)
}

/** 42 keys (6 rows × 7 days) covering the requested month, Monday first. */
export function monthGridKeys(year: number, month: number): string[] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - offset)
  const keys: string[] = []
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    keys.push(dateKey(d))
  }
  return keys
}

export function daysBetween(fromKey: string, toKey: string): number {
  const a = parseLocal(fromKey.slice(0, 10)).getTime()
  const b = parseLocal(toKey.slice(0, 10)).getTime()
  return Math.round((b - a) / 86_400_000)
}

const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
const shortFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
const longFmt = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

/** 'Today' | 'Tomorrow' | 'Yesterday' | 'Wed' | 'Oct 15' for a date-only key. */
export function formatDueDate(value: string, now: Date = new Date()): string {
  const key = value.slice(0, 10)
  const delta = daysBetween(dateKey(now), key)
  if (delta === 0) return 'Today'
  if (delta === 1) return 'Tomorrow'
  if (delta === -1) return 'Yesterday'
  if (delta > 1 && delta < 7) return weekdayFmt.format(parseLocal(key))
  return shortFmt.format(parseLocal(key))
}

/** Human label for a due value, including the time when one is stored. */
export function formatDue(value: string, now: Date = new Date()): string {
  const datePart = formatDueDate(value, now)
  if (isDateOnly(value)) return datePart
  return `${datePart}, ${timeFmt.format(parseLocal(value))}`
}

export function formatDayHeading(key: string): string {
  return longFmt.format(parseLocal(key.slice(0, 10)))
}

export function formatMonth(year: number, month: number): string {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(
    new Date(year, month, 1),
  )
}

/** '1h 30m' | '45m' | '0m' — never fabricated rounding up to hours. */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/** '25:03' | '1:02:03' — elapsed clock for the focus timer. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** Chronological comparator for due values; nulls last. */
export function compareDue(a: string | null, b: string | null): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a.localeCompare(b)
}

/** Greeting tied to the actual local hour. */
export function greeting(now: Date = new Date()): string {
  const h = now.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
