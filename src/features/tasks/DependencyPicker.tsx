import { Link2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Task } from '../../core/types'
import { wouldCreateCycle } from '../../store/selectors'
import { useAppState } from '../../store/AppStoreContext'

/**
 * Dependency picker: choose prerequisite tasks. Candidates that would create a
 * cycle are shown but disabled with an explicit reason — never silently dropped.
 */
export function DependencyPicker({
  taskId,
  dependsOn,
  onChange,
}: {
  taskId: string | null
  dependsOn: string[]
  onChange: (ids: string[]) => void
}) {
  const state = useAppState()
  const [query, setQuery] = useState('')

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    return state.tasks
      .filter((task) => task.id !== taskId)
      .filter((task) => q === '' || task.title.toLowerCase().includes(q))
      .slice(0, 40)
  }, [state.tasks, query, taskId])

  const byId = useMemo(() => new Map(state.tasks.map((t) => [t.id, t])), [state.tasks])

  const toggle = (id: string) => {
    if (dependsOn.includes(id)) onChange(dependsOn.filter((x) => x !== id))
    else onChange([...dependsOn, id])
  }

  return (
    <section aria-label="Dependencies">
      <span className="tf-label">
        <span className="inline-flex items-center gap-1.5">
          <Link2 size={13} /> Depends on
        </span>
      </span>

      {dependsOn.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {dependsOn.map((id) => {
            const task = byId.get(id)
            if (!task) return null
            return (
              <li key={id}>
                <span className="tf-badge border-accent/30 bg-accent-soft text-accent">
                  {task.title}
                  <button
                    type="button"
                    aria-label={`Remove dependency ${task.title}`}
                    onClick={() => onChange(dependsOn.filter((x) => x !== id))}
                    className="rounded p-0.5 hover:text-danger"
                  >
                    <X size={11} />
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search tasks to block on"
        aria-label="Search dependency candidates"
        className="tf-input h-8 text-[13px]"
      />

      <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-line">
        {candidates.length === 0 && (
          <li className="px-3 py-2 text-[13px] text-faint">No other tasks yet.</li>
        )}
        {candidates.map((task) => {
          const active = dependsOn.includes(task.id)
          const loop = taskId !== null && wouldCreateCycle(state.tasks, taskId, task.id)
          return (
            <li key={task.id} className="border-b border-line last:border-0">
              <button
                type="button"
                disabled={loop}
                onClick={() => toggle(task.id)}
                title={loop ? 'This would create a circular dependency' : undefined}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors ${
                  loop ? 'cursor-not-allowed text-faint line-through' : 'hover:bg-surface-2'
                }`}
              >
                <span
                  className={`h-3.5 w-3.5 shrink-0 rounded border ${
                    active ? 'border-accent bg-accent' : 'border-line'
                  }`}
                />
                <span className="truncate">{task.title}</span>
                {loop && <span className="ml-auto shrink-0 text-[11px]">Would loop</span>}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="mt-1.5 text-xs text-faint">
        Tasks that depend on this one stay blocked until it is completed.
      </p>
    </section>
  )
}
