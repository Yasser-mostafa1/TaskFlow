/**
 * Minimal external store (no dependency) — state is a single immutable object,
 * subscribers are notified synchronously on change.
 */
import { logger } from '../core/logger'

export function createStore<T>(initial: T) {
  let state = initial
  const listeners = new Set<() => void>()

  return {
    get: (): T => state,
    set(next: T): void {
      if (Object.is(next, state)) return
      state = next
      listeners.forEach((listener) => {
        try {
          listener()
        } catch (err) {
          logger.errorObj('store.listener.failed', err)
        }
      })
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export type Store<T> = ReturnType<typeof createStore<T>>
