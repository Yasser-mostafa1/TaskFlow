import { AlertTriangle, Bell, Download, Palette, SlidersHorizontal, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useSettings } from '../../app/SettingsContext'
import { logger } from '../../core/logger'
import { EMPTY_TIMER } from '../../db/schema'
import type { ImportBundle } from '../../core/guards'
import { useDispatch, useAppState } from '../../store/AppStoreContext'
import { Button } from '../../ui/Button'
import { Field, Input, Select } from '../../ui/Field'
import { useConfirm, useToast } from '../../ui/Feedback'
import { PageHeader } from '../../ui/PageHeader'
import { Reveal } from '../../ui/Reveal'
import { Segmented } from '../../ui/Segmented'
import {
  currentPermission,
  notificationsSupported,
  requestNotificationPermission,
} from '../focus/notify'
import { SORTS } from '../tasks/FilterBar'
import {
  applyImport,
  buildExportBundle,
  downloadJson,
  importFileName,
  importSummary,
  parseImportFile,
} from './exportImport'

const MINUTE_ERROR = 'Must be between 1 and 240 minutes.'

const DURATION_ERROR_KEY = {
  focusDurationMinutes: 'focus',
  shortBreakMinutes: 'short',
  longBreakMinutes: 'long',
} as const

function SectionCard({
  icon,
  title,
  description,
  children,
  label,
}: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
  label: string
}) {
  return (
    <section aria-label={label} className="tf-card p-4">
      <div className="mb-4 flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-accent">
          {icon}
        </span>
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs leading-relaxed text-muted">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

/**
 * Settings (spec §16): every control is wired to something real — appearance
 * through the OS-aware theme, focus/break durations feeding Focus Mode,
 * notifications behind an explicit permission gesture, and a validated
 * JSON backup round-trip. Nothing decorative.
 */
export function SettingsView() {
  const state = useAppState()
  const dispatch = useDispatch()
  const toast = useToast()
  const confirm = useConfirm()
  const { settings, update } = useSettings()

  const [durationError, setDurationError] = useState<{ focus?: string; short?: string; long?: string }>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<ImportBundle | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const supported = notificationsSupported()
  const permission = currentPermission()

  /* ------------------------------- durations ------------------------------- */

  const changeDuration = (field: keyof typeof DURATION_ERROR_KEY, text: string) => {
    const value = Number(text)
    const key = DURATION_ERROR_KEY[field]
    if (!Number.isInteger(value) || value < 1 || value > 240) {
      setDurationError((current) => ({ ...current, [key]: MINUTE_ERROR }))
      return
    }
    setDurationError((current) => ({ ...current, [key]: undefined }))
    update({ [field]: value })
  }

  /* ----------------------------- notifications ----------------------------- */

  const toggleNotifications = async () => {
    if (!supported) return
    if (settings.notificationsEnabled) {
      update({ notificationsEnabled: false })
      setNotice(null)
      return
    }
    const result = await requestNotificationPermission()
    if (result === 'granted') {
      update({ notificationsEnabled: true })
      setNotice(null)
      logger.info('settings.notifications.enabled')
    } else if (result === 'unsupported') {
      setNotice('Not supported in this browser.')
    } else {
      setNotice('Notifications stay off — permission was not granted. You can allow them in your browser settings.')
    }
  }

  /* --------------------------------- data ---------------------------------- */

  const onExport = async () => {
    try {
      const { json, summary } = await buildExportBundle(state)
      downloadJson(importFileName(), json)
      toast.push('success', `Backup downloaded (${summary.tasks} tasks, ${summary.projects} projects).`)
      logger.info('settings.export', {
        tasks: summary.tasks,
        projects: summary.projects,
        tags: summary.tags,
        sessions: summary.sessions,
        attachments: summary.attachments,
      })
    } catch (err) {
      logger.errorObj('settings.export.failed', err)
      toast.push('error', 'The backup could not be created.')
    }
  }

  const onImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    const result = await parseImportFile(file)
    if (!result.ok) {
      setPendingImport(null)
      setImportError(result.error)
      logger.warn('settings.import.rejected', { error: result.error })
      return
    }
    setImportError(null)
    setPendingImport(result.data)
  }

  const onConfirmImport = async () => {
    if (!pendingImport) return
    const counts = importSummary(pendingImport)
    const confirmed = await confirm({
      title: 'Replace workspace?',
      message: `Importing replaces ALL current data with the backup (${counts.tasks} tasks, ${counts.projects} projects, ${counts.tags} tags, ${counts.sessions} sessions). This cannot be undone.`,
      confirmLabel: 'Replace workspace',
      destructive: true,
    })
    if (!confirmed) return
    dispatch({ type: 'state/replace', state: applyImport(pendingImport) })
    setPendingImport(null)
    toast.push(
      'success',
      `Backup imported — ${counts.tasks} tasks, ${counts.projects} projects, ${counts.tags} tags.`,
    )
    logger.info('settings.import.applied', {
      tasks: counts.tasks,
      projects: counts.projects,
      tags: counts.tags,
      sessions: counts.sessions,
    })
  }

  const onDeleteAll = async () => {
    const confirmed = await confirm({
      title: 'Delete all data?',
      message: `This permanently deletes ${state.tasks.length} tasks, ${state.projects.length} projects, ${state.tags.length} tags, ${state.sessions.length} focus sessions and ${state.attachments.length} attachments from this browser. This cannot be undone.`,
      confirmLabel: 'Delete everything',
      destructive: true,
    })
    if (!confirmed) return
    dispatch({
      type: 'state/replace',
      state: { tasks: [], projects: [], tags: [], sessions: [], attachments: [], timer: { ...EMPTY_TIMER } },
    })
    setPendingImport(null)
    toast.push('success', 'All local data deleted.')
    logger.info('settings.data.deleted')
  }

  /* --------------------------------- view ---------------------------------- */

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Settings"
        description="Preferences are saved in this browser only — nothing leaves your device."
      />

      <div className="grid gap-4">
        <Reveal>
          <SectionCard
            label="Appearance"
            icon={<Palette size={16} />}
            title="Appearance"
            description="System follows your operating system's light or dark preference live."
          >
            <Segmented
              ariaLabel="Theme"
              value={settings.theme}
              onChange={(theme) => update({ theme })}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'System' },
              ]}
            />
          </SectionCard>
        </Reveal>

        <Reveal delay={0.02}>
          <SectionCard
            label="Focus"
            icon={<SlidersHorizontal size={16} />}
            title="Focus & breaks"
            description="Used by Focus Mode: the countdown length and the suggested breaks."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Focus length (minutes)" error={durationError.focus}>
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    min={1}
                    max={240}
                    defaultValue={settings.focusDurationMinutes}
                    onChange={(event) => changeDuration('focusDurationMinutes', event.target.value)}
                  />
                )}
              </Field>
              <Field label="Short break (minutes)" error={durationError.short}>
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    min={1}
                    max={240}
                    defaultValue={settings.shortBreakMinutes}
                    onChange={(event) => changeDuration('shortBreakMinutes', event.target.value)}
                  />
                )}
              </Field>
              <Field label="Long break (minutes)" error={durationError.long}>
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    min={1}
                    max={240}
                    defaultValue={settings.longBreakMinutes}
                    onChange={(event) => changeDuration('longBreakMinutes', event.target.value)}
                  />
                )}
              </Field>
            </div>
          </SectionCard>
        </Reveal>

        <Reveal delay={0.04}>
          <SectionCard
            label="Notifications"
            icon={<Bell size={16} />}
            title="Notifications"
            description="A notification when a focus countdown finishes. Permission is requested only when you turn this on."
          >
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={settings.notificationsEnabled}
                aria-label="Focus notifications"
                disabled={!supported}
                onClick={() => void toggleNotifications()}
                className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
                  settings.notificationsEnabled ? 'border-accent bg-accent' : 'border-line bg-surface-2'
                } ${!supported ? 'cursor-not-allowed opacity-40' : ''}`}
              >
                <span
                  className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-all ${
                    settings.notificationsEnabled ? 'left-6' : 'left-0.5'
                  }`}
                  style={{ height: '1.1rem', width: '1.1rem' }}
                />
              </button>
              <p className="text-sm text-muted">
                {!supported
                  ? 'Not supported in this browser.'
                  : permission === 'denied'
                    ? 'Blocked in your browser settings — notifications stay off.'
                    : 'Get a notification when a focus countdown finishes.'}
              </p>
            </div>
            {notice && (
              <p role="status" className="mt-3 flex items-start gap-2 text-sm text-warn">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                {notice}
              </p>
            )}
          </SectionCard>
        </Reveal>

        <Reveal delay={0.06}>
          <SectionCard
            label="Tasks"
            icon={<SlidersHorizontal size={16} />}
            title="Task display"
            description="How My Tasks is sorted when you open it."
          >
            <Field label="Default task sort">
              {(id) => (
                <Select
                  id={id}
                  value={settings.defaultSort}
                  onChange={(event) => update({ defaultSort: event.target.value as typeof settings.defaultSort })}
                >
                  {SORTS.map((sort) => (
                    <option key={sort.value} value={sort.value}>
                      {sort.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </SectionCard>
        </Reveal>

        <Reveal delay={0.08}>
          <SectionCard
            label="Data"
            icon={<Download size={16} />}
            title="Backup & restore"
            description="Export everything (attachments included) as JSON, or restore a previous backup. Importing always asks before replacing anything."
          >
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" icon={<Download size={14} />} onClick={() => void onExport()}>
                Export backup (.json)
              </Button>
              <Button variant="secondary" icon={<Upload size={14} />} onClick={() => fileRef.current?.click()}>
                Import backup
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                aria-label="Import backup file"
                onChange={(event) => void onImportFile(event)}
              />
            </div>

            {importError && (
              <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-danger">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                {importError}
              </p>
            )}

            {pendingImport && (
              <div className="mt-4 rounded-lg border border-info/30 bg-info-soft p-3">
                <p className="text-sm font-medium">Backup ready to import</p>
                <p className="mt-1 text-xs text-muted">
                  {pendingImport.tasks.length} tasks, {pendingImport.projects.length} projects,{' '}
                  {pendingImport.tags.length} tags, {pendingImport.sessions.length} sessions.
                </p>
                {pendingImport.tasks.length > 0 && (
                  <p className="mt-1 truncate text-xs text-muted">
                    Includes: {pendingImport.tasks.slice(0, 3).map((task) => `“${task.title}”`).join(', ')}
                    {pendingImport.tasks.length > 3 ? '…' : ''}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="primary" onClick={() => void onConfirmImport()}>
                    Replace workspace
                  </Button>
                  <Button variant="ghost" onClick={() => setPendingImport(null)}>
                    Dismiss
                  </Button>
                </div>
              </div>
            )}
          </SectionCard>
        </Reveal>

        <Reveal delay={0.1}>
          <SectionCard
            label="Danger zone"
            icon={<Trash2 size={16} />}
            title="Danger zone"
            description="Permanently delete every task, project, tag, session and attachment stored in this browser."
          >
            <Button variant="danger" icon={<Trash2 size={14} />} onClick={() => void onDeleteAll()}>
              Delete all data
            </Button>
          </SectionCard>
        </Reveal>
      </div>
    </div>
  )
}
