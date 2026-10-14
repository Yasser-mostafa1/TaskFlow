import { ChevronLeft, ChevronRight, CalendarPlus, ListTodo } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  dateKey,
  formatDayHeading,
  formatDue,
  formatMonth,
  monthGridKeys,
  todayKey,
} from '../../core/dates'
import type { SectionId, Task } from '../../core/types'
import { isOverdue, tasksDueOn } from '../../store/selectors'
import { useAppState } from '../../store/AppStoreContext'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { PageHeader } from '../../ui/PageHeader'
import { DueBadge, PriorityBadge, StatusBadge } from '../../ui/Badges'
import { QuickAdd } from '../tasks/QuickAdd'
import { TaskEditor } from '../tasks/TaskEditor'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function CalendarView({ onNavigate }: { onNavigate: (section: SectionId) => void }) {
  const state = useAppState()
  const today = todayKey()
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [selectedKey, setSelectedKey] = useState<string>(today)
  const [editing, setEditing] = useState<Task | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)

  const now = new Date()
  const keys = useMemo(() => monthGridKeys(cursor.year, cursor.month), [cursor])

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of state.tasks) {
      if (task.dueDate === null) continue
      const key = task.dueDate.slice(0, 10)
      const list = map.get(key)
      if (list) list.push(task)
      else map.set(key, [task])
    }
    for (const list of map.values()) list.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
    return map
  }, [state.tasks])

  const monthTaskCount = useMemo(
    () =>
      [...byDay.entries()]
        .filter(([key]) => key.startsWith(`${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`))
        .reduce((total, [, list]) => total + list.length, 0),
    [byDay, cursor],
  )

  const selectedTasks = tasksDueOn(state.tasks, selectedKey)

  const shiftMonth = (delta: number) => {
    setCursor((current) => {
      const next = new Date(current.year, current.month + delta, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })
  }

  const openTask = (task: Task) => {
    setEditing(task)
    setEditorOpen(true)
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Calendar"
        description={`${monthTaskCount} scheduled task${monthTaskCount === 1 ? '' : 's'} this month`}
        actions={
          <>
            <Button size="sm" onClick={() => setCursor({ year: now.getFullYear(), month: now.getMonth() })}>
              Today
            </Button>
            <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-0.5">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => shiftMonth(-1)}
                className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="min-w-36 text-center text-sm font-semibold">
                {formatMonth(cursor.year, cursor.month)}
              </span>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => shiftMonth(1)}
                className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="tf-card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-line bg-surface-2/60">
            {WEEKDAYS.map((day) => (
              <div key={day} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {keys.map((key) => {
              const inMonth = key.startsWith(
                `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`,
              )
              const isToday = key === today
              const dayTasks = byDay.get(key) ?? []
              const selected = key === selectedKey
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                  aria-pressed={selected}
                  aria-label={`${formatDayHeading(key)}, ${dayTasks.length} task${dayTasks.length === 1 ? '' : 's'}`}
                  className={`min-h-24 border-b border-r border-line p-1.5 text-left transition-colors last:border-r-0 ${
                    selected ? 'bg-accent-soft/70' : 'hover:bg-surface-2/70'
                  } ${inMonth ? '' : 'opacity-45'}`}
                >
                  <span
                    className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-medium ${
                      isToday ? 'bg-accent text-on-accent' : selected ? 'text-accent' : 'text-muted'
                    }`}
                  >
                    {Number(key.slice(8, 10))}
                  </span>

                  <span className="mt-1 flex flex-col gap-0.5">
                    {dayTasks.slice(0, 3).map((task) => {
                      const overdue = isOverdue(task, now)
                      return (
                        <span
                          key={task.id}
                          className={`hidden truncate rounded px-1 py-0.5 text-[10px] leading-tight sm:block ${
                            overdue
                              ? 'bg-warn-soft text-warn'
                              : task.status === 'completed'
                                ? 'bg-surface-2 text-faint line-through'
                                : 'bg-surface-2 text-ink'
                          }`}
                        >
                          {task.title}
                        </span>
                      )
                    })}
                    <span className="flex gap-0.5 sm:hidden">
                      {dayTasks.slice(0, 3).map((task) => (
                        <span
                          key={task.id}
                          className={`h-1.5 w-1.5 rounded-full ${
                            isOverdue(task, now) ? 'bg-warn' : task.status === 'completed' ? 'bg-faint' : 'bg-accent'
                          }`}
                        />
                      ))}
                    </span>
                    {dayTasks.length > 3 && (
                      <span className="hidden text-[10px] text-muted sm:block">+{dayTasks.length - 3} more</span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <aside className="flex flex-col gap-4" aria-label="Selected day">
          <div className="tf-card p-4">
            <h3 className="text-sm font-semibold">{formatDayHeading(selectedKey)}</h3>
            <p className="mt-0.5 text-xs text-muted">
              {selectedTasks.length === 0
                ? 'Nothing scheduled'
                : `${selectedTasks.length} task${selectedTasks.length === 1 ? '' : 's'}`}
            </p>

            <div className="mt-3">
              <QuickAdd defaultDueDate={selectedKey} />
            </div>

            {selectedTasks.length > 0 && (
              <ul className="mt-3 flex flex-col gap-2">
                {selectedTasks.map((task) => (
                  <li key={task.id} className="rounded-lg border border-line bg-surface-2/60 p-2">
                    <button
                      type="button"
                      onClick={() => openTask(task)}
                      className={`w-full text-left text-[13px] font-medium hover:text-accent ${
                        task.status === 'completed' ? 'text-faint line-through' : 'text-ink'
                      }`}
                    >
                      {task.title}
                    </button>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <PriorityBadge priority={task.priority} />
                      <StatusBadge status={task.status} />
                      <DueBadge task={task} now={now} />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={() => onNavigate('tasks')}
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink"
            >
              <ListTodo size={13} /> Open in My Tasks
            </button>
          </div>

          <div className="tf-card p-4 text-xs leading-relaxed text-muted">
            <p className="flex items-center gap-1.5 font-medium text-ink">
              <CalendarPlus size={14} /> Only real tasks appear here
            </p>
            <p className="mt-1.5">
              Dates are stored exactly as you pick them, so a task due on a day never moves to another day.
            </p>
          </div>
        </aside>
      </div>

      {selectedTasks.length === 0 && selectedKey === today && (
        <div className="mt-4">
          <EmptyState
            icon={<CalendarPlus size={26} />}
            title="Nothing due today"
            description="Pick any day in the calendar to schedule a task for it."
          />
        </div>
      )}

      <TaskEditor open={editorOpen} task={editing} onClose={() => setEditorOpen(false)} />
    </div>
  )
}
