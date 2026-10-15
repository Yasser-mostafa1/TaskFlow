import { describe, expect, it, vi } from 'vitest'
import { parseImportBundle } from '../../core/guards'
import { EMPTY_STATE } from '../../store/appStore'
import { makeProject, makeState, makeTag, makeTask } from '../../test/factories'
import type { AppState, FocusSession } from '../../core/types'
import { applyImport, buildExportBundle, downloadJson, importFileName, importSummary } from './exportImport'

function pngBlob(): Blob {
  return new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' })
}

function fixtureState(): AppState {
  const task = makeTask({ title: 'Export me' })
  const session: FocusSession = {
    id: 'sess_1',
    taskId: task.id,
    startedAt: 1_700_000_000_000,
    endedAt: 1_700_000_000_000 + 25 * 60_000,
    durationMs: 25 * 60_000,
    createdAt: 1_700_000_000_000 + 25 * 60_000,
  }
  return makeState({
    tasks: [task],
    projects: [makeProject({ name: 'Alpha' })],
    tags: [makeTag({ name: 'home' })],
    sessions: [session],
    attachments: [
      {
        id: 'att_1',
        ownerType: 'task',
        ownerId: task.id,
        name: 'diagram.png',
        mime: 'image/png',
        size: 4,
        blob: pngBlob(),
        createdAt: 1_700_000_000_000,
      },
    ],
    timer: { taskId: task.id, startedAt: 1_700_000_000_000, accumulatedMs: 0, targetMs: 25 * 60_000 },
  })
}

describe('buildExportBundle', () => {
  it('produces a version-1 JSON the importer accepts, attachments as data URLs', async () => {
    const { json, summary } = await buildExportBundle(fixtureState())
    expect(summary).toEqual({ tasks: 1, projects: 1, tags: 1, sessions: 1, attachments: 1 })

    const parsed = JSON.parse(json) as Record<string, unknown>
    expect(parsed.version).toBe(1)
    expect(typeof parsed.exportedAt).toBe('number')

    const attachments = parsed.attachments as Array<Record<string, unknown>>
    expect(String(attachments[0]?.dataUrl)).toMatch(/^data:image\/png;base64,/)

    const result = parseImportBundle(parsed)
    expect(result.ok).toBe(true)
  })

  it('exports an empty workspace as a valid empty bundle', async () => {
    const { json, summary } = await buildExportBundle(EMPTY_STATE)
    expect(summary).toEqual({ tasks: 0, projects: 0, tags: 0, sessions: 0, attachments: 0 })
    const result = parseImportBundle(JSON.parse(json))
    expect(result.ok).toBe(true)
  })
})

describe('downloadJson', () => {
  it('creates and revokes an object URL for the download anchor', () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL')
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')
    downloadJson('taskflow-backup.json', '{"version":1}')
    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(revokeSpy).toHaveBeenCalledTimes(1)
    createSpy.mockRestore()
    revokeSpy.mockRestore()
  })
})

describe('applyImport', () => {
  it('restores collections, converts attachments back to Blobs and resets the timer', async () => {
    const source = fixtureState()
    const { json } = await buildExportBundle(source)
    const parsed = parseImportBundle(JSON.parse(json))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    const restored = applyImport(parsed.data)
    expect(restored.tasks.map((t) => t.title)).toEqual(['Export me'])
    expect(restored.projects.map((p) => p.name)).toEqual(['Alpha'])
    expect(restored.tags.map((t) => t.name)).toEqual(['home'])
    expect(restored.sessions).toHaveLength(1)
    expect(restored.attachments).toHaveLength(1)
    const attachment = restored.attachments[0]
    expect(attachment?.blob).toBeInstanceOf(Blob)
    expect('dataUrl' in attachment!).toBe(false)
    expect(restored.timer).toEqual({ taskId: null, startedAt: null, accumulatedMs: 0, targetMs: null })
  })

  it('importSummary reports the bundle counts for the confirmation UI', async () => {
    const { json } = await buildExportBundle(fixtureState())
    const parsed = parseImportBundle(JSON.parse(json))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(importSummary(parsed.data)).toEqual({ tasks: 1, projects: 1, tags: 1, sessions: 1, attachments: 1 })
  })
})

describe('importFileName', () => {
  it('is a dated, stable backup name', () => {
    expect(importFileName(new Date(2026, 9, 15))).toBe('taskflow-backup-2026-10-15.json')
  })
})
