import { ImagePlus, Trash2, X, ZoomIn } from 'lucide-react'
import { useRef, useState } from 'react'
import { logger } from '../../core/logger'
import type { Attachment } from '../../core/types'
import { useDispatch, useAppState } from '../../store/AppStoreContext'
import { Button } from '../../ui/Button'
import { Modal } from '../../ui/Modal'
import { useConfirm, useToast } from '../../ui/Feedback'
import { ACCEPTED_IMAGE_LABEL, MAX_IMAGE_BYTES, prepareAttachment } from './imageValidation'
import { useObjectUrl } from './objectUrls'

function AttachmentImage({ attachment, className }: { attachment: Attachment; className?: string }) {
  const url = useObjectUrl(attachment.blob)
  if (!url) return <div className={`bg-surface-2 ${className ?? ''}`} aria-hidden="true" />
  return <img src={url} alt={attachment.name} className={className} />
}

/** Images attached to one task or project: add, preview, remove (spec §14). */
export function ImageAttachments({
  ownerType,
  ownerId,
}: {
  ownerType: 'task' | 'project'
  ownerId: string
}) {
  const state = useAppState()
  const dispatch = useDispatch()
  const toast = useToast()
  const confirm = useConfirm()
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)

  const items = state.attachments.filter(
    (attachment) => attachment.ownerType === ownerType && attachment.ownerId === ownerId,
  )
  const preview = items.find((attachment) => attachment.id === previewId) ?? null

  const onFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    for (const file of Array.from(fileList)) {
      const result = prepareAttachment(file, ownerType, ownerId)
      if (!result.ok) {
        toast.push('error', result.error)
        continue
      }
      dispatch({ type: 'attachment/add', attachment: result.attachment })
      logger.info('attachment.added', { size: result.attachment.size })
    }
    toast.push('success', 'Image attached.')
    if (inputRef.current) inputRef.current.value = ''
  }

  const remove = async (attachment: Attachment) => {
    const ok = await confirm({
      title: 'Remove this image?',
      message: `"${attachment.name}" will be deleted from this browser. This cannot be undone.`,
      confirmLabel: 'Remove image',
      destructive: true,
    })
    if (!ok) return
    dispatch({ type: 'attachment/remove', id: attachment.id })
    if (previewId === attachment.id) setPreviewId(null)
    toast.push('info', 'Image removed.')
  }

  return (
    <section aria-label="Images">
      <div className="mb-2 flex items-center justify-between">
        <span className="tf-label mb-0">Images</span>
        <span className="text-[11px] text-faint">
          {ACCEPTED_IMAGE_LABEL} · up to {Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {items.map((attachment) => (
          <div key={attachment.id} className="group relative h-20 w-24 overflow-hidden rounded-lg border border-line">
            <button
              type="button"
              onClick={() => setPreviewId(attachment.id)}
              aria-label={`Preview ${attachment.name}`}
              className="h-full w-full"
            >
              <AttachmentImage attachment={attachment} className="h-full w-full object-cover" />
              <span className="absolute inset-0 hidden items-center justify-center bg-black/40 group-hover:flex">
                <ZoomIn size={16} className="text-white" />
              </span>
            </button>
            <button
              type="button"
              onClick={() => void remove(attachment)}
              aria-label={`Remove ${attachment.name}`}
              className="absolute right-1 top-1 rounded-md bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-20 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-faint transition-colors hover:border-accent hover:text-accent"
          aria-label="Add image"
        >
          <ImagePlus size={17} />
          <span className="text-[11px]">Add</span>
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/avif,image/bmp"
        multiple
        onChange={(event) => onFiles(event.target.files)}
        className="hidden"
        aria-label="Choose image files"
      />

      <Modal
        open={preview !== null}
        title={preview?.name ?? ''}
        onClose={() => setPreviewId(null)}
        width="lg"
        footer={
          <>
            <span className="mr-auto text-xs text-muted">
              {preview ? `${Math.max(1, Math.round(preview.size / 1024))} KB` : ''}
            </span>
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 size={14} />}
              onClick={() => preview && void remove(preview)}
            >
              Remove
            </Button>
            <Button variant="secondary" size="sm" icon={<X size={14} />} onClick={() => setPreviewId(null)}>
              Close
            </Button>
          </>
        }
      >
        {preview && <AttachmentImage attachment={preview} className="max-h-[60vh] w-full rounded-lg object-contain" />}
      </Modal>
    </section>
  )
}
