/**
 * Safe, asynchronous, redacting logger.
 *
 * Rules (spec §18):
 *  - Non-blocking: every call only pushes to a buffer and schedules one flush.
 *  - Only basic levels: debug | info | warn | error.
 *  - Console output happens in dev only; production keeps a bounded ring buffer
 *    that Settings → Diagnostics can read.
 *  - Never logs user content (titles, descriptions, notes, file names, payloads).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  t: number
  level: LogLevel
  event: string
  fields?: Record<string, string | number | boolean>
}

const MAX_ENTRIES = 200
const MAX_STRING = 64

const ring: LogEntry[] = []
let pending: LogEntry[] = []
let scheduled = false

/** Keys that must never reach the log, whatever the caller passes. */
const FORBIDDEN_KEY = /(title|description|name|note|content|label|query|comment|body|text|value|path|url)/i

function sanitize(
  fields: Record<string, string | number | boolean> | undefined,
): Record<string, string | number | boolean> | undefined {
  if (!fields) return undefined
  const out: Record<string, string | number | boolean> = {}
  for (const [key, raw] of Object.entries(fields)) {
    if (FORBIDDEN_KEY.test(key)) continue
    if (typeof raw === 'string') {
      out[key] = raw.length > MAX_STRING ? `${raw.slice(0, MAX_STRING)}…` : raw
    } else {
      out[key] = raw
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function flush(): void {
  scheduled = false
  if (pending.length === 0) return
  const batch = pending
  pending = []
  for (const entry of batch) {
    ring.push(entry)
    if (ring.length > MAX_ENTRIES) ring.splice(0, ring.length - MAX_ENTRIES)
    const isDev =
      typeof import.meta !== 'undefined' &&
      import.meta.env?.DEV === true &&
      import.meta.env?.MODE !== 'test'
    if (!isDev) continue
    const method =
      entry.level === 'error'
        ? 'error'
        : entry.level === 'warn'
          ? 'warn'
          : entry.level === 'debug'
            ? 'debug'
            : 'info'
    const consoleFn = console[method]
    if (typeof consoleFn === 'function') consoleFn(`[${entry.event}]`, entry.fields ?? '')
  }
}

function push(level: LogLevel, event: string, fields?: Record<string, string | number | boolean>): void {
  try {
    const safe = sanitize(fields)
    pending.push({ t: Date.now(), level, event, fields: safe })
    if (pending.length > MAX_ENTRIES) pending.splice(0, pending.length - MAX_ENTRIES)
    if (!scheduled) {
      scheduled = true
      queueMicrotask(flush)
    }
  } catch {
    /* logging must never break the app */
  }
}

export const logger = {
  debug: (event: string, fields?: Record<string, string | number | boolean>) => push('debug', event, fields),
  info: (event: string, fields?: Record<string, string | number | boolean>) => push('info', event, fields),
  warn: (event: string, fields?: Record<string, string | number | boolean>) => push('warn', event, fields),
  error: (event: string, fields?: Record<string, string | number | boolean>) => push('error', event, fields),
  /** Error objects are reduced to name + truncated message (never a payload). */
  errorObj: (event: string, err: unknown, fields?: Record<string, string | number | boolean>) => {
    const e = err as { name?: string; message?: string } | undefined
    push('error', event, {
      ...fields,
      err: e?.name ?? 'Error',
      msg: typeof e?.message === 'string' ? e.message : 'unknown',
    })
  },
  /** Snapshot of the ring buffer for the diagnostics view. */
  drain: (): LogEntry[] => ring.slice(),
}
