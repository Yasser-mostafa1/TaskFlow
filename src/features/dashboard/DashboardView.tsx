import { Plus, Sparkles } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import type { NavigateFn } from '../../app/Navigation'
import { dateKey, formatDayHeading, greeting } from '../../core/dates'
import type { Task } from '../../core/types'
import { useAppState } from '../../store/AppStoreContext'
import { attentionTasks, computeStats, indexTasks, upcomingTasks, weeklyActivity } from '../../store/selectors'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { PageHeader } from '../../ui/PageHeader'
import { Reveal } from '../../ui/Reveal'
import { QuickAdd } from '../tasks/QuickAdd'
import { TaskEditor } from '../tasks/TaskEditor'
import { AttentionPanel, TimerBanner, UpcomingPanel, WeeklyPanel } from './ActivityPanels'
import { RecommendCard } from './RecommendCard'
import { OverviewCard, StatCards } from './StatCards'

/**
 * Dashboard (spec §5): greeting, real counts, quick-add, deterministic
 * recommendation, attention and upcoming lists, and a weekly summary —
 * every element is a projection of the same store, nothing hardcoded.
 */
export function DashboardView({ onNavigate }: { onNavigate: NavigateFn }) {
  const state = useAppState()
  const now = useMemo(() => new Date(), [state.tasks])
  const stats = useMemo(() => computeStats(state, now), [state, now])
  const attention = useMemo(() => attentionTasks(state, now), [state, now])
  const upcoming = useMemo(() => upcomingTasks(state, now, 7), [state, now])
  const week = useMemo(() => weeklyActivity(state, now), [state, now])

  const [editing, setEditing] = useState<Task | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)

  const openNew = useCallback(() => {
    setEditing(null)
    setEditorOpen(true)
  }, [])

  const openEdit = useCallback((task: Task) => {
    setEditing(task)
    setEditorOpen(true)
  }, [])

  const timerTask =
    state.timer.taskId === null ? null : indexTasks(state.tasks).get(state.timer.taskId) ?? null

  const dayLine = formatDayHeading(dateKey(now))
  const description =
    stats.total === 0
      ? `${dayLine} · Add your first task below`
      : `${dayLine} · ${stats.active} active · ${stats.dueToday} due today · ${stats.overdue} overdue`

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={greeting(now)}
        description={description}
        actions={
          <Button variant="primary" icon={<Plus size={15} />} onClick={openNew}>
            New task
          </Button>
        }
      />

      {timerTask && (
        <Reveal className="mb-4">
          <TimerBanner task={timerTask} timer={state.timer} onNavigate={onNavigate} />
        </Reveal>
      )}

      <Reveal delay={0.02} className="mb-4">
        <StatCards stats={stats} onNavigate={onNavigate} />
      </Reveal>

      <Reveal delay={0.04} className="mb-4">
        <QuickAdd />
      </Reveal>

      <Reveal delay={0.06} className="mb-4">
        <OverviewCard stats={stats} onNavigate={onNavigate} />
      </Reveal>

      {stats.total === 0 ? (
        <Reveal delay={0.08}>
          <EmptyState
            icon={<Sparkles size={28} />}
            title="Welcome to TaskFlow"
            description="Add your first task above — the dashboard fills itself in: counts, recommendations, deadlines and your week, all computed from what you actually do."
          />
        </Reveal>
      ) : (
        <div className="grid gap-4">
          <Reveal delay={0.08}>
            <RecommendCard blockedCount={stats.blocked} onNavigate={onNavigate} onOpenTask={openEdit} />
          </Reveal>
          <div className="grid gap-4 lg:grid-cols-2">
            <Reveal delay={0.1}>
              <AttentionPanel tasks={attention} now={now} onNavigate={onNavigate} onOpenTask={openEdit} />
            </Reveal>
            <Reveal delay={0.12}>
              <UpcomingPanel tasks={upcoming} now={now} onNavigate={onNavigate} onOpenTask={openEdit} />
            </Reveal>
          </div>
          <Reveal delay={0.14}>
            <WeeklyPanel days={week} />
          </Reveal>
        </div>
      )}

      <TaskEditor open={editorOpen} task={editing} onClose={() => setEditorOpen(false)} />
    </div>
  )
}
