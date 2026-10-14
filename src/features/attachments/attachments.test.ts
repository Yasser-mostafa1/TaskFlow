import { describe, expect, it } from 'vitest'
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  prepareAttachment,
  validateImageFile,
} from './imageValidation'
import { dataUrlToBlob } from './objectUrls'

const file = (type: string, size: number, name = 'shot.png') =>
  new File([new Uint8Array(size)], name, { type })

describe('image validation', () => {
  it('accepts every supported image type', () => {
    for (const type of ACCEPTED_IMAGE_TYPES) {
      expect(validateImageFile({ type, size: 1024 }).ok).toBe(true)
    }
  })

  it('rejects unsupported types with a readable reason', () => {
    const result = validateImageFile({ type: 'application/pdf', size: 10 })
    expect(result).toEqual({ ok: false, error: expect.stringContaining('images only') })
  })

  it('rejects empty and oversized files', () => {
    expect(validateImageFile({ type: 'image/png', size: 0 }).ok).toBe(false)
    expect(validateImageFile({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 }).ok).toBe(false)
    expect(validateImageFile({ type: 'image/png', size: MAX_IMAGE_BYTES }).ok).toBe(true)
  })

  it('builds an attachment only for valid files', () => {
    const ok = prepareAttachment(file('image/jpeg', 2048, 'photo.jpg'), 'task', 'task_1')
    expect(ok.ok).toBe(true)
    if (ok.ok) {
      expect(ok.attachment.ownerId).toBe('task_1')
      expect(ok.attachment.ownerType).toBe('task')
      expect(ok.attachment.mime).toBe('image/jpeg')
      expect(ok.attachment.blob).toBeInstanceOf(Blob)
    }

    const bad = prepareAttachment(file('text/plain', 10, 'notes.txt'), 'task', 'task_1')
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.error).toContain('images only')
  })
})

describe('data url conversion (export/import path)', () => {
  it('round-trips a blob through a data url', async () => {
    const original = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' })
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(original)
    })

    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true)
    const restored = dataUrlToBlob(dataUrl)
    expect(restored.type).toBe('image/png')
    expect(restored.size).toBe(4)
  })
})
