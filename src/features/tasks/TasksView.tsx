import { CheckSquare, Kanban, ListTodo, Plus, Square, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSettings } from '../../app/SettingsContext'
import { DEFAULT_FILTER, selectFiltered, type SortKey, type TaskFilter } from '../../store/selectors'
import { useDispatch, useAppState } from '../../store/AppStoreContext'
import { Button } from '../../ui/Button'
import { useConfirm, useToast } from '../../ui/Feedback'
import { EmptyState } from '../../ui/EmptyState'
import { PageHeader } from '../../ui/PageHeader'
import { Segmented } from '../../ui/Segmented'
import { FilterBar, isDefaultFilter } from './FilterBar'
import { KanbanBoard } from './KanbanBoard'
import { QuickAdd } from './QuickAdd'
import { TaskEditor } from './TaskEditor'
import { TaskRow } from './TaskRow'
import type { Task } from '../../core/types'

const VIEW_KEY = 'taskflow.tasksView'

function readInitialView(): 'list' | 'board' {
  try {
    return localStorage.getItem(VIEW_KEY) === 'board' ? 'board' : 'list'
  } catch {
    return 'list'
  }
}

export function TasksView({ initialFilter }: { initialFilter?: Partial<TaskFilter> } = {}) {
  const state = useAppState()
  const dispatch = useDispatch()
  const toast = useToast()
  const confirm = useConfirm()
  const { settings } = useSettings()

  const [view, setView] = useState<'list' | 'board'>(readInitialView)
  const [filter, setFilter] = useState<TaskFilter>(() => ({ ...DEFAULT_FILTER, ...initialFilter }))
  const [sort, setSort] = useState<SortKey>(settings.defaultSort)
  const [selected, setSelected] = useState<string[]>([])
  const [editing, setEditing] = useState<Task | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view)
    } catch {
      /* non-critical preference */
    }
  }, [view])

  const now = useMemo(() => new Date(), [state.tasks])
  const tasks = useMemo(() => selectFiltered(state, filter, sort, now), [state, filter, sort, now])
  const selectedSet = useMemo(() => new Set(selected), [selected])

  const openNew = useCallback(() => {
    setEditing(null)
    setEditorOpen(true)
  }, [])

  const openEdit = useCallback((task: Task) => {
    setEditing(task)
    setEditorOpen(true)
  }, [])

  const toggleSelect = useCallback((id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]))
  }, [])

  const visibleIds = tasks.map((task) => task.id)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id))

  const toggleSelectAll = () => {
    setSelected(allVisibleSelected ? [] : visibleIds)
  }

  const runBulk = async (
    kind: 'complete' | 'reopen' | 'delete',
  ) => {
    if (selected.length === 0) return
    if (kind === 'delete') {
      const ok = await confirm({
        title: `Delete ${selected.length} task${selected.length > 1 ? 's' : ''}?`,
        message: 'Their subtasks, attachments and tracked time will be removed. This cannot be undone.',
        confirmLabel: 'Delete',
        destructive: true,
      })
      if (!ok) return
      dispatch({ type: 'task/remove', ids: selected })
      toast.push('info', `${selected.length} task${selected.length > 1 ? 's' : ''} deleted.`)
    } else {
      dispatch({
        type: 'task/setStatus',
        ids: selected,
        status: kind === 'complete' ? 'completed' : 'todo',
      })
      toast.push('success', `${selected.length} task${selected.length > 1 ? 's' : ''} updated.`)
    }
    setSelected([])
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="My Tasks"
        description={
          isDefaultFilter(filter)
            ? `${state.tasks.length} task${state.tasks.length === 1 ? '' : 's'} in your workspace`
            : `${tasks.length} matching task${tasks.length === 1 ? '' : 's'}`
        }
        actions={
          <>
            <Segmented
              ariaLabel="Task view"
              value={view}
              options={[
                { value: 'list', label: 'List', icon: <ListTodo size={13} /> },
                { value: 'board', label: 'Board', icon: <Kanban size={13} /> },
              ]}
              onChange={setView}
            />
            <Button variant="primary" icon={<Plus size={15} />} onClick={openNew}>
              New task
            </Button>
          </>
        }
      />

      <div className="mb-4">
        <QuickAdd />
      </div>

      <div className="mb-3">
        <FilterBar filter={filter} onFilter={setFilter} sort={sort} onSort={setSort} />
      </div>

      {view === 'list' && selected.length > 0 && (
        <div className="sticky top-0 z-30 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft px-3 py-2">
          <span className="text-sm font-medium text-accent">{selected.length} selected</span>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" icon={<CheckSquare size={14} />} onClick={() => void runBulk('complete')}>
              Complete
            </Button>
            <Button size="sm" icon={<Square size={14} />} onClick={() => void runBulk('reopen')}>
              Reopen
            </Button>
            <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => void runBulk('delete')}>
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {view === 'board' ? (
        <KanbanBoard tasks={tasks} now={now} onEdit={openEdit} />
      ) : (
        <div className="tf-card overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line bg-surface-2/60 px-3 py-2">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectAll}
              aria-label="Select all visible tasks"
              disabled={visibleIds.length === 0}
              className="h-3.5 w-3.5 cursor-pointer accent-[var(--c-accent)]"
            />
            <span className="text-xs font-medium text-muted">
              {tasks.length === 0 ? 'No tasks' : `${tasks.length} shown`}
            </span>
          </div>

          {tasks.length === 0 ? (
            <div className="p-4">
              {state.tasks.length === 0 ? (
                <EmptyState
                  icon={<ListTodo size={28} />}
                  title="No tasks yet"
                  description="Use the box above to add your first task — it takes one line and one Enter press."
                />
              ) : (
                <EmptyState
                  icon={<ListTodo size={28} />}
                  title="Nothing matches these filters"
                  description="Adjust or clear the filters to see more tasks."
                  action={
                    <Button size="sm" onClick={() => setFilter({ ...DEFAULT_FILTER })}>
                      Clear filters
                    </Button>
                  }
                />
              )}
            </div>
          ) : (
            <ul>
              {tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  now={now}
                  onEdit={openEdit}
                  selected={selectedSet.has(task.id)}
                  onToggleSelect={toggleSelect}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      <TaskEditor open={editorOpen} task={editing} onClose={() => setEditorOpen(false)} />
    </div>
  )
}
