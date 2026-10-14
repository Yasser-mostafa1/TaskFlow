import { describe, expect, it } from 'vitest'
import { makeProject, makeState, makeTag, makeTask } from '../test/factories'
import { applyMove, reducer, type Action } from './reducer'

const run = (state = makeState(), ...actions: Action[]) =>
  actions.reduce(reducer, state)

describe('task actions', () => {
  it('adds and updates a task with a fresh timestamp', () => {
    const task = makeTask({ title: 'First' })
    let state = run(makeState(), { type: 'task/add', task })
    expect(state.tasks).toHaveLength(1)

    state = run(state, { type: 'task/update', id: task.id, patch: { title: 'Renamed' } })
    expect(state.tasks[0]?.title).toBe('Renamed')
    expect(state.tasks[0]?.updatedAt).toBeGreaterThanOrEqual(task.updatedAt)
  })

  it('records a completion timestamp only when a task becomes completed', () => {
    const task = makeTask()
    let state = run(makeState(), { type: 'task/add', task })
    state = run(state, { type: 'task/setStatus', ids: [task.id], status: 'completed' })
    expect(state.tasks[0]?.completedAt).not.toBeNull()

    state = run(state, { type: 'task/setStatus', ids: [task.id], status: 'todo' })
    expect(state.tasks[0]?.completedAt).toBeNull()
  })

  it('cascades deletion: sessions, attachments, dependencies and the timer', () => {
    const target = makeTask()
    const other = makeTask({ dependsOn: [target.id] })
    const project = makeProject()
    const state = run(
      makeState({
        tasks: [target, other],
        sessions: [{ id: 's1', taskId: target.id, startedAt: 1, endedAt: 2, durationMs: 1000, createdAt: 2 }],
        timer: { taskId: target.id, startedAt: 5, accumulatedMs: 100 },
        attachments: [
          {
            id: 'a1',
            ownerType: 'task',
            ownerId: target.id,
            name: 'x.png',
            mime: 'image/png',
            size: 10,
            createdAt: 1,
            blob: new Blob(),
          },
        ],
      }),
      { type: 'task/remove', ids: [target.id] },
    )

    expect(state.tasks).toHaveLength(1)
    expect(state.tasks[0]?.dependsOn).toEqual([])
    expect(state.sessions).toHaveLength(0)
    expect(state.attachments).toHaveLength(0)
    expect(state.timer.taskId).toBeNull()
    expect(project.id).toBeTruthy()
  })

  it('moves a task across columns and renumbers the order', () => {
    const a = makeTask({ order: 0 })
    const b = makeTask({ order: 1 })
    const c = makeTask({ order: 2 })
    const state = run(
      makeState({ tasks: [a, b, c] }),
      { type: 'task/move', activeId: a.id, overId: c.id, position: 'after', status: 'in_progress' },
    )
    const moved = state.tasks.find((t) => t.id === a.id)
    expect(moved?.status).toBe('in_progress')
    expect(state.tasks.map((t) => t.order).sort()).toEqual([0, 1, 2])
    const ordered = [...state.tasks].sort((x, y) => x.order - y.order)
    expect(ordered.map((t) => t.id)).toEqual([b.id, c.id, a.id])
  })

  it('keeps completedAt consistent when a move completes a task', () => {
    const a = makeTask({ order: 0 })
    const state = run(
      makeState({ tasks: [a] }),
      { type: 'task/move', activeId: a.id, overId: null, position: 'after', status: 'completed' },
    )
    expect(state.tasks[0]?.status).toBe('completed')
    expect(state.tasks[0]?.completedAt).not.toBeNull()
  })
})

describe('project and tag actions', () => {
  it('never deletes tasks when a project is removed', () => {
    const project = makeProject()
    const inProject = makeTask({ projectId: project.id })
    const state = run(
      makeState({ projects: [project], tasks: [inProject] }),
      { type: 'project/remove', id: project.id },
    )
    expect(state.projects).toHaveLength(0)
    expect(state.tasks).toHaveLength(1)
    expect(state.tasks[0]?.projectId).toBeNull()
  })

  it('cleans tag references when a tag is removed', () => {
    const tag = makeTag()
    const task = makeTask({ tagIds: [tag.id] })
    const state = run(makeState({ tags: [tag], tasks: [task] }), { type: 'tag/remove', id: tag.id })
    expect(state.tasks[0]?.tagIds).toEqual([])
  })
})

describe('applyMove', () => {
  it('relocates before a target task', () => {
    const [a, b, c] = [makeTask(), makeTask(), makeTask()]
    const result = applyMove([a, b, c], c.id, a.id, 'before', undefined, Date.now())
    expect(result.map((t) => t.order).sort()).toEqual([0, 1, 2])
    expect(result.find((t) => t.order === 0)?.id).toBe(c.id)
  })

  it('keeps the input untouched when the active task does not exist', () => {
    const a = makeTask()
    const input = [a]
    const result = applyMove(input, 'missing', null, 'after', undefined, Date.now())
    expect(result).toBe(input)
  })
})

describe('state replacement', () => {
  it('swaps the whole state (import path)', () => {
    const next = makeState({ tasks: [makeTask()] })
    const state = run(makeState(), { type: 'state/replace', state: next })
    expect(state).toBe(next)
  })
})
