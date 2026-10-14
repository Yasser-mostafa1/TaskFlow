import { beforeEach, describe, expect, it } from 'vitest'
import { createAppStore, EMPTY_STATE } from './appStore'
import { attachPersistence } from './AppStoreContext'
import { reducer, type Action } from './reducer'
import { loadState, resetDBHandle, DB_NAME } from '../db/schema'
import { syncCollection, setMeta } from '../db/repos'
import { makeState, makeTask } from '../test/factories'
import type { AppState } from '../core/types'

function runReducer(state: AppState, ...actions: Action[]): AppState {
  return actions.reduce(reducer, state)
}

async function clearDatabase(): Promise<void> {
  resetDBHandle()
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
  resetDBHandle()
}

describe('persistence', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  it('round-trips tasks through IndexedDB', async () => {
    const task = makeTask({ title: 'Persist me' })
    await syncCollection('tasks', [task])

    const loaded = await loadState()
    expect(loaded.tasks).toHaveLength(1)
    expect(loaded.tasks[0]?.title).toBe('Persist me')
  })

  it('deletes records that no longer exist in memory', async () => {
    const a = makeTask()
    const b = makeTask()
    await syncCollection('tasks', [a, b])
    await syncCollection('tasks', [b])

    const loaded = await loadState()
    expect(loaded.tasks.map((t) => t.id)).toEqual([b.id])
  })

  it('drops corrupt records instead of failing the whole load', async () => {
    const good = makeTask()
    await syncCollection('tasks', [good])
    const db = await import('../db/schema').then((m) => m.getDB())
    await db?.put('tasks', { id: 'broken', title: '' } as never)

    const loaded = await loadState()
    expect(loaded.tasks.map((t) => t.id)).toEqual([good.id])
  })

  it('persists the timer in the meta store', async () => {
    await setMeta('timer', { taskId: 't1', startedAt: 123, accumulatedMs: 456 })
    const loaded = await loadState()
    expect(loaded.timer).toEqual({ taskId: 't1', startedAt: 123, accumulatedMs: 456 })
  })

  it('writes state changes after a dispatch and survives a reload', async () => {
    const store = createAppStore(makeState())
    const handle = attachPersistence(store, undefined, 0)
    const task = makeTask({ title: 'Written by dispatch' })
    store.dispatch({ type: 'task/add', task })
    await handle.flush()

    const reloaded = await loadState()
    expect(reloaded.tasks.map((t) => t.title)).toContain('Written by dispatch')
    handle.dispose()

    // A second store hydrating from disk sees the same data.
    const second = createAppStore(EMPTY_STATE)
    second.dispatch({ type: 'state/replace', state: await loadState() })
    expect(second.get().tasks).toHaveLength(1)
  })

  it('writes only the collection that changed', async () => {
    const store = createAppStore(makeState())
    const handle = attachPersistence(store, undefined, 0)
    store.dispatch({ type: 'timer/set', timer: { taskId: 'x', startedAt: 1, accumulatedMs: 2 } })
    await handle.flush()
    const loaded = await loadState()
    expect(loaded.timer.taskId).toBe('x')
    expect(loaded.tasks).toHaveLength(0)
    handle.dispose()
  })

  it('keeps the timer after reload', async () => {
    const store = createAppStore(makeState())
    const handle = attachPersistence(store, undefined, 0)
    store.dispatch({ type: 'timer/set', timer: { taskId: 'x', startedAt: 1, accumulatedMs: 2 } })
    await handle.flush()
    const loaded = await loadState()
    expect(loaded.timer.taskId).toBe('x')
    handle.dispose()
  })
})
