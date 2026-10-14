import { describe, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithApp } from '../../test/render'
import { makeProject, makeTag, makeTask } from '../../test/factories'
import { ProjectsView } from './ProjectsView'

describe('projects list', () => {
  it('shows an empty state and creates the first project', async () => {
    const user = userEvent.setup()
    const { store } = renderWithApp(<ProjectsView />)

    expect(screen.getByText('No projects yet')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Create a project' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Name'), 'Website redesign')
    await user.click(within(dialog).getByRole('button', { name: 'Create project' }))

    await waitFor(() => expect(store.get().projects).toHaveLength(1))
    expect(store.get().projects[0]?.name).toBe('Website redesign')
  })

  it('requires a project name', async () => {
    const user = userEvent.setup()
    const { store } = renderWithApp(<ProjectsView />)

    await user.click(screen.getByRole('button', { name: 'New project' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Create project' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('A project name is required.')
    expect(store.get().projects).toHaveLength(0)
  })

  it('derives completion percentage from real tasks', () => {
    const project = makeProject({ name: 'Launch' })
    renderWithApp(<ProjectsView />, {
      projects: [project],
      tasks: [
        makeTask({ projectId: project.id, status: 'completed' }),
        makeTask({ projectId: project.id }),
        makeTask({ projectId: project.id }),
      ],
    })

    expect(screen.getByText('1/3 tasks')).toBeInTheDocument()
    expect(screen.getByText('33%')).toBeInTheDocument()
  })
})

describe('project detail', () => {
  it('opens a project, lists its tasks and quick-adds to it', async () => {
    const project = makeProject({ name: 'Mobile app' })
    const inside = makeTask({ title: 'Design screens', projectId: project.id })
    const outside = makeTask({ title: 'Unrelated task' })
    const user = userEvent.setup()
    const { store } = renderWithApp(<ProjectsView />, {
      projects: [project],
      tasks: [inside, outside],
    })

    await user.click(screen.getByRole('button', { name: 'Open Mobile app' }))
    expect(screen.getByRole('button', { name: 'Design screens' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Unrelated task' })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Quick add task'), 'Polish animations{Enter}')
    const created = store.get().tasks.find((t) => t.title === 'Polish animations')
    expect(created?.projectId).toBe(project.id)
  })

  it('goes back to the grid', async () => {
    const project = makeProject({ name: 'Site' })
    const user = userEvent.setup()
    renderWithApp(<ProjectsView />, { projects: [project] })

    await user.click(screen.getByRole('button', { name: 'Open Site' }))
    await user.click(screen.getByRole('button', { name: 'All projects' }))
    expect(screen.getByRole('button', { name: 'Open Site' })).toBeInTheDocument()
  })
})

describe('deleting a project (spec §13)', () => {
  const setup = async () => {
    const project = makeProject({ name: 'Doomed' })
    const inside = makeTask({ title: 'Keep me safe', projectId: project.id })
    const user = userEvent.setup()
    const utils = renderWithApp(<ProjectsView />, { projects: [project], tasks: [inside] })
    await user.click(screen.getByRole('button', { name: 'Actions for Doomed' }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete project' }))
    const dialog = await screen.findByRole('dialog')
    return { user, dialog, ...utils, project, inside }
  }

  it('keeps the tasks when asked to', async () => {
    const { user, dialog, store, inside } = await setup()
    await user.click(within(dialog).getByRole('button', { name: 'Keep its tasks' }))

    await waitFor(() => expect(store.get().projects).toHaveLength(0))
    expect(store.get().tasks).toHaveLength(1)
    expect(store.get().tasks[0]?.id).toBe(inside.id)
    expect(store.get().tasks[0]?.projectId).toBeNull()
  })

  it('deletes the tasks only after an explicit choice', async () => {
    const { user, dialog, store } = await setup()
    await user.click(within(dialog).getByRole('button', { name: 'Delete tasks too' }))

    await waitFor(() => expect(store.get().projects).toHaveLength(0))
    expect(store.get().tasks).toHaveLength(0)
  })

  it('cancels without touching anything', async () => {
    const { user, dialog, store } = await setup()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(store.get().projects).toHaveLength(1)
    expect(store.get().tasks).toHaveLength(1)
  })
})

describe('tags panel', () => {
  it('creates a tag and rejects duplicates', async () => {
    const user = userEvent.setup()
    const { store } = renderWithApp(<ProjectsView />)

    await user.type(screen.getByLabelText('New tag name'), 'design{Enter}')
    await user.type(screen.getByLabelText('New tag name'), 'Design{Enter}')

    expect(store.get().tags).toHaveLength(1)
    expect(await screen.findByText('That tag already exists.')).toBeInTheDocument()
  })

  it('deletes a tag after confirmation and cleans task references', async () => {
    const tag = makeTag({ name: 'urgent' })
    const user = userEvent.setup()
    const { store } = renderWithApp(<ProjectsView />, {
      tags: [tag],
      tasks: [makeTask({ tagIds: [tag.id] })],
    })

    await user.click(screen.getByRole('button', { name: 'Delete tag urgent' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete tag' }))

    await waitFor(() => expect(store.get().tags).toHaveLength(0))
    expect(store.get().tasks[0]?.tagIds).toEqual([])
  })

  it('renames a tag', async () => {
    const tag = makeTag({ name: 'old' })
    const user = userEvent.setup()
    const { store } = renderWithApp(<ProjectsView />, { tags: [tag] })

    await user.click(screen.getByRole('button', { name: 'Rename tag old' }))
    const input = screen.getByLabelText('Rename old')
    await user.clear(input)
    await user.type(input, 'renamed{Enter}')

    await waitFor(() => expect(store.get().tags[0]?.name).toBe('renamed'))
  })
})

describe('image attachments on a project', () => {
  it('refuses files that are not supported images', async () => {
    const project = makeProject({ name: 'With cover' })
    const user = userEvent.setup()
    renderWithApp(<ProjectsView />, { projects: [project] })

    await user.click(screen.getByRole('button', { name: 'Open With cover' }))
    const input = screen.getByLabelText('Choose image files')
    const bad = new File(['not an image'], 'notes.txt', { type: 'text/plain' })
    fireEvent.change(input, { target: { files: [bad] } })

    expect(await screen.findByText(/images only/)).toBeInTheDocument()
  })

  it('accepts a valid image and shows a preview button', async () => {
    const project = makeProject({ name: 'Covered' })
    const user = userEvent.setup()
    const { store } = renderWithApp(<ProjectsView />, { projects: [project] })

    await user.click(screen.getByRole('button', { name: 'Open Covered' }))
    const input = screen.getByLabelText('Choose image files')
    const image = new File([new Uint8Array(64)], 'cover.png', { type: 'image/png' })
    await user.upload(input, image)

    await waitFor(() => expect(store.get().attachments).toHaveLength(1))
    expect(await screen.findByRole('button', { name: 'Preview cover.png' })).toBeInTheDocument()
  })
})

describe('project editing', () => {
  it('updates name and color', async () => {
    const project = makeProject({ name: 'Old name' })
    const user = userEvent.setup()
    const { store } = renderWithApp(<ProjectsView />, { projects: [project] })

    await user.click(screen.getByRole('button', { name: 'Actions for Old name' }))
    await user.click(screen.getByRole('menuitem', { name: 'Edit project' }))
    const dialog = await screen.findByRole('dialog')
    await user.clear(within(dialog).getByLabelText('Name'))
    await user.type(within(dialog).getByLabelText('Name'), 'New name')
    await user.click(within(dialog).getByLabelText('Color #16a34a'))
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(store.get().projects[0]?.name).toBe('New name'))
    expect(store.get().projects[0]?.color).toBe('#16a34a')
    expect(store.get().projects[0]?.id).toBe(project.id)
  })
})
