/** Shared domain types — single source of truth for every feature. */

export type TaskStatus = 'todo' | 'in_progress' | 'completed'
export type Priority = 'low' | 'medium' | 'high'

export type SectionId =
  | 'dashboard'
  | 'tasks'
  | 'projects'
  | 'calendar'
  | 'focus'
  | 'insights'
  | 'settings'

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export interface Attachment {
  id: string
  ownerType: 'task' | 'project'
  ownerId: string
  name: string
  mime: string
  size: number
  blob: Blob
  createdAt: number
}

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: Priority
  /** Naive local value: 'YYYY-MM-DD' (date-only) or 'YYYY-MM-DDTHH:mm'. Never UTC. */
  dueDate: string | null
  startDate: string | null
  estimateMinutes: number | null
  projectId: string | null
  tagIds: string[]
  subtasks: Subtask[]
  /** Ids of tasks that must be completed before this one can start. */
  dependsOn: string[]
  order: number
  createdAt: number
  updatedAt: number
  completedAt: number | null
}

export interface Project {
  id: string
  name: string
  description: string
  color: string
  createdAt: number
  updatedAt: number
}

export interface Tag {
  id: string
  name: string
  color: string
  createdAt: number
}

export interface FocusSession {
  id: string
  taskId: string
  startedAt: number
  endedAt: number
  durationMs: number
  createdAt: number
}

/** Exactly one timer exists at a time — this is what prevents overlapping sessions. */
export interface TimerState {
  taskId: string | null
  startedAt: number | null
  accumulatedMs: number
  /**
   * Countdown target for the current run. `null` = count-up (untimed session).
   * A break is `taskId: null` with a target; sessions are only ever recorded
   * for a real task, never for a break.
   */
  targetMs: number | null
}

export interface AppState {
  tasks: Task[]
  projects: Project[]
  tags: Tag[]
  sessions: FocusSession[]
  attachments: Attachment[]
  timer: TimerState
}

export type ThemePref = 'light' | 'dark' | 'system'

export type SortPref = 'manual' | 'due' | 'priority' | 'created' | 'title' | 'updated'

export interface Settings {
  /** 'system' follows the OS colour-scheme hint; applied as light or dark. */
  theme: ThemePref
  sidebarCollapsed: boolean
  focusDurationMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  /** Only ever true when the user opted in AND the browser granted permission. */
  notificationsEnabled: boolean
  defaultSort: SortPref
}

export const TASK_STATUSES: readonly TaskStatus[] = ['todo', 'in_progress', 'completed']
export const PRIORITIES: readonly Priority[] = ['low', 'medium', 'high']

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  completed: 'Completed',
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}
