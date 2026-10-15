import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen, within } from '@testing-library/react'
import { renderWithApp } from '../../test/render'
import { makeState, makeTask } from '../../test/factories'
import { addDaysKey, dateKey, formatDayHeading, greeting } from '../../core/dates'
import { DashboardView } from './DashboardView'

const today = dateKey(new Date())
const inThreeDays = addDaysKey(today, 3)
const past = addDaysKey(today, -5)

function seededState() {
  return {
    tasks: [
      makeTask({ title: 'Late chore', dueDate: past }),
      makeTask({ title: 'Today chore', dueDate: today }),
      makeTask({ title: 'Future chore', dueDate: inThreeDays }),
      makeTask({ title: 'Finished chore', status: 'completed', completedAt: Date.now() }),
    ],
  }
}

describe('dashboard header (spec §5)', () => {
  it('greets by local time and shows the real day heading', () => {
    renderWithApp(<DashboardView onNavigate={vi.fn()} />)
    expect(screen.getByRole('heading', { name: greeting(new Date()) })).toBeInTheDocument()
    const heading = formatDayHeading(dateKey(new Date()))
    expect(
      screen.getByText((content, element) => element?.tagName === 'P' && content.includes(heading)),
    ).toBeInTheDocument()
  })

  it('creates tasks from the quick-add box and updates the cards', async () => {
    const user = userEvent.setup()
    const { store } = renderWithApp(<DashboardView onNavigate={vi.fn()} />)

    await user.type(screen.getByLabelText('Quick add task'), 'Write weekly report{Enter}')

    expect(store.get().tasks).toHaveLength(1)
    expect(await screen.findByRole('button', { name: 'Total tasks: 1' })).toBeInTheDocument()
  })

  it('opens the task editor from the header button', async () => {
    const user = userEvent.setup()
    renderWithApp(<DashboardView onNavigate={vi.fn()} />, seededState())

    await user.click(screen.getByRole('button', { name: 'New task' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})

describe('stat cards', () => {
  it('shows counts derived from real state', () => {
    renderWithApp(<DashboardView onNavigate={vi.fn()} />, seededState())

    expect(screen.getByRole('button', { name: 'Total tasks: 4' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Due today: 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Overdue: 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Completed today: 1' })).toBeInTheDocument()
  })

  it('opens a pre-filtered task list from each card', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    renderWithApp(<DashboardView onNavigate={onNavigate} />, seededState())

    await user.click(screen.getByRole('button', { name: 'Overdue: 1' }))
    expect(onNavigate).toHaveBeenCalledWith('tasks', { scope: 'overdue' })

    await user.click(screen.getByRole('button', { name: 'Due today: 1' }))
    expect(onNavigate).toHaveBeenCalledWith('tasks', { scope: 'today' })

    await user.click(screen.getByRole('button', { name: 'Completed today: 1' }))
    expect(onNavigate).toHaveBeenCalledWith('tasks', { scope: 'completed' })
  })
})

describe('overview card', () => {
  it('reports a real completion ring with honest breakdowns', () => {
    renderWithApp(<DashboardView onNavigate={vi.fn()} />, seededState())
    const overview = screen.getByRole('region', { name: 'Task overview' })

    expect(within(overview).getByText('25%')).toBeInTheDocument()
    expect(within(overview).getByText('1 of 4 tasks completed')).toBeInTheDocument()
    const activeRow = within(overview).getByText('Active').parentElement
    expect(activeRow).toHaveTextContent('Active 3')
  })

  it('never fabricates a rate on an empty workspace', () => {
    renderWithApp(<DashboardView onNavigate={vi.fn()} />)
    expect(screen.getByText('0%')).toBeInTheDocument()
  })
})

function recommendState() {
  const dependency = makeTask({ title: 'Prerequisite', dueDate: null })
  return makeState({
    tasks: [
      dependency,
      makeTask({ title: 'Waiting task', dependsOn: [dependency.id], dueDate: today }),
      makeTask({ title: 'Late task', dueDate: past }),
      makeTask({ title: 'Calm task', dueDate: inThreeDays }),
    ],
  })
}

describe('what should I do now (G5)', () => {
  it('recommends the urgent task with its reason and hides blocked ones', () => {
    renderWithApp(<DashboardView onNavigate={vi.fn()} />, recommendState())
    const panel = screen.getByRole('region', { name: 'What should I do now?' })

    expect(within(panel).getByText('Late task')).toBeInTheDocument()
    expect(within(panel).getByText(/^Overdue since/)).toBeInTheDocument()
    expect(within(panel).queryByText('Waiting task')).toBeNull()
  })

  it('completes the suggested task and moves to the next one', async () => {
    const user = userEvent.setup()
    const { store } = renderWithApp(<DashboardView onNavigate={vi.fn()} />, recommendState())
    const panel = screen.getByRole('region', { name: 'What should I do now?' })

    await user.click(within(panel).getByRole('button', { name: 'Mark complete' }))

    expect(store.get().tasks.find((task) => task.title === 'Late task')?.status).toBe('completed')
    expect(await within(panel).findByText('Calm task')).toBeInTheDocument()
  })
})

describe('needs attention', () => {
  it('lists overdue and blocked work', () => {
    renderWithApp(<DashboardView onNavigate={vi.fn()} />, recommendState())
    const panel = screen.getByRole('region', { name: 'Needs attention' })

    expect(within(panel).getByText('Late task')).toBeInTheDocument()
    expect(within(panel).getByText('Waiting task')).toBeInTheDocument()
  })

  it('stays quiet when there is nothing to recover', () => {
    renderWithApp(<DashboardView onNavigate={vi.fn()} />, {
      tasks: [makeTask({ title: 'Calm task', dueDate: inThreeDays })],
    })
    const panel = screen.getByRole('region', { name: 'Needs attention' })

    expect(within(panel).getByText(/Nothing needs attention/)).toBeInTheDocument()
  })
})

describe('upcoming deadlines', () => {
  it('shows work due within seven days only', () => {
    renderWithApp(<DashboardView onNavigate={vi.fn()} />, seededState())
    const panel = screen.getByRole('region', { name: 'Upcoming deadlines' })

    expect(within(panel).getByText('Today chore')).toBeInTheDocument()
    expect(within(panel).getByText('Future chore')).toBeInTheDocument()
    expect(within(panel).queryByText('Late chore')).toBeNull()
    expect(within(panel).queryByText('Finished chore')).toBeNull()
  })
})

describe('weekly summary', () => {
  it('summarizes completions and focus time from real data', () => {
    const now = Date.now()
    renderWithApp(<DashboardView onNavigate={vi.fn()} />, {
      tasks: [makeTask({ status: 'completed', completedAt: now }), makeTask({ status: 'completed', completedAt: now })],
      sessions: [{ id: 's1', taskId: 't1', startedAt: now - 60_000, endedAt: now, durationMs: 30 * 60_000, createdAt: now }],
    })
    const panel = screen.getByRole('region', { name: 'Weekly summary' })

    expect(within(panel).getByText('2 tasks completed')).toBeInTheDocument()
    expect(within(panel).getByText('30m focused')).toBeInTheDocument()
    expect(within(panel).getByRole('img')).toHaveAccessibleName(/2 tasks completed and 30m focused/)
  })
})

describe('empty workspace', () => {
  it('welcomes instead of showing empty panels', () => {
    renderWithApp(<DashboardView onNavigate={vi.fn()} />)

    expect(screen.getByText('Welcome to TaskFlow')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Needs attention' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Weekly summary' })).toBeNull()
  })
})

describe('running focus session', () => {
  it('surfaces the active timer with a shortcut to Focus Mode', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    const task = makeTask({ title: 'Deep work' })
    renderWithApp(<DashboardView onNavigate={onNavigate} />, {
      tasks: [task],
      timer: { taskId: task.id, startedAt: Date.now() - 5_000, accumulatedMs: 0, targetMs: 25 * 60_000 },
    })
    const banner = screen.getByRole('region', { name: 'Running focus session' })

    expect(within(banner).getByText('Deep work')).toBeInTheDocument()
    expect(within(banner).getByRole('timer')).toHaveTextContent(/^\d+:\d{2}$/)

    await user.click(within(banner).getByRole('button', { name: 'Open focus' }))
    expect(onNavigate).toHaveBeenCalledWith('focus')
  })
})
