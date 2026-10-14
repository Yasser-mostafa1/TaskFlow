import { Check, Plus, Pencil, Tag as TagIcon, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { createId } from '../../core/ids'
import type { Tag } from '../../core/types'
import { useDispatch, useAppState } from '../../store/AppStoreContext'
import { useConfirm, useToast } from '../../ui/Feedback'
import { PageHeader } from '../../ui/PageHeader'

/** Tag management lives next to projects (spec §13). */
export function TagsPanel() {
  const state = useAppState()
  const dispatch = useDispatch()
  const toast = useToast()
  const confirm = useConfirm()
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const usage = (tag: Tag) => state.tasks.filter((task) => task.tagIds.includes(tag.id)).length

  const create = () => {
    const name = draft.trim()
    if (name === '') return
    const existing = state.tags.find((t) => t.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      toast.push('info', 'That tag already exists.')
      return
    }
    dispatch({ type: 'tag/save', tag: { id: createId('tag'), name, color: '#667085', createdAt: Date.now() } })
    setDraft('')
    toast.push('success', 'Tag created.')
  }

  const saveRename = (tag: Tag) => {
    const name = editingName.trim()
    setEditingId(null)
    if (name === '' || name === tag.name) return
    dispatch({ type: 'tag/save', tag: { ...tag, name } })
    toast.push('success', 'Tag renamed.')
  }

  const remove = async (tag: Tag) => {
    const count = usage(tag)
    const ok = await confirm({
      title: `Delete the tag "${tag.name}"?`,
      message:
        count > 0
          ? `It is used by ${count} task${count > 1 ? 's' : ''}. Those tasks keep their content and simply lose this tag.`
          : 'This cannot be undone.',
      confirmLabel: 'Delete tag',
      destructive: true,
    })
    if (!ok) return
    dispatch({ type: 'tag/remove', id: tag.id })
    toast.push('info', 'Tag deleted.')
  }

  return (
    <section aria-label="Tags" className="mt-8">
      <PageHeader title="Tags" description="Labels that cut across projects." />

      <div className="tf-card p-4">
        <div className="mb-3 flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                create()
              }
            }}
            placeholder="New tag name"
            aria-label="New tag name"
            className="tf-input max-w-xs"
          />
          <button type="button" onClick={create} aria-label="Create tag" className="tf-btn tf-btn-secondary">
            <Plus size={15} /> Add tag
          </button>
        </div>

        {state.tags.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-faint">
            <TagIcon size={15} /> No tags yet — create one above or from the task editor.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {state.tags.map((tag) => (
              <li key={tag.id} className="flex items-center gap-1 rounded-lg border border-line bg-surface-2 px-2 py-1">
                {editingId === tag.id ? (
                  <span className="flex items-center gap-1">
                    <input
                      autoFocus
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') saveRename(tag)
                        if (event.key === 'Escape') setEditingId(null)
                      }}
                      aria-label={`Rename ${tag.name}`}
                      className="tf-input h-6 w-32 px-1.5 text-xs"
                    />
                    <button
                      type="button"
                      aria-label="Save tag name"
                      onClick={() => saveRename(tag)}
                      className="rounded p-1 text-success hover:bg-surface"
                    >
                      <Check size={13} />
                    </button>
                  </span>
                ) : (
                  <>
                    <span className="text-[13px] font-medium text-ink">{tag.name}</span>
                    <span className="text-[11px] text-faint">{usage(tag)}</span>
                    <button
                      type="button"
                      aria-label={`Rename tag ${tag.name}`}
                      onClick={() => {
                        setEditingId(tag.id)
                        setEditingName(tag.name)
                      }}
                      className="rounded p-1 text-faint hover:text-ink"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete tag ${tag.name}`}
                      onClick={() => void remove(tag)}
                      className="rounded p-1 text-faint hover:text-danger"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
