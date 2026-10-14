import { CalendarClock, CircleSlash2, Flag } from 'lucide-react'
import { dateKey, formatDue } from '../core/dates'
import type { Priority, Task, TaskStatus } from '../core/types'
import { isOverdue } from '../store/selectors'

const STATUS_CLASS: Record<TaskStatus, string> = {
  todo: 'border-line bg-surface-2 text-muted',
  in_progress: 'border-info/30 bg-info-soft text-info',
  completed: 'border-success/30 bg-success-soft text-success',
}

const STATUS_TEXT: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  completed: 'Completed',
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`tf-badge ${STATUS_CLASS[status]}`}>{STATUS_TEXT[status]}</span>
}

const PRIORITY_CLASS: Record<Priority, string> = {
  low: 'border-line bg-surface-2 text-muted',
  medium: 'border-warn/30 bg-warn-soft text-warn',
  high: 'border-danger/30 bg-danger-soft text-danger',
}

const PRIORITY_TEXT: Record<Priority, string> = { low: 'Low', medium: 'Medium', high: 'High' }

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`tf-badge ${PRIORITY_CLASS[priority]}`}>
      <Flag size={11} />
      {PRIORITY_TEXT[priority]}
    </span>
  )
}

/**
 * Due label — overdue is shown with a restrained amber tone, never an
 * aggressive red wall (spec §12).
 */
export function DueBadge({ task, now }: { task: Task; now: Date }) {
  if (task.dueDate === null) return null
  const overdue = isOverdue(task, now)
  const isToday = task.dueDate.slice(0, 10) === dateKey(now)
  const className = overdue
    ? 'border-warn/40 bg-warn-soft text-warn'
    : isToday
      ? 'border-accent/30 bg-accent-soft text-accent'
      : 'border-line bg-surface-2 text-muted'
  return (
    <span className={`tf-badge ${className}`}>
      <CalendarClock size={11} />
      {overdue ? `Overdue · ${formatDue(task.dueDate, now)}` : formatDue(task.dueDate, now)}
    </span>
  )
}

export function BlockedBadge({ pending }: { pending: number }) {
  return (
    <span className="tf-badge border-warn/40 bg-warn-soft text-warn" title="Waiting on other tasks">
      <CircleSlash2 size={11} />
      Blocked{pending > 0 ? ` · ${pending}` : ''}
    </span>
  )
}
