/**
 * JSON backup export/import (journey G9).
 *
 * Export serializes every collection, attachments included (as data URLs).
 * Import is all-or-nothing: the file is validated by `parseImportBundle`
 * BEFORE anything is applied, and applying always happens through an explicit
 * user confirmation in the Settings view — data is never silently replaced.
 */
import { dateKey } from '../../core/dates'
import { parseImportBundle, type ImportBundle, type ImportResult } from '../../core/guards'
import { logger } from '../../core/logger'
import { EMPTY_TIMER } from '../../db/schema'
import type { AppState, Attachment } from '../../core/types'
import { blobToDataUrl, dataUrlToBlob } from '../attachments/objectUrls'

export interface CollectionCounts {
  tasks: number
  projects: number
  tags: number
  sessions: number
  attachments: number
}

export interface ExportResult {
  json: string
  summary: CollectionCounts
}

function counts(tasks: number, projects: number, tags: number, sessions: number, attachments: number): CollectionCounts {
  return { tasks, projects, tags, sessions, attachments }
}

/** Reads a file's text and validates it in one step. */
export async function parseImportFile(file: File): Promise<ImportResult> {
  let json: unknown
  try {
    json = JSON.parse(await file.text())
  } catch {
    return { ok: false, error: 'The file is not valid JSON.' }
  }
  return parseImportBundle(json)
}

export function importSummary(data: ImportBundle): CollectionCounts {
  return counts(
    data.tasks.length,
    data.projects.length,
    data.tags.length,
    data.sessions.length,
    data.attachments.length,
  )
}

/** Builds the version-1 backup JSON; attachments are read into data URLs. */
export async function buildExportBundle(state: AppState): Promise<ExportResult> {
  const attachments: Array<Omit<Attachment, 'blob'> & { dataUrl: string }> = []
  for (const attachment of state.attachments) {
    const { blob, ...rest } = attachment
    attachments.push({ ...rest, dataUrl: await blobToDataUrl(blob) })
  }
  const bundle = {
    version: 1,
    exportedAt: Date.now(),
    tasks: state.tasks,
    projects: state.projects,
    tags: state.tags,
    sessions: state.sessions,
    attachments,
  }
  logger.info('export.build', {
    tasks: state.tasks.length,
    projects: state.projects.length,
    tags: state.tags.length,
    sessions: state.sessions.length,
    attachments: attachments.length,
  })
  return {
    json: JSON.stringify(bundle),
    summary: counts(
      state.tasks.length,
      state.projects.length,
      state.tags.length,
      state.sessions.length,
      attachments.length,
    ),
  }
}

/** Turns validated import data into a fresh application state (timer starts idle). */
export function applyImport(data: ImportBundle): AppState {
  return {
    tasks: data.tasks,
    projects: data.projects,
    tags: data.tags,
    sessions: data.sessions,
    attachments: data.attachments.map(({ dataUrl, ...rest }) => ({ ...rest, blob: dataUrlToBlob(dataUrl) })),
    timer: { ...EMPTY_TIMER },
  }
}

export function importFileName(now: Date = new Date()): string {
  return `taskflow-backup-${dateKey(now)}.json`
}

/** Triggers a browser download of the JSON text. */
export function downloadJson(filename: string, json: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
