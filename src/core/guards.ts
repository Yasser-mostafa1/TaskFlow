/**
 * Hand-written validation (no schema library, by decision — see PROJECT_MAP).
 * Used by forms and by JSON import; every rejection carries a precise reason.
 */

import { isValidDateValue } from './dates'
import { PRIORITIES, TASK_STATUSES } from './types'
import type {
  FocusSession,
  Priority,
  Project,
  Subtask,
  Tag,
  Task,
  TaskStatus,
} from './types'

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const nullableStr = (v: unknown): string | null | undefined =>
  v === null || v === undefined ? null : str(v)
const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const nullableNum = (v: unknown): number | null | undefined =>
  v === null || v === undefined ? null : num(v)

const idList = (v: unknown): string[] | null =>
  Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null

export const MAX_TITLE = 300
export const MAX_DESCRIPTION = 5000
export const MAX_NAME = 80
export const MAX_ESTIMATE_MINUTES = 60 * 24 * 30

function readStatus(v: unknown): TaskStatus | null {
  return typeof v === 'string' && (TASK_STATUSES as readonly string[]).includes(v)
    ? (v as TaskStatus)
    : null
}

function readPriority(v: unknown): Priority | null {
  return typeof v === 'string' && (PRIORITIES as readonly string[]).includes(v)
    ? (v as Priority)
    : null
}

function readDate(v: unknown): string | null | undefined {
  const s = nullableStr(v)
  if (s === undefined || s === null) return s
  return isValidDateValue(s) ? s : undefined
}

function readSubtasks(v: unknown): Subtask[] | null {
  if (!Array.isArray(v)) return null
  const out: Subtask[] = []
  for (const raw of v) {
    if (!isRecord(raw)) return null
    const id = str(raw.id)
    const title = str(raw.title)
    const done = bool(raw.done)
    if (id === null || title === null || done === null || title.trim() === '') return null
    out.push({ id, title, done })
  }
  return out
}

/** Returns a normalized Task or null when the record is structurally invalid. */
export function normalizeTask(raw: unknown, fallbackOrder = 0): Task | null {
  if (!isRecord(raw)) return null
  const id = str(raw.id)
  const rawTitle = str(raw.title)
  const title = rawTitle === null ? null : rawTitle.trim()
  const status = readStatus(raw.status)
  const priority = readPriority(raw.priority)
  if (
    id === null ||
    id === '' ||
    title === null ||
    title === '' ||
    title.length > MAX_TITLE ||
    status === null ||
    priority === null
  ) {
    return null
  }
  const description = str(raw.description)
  const dueDate = readDate(raw.dueDate)
  const startDate = readDate(raw.startDate)
  const estimate = nullableNum(raw.estimateMinutes)
  const projectId = nullableStr(raw.projectId)
  const tagIds = idList(raw.tagIds)
  const subtasks = readSubtasks(raw.subtasks)
  const dependsOn = idList(raw.dependsOn)
  const order = num(raw.order)
  const createdAt = num(raw.createdAt)
  const updatedAt = num(raw.updatedAt)
  const completedAt = nullableNum(raw.completedAt)

  if (
    description === null ||
    dueDate === undefined ||
    startDate === undefined ||
    estimate === undefined ||
    projectId === undefined ||
    tagIds === null ||
    subtasks === null ||
    dependsOn === null ||
    order === null ||
    createdAt === null ||
    updatedAt === null ||
    completedAt === undefined ||
    (estimate !== null && (estimate <= 0 || estimate > MAX_ESTIMATE_MINUTES))
  ) {
    return null
  }

  return {
    id,
    title,
    description,
    status,
    priority,
    dueDate,
    startDate,
    estimateMinutes: estimate === null ? null : Math.round(estimate),
    projectId,
    tagIds,
    subtasks,
    dependsOn,
    order,
    createdAt,
    updatedAt,
    completedAt,
  }
}

export function normalizeProject(raw: unknown, fallbackOrder = 0): Project | null {
  void fallbackOrder
  if (!isRecord(raw)) return null
  const id = str(raw.id)
  const rawName = str(raw.name)
  const name = rawName === null ? null : rawName.trim()
  const description = str(raw.description)
  const color = str(raw.color)
  const createdAt = num(raw.createdAt)
  const updatedAt = num(raw.updatedAt)
  if (
    id === null ||
    id === '' ||
    name === null ||
    name === '' ||
    name.length > MAX_NAME ||
    description === null ||
    color === null ||
    !/^#[0-9a-fA-F]{3,8}$/.test(color) ||
    createdAt === null ||
    updatedAt === null
  ) {
    return null
  }
  return { id, name, description, color, createdAt, updatedAt }
}

export function normalizeTag(raw: unknown): Tag | null {
  if (!isRecord(raw)) return null
  const id = str(raw.id)
  const rawName = str(raw.name)
  const name = rawName === null ? null : rawName.trim()
  const color = str(raw.color)
  const createdAt = num(raw.createdAt)
  if (
    id === null ||
    id === '' ||
    name === null ||
    name === '' ||
    name.length > MAX_NAME ||
    color === null ||
    !/^#[0-9a-fA-F]{3,8}$/.test(color) ||
    createdAt === null
  ) {
    return null
  }
  return { id, name, color, createdAt }
}

export function normalizeSession(raw: unknown): FocusSession | null {
  if (!isRecord(raw)) return null
  const id = str(raw.id)
  const taskId = str(raw.taskId)
  const startedAt = num(raw.startedAt)
  const endedAt = num(raw.endedAt)
  const durationMs = num(raw.durationMs)
  const createdAt = num(raw.createdAt)
  if (
    id === null ||
    taskId === null ||
    startedAt === null ||
    endedAt === null ||
    durationMs === null ||
    createdAt === null ||
    durationMs < 0 ||
    endedAt < startedAt
  ) {
    return null
  }
  return { id, taskId, startedAt, endedAt, durationMs, createdAt }
}

/* ----------------------------- Import bundle ----------------------------- */

/** Image bytes travel as a data URL inside JSON exports. */
export interface ExportAttachment {
  id: string
  ownerType: 'task' | 'project'
  ownerId: string
  name: string
  mime: string
  size: number
  createdAt: number
  dataUrl: string
}

export interface ImportBundle {
  version: 1
  exportedAt: number
  tasks: Task[]
  projects: Project[]
  tags: Tag[]
  sessions: FocusSession[]
  attachments: ExportAttachment[]
}

export type ImportResult =
  | { ok: true; data: ImportBundle }
  | { ok: false; error: string }

const ATTACHMENT_RE = /^data:image\/(png|jpe?g|gif|webp|avif|bmp);base64,[A-Za-z0-9+/]+={0,2}$/

function normalizeAttachment(raw: unknown, index: number): ExportAttachment | null {
  if (!isRecord(raw)) return null
  const id = str(raw.id)
  const ownerType = raw.ownerType
  const ownerId = str(raw.ownerId)
  const name = str(raw.name)
  const mime = str(raw.mime)
  const size = num(raw.size)
  const createdAt = num(raw.createdAt)
  const dataUrl = str(raw.dataUrl)
  if (
    id === null ||
    (ownerType !== 'task' && ownerType !== 'project') ||
    ownerId === null ||
    name === null ||
    mime === null ||
    size === null ||
    createdAt === null ||
    dataUrl === null ||
    !ATTACHMENT_RE.test(dataUrl)
  ) {
    void index
    return null
  }
  return { id, ownerType, ownerId, name, mime, size, createdAt, dataUrl }
}

function readArray(
  source: Record<string, unknown>,
  key: string,
): { ok: true; value: unknown[] } | { ok: false; error: string } {
  const value = source[key]
  if (!Array.isArray(value)) return { ok: false, error: `"${key}" must be an array` }
  return { ok: true, value }
}

/**
 * All-or-nothing import validation: a single malformed record rejects the file,
 * so existing data can never be half-overwritten.
 */
export function parseImportBundle(json: unknown): ImportResult {
  if (!isRecord(json)) return { ok: false, error: 'The file does not contain a TaskFlow backup.' }
  if (json.version !== 1) return { ok: false, error: 'Unsupported backup version.' }

  const sections: Array<keyof ImportBundle> = ['tasks', 'projects', 'tags', 'sessions', 'attachments']
  for (const key of sections) {
    const arr = readArray(json, key)
    if (!arr.ok) return { ok: false, error: arr.error }
  }

  const tasks: Task[] = []
  const rawTasks = json['tasks'] as unknown[]
  for (let i = 0; i < rawTasks.length; i += 1) {
    const task = normalizeTask(rawTasks[i], i)
    if (!task) return { ok: false, error: `Task #${i + 1} is invalid or incomplete.` }
    tasks.push(task)
  }

  const projects: Project[] = []
  const rawProjects = json['projects'] as unknown[]
  for (let i = 0; i < rawProjects.length; i += 1) {
    const project = normalizeProject(rawProjects[i], i)
    if (!project) return { ok: false, error: `Project #${i + 1} is invalid or incomplete.` }
    projects.push(project)
  }

  const tags: Tag[] = []
  const rawTags = json['tags'] as unknown[]
  for (let i = 0; i < rawTags.length; i += 1) {
    const tag = normalizeTag(rawTags[i])
    if (!tag) return { ok: false, error: `Tag #${i + 1} is invalid or incomplete.` }
    tags.push(tag)
  }

  const sessions: FocusSession[] = []
  const rawSessions = json['sessions'] as unknown[]
  for (let i = 0; i < rawSessions.length; i += 1) {
    const session = normalizeSession(rawSessions[i])
    if (!session) return { ok: false, error: `Focus session #${i + 1} is invalid.` }
    sessions.push(session)
  }

  const attachments: ExportAttachment[] = []
  const rawAttachments = json['attachments'] as unknown[]
  for (let i = 0; i < rawAttachments.length; i += 1) {
    const attachment = normalizeAttachment(rawAttachments[i], i)
    if (!attachment) return { ok: false, error: `Attachment #${i + 1} is invalid.` }
    attachments.push(attachment)
  }

  const exportedAt = num(json.exportedAt) ?? 0
  return {
    ok: true,
    data: { version: 1, exportedAt, tasks, projects, tags, sessions, attachments },
  }
}

/* ------------------------------ Form checks ------------------------------ */

export interface DraftErrors {
  title?: string
  dueDate?: string
  estimateMinutes?: string
  description?: string
}

export function validateTaskDraft(draft: {
  title: string
  description: string
  dueDate: string | null
  estimateMinutes: number | null
}): DraftErrors {
  const errors: DraftErrors = {}
  const title = draft.title.trim()
  if (title === '') errors.title = 'A title is required.'
  else if (title.length > MAX_TITLE) errors.title = `Keep the title under ${MAX_TITLE} characters.`

  if (draft.description.length > MAX_DESCRIPTION) {
    errors.description = `Keep the description under ${MAX_DESCRIPTION} characters.`
  }
  if (draft.dueDate !== null && !isValidDateValue(draft.dueDate)) {
    errors.dueDate = 'Pick a valid date.'
  }
  if (
    draft.estimateMinutes !== null &&
    (!Number.isFinite(draft.estimateMinutes) ||
      draft.estimateMinutes <= 0 ||
      draft.estimateMinutes > MAX_ESTIMATE_MINUTES)
  ) {
    errors.estimateMinutes = 'Estimate must be between 1 minute and 30 days.'
  }
  return errors
}
