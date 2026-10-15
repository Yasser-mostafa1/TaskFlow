import { CheckCircle2, Coffee, ListChecks, Pause, Play, Square, Timer, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { NavigateFn } from '../../app/Navigation'
import { useSettings } from '../../app/SettingsContext'
import { dateKey, formatClock, formatDuration } from '../../core/dates'
import { logger } from '../../core/logger'
import type { Task, TimerState } from '../../core/types'
import { useDispatch, useAppState } from '../../store/AppStoreContext'
import { indexTasks, timerElapsed } from '../../store/selectors'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { Field, Input } from '../../ui/Field'
import { useConfirm, useToast } from '../../ui/Feedback'
import { PageHeader } from '../../ui/PageHeader'
import { Reveal } from '../../ui/Reveal'
import { Segmented } from '../../ui/Segmented'
import { notifySessionComplete } from './notify'
import { focusTransition, isTimerIdle, remainingMs, type FocusError, type FocusIntent } from './timer'

const MINUTE = 60_000
const PRESETS = [25, 50]
const HISTORY_LIMIT = 8

const ERROR_MESSAGE: Record<FocusError, string> = {
  busy: 'A focus session is already running.',
  idle: 'There is no active session.',
  not_running: 'The session is already paused.',
  not_paused: 'The session is already running.',
  invalid_target: 'Pick a duration between 1 and 240 minutes.',
  invalid_task: 'Select a task first.',
}

function isValidMinutes(text: string): boolean {
  const value = Number(text)
  return Number.isInteger(value) && value >= 1 && value <= 240
}

/**
 * Focus Mode (spec §8 / journey G6): one timestamp-based countdown that stays
 * accurate across inactive tabs and reloads, sessions recorded with their real
 * elapsed time, and never a task completed behind the user's back.
 */
export function FocusView({ onNavigate }: { onNavigate: NavigateFn }) {
  const state = useAppState()
  const dispatch = useDispatch()
  const toast = useToast()
  const confirm = useConfirm()
  const { settings } = useSettings()

  const timer = state.timer
  const timerRef = useRef<TimerState>(timer)
  timerRef.current = timer

  const byId = useMemo(() => indexTasks(state.tasks), [state.tasks])
  const activeTasks = useMemo(() => state.tasks.filter((t) => t.status !== 'completed'), [state.tasks])

  const active = !isTimerIdle(timer)
  const isBreak = active && timer.taskId === null
  const focusedTask = timer.taskId === null ? null : byId.get(timer.taskId) ?? null

  const [tick, setTick] = useState(() => Date.now())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [choice, setChoice] = useState<string>(() =>
    PRESETS.includes(settings.focusDurationMinutes) ? String(settings.focusDurationMinutes) : 'custom',
  )
  const [customText, setCustomText] = useState(() => String(settings.focusDurationMinutes))
  const [customError, setCustomError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const selected = selectedId === null ? null : byId.get(selectedId) ?? null
  const customValid = isValidMinutes(customText)
  const minutes = choice === 'custom' ? Number(customText) : Number(choice)
  const targetMs = Number.isFinite(minutes) && minutes >= 1 ? minutes * MINUTE : null

  /* ------------------------------ persistence ----------------------------- */

  /** One dispatch per transition: `timer/finish` (atomic record+clear) or `timer/set`. */
  const apply = useCallback(
    (intent: FocusIntent, opts: { silent?: boolean } = {}) => {
      const result = focusTransition(timerRef.current, intent, Date.now())
      if (!result.ok) {
        if (!opts.silent) toast.push('error', ERROR_MESSAGE[result.error])
        return null
      }
      if (intent.type === 'end' || intent.type === 'discard') {
        dispatch({ type: 'timer/finish', session: result.session })
      } else {
        dispatch({ type: 'timer/set', timer: result.timer })
      }
      if (result.session !== null) {
        const focusedMinutes = Math.max(1, Math.round(result.session.durationMs / MINUTE))
        toast.push('success', `Focus session saved — ${formatDuration(focusedMinutes)}.`)
        logger.info('focus.session.saved', {
          taskId: result.session.taskId,
          minutes: focusedMinutes,
          plannedMinutes: minutes,
        })
      }
      return result
    },
    [dispatch, toast, minutes],
  )

  /* -------------------------------- ticking -------------------------------- */

  useEffect(() => {
    if (!active || timer.startedAt === null) return undefined
    const id = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active, timer.startedAt])

  /** Inactive tabs throttle intervals — resync from timestamps when visible. */
  useEffect(() => {
    const resync = () => setTick(Date.now())
    document.addEventListener('visibilitychange', resync)
    window.addEventListener('focus', resync)
    return () => {
      document.removeEventListener('visibilitychange', resync)
      window.removeEventListener('focus', resync)
    }
  }, [])

  const naturalFinish = useCallback(() => {
    const current = timerRef.current
    const result = focusTransition(current, { type: 'end' }, Date.now())
    if (!result.ok) return
    dispatch({ type: 'timer/finish', session: result.session })
    if (result.session === null) return
    const finishedTask = current.taskId === null ? null : byId.get(current.taskId) ?? null
    const focusedMinutes = Math.max(1, Math.round(result.session.durationMs / MINUTE))
    setAnnouncement(`Focus session complete — ${formatDuration(focusedMinutes)} recorded.`)
    toast.push('success', `Time's up — session saved (${formatDuration(focusedMinutes)}).`)
    logger.info('focus.session.completed', { taskId: current.taskId ?? 'break', minutes: focusedMinutes })
    if (settings.notificationsEnabled) {
      notifySessionComplete(
        'Focus session complete',
        finishedTask
          ? `${formatDuration(focusedMinutes)} on “${finishedTask.title}”.`
          : `${formatDuration(focusedMinutes)} of focus time.`,
      )
    }
  }, [byId, dispatch, toast, settings.notificationsEnabled])

  /** Auto-finish at the target instant — the timestamp math survives throttling. */
  useEffect(() => {
    if (!active || timer.startedAt === null || timer.targetMs === null) return undefined
    const remaining = remainingMs(timer, Date.now())
    if (remaining === null) return undefined
    if (remaining <= 0) {
      naturalFinish()
      return undefined
    }
    const id = setTimeout(naturalFinish, remaining)
    return () => clearTimeout(id)
  }, [active, timer, naturalFinish])

  /* -------------------------------- actions -------------------------------- */

  const startSelected = () => {
    if (!selected) return
    const result = apply({ type: 'startTask', taskId: selected.id, targetMs })
    if (result?.ok) setAnnouncement('Focus session started.')
  }

  const startBreak = (breakMinutes: number) => {
    const result = apply({ type: 'startBreak', targetMs: breakMinutes * MINUTE })
    if (result?.ok) setAnnouncement(`${breakMinutes}-minute break started.`)
  }

  const pause = () => {
    const result = apply({ type: 'pause' })
    if (result?.ok) setAnnouncement('Session paused.')
  }

  const resume = () => {
    const result = apply({ type: 'resume' })
    if (result?.ok) setAnnouncement('Session resumed.')
  }

  const endSession = () => {
    apply({ type: 'end' })
    setAnnouncement('Session ended and saved.')
  }

  const discard = async () => {
    if (isBreak) {
      apply({ type: 'discard' })
      setAnnouncement('Break skipped.')
      return
    }
    const confirmed = await confirm({
      title: 'Discard this session?',
      message:
        'The time tracked so far will not be recorded as a focus session. This cannot be undone.',
      confirmLabel: 'Discard session',
      destructive: true,
    })
    if (confirmed) {
      apply({ type: 'discard' })
      setAnnouncement('Session discarded.')
    }
  }

  const toggleSubtask = (task: Task, subtaskId: string) => {
    dispatch({
      type: 'task/update',
      id: task.id,
      patch: {
        subtasks: task.subtasks.map((sub) => (sub.id === subtaskId ? { ...sub, done: !sub.done } : sub)),
      },
    })
  }

  /* -------------------------------- derived -------------------------------- */

  const elapsedMs = timerElapsed(timer, tick)
  const remaining = remainingMs(timer, tick)
  const clock = remaining !== null ? formatClock(remaining) : formatClock(elapsedMs)
  const running = timer.startedAt !== null

  const today = dateKey(new Date())
  const todayMinutes = state.sessions
    .filter((session) => dateKey(new Date(session.startedAt)) === today)
    .reduce((sum, session) => sum + Math.round(session.durationMs / MINUTE), 0)
  const history = useMemo(
    () => [...state.sessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, HISTORY_LIMIT),
    [state.sessions],
  )

  /* --------------------------------- view --------------------------------- */

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Focus Mode"
        description="Work on one task at a time. The countdown follows the clock, so it stays right even if you switch tabs or reload."
      />

      <p role="status" className="sr-only">
        {announcement}
      </p>

      {active ? (
        <Reveal>
          <section aria-label={isBreak ? 'Break' : 'Focus session'} className="tf-card p-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-on-accent">
                {isBreak ? <Coffee size={20} /> : <Timer size={20} />}
              </span>
              {isBreak ? (
                <>
                  <h3 className="text-sm font-semibold">Break time</h3>
                  <p className="text-sm text-muted">Step away — the countdown keeps running.</p>
                </>
              ) : (
                <>
                  <h3 className="max-w-full truncate text-base font-semibold">{focusedTask?.title ?? 'Session'}</h3>
                  <span
                    className={`tf-badge ${
                      running ? 'border-accent/40 bg-accent-soft text-accent' : 'border-warn/40 bg-warn-soft text-warn'
                    }`}
                  >
                    {running ? 'Focusing' : 'Paused'}
                  </span>
                </>
              )}

              <div
                role="timer"
                aria-label={remaining !== null ? 'Time remaining' : 'Time focused'}
                className="text-5xl font-semibold tabular-nums tracking-tight"
              >
                {clock}
              </div>
              {remaining !== null && (
                <p className="text-xs text-muted">
                  {formatDuration(Math.round(remaining / MINUTE))} left of {formatDuration(Math.round((timer.targetMs ?? 0) / MINUTE))}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-center gap-2">
                {isBreak ? (
                  <Button variant="secondary" icon={<Square size={14} />} onClick={() => apply({ type: 'discard' })}>
                    Skip break
                  </Button>
                ) : (
                  <>
                    {running ? (
                      <Button variant="primary" icon={<Pause size={14} />} onClick={pause}>
                        Pause
                      </Button>
                    ) : (
                      <Button variant="primary" icon={<Play size={14} />} onClick={resume}>
                        Resume
                      </Button>
                    )}
                    <Button variant="secondary" icon={<CheckCircle2 size={14} />} onClick={endSession}>
                      End session
                    </Button>
                    <Button variant="ghost" icon={<Trash2 size={14} />} onClick={() => void discard()}>
                      Discard
                    </Button>
                  </>
                )}
              </div>

              {!isBreak && focusedTask && focusedTask.subtasks.length > 0 && (
                <section aria-label="Subtasks" className="w-full max-w-md border-t border-line pt-4 text-left">
                  <p className="mb-2 flex items-center gap-2 text-xs font-medium text-muted">
                    <ListChecks size={13} /> Checklist
                  </p>
                  <ul className="space-y-1.5">
                    {focusedTask.subtasks.map((sub) => (
                      <li key={sub.id}>
                        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[var(--c-accent)]"
                            checked={sub.done}
                            onChange={() => toggleSubtask(focusedTask, sub.id)}
                          />
                          <span className={sub.done ? 'text-muted line-through' : ''}>{sub.title}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </section>
        </Reveal>
      ) : activeTasks.length === 0 ? (
        <Reveal>
          <EmptyState
            icon={<Timer size={28} />}
            title="No tasks to focus on"
            description="Focus mode works on active tasks. Add a task first, then come back here to give it your full attention."
            action={
              <Button variant="primary" onClick={() => onNavigate('tasks')}>
                Open My Tasks
              </Button>
            }
          />
        </Reveal>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Reveal>
            <section aria-label="Start a session" className="tf-card p-4">
              <h3 className="mb-3 text-sm font-semibold">Pick a task</h3>
              <ul className="mb-4 max-h-64 space-y-1 overflow-y-auto">
                {activeTasks.map((task) => {
                  const isSelected = task.id === selectedId
                  return (
                    <li key={task.id}>
                      <button
                        type="button"
                        aria-label={`Focus on ${task.title}`}
                        aria-pressed={isSelected}
                        onClick={() => setSelectedId(task.id)}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                          isSelected
                            ? 'border-accent bg-accent-soft text-accent'
                            : 'border-line bg-surface hover:bg-surface-2'
                        }`}
                      >
                        <span className="min-w-0 truncate font-medium">{task.title}</span>
                        {task.priority === 'high' && <span className="tf-badge border-warn/40 bg-warn-soft text-warn">High</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>

              <div className="mb-4">
                <p className="tf-label">Focus length</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Segmented
                    ariaLabel="Focus duration"
                    value={choice}
                    onChange={setChoice}
                    options={[
                      ...PRESETS.map((value) => ({ value: String(value), label: `${value} min` })),
                      { value: 'custom', label: 'Custom' },
                    ]}
                  />
                  {choice === 'custom' && (
                    <div className="w-28">
                      <Field label="Custom minutes" error={customError ?? undefined}>
                        {(id, describedBy) => (
                          <Input
                            id={id}
                            aria-describedby={describedBy}
                            type="number"
                            min={1}
                            max={240}
                            value={customText}
                            onChange={(event) => {
                              const text = event.target.value
                              setCustomText(text)
                              setCustomError(isValidMinutes(text) || text === '' ? null : 'Must be between 1 and 240 minutes.')
                            }}
                          />
                        )}
                      </Field>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  icon={<Play size={14} />}
                  disabled={!selected || (choice === 'custom' && !customValid)}
                  onClick={startSelected}
                >
                  Start focus
                </Button>
                <Button variant="secondary" icon={<Coffee size={14} />} onClick={() => startBreak(settings.shortBreakMinutes)}>
                  Start {settings.shortBreakMinutes}m break
                </Button>
                <Button variant="ghost" icon={<Coffee size={14} />} onClick={() => startBreak(settings.longBreakMinutes)}>
                  Start {settings.longBreakMinutes}m break
                </Button>
              </div>
            </section>
          </Reveal>

          <Reveal delay={0.04}>
            <section aria-label="Session history" className="tf-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Session history</h3>
                <span className="tf-badge border-info/30 bg-info-soft text-info">
                  Today: {todayMinutes}m focused
                </span>
              </div>
              {history.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">
                  No focus sessions yet — completed time shows up here.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {history.map((session) => {
                    const task = byId.get(session.taskId)
                    const started = new Date(session.startedAt)
                    return (
                      <li key={session.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{task?.title ?? 'Removed task'}</p>
                          <p className="text-xs text-muted">
                            {new Intl.DateTimeFormat(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            }).format(started)}
                          </p>
                        </div>
                        <span className="shrink-0 tabular-nums text-muted">
                          {formatDuration(Math.round(session.durationMs / MINUTE))}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </Reveal>
        </div>
      )}
    </div>
  )
}
