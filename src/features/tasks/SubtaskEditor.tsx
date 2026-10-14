import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, GripVertical, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { createId } from '../../core/ids'
import type { Subtask } from '../../core/types'
import { subtaskProgress } from '../../store/selectors'
import { ProgressBar } from '../../ui/Progress'

/** Pure reorder used by drag-and-drop (and covered by tests). */
export function reorderSubtasks(subtasks: Subtask[], from: number, to: number): Subtask[] {
  if (from === to || from < 0 || to < 0 || from >= subtasks.length || to >= subtasks.length) {
    return subtasks
  }
  return arrayMove(subtasks, from, to)
}

function SubtaskRow({
  subtask,
  onChange,
  onToggle,
  onDelete,
}: {
  subtask: Subtask
  onChange: (title: string) => void
  onToggle: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: subtask.id,
  })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-2 py-1.5 ${
        isDragging ? 'opacity-60 shadow-md' : ''
      }`}
    >
      <button
        type="button"
        aria-pressed={subtask.done}
        aria-label={subtask.done ? `Reopen ${subtask.title}` : `Complete ${subtask.title}`}
        onClick={onToggle}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
          subtask.done ? 'border-success bg-success text-white' : 'border-line bg-surface hover:border-accent'
        }`}
      >
        {subtask.done && <Check size={12} />}
      </button>

      <input
        value={subtask.title}
        aria-label="Subtask title"
        onChange={(event) => onChange(event.target.value)}
        className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${
          subtask.done ? 'text-faint line-through' : 'text-ink'
        }`}
      />

      <button
        type="button"
        aria-label={`Reorder ${subtask.title}`}
        className="shrink-0 cursor-grab rounded p-1 text-faint hover:text-ink active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </button>

      <button
        type="button"
        aria-label={`Delete subtask ${subtask.title}`}
        onClick={onDelete}
        className="shrink-0 rounded p-1 text-faint hover:text-danger"
      >
        <Trash2 size={13} />
      </button>
    </li>
  )
}

/** Inline subtask list: add, rename, complete, reorder and delete. */
export function SubtaskEditor({
  subtasks,
  onChange,
}: {
  subtasks: Subtask[]
  onChange: (next: Subtask[]) => void
}) {
  const [draft, setDraft] = useState('')
  const progress = subtaskProgress(subtasks)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const add = () => {
    const title = draft.trim()
    if (title === '') return
    onChange([...subtasks, { id: createId('sub'), title, done: false }])
    setDraft('')
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = subtasks.findIndex((s) => s.id === active.id)
    const to = subtasks.findIndex((s) => s.id === over.id)
    onChange(reorderSubtasks(subtasks, from, to))
  }

  const update = (id: string, next: Partial<Subtask>) =>
    onChange(subtasks.map((s) => (s.id === id ? { ...s, ...next } : s)))

  return (
    <section aria-label="Subtasks">
      <div className="mb-2 flex items-center justify-between">
        <span className="tf-label mb-0">Subtasks</span>
        {subtasks.length > 0 && (
          <span className="text-xs text-muted">
            {progress.done}/{progress.total} · {progress.percent}%
          </span>
        )}
      </div>

      {subtasks.length > 0 && (
        <div className="mb-2">
          <ProgressBar percent={progress.percent} />
        </div>
      )}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={subtasks.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-1.5">
            {subtasks.map((subtask) => (
              <SubtaskRow
                key={subtask.id}
                subtask={subtask}
                onChange={(title) => update(subtask.id, { title })}
                onToggle={() => update(subtask.id, { done: !subtask.done })}
                onDelete={() => onChange(subtasks.filter((s) => s.id !== subtask.id))}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <div className="mt-2 flex items-center gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              add()
            }
          }}
          placeholder="Add a subtask"
          aria-label="New subtask title"
          className="tf-input h-8 text-[13px]"
        />
        <button
          type="button"
          onClick={add}
          aria-label="Add subtask"
          className="tf-btn tf-btn-sm tf-btn-secondary shrink-0"
        >
          <Plus size={14} />
        </button>
      </div>
    </section>
  )
}
