import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeTask } from '../../test/factories'
import { renderWithApp } from '../../test/render'
import { SettingsView } from './SettingsView'

function stubNotification(
  permission: NotificationPermission,
  grant: NotificationPermission = permission,
): ReturnType<typeof vi.fn> {
  const requestPermission = vi.fn().mockResolvedValue(grant)
  const ctor = function NotificationStub() {} as unknown as typeof Notification
  Object.defineProperty(ctor, 'permission', { value: permission, configurable: true })
  Object.defineProperty(ctor, 'requestPermission', { value: requestPermission, configurable: true })
  vi.stubGlobal('Notification', ctor)
  return requestPermission
}

function validBundle(taskTitle: string): string {
  return JSON.stringify({
    version: 1,
    exportedAt: 1_700_000_000_000,
    tasks: [JSON.parse(JSON.stringify(makeTask({ title: taskTitle })))],
    projects: [],
    tags: [],
    sessions: [],
    attachments: [],
  })
}

describe('SettingsView', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('Notification', undefined)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('switches the theme preference between light, dark and system', async () => {
    const user = userEvent.setup()
    const { getSettings } = renderWithApp(<SettingsView />)

    await user.click(screen.getByRole('tab', { name: 'Dark' }))
    expect(getSettings().theme).toBe('dark')

    await user.click(screen.getByRole('tab', { name: 'System' }))
    expect(getSettings().theme).toBe('system')
  })

  it('updates focus and break durations, rejecting out-of-range input', async () => {
    const user = userEvent.setup()
    const { getSettings } = renderWithApp(<SettingsView />)

    const focus = screen.getByLabelText('Focus length (minutes)')
    await user.clear(focus)
    await user.type(focus, '50')
    expect(getSettings().focusDurationMinutes).toBe(50)

    await user.clear(focus)
    await user.type(focus, '0')
    expect(await screen.findByText(/between 1 and 240/)).toBeInTheDocument()
    expect(getSettings().focusDurationMinutes).toBe(50)

    const shortBreak = screen.getByLabelText('Short break (minutes)')
    await user.clear(shortBreak)
    await user.type(shortBreak, '8')
    expect(getSettings().shortBreakMinutes).toBe(8)
  })

  it('changes the default task sort used by My Tasks', async () => {
    const user = userEvent.setup()
    const { getSettings } = renderWithApp(<SettingsView />)
    await user.selectOptions(screen.getByLabelText('Default task sort'), 'due')
    expect(getSettings().defaultSort).toBe('due')
  })

  it('clearly marks notifications as unavailable when the browser lacks support', async () => {
    const user = userEvent.setup()
    renderWithApp(<SettingsView />)
    const toggle = screen.getByRole('switch', { name: 'Focus notifications' })
    expect(toggle).toBeDisabled()
    expect(screen.getByText('Not supported in this browser.')).toBeInTheDocument()
    await user.click(toggle)
    expect(toggle).not.toBeChecked()
  })

  it('requests permission only when the user turns notifications on', async () => {
    const user = userEvent.setup()
    const requestPermission = stubNotification('default', 'granted')
    const { getSettings } = renderWithApp(<SettingsView />)

    expect(requestPermission).not.toHaveBeenCalled()
    await user.click(screen.getByRole('switch', { name: 'Focus notifications' }))
    expect(requestPermission).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(getSettings().notificationsEnabled).toBe(true))
  })

  it('keeps notifications off when permission is denied, with an explanation', async () => {
    const user = userEvent.setup()
    stubNotification('denied')
    const { getSettings } = renderWithApp(<SettingsView />)

    await user.click(screen.getByRole('switch', { name: 'Focus notifications' }))
    expect(getSettings().notificationsEnabled).toBe(false)
    expect(await screen.findByText(/permission was not granted/)).toBeInTheDocument()
  })

  it('exports a downloadable backup of the current data', async () => {
    const user = userEvent.setup()
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:backup')
    renderWithApp(<SettingsView />, { tasks: [makeTask({ title: 'Exported task' })] })

    await user.click(screen.getByRole('button', { name: 'Export backup (.json)' }))
    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(/Backup downloaded/)).toBeInTheDocument()
  })

  it('rejects a file that is not JSON without touching any data', async () => {
    const user = userEvent.setup()
    const { store } = renderWithApp(<SettingsView />, { tasks: [makeTask({ title: 'Keep me' })] })

    const file = new File(['not json {'], 'broken.json', { type: 'application/json' })
    await user.upload(screen.getByLabelText('Import backup file'), file)

    expect(await screen.findByText('The file is not valid JSON.')).toBeInTheDocument()
    expect(store.get().tasks).toHaveLength(1)
  })

  it('rejects a JSON file that is not a TaskFlow backup', async () => {
    const user = userEvent.setup()
    const { store } = renderWithApp(<SettingsView />, { tasks: [makeTask({ title: 'Keep me' })] })

    const file = new File([JSON.stringify({ version: 99 })], 'other.json', { type: 'application/json' })
    await user.upload(screen.getByLabelText('Import backup file'), file)

    expect(await screen.findByText('Unsupported backup version.')).toBeInTheDocument()
    expect(store.get().tasks).toHaveLength(1)
  })

  it('previews a valid backup and replaces the workspace only after confirmation', async () => {
    const user = userEvent.setup()
    const { store } = renderWithApp(<SettingsView />, { tasks: [makeTask({ title: 'Old task' })] })

    const file = new File([validBundle('Imported task')], 'backup.json', { type: 'application/json' })
    await user.upload(screen.getByLabelText('Import backup file'), file)

    // Preview with real counts, state untouched so far.
    expect(await screen.findByText(/Imported task/)).toBeInTheDocument()
    expect(store.get().tasks.map((t) => t.title)).toEqual(['Old task'])

    await user.click(screen.getByRole('button', { name: 'Replace workspace' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Replace workspace' }))

    await waitFor(() => expect(store.get().tasks.map((t) => t.title)).toEqual(['Imported task']))
    expect(store.get().timer).toEqual({ taskId: null, startedAt: null, accumulatedMs: 0, targetMs: null })
    expect(await screen.findByText(/Backup imported/)).toBeInTheDocument()
  })

  it('leaves the workspace untouched when the import confirmation is cancelled', async () => {
    const user = userEvent.setup()
    const { store } = renderWithApp(<SettingsView />, { tasks: [makeTask({ title: 'Old task' })] })

    const file = new File([validBundle('Imported task')], 'backup.json', { type: 'application/json' })
    await user.upload(screen.getByLabelText('Import backup file'), file)
    await user.click(await screen.findByRole('button', { name: 'Replace workspace' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(store.get().tasks.map((t) => t.title)).toEqual(['Old task'])
  })

  it('deletes all data only after a destructive confirmation, and can be cancelled', async () => {
    const user = userEvent.setup()
    const { store } = renderWithApp(<SettingsView />, { tasks: [makeTask({ title: 'Doomed' })] })

    await user.click(screen.getByRole('button', { name: 'Delete all data' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(store.get().tasks).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Delete all data' }))
    const second = await screen.findByRole('dialog')
    await user.click(within(second).getByRole('button', { name: 'Delete everything' }))

    await waitFor(() => expect(store.get().tasks).toHaveLength(0))
    expect(store.get().projects).toHaveLength(0)
    expect(store.get().sessions).toHaveLength(0)
  })
})
