import { describe, expect, it } from 'vitest'
import type { TimerState } from '../../core/types'
import { focusTransition, isTimerIdle, makeSession, remainingMs } from './timer'

const IDLE: TimerState = { taskId: null, startedAt: null, accumulatedMs: 0, targetMs: null }
const T0 = 1_700_000_000_000
const MIN = 60_000

describe('focusTransition', () => {
  it('starts a task session from idle with a target', () => {
    const result = focusTransition(IDLE, { type: 'startTask', taskId: 'task_1', targetMs: 25 * MIN }, T0)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.timer).toEqual({ taskId: 'task_1', startedAt: T0, accumulatedMs: 0, targetMs: 25 * MIN })
    expect(result.session).toBeNull()
  })

  it('allows a count-up session (targetMs null)', () => {
    const result = focusTransition(IDLE, { type: 'startTask', taskId: 'task_1', targetMs: null }, T0)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.timer.targetMs).toBeNull()
  })

  it('rejects starting while a session is already running (overlap guard)', () => {
    const running: TimerState = { taskId: 'task_1', startedAt: T0, accumulatedMs: 0, targetMs: 25 * MIN }
    const result = focusTransition(running, { type: 'startTask', taskId: 'task_2', targetMs: 25 * MIN }, T0 + MIN)
    expect(result).toEqual({ ok: false, error: 'busy' })
  })

  it('rejects starting while a session is paused', () => {
    const paused: TimerState = { taskId: 'task_1', startedAt: null, accumulatedMs: 5 * MIN, targetMs: 25 * MIN }
    const result = focusTransition(paused, { type: 'startTask', taskId: 'task_2', targetMs: null }, T0)
    expect(result).toEqual({ ok: false, error: 'busy' })
  })

  it('rejects invalid targets and empty task ids', () => {
    expect(focusTransition(IDLE, { type: 'startTask', taskId: 'task_1', targetMs: 0 }, T0)).toEqual({
      ok: false,
      error: 'invalid_target',
    })
    expect(focusTransition(IDLE, { type: 'startTask', taskId: 'task_1', targetMs: -MIN }, T0)).toEqual({
      ok: false,
      error: 'invalid_target',
    })
    expect(focusTransition(IDLE, { type: 'startTask', taskId: 'task_1', targetMs: Number.NaN }, T0)).toEqual({
      ok: false,
      error: 'invalid_target',
    })
    expect(focusTransition(IDLE, { type: 'startTask', taskId: '  ', targetMs: null }, T0)).toEqual({
      ok: false,
      error: 'invalid_task',
    })
  })

  it('starts a break (no task) with a positive target', () => {
    const result = focusTransition(IDLE, { type: 'startBreak', targetMs: 5 * MIN }, T0)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.timer).toEqual({ taskId: null, startedAt: T0, accumulatedMs: 0, targetMs: 5 * MIN })
    expect(result.session).toBeNull()
  })

  it('pauses a running session, banking only real elapsed time', () => {
    const running: TimerState = { taskId: 'task_1', startedAt: T0, accumulatedMs: 10 * MIN, targetMs: 25 * MIN }
    const result = focusTransition(running, { type: 'pause' }, T0 + 5 * MIN)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.timer).toEqual({ taskId: 'task_1', startedAt: null, accumulatedMs: 15 * MIN, targetMs: 25 * MIN })
    expect(result.session).toBeNull()
  })

  it('rejects pausing when idle or already paused', () => {
    expect(focusTransition(IDLE, { type: 'pause' }, T0)).toEqual({ ok: false, error: 'not_running' })
    const paused: TimerState = { taskId: 'task_1', startedAt: null, accumulatedMs: MIN, targetMs: null }
    expect(focusTransition(paused, { type: 'pause' }, T0)).toEqual({ ok: false, error: 'not_running' })
  })

  it('resumes a paused session without losing banked time', () => {
    const paused: TimerState = { taskId: 'task_1', startedAt: null, accumulatedMs: 15 * MIN, targetMs: 25 * MIN }
    const result = focusTransition(paused, { type: 'resume' }, T0 + 60 * MIN)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.timer).toEqual({ taskId: 'task_1', startedAt: T0 + 60 * MIN, accumulatedMs: 15 * MIN, targetMs: 25 * MIN })
  })

  it('rejects resuming when running or idle', () => {
    const running: TimerState = { taskId: 'task_1', startedAt: T0, accumulatedMs: 0, targetMs: null }
    expect(focusTransition(running, { type: 'resume' }, T0)).toEqual({ ok: false, error: 'not_paused' })
    expect(focusTransition(IDLE, { type: 'resume' }, T0)).toEqual({ ok: false, error: 'idle' })
  })

  it('preserves total elapsed time across pause/resume cycles', () => {
    let timer = focusTransition(IDLE, { type: 'startTask', taskId: 'task_1', targetMs: null }, T0)
    expect(timer.ok).toBe(true)
    if (!timer.ok) return
    const paused = focusTransition(timer.timer, { type: 'pause' }, T0 + 10 * MIN)
    expect(paused.ok).toBe(true)
    if (!paused.ok) return
    const resumed = focusTransition(paused.timer, { type: 'resume' }, T0 + 30 * MIN)
    expect(resumed.ok).toBe(true)
    if (!resumed.ok) return
    const ended = focusTransition(resumed.timer, { type: 'end' }, T0 + 35 * MIN)
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    expect(ended.session?.durationMs).toBe(15 * MIN)
  })

  it('ending a task session records actual elapsed time and clears the timer', () => {
    const running: TimerState = { taskId: 'task_1', startedAt: T0, accumulatedMs: 0, targetMs: 25 * MIN }
    const result = focusTransition(running, { type: 'end' }, T0 + 10 * MIN)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.timer).toEqual(IDLE)
    expect(result.session).not.toBeNull()
    expect(result.session?.taskId).toBe('task_1')
    expect(result.session?.durationMs).toBe(10 * MIN)
    expect(result.session?.endedAt).toBe(T0 + 10 * MIN)
    expect(result.session?.startedAt).toBe(T0 + 10 * MIN - 10 * MIN)
  })

  it('ending a paused session records the banked time', () => {
    const paused: TimerState = { taskId: 'task_1', startedAt: null, accumulatedMs: 5 * MIN, targetMs: 25 * MIN }
    const result = focusTransition(paused, { type: 'end' }, T0 + 999)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.session?.durationMs).toBe(5 * MIN)
    expect(result.timer).toEqual(IDLE)
  })

  it('ending a break records nothing', () => {
    const brk: TimerState = { taskId: null, startedAt: T0, accumulatedMs: 0, targetMs: 5 * MIN }
    const result = focusTransition(brk, { type: 'end' }, T0 + 2 * MIN)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.session).toBeNull()
    expect(result.timer).toEqual(IDLE)
  })

  it('ending an idle timer is rejected', () => {
    expect(focusTransition(IDLE, { type: 'end' }, T0)).toEqual({ ok: false, error: 'idle' })
  })

  it('ending with zero elapsed records nothing (no empty sessions)', () => {
    const running: TimerState = { taskId: 'task_1', startedAt: T0, accumulatedMs: 0, targetMs: 25 * MIN }
    const result = focusTransition(running, { type: 'end' }, T0)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.session).toBeNull()
    expect(result.timer).toEqual(IDLE)
  })

  it('discarding clears everything without recording', () => {
    const running: TimerState = { taskId: 'task_1', startedAt: T0, accumulatedMs: 20 * MIN, targetMs: 25 * MIN }
    const result = focusTransition(running, { type: 'discard' }, T0 + MIN)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.timer).toEqual(IDLE)
    expect(result.session).toBeNull()
    expect(focusTransition(IDLE, { type: 'discard' }, T0)).toEqual({ ok: false, error: 'idle' })
  })
})

describe('isTimerIdle', () => {
  it('is true only for a completely empty timer', () => {
    expect(isTimerIdle(IDLE)).toBe(true)
    expect(isTimerIdle({ taskId: 'task_1', startedAt: T0, accumulatedMs: 0, targetMs: null })).toBe(false)
    expect(isTimerIdle({ taskId: null, startedAt: null, accumulatedMs: MIN, targetMs: null })).toBe(false)
    expect(isTimerIdle({ taskId: null, startedAt: T0, accumulatedMs: 0, targetMs: 5 * MIN })).toBe(false)
    expect(isTimerIdle({ taskId: null, startedAt: null, accumulatedMs: 0, targetMs: 5 * MIN })).toBe(false)
  })
})

describe('remainingMs', () => {
  it('returns null for count-up timers', () => {
    const running: TimerState = { taskId: 'task_1', startedAt: T0, accumulatedMs: 0, targetMs: null }
    expect(remainingMs(running, T0 + MIN)).toBeNull()
  })

  it('counts down from the target and never goes negative', () => {
    const running: TimerState = { taskId: 'task_1', startedAt: T0, accumulatedMs: 5 * MIN, targetMs: 25 * MIN }
    expect(remainingMs(running, T0 + 10 * MIN)).toBe(10 * MIN)
    expect(remainingMs(running, T0 + 100 * MIN)).toBe(0)
  })
})

describe('makeSession', () => {
  it('builds a consistent session record', () => {
    const session = makeSession('task_1', T0, T0 + 25 * MIN)
    expect(session.taskId).toBe('task_1')
    expect(session.startedAt).toBe(T0)
    expect(session.endedAt).toBe(T0 + 25 * MIN)
    expect(session.durationMs).toBe(25 * MIN)
    expect(session.id).toMatch(/^session_/)
    expect(session.createdAt).toBe(T0 + 25 * MIN)
  })

  it('never records a negative duration', () => {
    const session = makeSession('task_1', T0 + MIN, T0)
    expect(session.durationMs).toBe(0)
  })
})
