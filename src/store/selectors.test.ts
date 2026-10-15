import { describe, expect, it } from 'vitest'
import { makeState, makeTask } from '../test/factories'
import { makeProject } from '../test/factories'
import {
  attentionTasks,
  computeStats,
  DEFAULT_FILTER,
  indexTasks,
  isOverdue,
  blockInfo,
  nextOrder,
  selectFiltered,
  subtaskProgress,
  trackedMs,
  weeklyActivity,
  wouldCreateCycle,
} from './selectors'

const NOW = new Date(2026, 9, 12, 10, 0) // 2026-10-12 local

describe('progress and dependencies', () => {
  it('computes subtask progress accurately', () => {
    const task = makeTask({
      subtasks: [
        { id: '1', title: 'a', done: true },
        { id: '2', title: 'b', done: false },
        { id: '3', title: 'c', done: true },
      ],
    })
    expect(subtaskProgress(task.subtasks)).toEqual({ done: 2, total: 3, percent: 67 })
    expect(subtaskProgress(makeTask().subtasks)).toEqual({ done: 0, total: 0, percent: 0 })
  })

  it('marks a task blocked until every dependency is completed', () => {
    const dep = makeTask({ status: 'in_progress' })
    const task = makeTask({ dependsOn: [dep.id] })
    const byId = indexTasks([dep, task])
    expect(blockInfo(task, byId)).toEqual({ blocked: true, pendingIds: [dep.id] })

    const finished = { ...dep, status: 'completed' as const }
    expect(blockInfo(task, indexTasks([finished, task])).blocked).toBe(false)
  })

  it('rejects circular dependencies', () => {
    const a = makeTask()
    const b = makeTask({ dependsOn: [a.id] })
    const c = makeTask({ dependsOn: [b.id] })
    const tasks = [a, b, c]
    expect(wouldCreateCycle(tasks, a.id, c.id)).toBe(true)
    expect(wouldCreateCycle(tasks, c.id, a.id)).toBe(false)
    expect(wouldCreateCycle(tasks, a.id, a.id)).toBe(true)
  })
})

describe('overdue rules', () => {
  it('flags overdue only for incomplete tasks past their due instant', () => {
    expect(isOverdue(makeTask({ dueDate: '2026-10-11' }), NOW)).toBe(true)
    expect(isOverdue(makeTask({ dueDate: '2026-10-12' }), NOW)).toBe(false)
    expect(isOverdue(makeTask({ dueDate: '2026-10-12' }), new Date(2026, 9, 13, 9, 0))).toBe(true)
    expect(isOverdue(makeTask({ dueDate: '2026-10-01', status: 'completed' }), NOW)).toBe(false)
    expect(isOverdue(makeTask({ dueDate: null }), NOW)).toBe(false)
  })
})

describe('statistics', () => {
  it('never fabricates a rate when there are no tasks', () => {
    const stats = computeStats(makeState(), NOW)
    expect(stats).toMatchObject({ total: 0, completionRate: 0, overdue: 0, dueToday: 0, blocked: 0 })
  })

  it('derives counts from real tasks', () => {
    const state = makeState({
      tasks: [
        makeTask({ status: 'completed', completedAt: NOW.getTime() }),
        makeTask({ dueDate: '2026-10-12' }),
        makeTask({ dueDate: '2026-10-10' }),
        makeTask({ dependsOn: ['ghost'], priority: 'high' }),
      ],
    })
    const stats = computeStats(state, NOW)
    expect(stats.total).toBe(4)
    expect(stats.completed).toBe(1)
    expect(stats.completionRate).toBe(0.25)
    expect(stats.completedToday).toBe(1)
    expect(stats.dueToday).toBe(1)
    expect(stats.overdue).toBe(1)
    expect(stats.blocked).toBe(0) // dependency missing entirely is not a block
  })

  it('reports attention items sorted by due date', () => {
    const state = makeState({
      tasks: [
        makeTask({ title: 'ok', dueDate: '2026-10-20' }),
        makeTask({ title: 'late', dueDate: '2026-10-01' }),
        makeTask({ title: 'blocked', dependsOn: ['x'] }),
      ],
    })
    // 'blocked' has no real dependency record → not blocked; only 'late' is attention-worthy
    expect(attentionTasks(state, NOW).map((t) => t.title)).toEqual(['late'])
  })
})

describe('filtering and sorting', () => {
  const state = makeState({
    tasks: [
      makeTask({ title: 'Buy milk', priority: 'low', dueDate: '2026-10-20' }),
      makeTask({ title: 'Fix login bug', priority: 'high', dueDate: '2026-10-10' }),
      makeTask({ title: 'Ship release', status: 'completed', priority: 'medium' }),
    ],
  })

  it('filters by query across title', () => {
    const result = selectFiltered(state, { ...DEFAULT_FILTER, query: 'login' }, 'manual', NOW)
    expect(result.map((t) => t.title)).toEqual(['Fix login bug'])
  })

  it('filters by scope', () => {
    expect(selectFiltered(state, { ...DEFAULT_FILTER, scope: 'active' }, 'manual', NOW)).toHaveLength(2)
    expect(selectFiltered(state, { ...DEFAULT_FILTER, scope: 'completed' }, 'manual', NOW)).toHaveLength(1)
    expect(selectFiltered(state, { ...DEFAULT_FILTER, scope: 'overdue' }, 'manual', NOW)).toHaveLength(1)
  })

  it('sorts by due date with nulls last and by priority high-first', () => {
    const byDue = selectFiltered(state, DEFAULT_FILTER, 'due', NOW)
    expect(byDue.map((t) => t.title)).toEqual(['Fix login bug', 'Buy milk', 'Ship release'])
    const byPriority = selectFiltered(state, DEFAULT_FILTER, 'priority', NOW)
    expect(byPriority[0]?.priority).toBe('high')
  })

  it('assigns the next free order value', () => {
    expect(nextOrder([makeTask({ order: 3 }), makeTask({ order: 7 })])).toBe(8)
    expect(nextOrder([])).toBe(0)
  })
})

describe('time and activity', () => {
  it('adds recorded sessions and the live timer', () => {
    const task = makeTask()
    const state = makeState({
      sessions: [
        { id: 's1', taskId: task.id, startedAt: 1000, endedAt: 4000, durationMs: 3000, createdAt: 4000 },
        { id: 's2', taskId: task.id, startedAt: 5000, endedAt: 9000, durationMs: 4000, createdAt: 9000 },
      ],
      timer: { taskId: task.id, startedAt: 20_000, accumulatedMs: 1000, targetMs: null },
    })
    expect(trackedMs(state, task.id, 25_000)).toBe(7000 + 1000 + 5000)
    expect(trackedMs(state, 'other', 25_000)).toBe(0)
  })

  it('summarizes the last seven local days without inventing activity', () => {
    const state = makeState({
      tasks: [makeTask({ status: 'completed', completedAt: NOW.getTime() })],
      sessions: [{ id: 's', taskId: 't', startedAt: NOW.getTime(), endedAt: NOW.getTime() + 60_000, durationMs: 60_000, createdAt: NOW.getTime() }],
    })
    const week = weeklyActivity(state, NOW)
    expect(week).toHaveLength(7)
    expect(week[6]?.key).toBe('2026-10-12')
    expect(week[6]?.completed).toBe(1)
    expect(week[6]?.minutes).toBe(1)
    expect(week.slice(0, 6).every((day) => day.completed === 0 && day.minutes === 0)).toBe(true)
  })
})

describe('project linkage', () => {
  it('keeps tasks pointing at real projects', () => {
    const project = makeProject()
    const state = makeState({ projects: [project], tasks: [makeTask({ projectId: project.id })] })
    expect(state.tasks[0]?.projectId).toBe(project.id)
  })
})

describe("scope 'today' (dashboard deep-link)", () => {
  const state = makeState({
    tasks: [
      makeTask({ title: 'today', dueDate: '2026-10-12' }),
      makeTask({ title: 'today done', dueDate: '2026-10-12', status: 'completed' }),
      makeTask({ title: 'later', dueDate: '2026-10-15' }),
      makeTask({ title: 'late', dueDate: '2026-10-11' }),
      makeTask({ title: 'no due date', dueDate: null }),
    ],
  })

  it('keeps only incomplete tasks due today', () => {
    const result = selectFiltered(state, { ...DEFAULT_FILTER, scope: 'today' }, 'manual', NOW)
    expect(result.map((task) => task.title)).toEqual(['today'])
  })
})
