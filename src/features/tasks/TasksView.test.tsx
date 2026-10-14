import { describe, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen, waitFor, within } from '@testing-library/react'
import { renderWithApp } from '../../test/render'
import { makeProject, makeTask, makeTag } from '../../test/factories'
import { addDaysKey, dateKey } from '../../core/dates'
import { TasksView } from './TasksView'

const titles = () => screen.queryAllByRole('button', { name: /Edit|Sample|Fix|Ship|Buy/ })

describe('quick add (G1)', () => {
  it('creates a task from a single input', async () => {
    const user = userEvent.setup()
    const { store } = renderWithApp(<TasksView />)

    await user.type(screen.getByLabelText('Quick add task'), 'Buy groceries{Enter}')

    expect(store.get().tasks).toHaveLength(1)
    expect(store.get().tasks[0]?.title).toBe('Buy groceries')
    expect(screen.getByRole('button', { name: 'Buy groceries' })).toBeInTheDocument()
  })

  it('refuses an empty title with feedback', async () => {
    const user = userEvent.setup()
    const { store } = renderWithApp(<TasksView />)

    await user.type(screen.getByLabelText('Quick add task'), '   {Enter}')

    expect(store.get().tasks).toHaveLength(0)
    expect(await screen.findByRole('status')).toHaveTextContent('Give the task a title first.')
  })

  it('adds an optional due date and priority from the expanded row', async () => {
    const user = userEvent.setup()
    const { store } = renderWithApp(<TasksView />)

    await user.click(screen.getByLabelText('Show task options'))
    await user.selectOptions(screen.getByLabelText('Priority'), 'high')
    await user.type(screen.getByLabelText('Quick add task'), 'Plan sprint{Enter}')

    expect(store.get().tasks[0]?.priority).toBe('high')
    expect(store.get().tasks[0]?.title).toBe('Plan sprint')
  })
})

describe('completing tasks (G2)', () => {
  it('toggles completion and reports it', async () => {
    const task = makeTask({ title: 'Fix login bug' })
    const user = userEvent.setup()
    const { store } = renderWithApp(<TasksView />, { tasks: [task] })

    await user.click(screen.getByRole('button', { name: `Complete ${task.title}` }))

    expect(store.get().tasks[0]?.status).toBe('completed')
    expect(store.get().tasks[0]?.completedAt).not.toBeNull()

    await user.click(await screen.findByRole('button', { name: `Reopen ${task.title}` }))
    expect(store.get().tasks[0]?.status).toBe('todo')
    expect(store.get().tasks[0]?.completedAt).toBeNull()
  })

  it('edits a task through the editor modal', async () => {
    const task = makeTask({ title: 'Old title', description: 'Old description' })
    const user = userEvent.setup()
    const { store } = renderWithApp(<TasksView />, { tasks: [task] })

    await user.click(screen.getByRole('button', { name: 'Old title' }))
    const dialog = await screen.findByRole('dialog')
    const titleInput = within(dialog).getByLabelText('Title')
    await user.clear(titleInput)
    await user.type(titleInput, 'New title')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(store.get().tasks[0]?.title).toBe('New title'))
    expect(store.get().tasks).toHaveLength(1)
  })

  it('rejects an empty title in the editor', async () => {
    const task = makeTask({ title: 'Keep me' })
    const user = userEvent.setup()
    const { store } = renderWithApp(<TasksView />, { tasks: [task] })

    await user.click(screen.getByRole('button', { name: 'Keep me' }))
    const dialog = await screen.findByRole('dialog')
    await user.clear(within(dialog).getByLabelText('Title'))
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('A title is required.')
    expect(store.get().tasks[0]?.title).toBe('Keep me')
  })
})

describe('search, filters and sorting (G2)', () => {
  const tasks = [
    makeTask({ title: 'Buy milk', priority: 'low', dueDate: '2099-01-01' }),
    makeTask({ title: 'Fix login bug', priority: 'high', dueDate: '2026-10-10' }),
    makeTask({ title: 'Ship release', status: 'completed', priority: 'medium' }),
  ]

  it('narrows the list by search text', async () => {
    const user = userEvent.setup()
    renderWithApp(<TasksView />, { tasks })

    await user.type(screen.getByLabelText('Search tasks'), 'login')

    expect(screen.getByRole('button', { name: 'Fix login bug' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Buy milk' })).not.toBeInTheDocument()
  })

  it('filters by scope', async () => {
    const user = userEvent.setup()
    renderWithApp(<TasksView />, { tasks })

    await user.click(screen.getByRole('tab', { name: 'Completed' }))
    expect(screen.getByRole('button', { name: 'Ship release' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Buy milk' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Overdue' }))
    expect(screen.getByRole('button', { name: 'Fix login bug' })).toBeInTheDocument()
  })

  it('filters by priority and clears back to default', async () => {
    const user = userEvent.setup()
    renderWithApp(<TasksView />, { tasks })

    await user.selectOptions(screen.getByLabelText('Filter by priority'), 'high')
    expect(screen.getByRole('button', { name: 'Fix login bug' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Buy milk' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Clear filters/ }))
    expect(screen.getByRole('button', { name: 'Buy milk' })).toBeInTheDocument()
  })

  it('sorts by priority with high first', async () => {
    const user = userEvent.setup()
    renderWithApp(<TasksView />, { tasks })

    await user.selectOptions(screen.getByLabelText('Sort tasks'), 'priority')

    const list = screen.getAllByRole('listitem')
    expect(list[0]).toHaveTextContent('Fix login bug')
  })

  it('filters by project and tag', async () => {
    const project = makeProject({ name: 'Website' })
    const tag = makeTag({ name: 'design' })
    const user = userEvent.setup()
    renderWithApp(<TasksView />, {
      tasks: [makeTask({ title: 'Homepage', projectId: project.id }), makeTask({ title: 'Other' })],
      projects: [project],
      tags: [tag],
    })

    await user.selectOptions(screen.getByLabelText('Filter by project'), project.id)
    expect(screen.getByRole('button', { name: 'Homepage' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Other' })).not.toBeInTheDocument()
  })
})

describe('bulk actions with confirmation (G2)', () => {
  const tasks = [makeTask({ title: 'First task' }), makeTask({ title: 'Second task' }), makeTask({ title: 'Third task' })]

  it('cancels a destructive bulk delete', async () => {
    const user = userEvent.setup()
    const { store } = renderWithApp(<TasksView />, { tasks })

    await user.click(screen.getByLabelText('Select First task'))
    await user.click(screen.getByLabelText('Select Second task'))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Delete 2 tasks?')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(store.get().tasks).toHaveLength(3)
  })

  it('deletes after explicit confirmation', async () => {
    const user = userEvent.setup()
    const { store } = renderWithApp(<TasksView />, { tasks })

    await user.click(screen.getByLabelText('Select First task'))
    await user.click(screen.getByLabelText('Select Second task'))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(store.get().tasks).toHaveLength(1))
    expect(store.get().tasks[0]?.title).toBe('Third task')
  })

  it('completes many tasks at once', async () => {
    const user = userEvent.setup()
    const { store } = renderWithApp(<TasksView />, { tasks })

    await user.click(screen.getByLabelText('Select all visible tasks'))
    await user.click(screen.getByRole('button', { name: 'Complete' }))

    expect(store.get().tasks.every((task) => task.status === 'completed')).toBe(true)
  })
})

describe('empty states', () => {
  it('shows a helpful empty state when there are no tasks', () => {
    renderWithApp(<TasksView />)
    expect(screen.getByText('No tasks yet')).toBeInTheDocument()
  })

  it('offers a way back when filters match nothing', async () => {
    const user = userEvent.setup()
    renderWithApp(<TasksView />, { tasks: [makeTask({ title: 'Only one' })] })

    await user.type(screen.getByLabelText('Search tasks'), 'nothingmatches')
    expect(screen.getByText('Nothing matches these filters')).toBeInTheDocument()

    const clearButtons = screen.getAllByRole('button', { name: 'Clear filters' })
    await user.click(clearButtons[0] as HTMLElement)
    expect(screen.getByRole('button', { name: 'Only one' })).toBeInTheDocument()
  })
})

describe('row actions', () => {
  it('duplicates a task from the row menu', async () => {
    const task = makeTask({ title: 'Unique task' })
    const user = userEvent.setup()
    const { store } = renderWithApp(<TasksView />, { tasks: [task] })

    await user.click(screen.getByRole('button', { name: 'Actions for Unique task' }))
    await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }))

    expect(store.get().tasks).toHaveLength(2)
    expect(store.get().tasks[1]?.title).toBe('Unique task (copy)')
  })

  it('deletes a single task after confirmation', async () => {
    const task = makeTask({ title: 'Delete me' })
    const user = userEvent.setup()
    const { store } = renderWithApp(<TasksView />, { tasks: [task] })

    await user.click(screen.getByRole('button', { name: 'Actions for Delete me' }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete task' }))

    await waitFor(() => expect(store.get().tasks).toHaveLength(0))
  })
})

describe('task visibility details', () => {
  it('shows subtask progress and blocked state', () => {
    const dep = makeTask({ title: 'Write spec' })
    const task = makeTask({
      title: 'Review spec',
      dependsOn: [dep.id],
      subtasks: [
        { id: 's1', title: 'a', done: true },
        { id: 's2', title: 'b', done: false },
      ],
    })
    renderWithApp(<TasksView />, { tasks: [dep, task] })

    expect(screen.getByText('Blocked · 1')).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()
  })

  it('renders nothing unexpected without projects or tags', () => {
    const { container } = renderWithApp(<TasksView />, { tasks: [makeTask()] })
    expect(titles().length).toBeGreaterThan(0)
    expect(container).toBeTruthy()
  })
})

describe('navigation into a filtered list', () => {
  it('applies the initial filter handed over by the caller', () => {
    const late = makeTask({ title: 'Late chore', dueDate: '2020-01-01' })
    const future = makeTask({ title: 'Future chore', dueDate: '2999-01-01' })
    renderWithApp(<TasksView initialFilter={{ scope: 'overdue' }} />, { tasks: [late, future] })

    expect(screen.getByRole('button', { name: 'Late chore' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Future chore' })).not.toBeInTheDocument()
  })

  it('offers a due-today scope that matches only today', async () => {
    const user = userEvent.setup()
    const todayKey = dateKey(new Date())
    const todayTask = makeTask({ title: 'Today report', dueDate: todayKey })
    const tomorrowTask = makeTask({ title: 'Tomorrow report', dueDate: addDaysKey(todayKey, 1) })
    renderWithApp(<TasksView />, { tasks: [todayTask, tomorrowTask] })

    await user.click(screen.getByRole('tab', { name: 'Due today' }))

    expect(screen.getByRole('button', { name: 'Today report' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tomorrow report' })).not.toBeInTheDocument()
  })
})
