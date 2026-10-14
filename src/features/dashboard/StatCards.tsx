import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, ListTodo } from 'lucide-react'
import type { ReactNode } from 'react'
import { logger } from '../../core/logger'
import type { NavigateFn } from '../../app/Navigation'
import type { Stats, TaskFilter } from '../../store/selectors'
import { Button } from '../../ui/Button'
import { ProgressRing } from '../../ui/Progress'

interface StatDef {
  key: string
  label: string
  value: number
  hint: string
  icon: ReactNode
  tone: 'accent' | 'info' | 'warn' | 'success'
  scope: TaskFilter['scope']
}

const TONE: Record<StatDef['tone'], string> = {
  accent: 'bg-accent-soft text-accent',
  info: 'bg-info-soft text-info',
  warn: 'bg-warn-soft text-warn',
  success: 'bg-success-soft text-success',
}

/** Four interactive stat cards; each deep-links into a pre-filtered list. */
export function StatCards({ stats, onNavigate }: { stats: Stats; onNavigate: NavigateFn }) {
  const defs: StatDef[] = [
    {
      key: 'total',
      label: 'Total tasks',
      value: stats.total,
      hint: 'Everything in your workspace',
      icon: <ListTodo size={16} />,
      tone: 'accent',
      scope: 'all',
    },
    {
      key: 'dueToday',
      label: 'Due today',
      value: stats.dueToday,
      hint: 'On the clock right now',
      icon: <CalendarClock size={16} />,
      tone: 'info',
      scope: 'today',
    },
    {
      key: 'overdue',
      label: 'Overdue',
      value: stats.overdue,
      hint: 'Waiting to be rescheduled',
      icon: <AlertTriangle size={16} />,
      tone: 'warn',
      scope: 'overdue',
    },
    {
      key: 'completedToday',
      label: 'Completed today',
      value: stats.completedToday,
      hint: 'Your progress so far',
      icon: <CheckCircle2 size={16} />,
      tone: 'success',
      scope: 'completed',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {defs.map((def) => (
        <button
          key={def.key}
          type="button"
          aria-label={`${def.label}: ${def.value}`}
          onClick={() => {
            logger.info('dashboard.stat_click', { stat: def.key, scope: def.scope })
            onNavigate('tasks', { scope: def.scope })
          }}
          className="tf-card flex flex-col items-start gap-1 p-4 text-left transition-colors hover:border-accent/40"
        >
          <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${TONE[def.tone]}`}>
            {def.icon}
          </span>
          <span className="mt-1 text-2xl font-semibold tabular-nums">{def.value}</span>
          <span className="text-sm font-medium">{def.label}</span>
          <span className="text-xs text-muted">{def.hint}</span>
        </button>
      ))}
    </div>
  )
}

/** Completion ring plus an honest breakdown — every number is derived. */
export function OverviewCard({ stats, onNavigate }: { stats: Stats; onNavigate: NavigateFn }) {
  const percent = Math.round(stats.completionRate * 100)
  return (
    <section aria-label="Task overview" className="tf-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <ProgressRing percent={percent} label="completed" />
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold">Your progress</h3>
        <p className="mt-0.5 text-[13px] text-muted">
          {stats.completed} of {stats.total} tasks completed
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-muted">Active</dt>{' '}
            <dd className="font-medium tabular-nums">{stats.active}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Blocked</dt>{' '}
            <dd className="font-medium tabular-nums">{stats.blocked}</dd>
          </div>
        </dl>
        <div className="mt-3">
          <Button
            size="sm"
            onClick={() => {
              logger.info('dashboard.view_completed')
              onNavigate('tasks', { scope: 'completed' })
            }}
            icon={<ArrowRight size={13} />}
          >
            View completed
          </Button>
        </div>
      </div>
    </section>
  )
}
