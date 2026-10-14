import { describe, expect, it } from 'vitest'
import { makeState, makeTask } from '../../test/factories'
import { reducer } from '../../store/reducer'
import { groupByStatus, resolveKanbanMove } from './kanban'

describe('groupByStatus', () => {
  it('collects tasks into the three columns sorted by stored order', () => {
    const first = makeTask({ order: 0 })
    const second = makeTask({ order: 1 })
    const running = makeTask({ order: 2, status: 'in_progress' })
    const done = makeTask({ order: 3, status: 'completed' })

    const grouped = groupByStatus([done, second, running, first])
    expect(grouped.todo.map((t) => t.id)).toEqual([first.id, second.id])
    expect(grouped.in_progress.map((t) => t.id)).toEqual([running.id])
    expect(grouped.completed.map((t) => t.id)).toEqual([done.id])
  })
})

describe('resolveKanbanMove', () => {
  const a = makeTask({ order: 0 })
  const b = makeTask({ order: 1 })
  const c = makeTask({ order: 2, status: 'in_progress' })
  const tasks = [a, b, c]

  it('drops a task into an empty column and marks its status', () => {
    const action = resolveKanbanMove(tasks, { activeId: a.id, overId: 'completed' })
    expect(action).toMatchObject({ type: 'task/move', status: 'completed', overId: null, position: 'after' })

    const next = reducer(makeState({ tasks }), action!)
    const moved = next.tasks.find((t) => t.id === a.id)
    expect(moved?.status).toBe('completed')
    expect(moved?.completedAt).not.toBeNull()
    expect(next.tasks.map((t) => t.order).sort()).toEqual([0, 1, 2])
  })

  it('reorders inside a column using the pointer position', () => {
    const below = resolveKanbanMove(tasks, {
      activeId: a.id,
      overId: b.id,
      activeRect: { top: 60, height: 20 },
      overRect: { top: 0, height: 20 },
    })
    expect(below).toMatchObject({ position: 'after', status: 'todo' })

    const above = resolveKanbanMove(tasks, {
      activeId: b.id,
      overId: a.id,
      activeRect: { top: 0, height: 20 },
      overRect: { top: 60, height: 20 },
    })
    expect(above).toMatchObject({ position: 'before', status: 'todo' })

    const next = reducer(makeState({ tasks }), below!)
    const order = [...next.tasks].sort((x, y) => x.order - y.order).map((t) => t.id)
    expect(order).toEqual([b.id, a.id, c.id])
  })

  it('moves across columns onto another card', () => {
    const action = resolveKanbanMove(tasks, {
      activeId: a.id,
      overId: c.id,
      activeRect: { top: 0, height: 20 },
      overRect: { top: 40, height: 20 },
    })
    expect(action).toMatchObject({ status: 'in_progress', position: 'before' })

    const next = reducer(makeState({ tasks }), action!)
    const moved = next.tasks.find((t) => t.id === a.id)
    expect(moved?.status).toBe('in_progress')
    expect(moved?.completedAt).toBeNull()
    const column = next.tasks.filter((t) => t.status === 'in_progress').sort((x, y) => x.order - y.order)
    expect(column.map((t) => t.id)).toEqual([a.id, c.id])
  })

  it('is a no-op when a task lands on itself', () => {
    expect(resolveKanbanMove(tasks, { activeId: a.id, overId: a.id })).toBeNull()
  })

  it('changes status when a task is dropped on itself in another column', () => {
    const action = resolveKanbanMove(tasks, { activeId: a.id, overId: 'in_progress' })
    expect(action).toMatchObject({ status: 'in_progress' })
    const next = reducer(makeState({ tasks }), action!)
    expect(next.tasks.find((t) => t.id === a.id)?.status).toBe('in_progress')
  })

  it('ignores an unknown active task', () => {
    expect(resolveKanbanMove(tasks, { activeId: 'ghost', overId: 'todo' })).toBeNull()
  })

  it('keeps every column contiguous after repeated moves', () => {
    let state = makeState({ tasks })
    const moves = [
      { activeId: a.id, overId: 'completed' },
      { activeId: c.id, overId: 'todo' },
      { activeId: b.id, overId: 'in_progress' },
    ]
    for (const move of moves) {
      const action = resolveKanbanMove(state.tasks, move)
      if (action) state = reducer(state, action)
    }
    expect(state.tasks.map((t) => t.order).sort()).toEqual([0, 1, 2])
    expect(state.tasks.map((t) => t.status).sort()).toEqual(['completed', 'in_progress', 'todo'])
  })
})
