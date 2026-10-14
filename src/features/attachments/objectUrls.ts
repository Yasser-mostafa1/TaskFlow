import { useEffect, useState } from 'react'
import { logger } from '../../core/logger'

/**
 * Creates an object URL for a stored Blob and revokes it as soon as the
 * consumer unmounts or the blob changes (spec §14 — resource management).
 */
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return undefined
    }
    try {
      const objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
      return () => URL.revokeObjectURL(objectUrl)
    } catch (err) {
      logger.errorObj('attachment.url.failed', err)
      setUrl(null)
      return undefined
    }
  }, [blob])

  return url
}

/** Blob → data URL, used only by the JSON export path. */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('read-failed'))
    reader.readAsDataURL(blob)
  })
}

/** data URL → Blob, used only by the JSON import path. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, payload] = dataUrl.split(',')
  const mime = /data:([^;]+)/.exec(header ?? '')?.[1] ?? 'application/octet-stream'
  const binary = atob(payload ?? '')
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}
