import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithApp } from '../../test/render'
import { makeTask } from '../../test/factories'
import { KanbanBoard } from './KanbanBoard'

const NOW = new Date(2026, 9, 12, 10, 0)

describe('Kanban board', () => {
  const todo = makeTask({ title: 'Design the header', order: 0 })
  const running = makeTask({ title: 'Write the docs', order: 1, status: 'in_progress' })
  const done = makeTask({ title: 'Ship v1', order: 2, status: 'completed' })

  it('renders three columns with their tasks and counts', () => {
    renderWithApp(
      <KanbanBoard tasks={[todo, running, done]} now={NOW} onEdit={() => undefined} />,
      { tasks: [todo, running, done] },
    )

    expect(screen.getByRole('region', { name: 'To Do' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'In Progress' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Completed' })).toBeInTheDocument()

    expect(within(screen.getByRole('region', { name: 'To Do' })).getByText('Design the header')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'In Progress' })).getByText('Write the docs')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Completed' })).getByText('Ship v1')).toBeInTheDocument()
  })

  it('provides an accessible drag handle for each card', () => {
    renderWithApp(<KanbanBoard tasks={[todo]} now={NOW} onEdit={() => undefined} />, { tasks: [todo] })
    expect(screen.getByRole('button', { name: 'Drag Design the header' })).toBeInTheDocument()
  })

  it('shows a drop hint in empty columns', () => {
    renderWithApp(<KanbanBoard tasks={[todo]} now={NOW} onEdit={() => undefined} />, { tasks: [todo] })
    expect(within(screen.getByRole('region', { name: 'Completed' })).getByText('Drop tasks here')).toBeInTheDocument()
  })

  it('opens the editor from a card', async () => {
    const onEdit = vi.fn()
    const user = userEvent.setup()
    renderWithApp(<KanbanBoard tasks={[todo]} now={NOW} onEdit={onEdit} />, { tasks: [todo] })

    await user.click(screen.getByRole('button', { name: 'Design the header' }))
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: todo.id }))
  })

  it('shows blocked and subtask information on cards', () => {
    const dep = makeTask({ title: 'Write spec' })
    const task = makeTask({
      title: 'Review spec',
      dependsOn: [dep.id],
      subtasks: [
        { id: 's1', title: 'a', done: true },
        { id: 's2', title: 'b', done: false },
      ],
    })
    renderWithApp(<KanbanBoard tasks={[dep, task]} now={NOW} onEdit={() => undefined} />, {
      tasks: [dep, task],
    })

    expect(screen.getByText('Blocked · 1')).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()
  })
})
