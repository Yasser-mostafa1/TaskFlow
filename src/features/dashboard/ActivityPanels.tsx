import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, Timer } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type { NavigateFn } from '../../app/Navigation'
import { formatClock, formatDuration } from '../../core/dates'
import type { Task, TimerState } from '../../core/types'
import { timerElapsed, type DayActivity } from '../../store/selectors'
import { Button } from '../../ui/Button'
import { TaskRow } from '../tasks/TaskRow'
import { WeekChart } from '../insights/charts'

const MAX_ROWS = 6

function PanelHeader({
  icon,
  title,
  count,
  action,
}: {
  icon: ReactNode
  title: string
  count?: number
  action?: ReactNode
}) {
  return (
    <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-4 py-2.5">
      {icon}
      <h3 className="text-sm font-semibold">{title}</h3>
      {count !== undefined && <span className="tf-badge border-line bg-surface text-muted">{count}</span>}
      <span className="ml-auto">{action}</span>
    </div>
  )
}

/** Overdue and blocked work in one list — the entry point to recovery (spec §12). */
export function AttentionPanel({
  tasks,
  now,
  onNavigate,
  onOpenTask,
}: {
  tasks: Task[]
  now: Date
  onNavigate: NavigateFn
  onOpenTask: (task: Task) => void
}) {
  const shown = tasks.slice(0, MAX_ROWS)
  return (
    <section aria-label="Needs attention" className="tf-card overflow-hidden">
      <PanelHeader
        icon={<AlertTriangle size={15} className="text-warn" />}
        title="Needs attention"
        count={tasks.length}
        action={
          <Button size="sm" variant="ghost" onClick={() => onNavigate('tasks')} icon={<ArrowRight size={13} />}>
            Open list
          </Button>
        }
      />
      {shown.length === 0 ? (
        <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted">
          <CheckCircle2 size={15} className="shrink-0 text-success" />
          Nothing needs attention — no overdue or blocked tasks.
        </p>
      ) : (
        <ul>
          {shown.map((task) => (
            <TaskRow key={task.id} task={task} now={now} onEdit={onOpenTask} selectable={false} />
          ))}
        </ul>
      )}
    </section>
  )
}

/** Deadlines inside the next seven days, earliest first (already sorted). */
export function UpcomingPanel({
  tasks,
  now,
  onNavigate,
  onOpenTask,
}: {
  tasks: Task[]
  now: Date
  onNavigate: NavigateFn
  onOpenTask: (task: Task) => void
}) {
  const shown = tasks.slice(0, MAX_ROWS)
  return (
    <section aria-label="Upcoming deadlines" className="tf-card overflow-hidden">
      <PanelHeader
        icon={<CalendarDays size={15} className="text-accent" />}
        title="Upcoming deadlines"
        count={tasks.length}
        action={
          <Button size="sm" variant="ghost" onClick={() => onNavigate('calendar')} icon={<ArrowRight size={13} />}>
            Calendar
          </Button>
        }
      />
      {shown.length === 0 ? (
        <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted">
          <CalendarDays size={15} className="shrink-0 text-faint" />
          No deadlines in the next 7 days.
        </p>
      ) : (
        <ul>
          {shown.map((task) => (
            <TaskRow key={task.id} task={task} now={now} onEdit={onOpenTask} selectable={false} />
          ))}
        </ul>
      )}
    </section>
  )
}

/** Last seven days of completions and focus sessions — real data only. */
export function WeeklyPanel({ days }: { days: DayActivity[] }) {
  const totalDone = days.reduce((sum, day) => sum + day.completed, 0)
  const totalMinutes = days.reduce((sum, day) => sum + day.minutes, 0)
  return (
    <section aria-label="Weekly summary" className="tf-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Last 7 days</h3>
          <p className="text-xs text-muted">Built from your completions and focus sessions only.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="font-medium">{totalDone} task{totalDone === 1 ? '' : 's'} completed</span>
          <span className="font-medium text-info">{formatDuration(totalMinutes)} focused</span>
        </div>
      </div>
      <WeekChart days={days} />
    </section>
  )
}

/** Live banner for the single running focus session (never two at once). */
export function TimerBanner({
  task,
  timer,
  onNavigate,
}: {
  task: Task
  timer: TimerState
  onNavigate: NavigateFn
}) {
  const [tick, setTick] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <section
      aria-label="Running focus session"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-accent/40 bg-accent-soft px-4 py-3"
    >
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-on-accent">
        <Timer size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted">Focusing on</p>
        <p className="truncate text-sm font-medium">{task.title}</p>
      </div>
      <span role="timer" className="ml-auto text-lg font-semibold tabular-nums text-accent">
        {formatClock(timerElapsed(timer, tick))}
      </span>
      <Button size="sm" variant="primary" onClick={() => onNavigate('focus')}>
        Open focus
      </Button>
    </section>
  )
}
