import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen, waitFor, within } from '@testing-library/react'
import { renderWithApp } from '../../test/render'
import { makeTask } from '../../test/factories'
import { TaskEditor } from './TaskEditor'
import { reorderSubtasks } from './SubtaskEditor'

describe('reorderSubtasks', () => {
  const a = { id: 'a', title: 'A', done: false }
  const b = { id: 'b', title: 'B', done: false }
  const c = { id: 'c', title: 'C', done: false }

  it('moves an item and keeps the rest in order', () => {
    expect(reorderSubtasks([a, b, c], 0, 2).map((s) => s.id)).toEqual(['b', 'c', 'a'])
    expect(reorderSubtasks([a, b, c], 2, 0).map((s) => s.id)).toEqual(['c', 'a', 'b'])
  })

  it('is a no-op for invalid or identical positions', () => {
    const list = [a, b, c]
    expect(reorderSubtasks(list, 1, 1)).toBe(list)
    expect(reorderSubtasks(list, 5, 0)).toBe(list)
    expect(reorderSubtasks(list, 0, -1)).toBe(list)
  })
})

describe('creating a task', () => {
  it('creates a task with subtasks and dependencies', async () => {
    const dependency = makeTask({ title: 'Write spec' })
    const user = userEvent.setup()
    const onClose = vi.fn()
    const { store } = renderWithApp(<TaskEditor open task={null} onClose={onClose} />, {
      tasks: [dependency],
    })

    await user.type(screen.getByLabelText('Title'), 'Review the spec')
    await user.type(screen.getByLabelText('New subtask title'), 'Read the goals{Enter}')
    await user.type(screen.getByLabelText('New subtask title'), 'Check the risks{Enter}')
    await user.click(screen.getByRole('button', { name: 'Complete Read the goals' }))
    await user.click(screen.getByRole('button', { name: /Write spec/ }))
    await user.click(screen.getByRole('button', { name: 'Create task' }))

    await waitFor(() => expect(store.get().tasks).toHaveLength(2))
    const created = store.get().tasks.find((t) => t.title === 'Review the spec')
    expect(created?.subtasks.map((s) => s.done)).toEqual([true, false])
    expect(created?.dependsOn).toEqual([dependency.id])
    expect(onClose).toHaveBeenCalled()
  })

  it('shows validation errors instead of creating an empty task', async () => {
    const user = userEvent.setup()
    const { store } = renderWithApp(<TaskEditor open task={null} onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Create task' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('A title is required.')
    expect(store.get().tasks).toHaveLength(0)
  })

  it('rejects an invalid estimate', async () => {
    const user = userEvent.setup()
    const { store } = renderWithApp(<TaskEditor open task={null} onClose={vi.fn()} />)

    await user.type(screen.getByLabelText('Title'), 'Anything')
    await user.clear(screen.getByLabelText('Estimate'))
    await user.type(screen.getByLabelText('Estimate'), '0')
    await user.click(screen.getByRole('button', { name: 'Create task' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('between 1 minute and 30 days')
    expect(store.get().tasks).toHaveLength(0)
  })
})

describe('editing a task', () => {
  it('updates fields and keeps the record count stable', async () => {
    const task = makeTask({ title: 'Draft', description: 'Old', priority: 'low', estimateMinutes: 30 })
    const user = userEvent.setup()
    const { store } = renderWithApp(<TaskEditor open task={task} onClose={vi.fn()} />, { tasks: [task] })

    const title = screen.getByLabelText('Title')
    await user.clear(title)
    await user.type(title, 'Draft v2')
    await user.selectOptions(screen.getByLabelText('Priority'), 'high')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(store.get().tasks[0]?.title).toBe('Draft v2'))
    expect(store.get().tasks[0]?.priority).toBe('high')
    expect(store.get().tasks[0]?.estimateMinutes).toBe(30)
    expect(store.get().tasks).toHaveLength(1)
  })

  it('removes a dependency from the chip', async () => {
    const dependency = makeTask({ title: 'Write spec' })
    const task = makeTask({ title: 'Review', dependsOn: [dependency.id] })
    const user = userEvent.setup()
    const { store } = renderWithApp(<TaskEditor open task={task} onClose={vi.fn()} />, {
      tasks: [dependency, task],
    })

    await user.click(screen.getByRole('button', { name: 'Remove dependency Write spec' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(store.get().tasks.find((t) => t.id === task.id)?.dependsOn).toEqual([]))
  })
})

describe('dependency safety', () => {
  it('disables candidates that would create a loop', () => {
    const main = makeTask({ title: 'Main task' })
    const child = makeTask({ title: 'Child task', dependsOn: [main.id] })
    renderWithApp(<TaskEditor open task={main} onClose={vi.fn()} />, { tasks: [main, child] })

    const candidate = screen.getByRole('button', { name: /Child task/ })
    expect(candidate).toBeDisabled()
    expect(candidate).toHaveTextContent('Would loop')
  })

  it('allows a legitimate dependency', () => {
    const prerequisite = makeTask({ title: 'Prerequisite' })
    const task = makeTask({ title: 'Follow-up' })
    renderWithApp(<TaskEditor open task={task} onClose={vi.fn()} />, { tasks: [prerequisite, task] })

    expect(screen.getByRole('button', { name: /Prerequisite/ })).toBeEnabled()
  })
})

describe('subtask keyboard reordering', () => {
  it('moves a subtask with the keyboard (accessible alternative)', async () => {
    // jsdom reports zero-sized boxes; give elements real geometry so the
    // keyboard coordinate getter can resolve "which item is above".
    const originalRect = Element.prototype.getBoundingClientRect
    Element.prototype.getBoundingClientRect = function rect(this: Element) {
      const all = Array.from(document.querySelectorAll('body *'))
      const index = all.indexOf(this)
      const top = index < 0 ? 0 : index * 24
      return {
        top,
        bottom: top + 20,
        left: 0,
        right: 400,
        width: 400,
        height: 20,
        x: 0,
        y: top,
        toJSON: () => ({}),
      } as DOMRect
    }

    try {
      const task = makeTask({ title: 'Parent' })
      const user = userEvent.setup()
      const { store } = renderWithApp(<TaskEditor open task={task} onClose={vi.fn()} />, { tasks: [task] })

      await user.type(screen.getByLabelText('New subtask title'), 'First{Enter}')
      await user.type(screen.getByLabelText('New subtask title'), 'Second{Enter}')

      const handle = screen.getByRole('button', { name: 'Reorder Second' })
      handle.focus()
      await user.keyboard(' ')
      await user.keyboard('{ArrowUp}')
      await user.keyboard(' ')

      await user.click(screen.getByRole('button', { name: 'Save changes' }))
      await waitFor(() => {
        const saved = store.get().tasks.find((t) => t.id === task.id)
        expect(saved?.subtasks.map((s) => s.title)).toEqual(['Second', 'First'])
      })
    } finally {
      Element.prototype.getBoundingClientRect = originalRect
    }
  })
})

describe('scope of the editor', () => {
  it('only renders when open', () => {
    const { container } = renderWithApp(<TaskEditor open={false} task={null} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(container).toBeTruthy()
  })

  it('shows the local timezone hint', () => {
    renderWithApp(<TaskEditor open task={null} onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/stored in your local timezone/i)).toBeInTheDocument()
  })
})
