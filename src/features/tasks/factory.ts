import { createId } from '../../core/ids'
import { nowStamp } from '../../core/dates'
import { nextOrder } from '../../store/selectors'
import type { AppState, Subtask, Task } from '../../core/types'

export interface TaskDraft {
  title: string
  description: string
  status: Task['status']
  priority: Task['priority']
  dueDate: string | null
  startDate: string | null
  estimateMinutes: number | null
  projectId: string | null
  tagIds: string[]
  subtasks: Subtask[]
  dependsOn: string[]
}

export const EMPTY_DRAFT: TaskDraft = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: null,
  startDate: null,
  estimateMinutes: null,
  projectId: null,
  tagIds: [],
  subtasks: [],
  dependsOn: [],
}

export function draftFromTask(task: Task): TaskDraft {
  return {
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    startDate: task.startDate,
    estimateMinutes: task.estimateMinutes,
    projectId: task.projectId,
    tagIds: [...task.tagIds],
    subtasks: task.subtasks.map((s) => ({ ...s })),
    dependsOn: [...task.dependsOn],
  }
}

/** Builds a valid Task from a validated draft (all optional fields defaulted). */
export function createTaskFromDraft(draft: TaskDraft, state: AppState): Task {
  const now = nowStamp()
  return {
    id: createId('task'),
    title: draft.title.trim(),
    description: draft.description.trim(),
    status: draft.status,
    priority: draft.priority,
    dueDate: draft.dueDate,
    startDate: draft.startDate,
    estimateMinutes: draft.estimateMinutes,
    projectId: draft.projectId,
    tagIds: draft.tagIds,
    subtasks: draft.subtasks,
    dependsOn: draft.dependsOn,
    order: nextOrder(state.tasks),
    createdAt: now,
    updatedAt: now,
    completedAt: draft.status === 'completed' ? now : null,
  }
}
