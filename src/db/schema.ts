import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { normalizeTask } from '../core/guards'
import { logger } from '../core/logger'
import type { AppState, FocusSession, Project, Tag, Task, TimerState } from '../core/types'

export const DB_NAME = 'taskflow'
export const DB_VERSION = 1

export type CollectionName = 'tasks' | 'projects' | 'tags' | 'sessions' | 'attachments'

export interface TaskflowDB extends DBSchema {
  tasks: { key: string; value: Task }
  projects: { key: string; value: Project }
  tags: { key: string; value: Tag }
  sessions: { key: string; value: FocusSession }
  attachments: { key: string; value: AppState['attachments'][number] }
  meta: { key: string; value: { key: string; value: unknown } }
}

export const EMPTY_TIMER: TimerState = { taskId: null, startedAt: null, accumulatedMs: 0 }

let dbPromise: Promise<IDBPDatabase<TaskflowDB> | null> | null = null

/** Opens (once) and upgrades the database. Returns null when storage is unavailable. */
export function getDB(): Promise<IDBPDatabase<TaskflowDB> | null> {
  if (dbPromise) return dbPromise
  dbPromise = openDB<TaskflowDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('tasks')) db.createObjectStore('tasks', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('tags')) db.createObjectStore('tags', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('attachments')) db.createObjectStore('attachments', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta')
    },
  })
    .then((db) => {
      logger.info('db.open', { version: DB_VERSION })
      return db
    })
    .catch((err: unknown) => {
      logger.errorObj('db.open.failed', err)
      return null
    })
  return dbPromise
}

/** Test/support hook: closes the current connection so the DB can be reset. */
export function resetDBHandle(): void {
  const pending = dbPromise
  dbPromise = null
  void pending?.then((db) => db?.close())
}

export interface LoadedState {
  tasks: Task[]
  projects: Project[]
  tags: Tag[]
  sessions: FocusSession[]
  attachments: AppState['attachments']
  timer: TimerState
}

/**
 * Reads everything back defensively: a corrupt record is skipped (and counted)
 * instead of taking the whole application down.
 */
export async function loadState(): Promise<LoadedState> {
  const db = await getDB()
  if (!db) {
    return { tasks: [], projects: [], tags: [], sessions: [], attachments: [], timer: { ...EMPTY_TIMER } }
  }
  try {
    const [rawTasks, projects, tags, sessions, attachments, timerMeta] = await Promise.all([
      db.getAll('tasks'),
      db.getAll('projects'),
      db.getAll('tags'),
      db.getAll('sessions'),
      db.getAll('attachments'),
      db.get('meta', 'timer'),
    ])

    const tasks: Task[] = []
    let dropped = 0
    rawTasks.forEach((raw, index) => {
      const task = normalizeTask(raw, index)
      if (task) tasks.push(task)
      else dropped += 1
    })
    if (dropped > 0) logger.warn('db.records.dropped', { collection: 'tasks', count: dropped })

    const timer = timerMeta?.value
    const safeTimer: TimerState =
      timer &&
      typeof timer === 'object' &&
      (timer as TimerState).taskId !== undefined &&
      typeof (timer as TimerState).accumulatedMs === 'number'
        ? (timer as TimerState)
        : { ...EMPTY_TIMER }

    logger.info('db.load', {
      tasks: tasks.length,
      projects: projects.length,
      tags: tags.length,
      sessions: sessions.length,
      attachments: attachments.length,
    })

    return { tasks, projects, tags, sessions, attachments, timer: safeTimer }
  } catch (err) {
    logger.errorObj('db.load.failed', err)
    throw err
  }
}
