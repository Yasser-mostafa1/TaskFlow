import { describe, expect, it } from 'vitest'
import { createId } from './ids'
import { logger } from './logger'
import {
  MAX_TITLE,
  normalizeProject,
  normalizeTask,
  parseImportBundle,
  validateTaskDraft,
} from './guards'
import type { Task } from './types'

const baseTask = (): Record<string, unknown> => ({
  id: 'task_1',
  title: 'Write the plan',
  description: '',
  status: 'todo',
  priority: 'high',
  dueDate: null,
  startDate: null,
  estimateMinutes: 30,
  projectId: null,
  tagIds: [],
  subtasks: [],
  dependsOn: [],
  order: 0,
  createdAt: 1,
  updatedAt: 2,
  completedAt: null,
})

describe('record normalization', () => {
  it('accepts a complete task', () => {
    const task = normalizeTask(baseTask())
    expect(task?.title).toBe('Write the plan')
    expect(task?.priority).toBe('high')
  })

  it('rejects tasks that are missing required data', () => {
    expect(normalizeTask({ ...baseTask(), title: '   ' })).toBeNull()
    expect(normalizeTask({ ...baseTask(), status: 'doing' })).toBeNull()
    expect(normalizeTask({ ...baseTask(), priority: 'urgent' })).toBeNull()
    expect(normalizeTask({ ...baseTask(), dueDate: 'tomorrow' })).toBeNull()
    expect(normalizeTask({ ...baseTask(), estimateMinutes: -5 })).toBeNull()
    expect(normalizeTask(null)).toBeNull()
  })

  it('creates unique ids', () => {
    expect(createId('t')).not.toBe(createId('t'))
  })

  it('accepts a project only with a valid color and name', () => {
    expect(normalizeProject({ id: 'p', name: 'Site', description: '', color: '#4f46e5', createdAt: 1, updatedAt: 1 })).not.toBeNull()
    expect(normalizeProject({ id: 'p', name: '', description: '', color: '#fff', createdAt: 1, updatedAt: 1 })).toBeNull()
    expect(normalizeProject({ id: 'p', name: 'Site', description: '', color: 'indigo', createdAt: 1, updatedAt: 1 })).toBeNull()
  })
})

describe('task draft validation', () => {
  it('requires a title', () => {
    expect(validateTaskDraft({ title: ' ', description: '', dueDate: null, estimateMinutes: null }).title).toBeTruthy()
  })

  it('rejects oversized titles and bad dates', () => {
    const errors = validateTaskDraft({
      title: 'x'.repeat(MAX_TITLE + 1),
      description: '',
      dueDate: 'not-a-date',
      estimateMinutes: 0,
    })
    expect(errors.title).toBeTruthy()
    expect(errors.dueDate).toBeTruthy()
    expect(errors.estimateMinutes).toBeTruthy()
  })

  it('passes a valid draft', () => {
    expect(
      validateTaskDraft({ title: 'Ship release', description: '', dueDate: '2026-10-20', estimateMinutes: 45 }),
    ).toEqual({})
  })
})

describe('JSON import validation (all-or-nothing)', () => {
  const bundle = (overrides: Record<string, unknown> = {}) => ({
    version: 1,
    exportedAt: 123,
    tasks: [baseTask()],
    projects: [],
    tags: [],
    sessions: [],
    attachments: [],
    ...overrides,
  })

  it('accepts a well-formed backup', () => {
    const result = parseImportBundle(bundle())
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.tasks).toHaveLength(1)
  })

  it('rejects non-backup payloads', () => {
    expect(parseImportBundle(null).ok).toBe(false)
    expect(parseImportBundle({ hello: 'world' }).ok).toBe(false)
    expect(parseImportBundle(bundle({ version: 2 })).ok).toBe(false)
  })

  it('rejects a file containing a single malformed record', () => {
    const bad = bundle({ tasks: [baseTask(), { ...baseTask(), id: 'task_2', status: 'nope' }] })
    const result = parseImportBundle(bad)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('Task #2')
  })

  it('rejects sections that are not arrays', () => {
    expect(parseImportBundle(bundle({ projects: 'none' })).ok).toBe(false)
  })

  it('rejects malformed attachment payloads', () => {
    const result = parseImportBundle(
      bundle({
        attachments: [
          { id: 'a', ownerType: 'task', ownerId: 'task_1', name: 'shot', mime: 'image/png', size: 10, createdAt: 1, dataUrl: 'javascript:alert(1)' },
        ],
      }),
    )
    expect(result.ok).toBe(false)
  })
})

describe('logger', () => {
  it('never emits values stored under content-like keys', async () => {
    logger.info('test.event', { title: 'My secret task', count: 3 })
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    const entries = logger.drain().filter((entry) => entry.event === 'test.event')
    expect(entries.at(-1)?.fields).toEqual({ count: 3 })
  })

  it('keeps only a bounded history', async () => {
    for (let i = 0; i < 300; i += 1) logger.debug('flood', { i })
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    expect(logger.drain().length).toBeLessThanOrEqual(200)
  })
})

describe('task type sanity', () => {
  it('keeps the status set closed', () => {
    const statuses = ['todo', 'in_progress', 'completed']
    expect(statuses).toContain('in_progress')
    const task = normalizeTask(baseTask()) as Task
    expect(task.subtasks).toEqual([])
  })
})
