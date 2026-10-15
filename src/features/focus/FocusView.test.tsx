import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SectionId } from '../../core/types'
import { makeState, makeTask } from '../../test/factories'
import { renderWithApp } from '../../test/render'
import { FocusView } from './FocusView'

const MIN = 60_000

function noNavigate(): (section: SectionId) => void {
  return () => undefined
}

describe('FocusView', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('offers an onboarding state when there is nothing to focus on', () => {
    const onNavigate = vi.fn()
    renderWithApp(<FocusView onNavigate={onNavigate} />, { tasks: [] })
    expect(screen.getByText('No tasks to focus on')).toBeInTheDocument()
    const open = screen.getByRole('button', { name: 'Open My Tasks' })
    expect(open).toBeInTheDocument()
  })

  it('lists active tasks in the picker but never completed ones', () => {
    renderWithApp(<FocusView onNavigate={noNavigate()} />, {
      tasks: [makeTask({ title: 'Write report' }), makeTask({ title: 'Done already', status: 'completed' })],
    })
    expect(screen.getByRole('button', { name: /Focus on Write report/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Focus on Done already/ })).not.toBeInTheDocument()
  })

  it('starts a25-minute session for the selected task (countdown, store timer)', async () => {
    const user = userEvent.setup()
    const { store } = renderWithApp(<FocusView onNavigate={noNavigate()} />, {
      tasks: [makeTask({ title: 'Deep work', id: 'task_focus_1' })],
    })

    await user.click(screen.getByRole('button', { name: /Focus on Deep work/ }))
    await user.click(screen.getByRole('tab', { name: '25 min' }))
    await user.click(screen.getByRole('button', { name: 'Start focus' }))

    expect(store.get().timer.taskId).toBe('task_focus_1')
    expect(store.get().timer.targetMs).toBe(25 * MIN)
    const timer = screen.getByRole('timer')
    expect(timer.textContent).toMatch(/24:5\d|25:00/)
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'End session' })).toBeInTheDocument()
    // No second timer can be started while one runs.
    expect(screen.queryByRole('button', { name: 'Start focus' })).not.toBeInTheDocument()
  })

  it('rejects a second start while the timer is already running (single session)', () => {
    const task = makeTask({ title: 'Already running' })
    const { store } = renderWithApp(<FocusView onNavigate={noNavigate()} />, {
      tasks: [task],
      timer: { taskId: task.id, startedAt: Date.now(), accumulatedMs: 0, targetMs: 25 * MIN },
    })
    // The running view replaces the picker entirely.
    expect(screen.getByRole('timer')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start focus' })).not.toBeInTheDocument()
    expect(store.get().timer.taskId).toBe(task.id)
  })

  it('pauses and resumes without losing elapsed time', async () => {
    const user = userEvent.setup()
    const task = makeTask({ title: 'Pause me' })
    const { store } = renderWithApp(<FocusView onNavigate={noNavigate()} />, {
      tasks: [task],
      timer: { taskId: task.id, startedAt: Date.now() - 10 * MIN, accumulatedMs: 5 * MIN, targetMs: 25 * MIN },
    })

    await user.click(screen.getByRole('button', { name: 'Pause' }))
    expect(store.get().timer.startedAt).toBeNull()
    expect(store.get().timer.accumulatedMs).toBeGreaterThanOrEqual(10 * MIN)
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Resume' }))
    expect(store.get().timer.startedAt).not.toBeNull()
    expect(store.get().timer.accumulatedMs).toBeGreaterThanOrEqual(10 * MIN)
  })

  it('resumes with the correct remaining time after a reload (timestamp-based)', () => {
    const task = makeTask({ title: 'Survives reload' })
    renderWithApp(<FocusView onNavigate={noNavigate()} />, {
      tasks: [task],
      timer: { taskId: task.id, startedAt: Date.now() - 10 * MIN, accumulatedMs: 0, targetMs: 25 * MIN },
    })
    expect(screen.getByRole('timer').textContent).toMatch(/^(14:5\d|15:00)$/)
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  it('ends the session, records real elapsed time and never completes the task', async () => {
    const user = userEvent.setup()
    const task = makeTask({ title: 'Do not auto-complete' })
    const { store } = renderWithApp(<FocusView onNavigate={noNavigate()} />, {
      tasks: [task],
      timer: { taskId: task.id, startedAt: Date.now() - 12 * MIN, accumulatedMs: 0, targetMs: 25 * MIN },
    })

    await user.click(screen.getByRole('button', { name: 'End session' }))

    const sessions = store.get().sessions
    expect(sessions).toHaveLength(1)
    expect(sessions[0]?.taskId).toBe(task.id)
    expect(sessions[0]?.durationMs).toBeGreaterThanOrEqual(12 * MIN - 1000)
    expect(store.get().timer).toEqual({ taskId: null, startedAt: null, accumulatedMs: 0, targetMs: null })
    // The task itself is untouched.
    expect(store.get().tasks[0]?.status).toBe('todo')
    // Back to the picker.
    expect(screen.getByRole('button', { name: 'Start focus' })).toBeInTheDocument()
  })

  it('asking to discard requires confirmation and records nothing', async () => {
    const user = userEvent.setup()
    const task = makeTask({ title: 'Discard me' })
    const { store } = renderWithApp(<FocusView onNavigate={noNavigate()} />, {
      tasks: [task],
      timer: { taskId: task.id, startedAt: Date.now() - 3 * MIN, accumulatedMs: 0, targetMs: 25 * MIN },
    })

    await user.click(screen.getByRole('button', { name: 'Discard' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Discard session' }))

    expect(store.get().sessions).toHaveLength(0)
    expect(store.get().timer.taskId).toBeNull()
  })

  it('cancelling the discard keeps the session running', async () => {
    const user = userEvent.setup()
    const task = makeTask({ title: 'Keep running' })
    const { store } = renderWithApp(<FocusView onNavigate={noNavigate()} />, {
      tasks: [task],
      timer: { taskId: task.id, startedAt: Date.now(), accumulatedMs: 0, targetMs: 25 * MIN },
    })

    await user.click(screen.getByRole('button', { name: 'Discard' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(store.get().timer.taskId).toBe(task.id)
  })

  it('shows the idle picker again when the focused task is deleted mid-session', () => {
    const task = makeTask({ title: 'Will vanish' })
    const other = makeTask({ title: 'Stays around' })
    const { store } = renderWithApp(<FocusView onNavigate={noNavigate()} />, {
      tasks: [task, other],
      timer: { taskId: task.id, startedAt: Date.now(), accumulatedMs: 0, targetMs: 25 * MIN },
    })
    expect(screen.getByRole('timer')).toBeInTheDocument()

    act(() => {
      store.dispatch({ type: 'task/remove', ids: [task.id] })
    })
    expect(screen.getByRole('button', { name: 'Start focus' })).toBeInTheDocument()
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
  })

  it('offers a break from settings and records no session for it', async () => {
    const user = userEvent.setup()
    const { store } = renderWithApp(
      <FocusView onNavigate={noNavigate()} />,
      { tasks: [makeTask({ title: 'Any task' })] },
      { shortBreakMinutes: 7 },
    )

    await user.click(screen.getByRole('button', { name: 'Start 7m break' }))
    expect(store.get().timer.taskId).toBeNull()
    expect(store.get().timer.targetMs).toBe(7 * MIN)
    expect(screen.getByRole('timer')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Skip break' }))
    expect(store.get().timer.taskId).toBeNull()
    expect(store.get().sessions).toHaveLength(0)
  })

  it('auto-finishes when the countdown reaches zero, records the session, task stays open', async () => {
    vi.useFakeTimers()
    const task = makeTask({ title: 'Almost done' })
    const { store } = renderWithApp(<FocusView onNavigate={noNavigate()} />, {
      tasks: [task],
      // 500ms short of its 60s target: the effect schedules the natural finish.
      timer: { taskId: task.id, startedAt: Date.now() - 59_500, accumulatedMs: 0, targetMs: 60_000 },
    })

    await vi.advanceTimersByTimeAsync(1_500)

    expect(store.get().sessions).toHaveLength(1)
    expect(store.get().sessions[0]?.durationMs).toBeGreaterThanOrEqual(60_000)
    expect(store.get().timer.taskId).toBeNull()
    expect(store.get().tasks[0]?.status).toBe('todo')
  })

  it('shows today’s real focus total and the session history', () => {
    const task = makeTask({ title: 'Tracked task' })
    const startedAt = Date.now() - 60 * MIN
    renderWithApp(
      <FocusView onNavigate={noNavigate()} />,
      {
        tasks: [task],
        sessions: [
          {
            id: 's1',
            taskId: task.id,
            startedAt,
            endedAt: startedAt + 30 * MIN,
            durationMs: 30 * MIN,
            createdAt: startedAt + 30 * MIN,
          },
        ],
      },
      {},
    )
    expect(screen.getByText('Today: 30m focused')).toBeInTheDocument()
    const history = screen.getByRole('region', { name: 'Session history' })
    expect(within(history).getByText('Tracked task')).toBeInTheDocument()
    expect(within(history).getByText('30m')).toBeInTheDocument()
  })

  it('renders the subtask checklist of the focused task and toggles items', async () => {
    const user = userEvent.setup()
    const task = makeTask({
      title: 'With subtasks',
      subtasks: [{ id: 'sub1', title: 'First step', done: false }],
    })
    const { store } = renderWithApp(<FocusView onNavigate={noNavigate()} />, {
      tasks: [task],
      timer: { taskId: task.id, startedAt: Date.now(), accumulatedMs: 0, targetMs: 25 * MIN },
    })

    const box = screen.getByRole('checkbox', { name: 'First step' })
    await user.click(box)
    expect(store.get().tasks[0]?.subtasks[0]?.done).toBe(true)
  })

  it('shows a friendly state when the timer is paused (no panic, clear controls)', async () => {
    const user = userEvent.setup()
    const task = makeTask({ title: 'Paused state' })
    renderWithApp(<FocusView onNavigate={noNavigate()} />, {
      tasks: [task],
      timer: { taskId: task.id, startedAt: null, accumulatedMs: 4 * MIN, targetMs: 25 * MIN },
    })
    expect(screen.getByText('Paused')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Resume' }))
    expect(screen.getByText('Focusing')).toBeInTheDocument()
  })
})
