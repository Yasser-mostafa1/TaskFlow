import { ChevronDown, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PRIORITIES, PRIORITY_LABEL } from '../../core/types'
import type { Priority } from '../../core/types'
import { useDispatch, useAppState } from '../../store/AppStoreContext'
import { useToast } from '../../ui/Feedback'
import { createTaskFromDraft, EMPTY_DRAFT } from './factory'

/**
 * Quick-add: one input, one Enter press. Advanced fields are optional and
 * expand inline so task creation never needs another screen (spec §6).
 */
export function QuickAdd({
  defaultProjectId = null,
  defaultDueDate = null,
  autoFocus = false,
}: {
  defaultProjectId?: string | null
  defaultDueDate?: string | null
  autoFocus?: boolean
}) {
  const state = useAppState()
  const dispatch = useDispatch()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [priority, setPriority] = useState<Priority>('medium')
  const [dueDate, setDueDate] = useState(defaultDueDate ?? '')
  const [projectId, setProjectId] = useState<string>(defaultProjectId ?? '')

  useEffect(() => {
    setDueDate(defaultDueDate ?? '')
  }, [defaultDueDate])

  const create = () => {
    const trimmed = title.trim()
    if (trimmed === '') {
      toast.push('error', 'Give the task a title first.')
      return
    }
    const task = createTaskFromDraft(
      {
        ...EMPTY_DRAFT,
        title: trimmed,
        priority,
        dueDate: dueDate === '' ? null : dueDate,
        projectId: projectId === '' ? null : projectId,
      },
      state,
    )
    dispatch({ type: 'task/add', task })
    setTitle('')
    toast.push('success', 'Task added.')
  }

  return (
    <div className="tf-card p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={create}
          aria-label="Add task"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-on-accent transition-opacity hover:opacity-90"
        >
          <Plus size={16} />
        </button>
        <input
          value={title}
          autoFocus={autoFocus}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              create()
            }
          }}
          placeholder={
            dueDate === '' ? 'Add a task and press Enter' : `Add a task due ${dueDate} (press Enter)`
          }
          aria-label="Quick add task"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Hide task options' : 'Show task options'}
          className="rounded-md p-1.5 text-faint hover:bg-surface-2 hover:text-ink"
        >
          <ChevronDown size={15} className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
      </div>

      {expanded && (
        <div className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Priority
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as Priority)}
              className="tf-input h-8 text-[13px]"
            >
              {PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {PRIORITY_LABEL[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Due date
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="tf-input h-8 text-[13px]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Project
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="tf-input h-8 text-[13px]"
            >
              <option value="">No project</option>
              {state.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  )
}
