import { createStore } from './createStore'
import { reducer, type Action } from './reducer'
import type { AppState } from '../core/types'

export interface AppStore {
  get: () => AppState
  subscribe: (listener: () => void) => () => void
  dispatch: (action: Action) => void
}

export function createAppStore(initial: AppState): AppStore {
  const store = createStore(initial)
  return {
    get: store.get,
    subscribe: store.subscribe,
    dispatch: (action: Action) => store.set(reducer(store.get(), action)),
  }
}

export const EMPTY_STATE: AppState = {
  tasks: [],
  projects: [],
  tags: [],
  sessions: [],
  attachments: [],
  timer: { taskId: null, startedAt: null, accumulatedMs: 0 },
}
