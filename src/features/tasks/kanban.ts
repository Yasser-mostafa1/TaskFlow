import type { Action } from '../../store/reducer'
import { TASK_STATUSES } from '../../core/types'
import type { Task, TaskStatus } from '../../core/types'

export interface DragRect {
  top: number
  height: number
}

export interface DragInfo {
  activeId: string
  /** Task id or column status id. */
  overId: string
  activeRect?: DragRect
  overRect?: DragRect
}

export const isColumnId = (id: string): id is TaskStatus =>
  (TASK_STATUSES as readonly string[]).includes(id)

const byOrder = (a: Task, b: Task): number => a.order - b.order

/** Columns in display order, each sorted by the stored manual order. */
export function groupByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const grouped: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], completed: [] }
  for (const task of tasks) grouped[task.status].push(task)
  for (const status of TASK_STATUSES) grouped[status].sort(byOrder)
  return grouped
}

/**
 * Turns a drop into exactly one state action — the single place where
 * "where did it land" becomes "what changes in the data" (spec §8).
 */
export function resolveKanbanMove(tasks: Task[], drag: DragInfo): Action | null {
  const active = tasks.find((task) => task.id === drag.activeId)
  if (!active) return null

  const targetStatus: TaskStatus = isColumnId(drag.overId)
    ? drag.overId
    : (tasks.find((task) => task.id === drag.overId)?.status ?? active.status)

  const targetColumn = tasks.filter((task) => task.status === targetStatus).sort(byOrder)

  let overTaskId: string | null = null
  let position: 'before' | 'after' = 'after'

  if (isColumnId(drag.overId)) {
    overTaskId = targetColumn[targetColumn.length - 1]?.id ?? null
    position = 'after'
  } else if (drag.overId === drag.activeId) {
    if (targetStatus === active.status) return null
    overTaskId = null
    position = 'after'
  } else {
    overTaskId = drag.overId
    if (drag.activeRect && drag.overRect) {
      const activeMid = drag.activeRect.top + drag.activeRect.height / 2
      const overMid = drag.overRect.top + drag.overRect.height / 2
      position = activeMid < overMid ? 'before' : 'after'
    } else {
      const originalActiveIndex = targetColumn.findIndex((task) => task.id === drag.activeId)
      const overIndex = targetColumn.findIndex((task) => task.id === drag.overId)
      position =
        overIndex === -1 || (originalActiveIndex !== -1 && originalActiveIndex < overIndex)
          ? 'after'
          : 'before'
    }
  }

  return {
    type: 'task/move',
    activeId: drag.activeId,
    overId: overTaskId,
    position,
    status: targetStatus,
  }
}
