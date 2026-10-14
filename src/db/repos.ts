import { logger } from '../core/logger'
import type { AppState, FocusSession, Project, Tag, Task } from '../core/types'
import { getDB, type CollectionName } from './schema'

type CollectionValue = Task | Project | Tag | FocusSession | AppState['attachments'][number]

interface CollectionTypes {
  tasks: Task
  projects: Project
  tags: Tag
  sessions: FocusSession
  attachments: AppState['attachments'][number]
}

/**
 * Makes the stored collection match the in-memory one exactly
 * (insert / update / delete in a single transaction).
 */
export async function syncCollection<K extends CollectionName>(
  name: K,
  records: CollectionTypes[K][],
): Promise<void> {
  const db = await getDB()
  if (!db) return
  const keep = new Set(records.map((r) => (r as { id: string }).id))
  const tx = db.transaction(name, 'readwrite')
  const store = tx.store
  const existingKeys = await store.getAllKeys()
  const removals: Promise<void>[] = []
  for (const key of existingKeys) {
    if (!keep.has(key as string)) removals.push(store.delete(key) as Promise<void>)
  }
  const writes = records.map((record) => store.put(record as CollectionValue))
  await Promise.all([...removals, ...writes, tx.done])
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getDB()
  if (!db) return
  await db.put('meta', { key, value }, key)
}

/** Wraps a persistence failure so callers can toast without breaking state. */
export class PersistenceError extends Error {
  constructor(collection: string, cause: unknown) {
    super(`Could not save ${collection}`)
    this.name = 'PersistenceError'
    logger.errorObj('db.sync.failed', cause, { collection })
  }
}
