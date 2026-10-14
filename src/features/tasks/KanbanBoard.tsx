import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useState } from 'react'
import { STATUS_LABEL } from '../../core/types'
import type { Task, TaskStatus } from '../../core/types'
import { useDispatch } from '../../store/AppStoreContext'
import { groupByStatus, resolveKanbanMove } from './kanban'
import { KanbanCard } from './KanbanCard'

const COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'completed']

const COLUMN_TONE: Record<TaskStatus, string> = {
  todo: 'text-muted',
  in_progress: 'text-info',
  completed: 'text-success',
}

export function KanbanBoard({
  tasks,
  now,
  onEdit,
}: {
  tasks: Task[]
  now: Date
  onEdit: (task: Task) => void
}) {
  const dispatch = useDispatch()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 140, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const [activeId, setActiveId] = useState<string | null>(null)

  const grouped = groupByStatus(tasks)

  const onDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id))

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    if (!event.over) return
    const translated = event.active.rect.current.translated
    const action = resolveKanbanMove(tasks, {
      activeId: String(event.active.id),
      overId: String(event.over.id),
      activeRect: translated ? { top: translated.top, height: translated.height } : undefined,
      overRect: { top: event.over.rect.top, height: event.over.rect.height },
    })
    if (action) dispatch(action)
  }

  const activeTask = activeId === null ? null : (tasks.find((task) => task.id === activeId) ?? null)

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((status) => {
          const columnTasks = grouped[status]
          return (
            <section
              key={status}
              aria-label={STATUS_LABEL[status]}
              className="flex min-h-40 flex-col rounded-xl border border-line bg-surface-2/50"
            >
              <header className="flex items-center justify-between px-3 py-2.5">
                <h3 className={`text-[13px] font-semibold ${COLUMN_TONE[status]}`}>
                  {STATUS_LABEL[status]}
                </h3>
                <span className="rounded-md bg-surface px-1.5 py-0.5 text-xs font-medium text-muted">
                  {columnTasks.length}
                </span>
              </header>

              <SortableContext
                items={columnTasks.map((task) => task.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-1 flex-col gap-2 px-2 pb-3">
                  {columnTasks.map((task) => (
                    <KanbanCard key={task.id} task={task} now={now} onEdit={onEdit} />
                  ))}
                  {columnTasks.length === 0 && (
                    <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs text-faint">
                      Drop tasks here
                    </p>
                  )}
                </div>
              </SortableContext>
            </section>
          )
        })}
      </div>

      <DragOverlay dropAnimation={{ duration: 160, easing: 'ease-out' }}>
        {activeTask && (
          <div className="tf-card w-64 rotate-1 p-3 shadow-xl">
            <p className="line-clamp-2 text-sm font-medium">{activeTask.title}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
