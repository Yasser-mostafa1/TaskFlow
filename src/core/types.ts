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
}

export interface AppState {
  tasks: Task[]
  projects: Project[]
  tags: Tag[]
  sessions: FocusSession[]
  attachments: Attachment[]
  timer: TimerState
}

export interface Settings {
  theme: 'light' | 'dark'
  sidebarCollapsed: boolean
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
