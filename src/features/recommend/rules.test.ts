import { describe, expect, it } from 'vitest'
import { formatDue } from '../../core/dates'
import { makeState, makeTask } from '../../test/factories'
import { recommendNext } from './rules'

const NOW = new Date(2026, 9, 12, 10, 0) // 2026-10-12 local

describe('recommendation rules (G5)', () => {
  it('returns null when nothing is eligible', () => {
    expect(recommendNext(makeState(), NOW)).toBeNull()
    expect(recommendNext(makeState({ tasks: [makeTask({ status: 'completed' })] }), NOW)).toBeNull()
  })

  it('never recommends completed or blocked tasks', () => {
    const dependency = makeTask({ title: 'Dependency', dueDate: null })
    const blocked = makeTask({ title: 'Blocked work', dueDate: '2026-10-10', dependsOn: [dependency.id] })
    const done = makeTask({ title: 'Done work', status: 'completed', dueDate: '2026-10-09' })
    const open = makeTask({ title: 'Open work', dueDate: '2026-10-20' })

    const rec = recommendNext(makeState({ tasks: [dependency, blocked, done, open] }), NOW)

    expect(rec?.task.title).toBe('Open work')
  })

  it('ranks overdue first with the oldest deadline on top', () => {
    const older = makeTask({ title: 'Oldest late', dueDate: '2026-10-01' })
    const recent = makeTask({ title: 'Recent late', dueDate: '2026-10-11' })
    const today = makeTask({ title: 'Due today', dueDate: '2026-10-12' })

    const rec = recommendNext(makeState({ tasks: [recent, today, older] }), NOW)

    expect(rec?.task.title).toBe('Oldest late')
    expect(rec?.reason).toContain('Overdue since')
  })

  it('prefers due today over future deadlines regardless of priority', () => {
    const today = makeTask({ title: 'Today task', dueDate: '2026-10-12', priority: 'low' })
    const soon = makeTask({ title: 'Tomorrow task', dueDate: '2026-10-13', priority: 'high' })

    const rec = recommendNext(makeState({ tasks: [soon, today] }), NOW)

    expect(rec?.task.title).toBe('Today task')
    expect(rec?.reason).toBe('Due today')
  })

  it('keeps near deadlines ahead of work in progress', () => {
    const working = makeTask({ title: 'In progress', status: 'in_progress', dueDate: null })
    const soon = makeTask({ title: 'Due tomorrow', dueDate: '2026-10-13' })

    expect(recommendNext(makeState({ tasks: [working, soon] }), NOW)?.task.title).toBe('Due tomorrow')
  })

  it('prefers resumed work over distant deadlines', () => {
    const working = makeTask({ title: 'Started work', status: 'in_progress', dueDate: null })
    const distant = makeTask({ title: 'Next month', dueDate: '2026-11-20' })

    const rec = recommendNext(makeState({ tasks: [distant, working] }), NOW)

    expect(rec?.task.title).toBe('Started work')
    expect(rec?.reason).toContain('in progress')
  })

  it('breaks ties by priority, then deadline, then the shortest estimate', () => {
    const far = makeTask({ title: 'Far low', dueDate: '2026-10-25', priority: 'low' })
    const nearLow = makeTask({ title: 'Near low', dueDate: '2026-10-15', priority: 'low' })
    const nearHigh = makeTask({ title: 'Near high', dueDate: '2026-10-15', priority: 'high' })
    expect(recommendNext(makeState({ tasks: [far, nearLow, nearHigh] }), NOW)?.task.title).toBe('Near high')

    const long = makeTask({ title: 'Long task', dueDate: '2026-10-15', priority: 'high', estimateMinutes: 120 })
    const short = makeTask({ title: 'Short task', dueDate: '2026-10-15', priority: 'high', estimateMinutes: 15 })
    expect(recommendNext(makeState({ tasks: [long, short] }), NOW)?.task.title).toBe('Short task')
  })

  it('suggests tasks without a deadline last, with an honest reason', () => {
    const noDue = makeTask({ title: 'Someday', dueDate: null, priority: 'high' })
    const dueLater = makeTask({ title: 'Later', dueDate: '2026-12-01', priority: 'low' })
    expect(recommendNext(makeState({ tasks: [dueLater, noDue] }), NOW)?.task.title).toBe('Later')

    const medium = recommendNext(makeState({ tasks: [makeTask({ dueDate: null, priority: 'medium' })] }), NOW)
    expect(medium?.reason).toBe('No deadline')

    const high = recommendNext(makeState({ tasks: [makeTask({ dueDate: null, priority: 'high' })] }), NOW)
    expect(high?.reason).toBe('High priority, no deadline')
  })

  it('explains near deadlines with a human-readable label', () => {
    const tomorrow = makeTask({ title: 'Tomorrow thing', dueDate: '2026-10-13' })
    expect(recommendNext(makeState({ tasks: [tomorrow] }), NOW)?.reason).toBe('Due Tomorrow')

    const later = makeTask({ title: 'Later thing', dueDate: '2026-10-19' })
    expect(recommendNext(makeState({ tasks: [later] }), NOW)?.reason).toBe(`Due ${formatDue('2026-10-19', NOW)}`)
  })
})
