/**
 * Pure focus-timer state machine (spec §8 / journey G6).
 *
 * The timer is timestamp-based (`startedAt` + banked `accumulatedMs`), so the
 * countdown stays correct while the tab is inactive or after a reload — the
 * UI never owns time, it only renders `timerElapsed(timer, now)`.
 *
 * Exactly one timer can exist (enforced by `start` rejecting a busy timer),
 * and a session is recorded by the same atomic transition that clears the
 * timer, so duplicate records are structurally impossible.
 */
import { createId } from '../../core/ids'
import { timerElapsed } from '../../store/selectors'
import type { FocusSession, TimerState } from '../../core/types'

export const EMPTY_FOCUS_TIMER: TimerState = { taskId: null, startedAt: null, accumulatedMs: 0, targetMs: null }

export type FocusIntent =
  | { type: 'startTask'; taskId: string; targetMs: number | null }
  | { type: 'startBreak'; targetMs: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | /** Record the session (when any real time was spent) and stop. */
    { type: 'end' }
  | /** Stop without recording anything (explicit user discard). */
    { type: 'discard' }

export type FocusError = 'busy' | 'idle' | 'not_running' | 'not_paused' | 'invalid_target' | 'invalid_task'

export type FocusTransition =
  | { ok: true; timer: TimerState; session: FocusSession | null }
  | { ok: false; error: FocusError }

export function isTimerIdle(timer: TimerState): boolean {
  return timer.taskId === null && timer.startedAt === null && timer.accumulatedMs === 0 && timer.targetMs === null
}

function isValidTarget(targetMs: number | null): boolean {
  return targetMs === null || (Number.isFinite(targetMs) && targetMs > 0)
}

/** Remaining time until the target; null for untimed (count-up) runs. */
export function remainingMs(timer: TimerState, now: number): number | null {
  if (timer.targetMs === null) return null
  return Math.max(0, timer.targetMs - timerElapsed(timer, now))
}

/** Builds a consistent session: startedAt + durationMs always agree with endedAt. */
export function makeSession(taskId: string, startedAt: number, endedAt: number): FocusSession {
  return {
    id: createId('session'),
    taskId,
    startedAt,
    endedAt,
    durationMs: Math.max(0, endedAt - startedAt),
    createdAt: endedAt,
  }
}

/**
 * Applies one intent at an instant. Returns the next timer plus the session to
 * record (null = record nothing). Invalid transitions are refused, never
 * guessed — the caller dispatches the returned timer with `timer/finish` (when
 * a session may be recorded) or `timer/set` (otherwise) in one dispatch.
 */
export function focusTransition(timer: TimerState, intent: FocusIntent, now: number): FocusTransition {
  switch (intent.type) {
    case 'startTask': {
      if (!isTimerIdle(timer)) return { ok: false, error: 'busy' }
      if (!isValidTarget(intent.targetMs)) return { ok: false, error: 'invalid_target' }
      if (intent.taskId.trim() === '') return { ok: false, error: 'invalid_task' }
      return {
        ok: true,
        timer: { taskId: intent.taskId, startedAt: now, accumulatedMs: 0, targetMs: intent.targetMs },
        session: null,
      }
    }

    case 'startBreak': {
      if (!isTimerIdle(timer)) return { ok: false, error: 'busy' }
      if (!isValidTarget(intent.targetMs)) return { ok: false, error: 'invalid_target' }
      return {
        ok: true,
        timer: { taskId: null, startedAt: now, accumulatedMs: 0, targetMs: intent.targetMs },
        session: null,
      }
    }

    case 'pause': {
      if (timer.startedAt === null) return { ok: false, error: 'not_running' }
      return {
        ok: true,
        timer: { ...timer, startedAt: null, accumulatedMs: timerElapsed(timer, now) },
        session: null,
      }
    }

    case 'resume': {
      if (isTimerIdle(timer)) return { ok: false, error: 'idle' }
      if (timer.startedAt !== null) return { ok: false, error: 'not_paused' }
      return { ok: true, timer: { ...timer, startedAt: now }, session: null }
    }

    case 'end': {
      if (isTimerIdle(timer)) return { ok: false, error: 'idle' }
      const elapsed = timerElapsed(timer, now)
      const session =
        timer.taskId !== null && elapsed > 0 ? makeSession(timer.taskId, now - elapsed, now) : null
      return { ok: true, timer: { ...EMPTY_FOCUS_TIMER }, session }
    }

    case 'discard': {
      if (isTimerIdle(timer)) return { ok: false, error: 'idle' }
      return { ok: true, timer: { ...EMPTY_FOCUS_TIMER }, session: null }
    }

    default: {
      const exhaustive: never = intent
      void exhaustive
      return { ok: false, error: 'idle' }
    }
  }
}
