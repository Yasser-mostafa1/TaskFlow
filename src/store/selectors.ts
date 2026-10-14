/**
 * Domain logic shared by every view (pure functions over AppState).
 * All counts and percentages are derived — nothing is hardcoded (spec §5).
 */

import { dateKey, dueInstant, isSameKey } from '../core/dates'
import type { AppState, Priority, Project, Subtask, Tag, Task, TaskStatus, TimerState } from '../core/types'

export type SortKey = 'manual' | 'due' | 'priority' | 'created' | 'title' | 'updated'

export interface TaskFilter {
  query: string
  status: 'all' | TaskStatus
  priority: 'all' | Priority
  projectId: 'all' | 'none' | string
  tagId: 'all' | string
  scope: 'all' | 'active' | 'completed' | 'overdue' | 'today'
}

export const DEFAULT_FILTER: TaskFilter = {
  query: '',
  status: 'all',
  priority: 'all',
  projectId: 'all',
  tagId: 'all',
  scope: 'all',
}

export function indexTasks(tasks: Task[]): Map<string, Task> {
  return new Map(tasks.map((task) => [task.id, task]))
}

export function nextOrder(tasks: Task[]): number {
  let max = -1
  for (const task of tasks) if (task.order > max) max = task.order
  return max + 1
}

/* ------------------------------- Progress ------------------------------- */

export interface Progress {
  done: number
  total: number
  /** 0 when there are no subtasks — never a fabricated percentage. */
  percent: number
}

export function subtaskProgress(subtasks: Subtask[]): Progress {
  const total = subtasks.length
  if (total === 0) return { done: 0, total: 0, percent: 0 }
  const done = subtasks.filter((s) => s.done).length
  return { done, total, percent: Math.round((done / total) * 100) }
}

export interface BlockInfo {
  blocked: boolean
  pendingIds: string[]
}

/** A task is blocked while any dependency is still incomplete. */
export function blockInfo(task: Task, byId: Map<string, Task>): BlockInfo {
  const pendingIds = task.dependsOn.filter((id) => {
    const dependency = byId.get(id)
    // A dangling id is cleaned up by the reducer and never blocks forever.
    return dependency !== undefined && dependency.status !== 'completed'
  })
  return { blocked: pendingIds.length > 0, pendingIds }
}

/** Guards against circular dependencies before they are ever written. */
export function wouldCreateCycle(tasks: Task[], taskId: string, depId: string): boolean {
  if (taskId === depId) return true
  const byId = indexTasks(tasks)
  const start = byId.get(depId)
  if (!start) return false
  const seen = new Set<string>()
  const stack: string[] = [...start.dependsOn]
  while (stack.length > 0) {
    const id = stack.pop() as string
    if (id === taskId) return true
    if (seen.has(id)) continue
    seen.add(id)
    const current = byId.get(id)
    if (current) stack.push(...current.dependsOn)
  }
  return false
}

export function isOverdue(task: Task, now: Date): boolean {
  if (task.status === 'completed' || task.dueDate === null) return false
  return dueInstant(task.dueDate).getTime() < now.getTime()
}

export function isDueToday(task: Task, now: Date): boolean {
  if (task.dueDate === null) return false
  return isSameKey(task.dueDate, dateKey(now))
}

/* --------------------------------- Time --------------------------------- */

export function timerElapsed(timer: TimerState, now: number): number {
  const running = timer.startedAt === null ? 0 : Math.max(0, now - timer.startedAt)
  return timer.accumulatedMs + running
}

/** Total tracked time for a task: recorded sessions + the live timer. */
export function trackedMs(state: AppState, taskId: string, now: number): number {
  let total = 0
  for (const session of state.sessions) {
    if (session.taskId === taskId) total += session.durationMs
  }
  if (state.timer.taskId === taskId) total += timerElapsed(state.timer, now)
  return total
}

export function spentMinutesByTask(state: AppState): Map<string, number> {
  const out = new Map<string, number>()
  for (const session of state.sessions) {
    out.set(session.taskId, (out.get(session.taskId) ?? 0) + Math.round(session.durationMs / 60000))
  }
  return out
}

/* -------------------------------- Stats --------------------------------- */

export interface Stats {
  total: number
  completed: number
  active: number
  overdue: number
  dueToday: number
  completedToday: number
  blocked: number
  completionRate: number
}

export function computeStats(state: AppState, now: Date): Stats {
  const byId = indexTasks(state.tasks)
  const today = dateKey(now)
  let completed = 0
  let overdue = 0
  let dueToday = 0
  let completedToday = 0
  let blocked = 0

  for (const task of state.tasks) {
    if (task.status === 'completed') {
      completed += 1
      if (task.completedAt !== null && dateKey(new Date(task.completedAt)) === today) completedToday += 1
    } else if (isOverdue(task, now)) {
      overdue += 1
    } else if (isDueToday(task, now)) {
      dueToday += 1
    }
    if (task.status !== 'completed' && blockInfo(task, byId).blocked) blocked += 1
  }

  const total = state.tasks.length
  return {
    total,
    completed,
    active: total - completed,
    overdue,
    dueToday,
    completedToday,
    blocked,
    completionRate: total === 0 ? 0 : completed / total,
  }
}

export interface ProjectProgress {
  project: Project
  total: number
  completed: number
  percent: number
}

export function projectProgress(state: AppState, project: Project): ProjectProgress {
  const tasks = state.tasks.filter((task) => task.projectId === project.id)
  const completed = tasks.filter((task) => task.status === 'completed').length
  return {
    project,
    total: tasks.length,
    completed,
    percent: tasks.length === 0 ? 0 : Math.round((completed / tasks.length) * 100),
  }
}

/* ------------------------------- Filtering ------------------------------ */

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

function matchesQuery(state: AppState, task: Task, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q === '') return true
  if (task.title.toLowerCase().includes(q)) return true
  if (task.description.toLowerCase().includes(q)) return true
  for (const tagId of task.tagIds) {
    const tag = state.tags.find((t) => t.id === tagId)
    if (tag && tag.name.toLowerCase().includes(q)) return true
  }
  return false
}

export function selectFiltered(state: AppState, filter: TaskFilter, sort: SortKey, now: Date): Task[] {
  const filtered = state.tasks.filter((task) => {
    if (!matchesQuery(state, task, filter.query)) return false
    if (filter.status !== 'all' && task.status !== filter.status) return false
    if (filter.priority !== 'all' && task.priority !== filter.priority) return false
    if (filter.projectId === 'none' && task.projectId !== null) return false
    if (filter.projectId !== 'all' && filter.projectId !== 'none' && task.projectId !== filter.projectId) {
      return false
    }
    if (filter.tagId !== 'all' && !task.tagIds.includes(filter.tagId)) return false
    if (filter.scope === 'active' && task.status === 'completed') return false
    if (filter.scope === 'completed' && task.status !== 'completed') return false
    if (filter.scope === 'overdue' && !isOverdue(task, now)) return false
    if (filter.scope === 'today' && !(task.status !== 'completed' && isDueToday(task, now))) return false
    return true
  })

  const sorted = [...filtered]
  switch (sort) {
    case 'due':
      sorted.sort(
        (a, b) =>
          (a.dueDate === null ? 1 : 0) - (b.dueDate === null ? 1 : 0) ||
          (a.dueDate ?? '').localeCompare(b.dueDate ?? '') ||
          PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
      )
      break
    case 'priority':
      sorted.sort(
        (a, b) =>
          PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
          (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'),
      )
      break
    case 'created':
      sorted.sort((a, b) => b.createdAt - a.createdAt)
      break
    case 'updated':
      sorted.sort((a, b) => b.updatedAt - a.updatedAt)
      break
    case 'title':
      sorted.sort((a, b) => a.title.localeCompare(b.title))
      break
    case 'manual':
    default:
      sorted.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
      break
  }
  return sorted
}

export function tasksDueOn(tasks: Task[], key: string): Task[] {
  return tasks.filter((task) => task.dueDate !== null && task.dueDate.slice(0, 10) === key)
}

export function upcomingTasks(state: AppState, now: Date, days: number): Task[] {
  const today = dateKey(now)
  const horizon = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days))
  return state.tasks
    .filter((task) => {
      if (task.status === 'completed' || task.dueDate === null) return false
      const key = task.dueDate.slice(0, 10)
      return key >= today && key <= horizon
    })
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
}

/** Tasks that still need attention: overdue, blocked, or unassigned high priority. */
export function attentionTasks(state: AppState, now: Date): Task[] {
  const byId = indexTasks(state.tasks)
  return state.tasks
    .filter((task) => {
      if (task.status === 'completed') return false
      return isOverdue(task, now) || blockInfo(task, byId).blocked
    })
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
}

export interface DayActivity {
  key: string
  completed: number
  minutes: number
}

/** Last 7 local days, oldest first. */
export function weeklyActivity(state: AppState, now: Date): DayActivity[] {
  const days: DayActivity[] = []
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    days.push({ key: dateKey(d), completed: 0, minutes: 0 })
  }
  const byKey = new Map(days.map((day) => [day.key, day]))

  for (const task of state.tasks) {
    if (task.completedAt === null) continue
    const bucket = byKey.get(dateKey(new Date(task.completedAt)))
    if (bucket) bucket.completed += 1
  }
  for (const session of state.sessions) {
    const bucket = byKey.get(dateKey(new Date(session.startedAt)))
    if (bucket) bucket.minutes += Math.round(session.durationMs / 60000)
  }
  return days
}

export function tagById(tags: Tag[]): Map<string, Tag> {
  return new Map(tags.map((tag) => [tag.id, tag]))
}
