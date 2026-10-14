import { createId } from '../../core/ids'
import { nowStamp } from '../../core/dates'
import { logger } from '../../core/logger'
import type { Attachment } from '../../core/types'

export const ACCEPTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
] as const

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export const ACCEPTED_IMAGE_LABEL = 'PNG, JPEG, GIF, WebP, AVIF or BMP'

export type ImageValidation = { ok: true } | { ok: false; error: string }

/** Type + size validation before anything is written to IndexedDB (spec §14). */
export function validateImageFile(file: { type: string; size: number }): ImageValidation {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: `${ACCEPTED_IMAGE_LABEL} images only.` }
  }
  if (file.size === 0) return { ok: false, error: 'That file is empty.' }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: 'Images must be smaller than 5 MB.' }
  }
  return { ok: true }
}

/** Builds an Attachment record from an already validated file. */
export function buildAttachment(
  file: File,
  ownerType: 'task' | 'project',
  ownerId: string,
): Attachment {
  return {
    id: createId('att'),
    ownerType,
    ownerId,
    name: file.name,
    mime: file.type,
    size: file.size,
    blob: file,
    createdAt: nowStamp(),
  }
}

/** Validates and converts, returning a precise error string on rejection. */
export function prepareAttachment(
  file: File,
  ownerType: 'task' | 'project',
  ownerId: string,
): { ok: true; attachment: Attachment } | { ok: false; error: string } {
  const validation = validateImageFile(file)
  if (!validation.ok) {
    logger.info('attachment.rejected', { reason: 'validation', size: file.size })
    return { ok: false, error: validation.error }
  }
  return { ok: true, attachment: buildAttachment(file, ownerType, ownerId) }
}
