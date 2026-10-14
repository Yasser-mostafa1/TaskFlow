import { ArrowRight, Check, Sparkles } from 'lucide-react'
import type { NavigateFn } from '../../app/Navigation'
import { logger } from '../../core/logger'
import type { Task } from '../../core/types'
import { useDispatch, useAppState } from '../../store/AppStoreContext'
import { DueBadge, PriorityBadge, StatusBadge } from '../../ui/Badges'
import { Button } from '../../ui/Button'
import { useToast } from '../../ui/Feedback'
import { recommendNext } from '../recommend/rules'

/**
 * "What should I do now?" — the deterministic rule engine with its reason
 * shown to the user (spec §10, journey G5). Blocked and completed tasks are
 * never proposed.
 */
export function RecommendCard({
  blockedCount,
  onNavigate,
  onOpenTask,
}: {
  blockedCount: number
  onNavigate: NavigateFn
  onOpenTask: (task: Task) => void
}) {
  const state = useAppState()
  const dispatch = useDispatch()
  const toast = useToast()
  const now = new Date()
  const rec = recommendNext(state, now)

  const complete = () => {
    if (!rec) return
    dispatch({ type: 'task/setStatus', ids: [rec.task.id], status: 'completed' })
    logger.info('dashboard.recommend_complete', { taskId: rec.task.id })
    toast.push('success', 'Task completed.')
  }

  return (
    <section aria-label="What should I do now?" className="tf-card flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <Sparkles size={16} />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">What should I do now?</h3>
          <p className="text-xs text-muted">Deterministic rules — no AI, no guessing.</p>
        </div>
      </div>

      {rec ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                logger.info('dashboard.recommend_open', { taskId: rec.task.id })
                onOpenTask(rec.task)
              }}
              className="truncate text-left text-sm font-medium hover:text-accent"
            >
              {rec.task.title}
            </button>
            <StatusBadge status={rec.task.status} />
            <PriorityBadge priority={rec.task.priority} />
            <DueBadge task={rec.task} now={now} />
          </div>

          <p className="flex items-start gap-1.5 rounded-lg bg-accent-soft px-3 py-2 text-[13px] text-accent">
            <Sparkles size={13} className="mt-0.5 shrink-0" />
            {rec.reason}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" icon={<Check size={14} />} onClick={complete}>
              Mark complete
            </Button>
            <Button
              size="sm"
              icon={<ArrowRight size={13} />}
              onClick={() => onNavigate('tasks')}
            >
              View all tasks
            </Button>
          </div>

          {blockedCount > 0 && (
            <p className="text-xs text-warn">
              {blockedCount} task{blockedCount === 1 ? ' is' : 's are'} waiting on dependencies — finish their
              prerequisites to unlock {blockedCount === 1 ? 'it' : 'them'}.
            </p>
          )}
        </>
      ) : (
        <p className="text-[13px] text-muted">
          {state.tasks.length === 0
            ? 'Add a task above and it will show up here.'
            : 'Nothing to suggest — every task is either done or waiting on another task.'}
        </p>
      )}
    </section>
  )
}
