import { describe, expect, it } from 'vitest'
import {
  addDaysKey,
  dateKey,
  dueInstant,
  formatClock,
  formatDue,
  isValidDateValue,
  monthGridKeys,
  parseLocal,
  startOfWeekKey,
  timeKey,
} from './dates'

describe('local-naive dates', () => {
  it('round-trips date-only values without shifting the day', () => {
    const key = '2026-03-15'
    const parsed = parseLocal(key)
    expect(dateKey(parsed)).toBe(key)
    expect(parsed.getHours()).toBe(0)
    expect(timeKey(parsed)).toBe('2026-03-15T00:00')
  })

  it('round-trips date-time values as local wall-clock time', () => {
    const stamp = '2026-11-04T18:30'
    const parsed = parseLocal(stamp)
    expect(timeKey(parsed)).toBe(stamp)
    expect(parsed.getHours()).toBe(18)
    expect(parsed.getMinutes()).toBe(30)
  })

  it('never accepts impossible calendar values', () => {
    expect(isValidDateValue('2026-02-30')).toBe(false)
    expect(isValidDateValue('2026-13-01')).toBe(false)
    expect(isValidDateValue('2026-10-12T25:00')).toBe(false)
    expect(isValidDateValue('2026-10-12')).toBe(true)
    expect(isValidDateValue('2026-10-12T09:05')).toBe(true)
  })

  it('labels Today/Tomorrow from the stored local day', () => {
    const now = new Date(2026, 2, 15, 9, 0)
    expect(formatDue('2026-03-15', now)).toBe('Today')
    expect(formatDue('2026-03-16', now)).toBe('Tomorrow')
    expect(formatDue('2026-03-14', now)).toBe('Yesterday')
    expect(formatDue('2026-03-25', now)).toBe('Mar 25')
  })

  it('considers a date-only task overdue only after its day ends', () => {
    const endOfDay = new Date(2026, 9, 12, 23, 0)
    const nextDay = new Date(2026, 9, 13, 0, 1)
    expect(dueInstant('2026-10-12').getTime()).toBeGreaterThan(endOfDay.getTime())
    expect(dueInstant('2026-10-12').getTime()).toBeLessThan(nextDay.getTime())
  })

  it('builds a Monday-first 42-day month grid that covers the month', () => {
    const keys = monthGridKeys(2026, 9) // October 2026
    expect(keys).toHaveLength(42)
    expect(keys[0]).toBe('2026-09-28')
    expect(keys[41]).toBe('2026-11-08')
    expect(keys.filter((k) => k.startsWith('2026-10'))).toHaveLength(31)
    const first = parseLocal(keys[0] as string)
    expect(first.getDay()).toBe(1) // Monday
  })

  it('adds days and starts weeks on Monday', () => {
    expect(addDaysKey('2026-10-12', 5)).toBe('2026-10-17')
    expect(addDaysKey('2026-10-12', -12)).toBe('2026-09-30')
    expect(startOfWeekKey('2026-10-12')).toBe('2026-10-12') // Monday
    expect(startOfWeekKey('2026-10-14')).toBe('2026-10-12') // Wednesday
    expect(startOfWeekKey('2026-10-18')).toBe('2026-10-12') // Sunday
  })

  it('formats elapsed time without inventing units', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(1_500_000)).toBe('25:00')
    expect(formatClock(3_723_000)).toBe('1:02:03')
  })
})
