import { describe, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen, waitFor, within } from '@testing-library/react'
import { renderWithApp } from '../../test/render'
import { makeTask } from '../../test/factories'
import { dateKey, formatDayHeading, formatMonth, todayKey } from '../../core/dates'
import { CalendarView } from './CalendarView'

const navigate = () => undefined

const currentMonthHeading = () => {
  const now = new Date()
  return formatMonth(now.getFullYear(), now.getMonth())
}

describe('calendar rendering', () => {
  it('shows the current month and weekday headers', () => {
    renderWithApp(<CalendarView onNavigate={navigate} />)
    expect(screen.getByText(currentMonthHeading())).toBeInTheDocument()
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Sun')).toBeInTheDocument()
  })

  it('renders every day of the month exactly once', () => {
    const { container } = renderWithApp(<CalendarView onNavigate={navigate} />)
    const now = new Date()
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const labels = [...container.querySelectorAll('button[aria-label]')]
      .map((el) => el.getAttribute('aria-label') ?? '')
      .filter((label) => label.includes(', ') && label.includes('task'))
    expect(labels.filter((label) => label.startsWith(formatDayHeading(`${prefix}-01`).split(',')[0] ?? ''))).toBeTruthy()
    expect(labels.length).toBe(42)
  })

  it('moves to the next and previous month', async () => {
    const user = userEvent.setup()
    renderWithApp(<CalendarView onNavigate={navigate} />)

    await user.click(screen.getByRole('button', { name: 'Next month' }))
    const next = new Date()
    next.setMonth(next.getMonth() + 1)
    expect(screen.getByText(formatMonth(next.getFullYear(), next.getMonth()))).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByText(currentMonthHeading())).toBeInTheDocument()
  })
})

describe('scheduled tasks on dates (G7)', () => {
  it('shows a task on its date and opens it from the day panel', async () => {
    const now = new Date()
    const key = dateKey(new Date(now.getFullYear(), now.getMonth(), 15))
    const task = makeTask({ title: 'Quarterly review', dueDate: key })
    const user = userEvent.setup()
    renderWithApp(<CalendarView onNavigate={navigate} />, { tasks: [task] })

    const cell = screen.getByRole('button', { name: `${formatDayHeading(key)}, 1 task` })
    expect(cell).toHaveTextContent('Quarterly review')

    await user.click(cell)
    expect(await screen.findByRole('button', { name: 'Quarterly review' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Quarterly review' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('Edit task')
  })

  it('creates a task for the selected day without timezone drift', async () => {
    const now = new Date()
    const key = dateKey(new Date(now.getFullYear(), now.getMonth(), 21))
    const user = userEvent.setup()
    const { store } = renderWithApp(<CalendarView onNavigate={navigate} />)

    await user.click(
      screen.getByRole('button', { name: new RegExp(`${formatDayHeading(key)}, 0 tasks`) }),
    )
    await user.type(screen.getByLabelText('Quick add task'), 'Pay the invoice{Enter}')

    await waitFor(() => expect(store.get().tasks).toHaveLength(1))
    expect(store.get().tasks[0]?.dueDate).toBe(key)
    expect(store.get().tasks[0]?.dueDate?.slice(0, 10)).toBe(key)
  })

  it('lists the selected day tasks in the side panel', () => {
    const now = new Date()
    const key = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
    const today = todayKey()
    const task = makeTask({ title: 'Due today task', dueDate: today })
    renderWithApp(<CalendarView onNavigate={navigate} />, { tasks: [task] })

    const panel = screen.getByRole('complementary', { name: 'Selected day' })
    expect(within(panel).getByText('Due today task')).toBeInTheDocument()
    expect(key).toBe(today)
  })

  it('marks overdue tasks in a restrained way', () => {
    const yesterday = dateKey(new Date(Date.now() - 86_400_000))
    const task = makeTask({ title: 'Late task', dueDate: yesterday })
    const { container } = renderWithApp(<CalendarView onNavigate={navigate} />, { tasks: [task] })

    expect(container.querySelector('.bg-warn-soft')).not.toBeNull()
    expect(container.textContent).toContain('Late task')
  })
})

describe('empty day', () => {
  it('tells the user the day is free', () => {
    renderWithApp(<CalendarView onNavigate={navigate} />)
    expect(screen.getByText('Nothing due today')).toBeInTheDocument()
  })
})
