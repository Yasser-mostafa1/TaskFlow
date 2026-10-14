import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'
import { logger } from '../core/logger'
import { setMeta, syncCollection } from '../db/repos'
import type { AppState } from '../core/types'
import type { AppStore } from './appStore'

const StoreContext = createContext<AppStore | null>(null)

const PERSISTED: Array<keyof AppState> = [
  'tasks',
  'projects',
  'tags',
  'sessions',
  'attachments',
  'timer',
]

export interface PersistenceHandle {
  flush: () => Promise<void>
  dispose: () => void
}

/**
 * Writes every collection whose array reference changed since the last write,
 * coalescing bursts (drag, typing) into one batched IndexedDB transaction.
 */
export function attachPersistence(
  store: AppStore,
  onError?: (message: string) => void,
  delayMs = 80,
): PersistenceHandle {
  let previous = store.get()
  const dirty = new Set<keyof AppState>()
  let timer: ReturnType<typeof setTimeout> | null = null

  const flush = async (): Promise<void> => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    const pending = [...dirty]
    dirty.clear()
    for (const key of pending) {
      try {
        const value = store.get()[key]
        if (key === 'timer') await setMeta('timer', value)
        else await syncCollection(key, value as never)
      } catch (err) {
        logger.errorObj('persistence.write.failed', err, { collection: key })
        onError?.('Changes could not be saved to local storage.')
      }
    }
  }

  const unsubscribe = store.subscribe(() => {
    const next = store.get()
    for (const key of PERSISTED) {
      if (!Object.is(previous[key], next[key])) dirty.add(key)
    }
    previous = next
    if (dirty.size > 0 && timer === null) {
      timer = setTimeout(() => {
        timer = null
        void flush()
      }, delayMs)
    }
  })

  return {
    flush,
    dispose: () => {
      unsubscribe()
      if (timer !== null) clearTimeout(timer)
      timer = null
      dirty.clear()
    },
  }
}

export function AppStoreProvider({
  store,
  children,
}: {
  store: AppStore
  children: ReactNode
}) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useAppStore(): AppStore {
  const store = useContext(StoreContext)
  if (!store) {
    logger.error('store.missing')
    throw new Error('useAppStore must be used inside <AppStoreProvider>')
  }
  return store
}

/** Subscribes to the whole state object (stable reference between changes). */
export function useAppState(): AppState {
  const store = useAppStore()
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}

export function useDispatch(): (action: Parameters<AppStore['dispatch']>[0]) => void {
  return useAppStore().dispatch
}
