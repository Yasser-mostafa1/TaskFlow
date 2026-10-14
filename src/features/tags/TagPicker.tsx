import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { createId } from '../../core/ids'
import { useDispatch, useAppState } from '../../store/AppStoreContext'

/**
 * Chip-based tag picker shared by the task editor and the filter bar.
 * Tags are global: one name + color, referenced by id from any task.
 */
export function TagPicker({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const state = useAppState()
  const dispatch = useDispatch()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  const createTag = () => {
    const trimmed = name.trim()
    if (trimmed === '') return
    const existing = state.tags.find((tag) => tag.name.toLowerCase() === trimmed.toLowerCase())
    if (existing) {
      if (!selected.includes(existing.id)) onChange([...selected, existing.id])
    } else {
      const tag = { id: createId('tag'), name: trimmed, color: '#667085', createdAt: Date.now() }
      dispatch({ type: 'tag/save', tag })
      onChange([...selected, tag.id])
    }
    setName('')
    setCreating(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {state.tags.map((tag) => {
        const active = selected.includes(tag.id)
        return (
          <button
            key={tag.id}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(tag.id)}
            className={`tf-badge transition-colors ${
              active
                ? 'border-accent/40 bg-accent-soft text-accent'
                : 'border-line bg-surface-2 text-muted hover:text-ink'
            }`}
          >
            {tag.name}
            {active && <X size={11} />}
          </button>
        )
      })}

      {creating ? (
        <span className="flex items-center gap-1">
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                createTag()
              }
              if (event.key === 'Escape') setCreating(false)
            }}
            onBlur={createTag}
            placeholder="Tag name"
            aria-label="New tag name"
            className="tf-input h-7 w-32 px-2 text-xs"
          />
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="tf-badge border-dashed border-line bg-transparent text-faint hover:text-ink"
        >
          <Plus size={11} /> Tag
        </button>
      )}
    </div>
  )
}
