import { CSS } from '@dnd-kit/utilities'
import { useSortable } from '@dnd-kit/sortable'
import { GripVertical } from 'lucide-react'
import { memo } from 'react'
import type { Task } from '../../core/types'
import { blockInfo, indexTasks, subtaskProgress } from '../../store/selectors'
import { useAppState } from '../../store/AppStoreContext'
import { BlockedBadge, DueBadge, PriorityBadge } from '../../ui/Badges'
import { ProgressBar } from '../../ui/Progress'

export const KanbanCard = memo(function KanbanCard({
  task,
  now,
  onEdit,
}: {
  task: Task
  now: Date
  onEdit: (task: Task) => void
}) {
  const state = useAppState()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  const byId = indexTasks(state.tasks)
  const block = blockInfo(task, byId)
  const progress = subtaskProgress(task.subtasks)
  const project = state.projects.find((p) => p.id === task.projectId)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`tf-card group cursor-default p-3 ${isDragging ? 'opacity-50 shadow-lg' : ''}`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onEdit(task)}
            className="line-clamp-2 text-left text-sm font-medium leading-snug hover:text-accent"
          >
            {task.title}
          </button>
          {task.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{task.description}</p>
          )}
        </div>

        <button
          type="button"
          aria-label={`Drag ${task.title}`}
          className="shrink-0 cursor-grab rounded p-1 text-faint transition-colors hover:bg-surface-2 hover:text-ink active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={15} />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <PriorityBadge priority={task.priority} />
        <DueBadge task={task} now={now} />
        {block.blocked && <BlockedBadge pending={block.pendingIds.length} />}
        {project && (
          <span className="tf-badge border-line bg-surface-2 text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: project.color }} />
            {project.name}
          </span>
        )}
      </div>

      {task.subtasks.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <ProgressBar percent={progress.percent} tone={progress.percent === 100 ? 'success' : 'accent'} />
          <span className="shrink-0 text-[11px] text-muted">
            {progress.done}/{progress.total}
          </span>
        </div>
      )}
    </div>
  )
})
