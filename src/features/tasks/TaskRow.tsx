import { Check, Copy, Pencil, Repeat2, Trash2 } from 'lucide-react'
import { memo } from 'react'
import { createId } from '../../core/ids'
import type { Task } from '../../core/types'
import { useDispatch, useAppState } from '../../store/AppStoreContext'
import { blockInfo, indexTasks, nextOrder, subtaskProgress } from '../../store/selectors'
import { useConfirm, useToast } from '../../ui/Feedback'
import { BlockedBadge, DueBadge, PriorityBadge, StatusBadge } from '../../ui/Badges'
import { Dropdown } from '../../ui/Dropdown'
import { ProgressBar } from '../../ui/Progress'

export const TaskRow = memo(function TaskRow({
  task,
  now,
  onEdit,
  selected = false,
  onToggleSelect,
  selectable = true,
}: {
  task: Task
  now: Date
  onEdit: (task: Task) => void
  selected?: boolean
  onToggleSelect?: (id: string) => void
  selectable?: boolean
}) {
  const state = useAppState()
  const dispatch = useDispatch()
  const toast = useToast()
  const confirm = useConfirm()

  const byId = indexTasks(state.tasks)
  const block = blockInfo(task, byId)
  const progress = subtaskProgress(task.subtasks)
  const project = state.projects.find((p) => p.id === task.projectId)
  const tags = state.tags.filter((tag) => task.tagIds.includes(tag.id))
  const completed = task.status === 'completed'

  const toggleComplete = () => {
    dispatch({ type: 'task/setStatus', ids: [task.id], status: completed ? 'todo' : 'completed' })
    if (!completed) toast.push('success', 'Task completed.')
  }

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete this task?',
      message: `"${task.title}" and its subtasks, attachments and tracked time will be removed. This cannot be undone.`,
      confirmLabel: 'Delete task',
      destructive: true,
    })
    if (!ok) return
    dispatch({ type: 'task/remove', ids: [task.id] })
    toast.push('info', 'Task deleted.')
  }

  const duplicate = () => {
    const stamp = Date.now()
    dispatch({
      type: 'task/add',
      task: {
        ...task,
        id: createId('task'),
        title: `${task.title} (copy)`,
        status: 'todo',
        completedAt: null,
        subtasks: task.subtasks.map((s) => ({ ...s, id: createId('sub'), done: false })),
        order: nextOrder(state.tasks),
        createdAt: stamp,
        updatedAt: stamp,
      },
    })
    toast.push('success', 'Task duplicated.')
  }

  return (
    <li
      className={`group flex items-start gap-3 border-b border-line px-3 py-2.5 transition-colors last:border-0 hover:bg-surface-2/60 ${
        selected ? 'bg-accent-soft/60' : ''
      }`}
    >
      {selectable && (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect?.(task.id)}
          aria-label={`Select ${task.title}`}
          className="mt-1 h-3.5 w-3.5 shrink-0 cursor-pointer accent-[var(--c-accent)]"
        />
      )}

      <button
        type="button"
        onClick={toggleComplete}
        aria-pressed={completed}
        aria-label={completed ? `Reopen ${task.title}` : `Complete ${task.title}`}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
          completed ? 'border-success bg-success text-white' : 'border-line bg-surface hover:border-accent'
        }`}
      >
        {completed && <Check size={12} />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <button
            type="button"
            onClick={() => onEdit(task)}
            className={`truncate text-left text-sm font-medium hover:text-accent ${
              completed ? 'text-faint line-through' : 'text-ink'
            }`}
          >
            {task.title}
          </button>
          <StatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />
          <DueBadge task={task} now={now} />
          {block.blocked && <BlockedBadge pending={block.pendingIds.length} />}
          {project && (
            <span className="tf-badge border-line bg-surface-2 text-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: project.color }} />
              {project.name}
            </span>
          )}
          {tags.map((tag) => (
            <span key={tag.id} className="tf-badge border-line bg-surface-2 text-muted">
              {tag.name}
            </span>
          ))}
        </div>

        {task.description && (
          <p className={`mt-1 line-clamp-1 text-[13px] ${completed ? 'text-faint' : 'text-muted'}`}>
            {task.description}
          </p>
        )}

        {task.subtasks.length > 0 && (
          <div className="mt-2 flex max-w-xs items-center gap-2">
            <ProgressBar percent={progress.percent} tone={progress.percent === 100 ? 'success' : 'accent'} />
            <span className="shrink-0 text-[11px] text-muted">
              {progress.done}/{progress.total}
            </span>
          </div>
        )}
      </div>

      <Dropdown
        items={[
          { label: 'Edit task', icon: <Pencil size={14} />, onSelect: () => onEdit(task) },
          {
            label: completed ? 'Mark as to do' : 'Mark complete',
            icon: completed ? <Repeat2 size={14} /> : <Check size={14} />,
            onSelect: toggleComplete,
          },
          { label: 'Duplicate', icon: <Copy size={14} />, onSelect: duplicate },
          { label: 'Delete', icon: <Trash2 size={14} />, onSelect: () => void remove(), danger: true },
        ]}
        label={`Actions for ${task.title}`}
      />
    </li>
  )
})
