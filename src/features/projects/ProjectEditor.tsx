import { Save, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { MAX_NAME } from '../../core/guards'
import { createId } from '../../core/ids'
import { nowStamp } from '../../core/dates'
import type { Project } from '../../core/types'
import { useDispatch } from '../../store/AppStoreContext'
import { Button } from '../../ui/Button'
import { Field, Input, Textarea } from '../../ui/Field'
import { Modal } from '../../ui/Modal'
import { useToast } from '../../ui/Feedback'

export const PROJECT_COLORS = [
  '#4f46e5',
  '#2563eb',
  '#0d9488',
  '#16a34a',
  '#d97706',
  '#e11d48',
  '#9333ea',
  '#475569',
]

const EMPTY = { name: '', description: '', color: PROJECT_COLORS[0] as string }

export function ProjectEditor({
  open,
  project,
  onClose,
}: {
  open: boolean
  project: Project | null
  onClose: () => void
}) {
  const dispatch = useDispatch()
  const toast = useToast()
  const [draft, setDraft] = useState(EMPTY)
  const [error, setError] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!open) return
    setError(undefined)
    setDraft(
      project
        ? { name: project.name, description: project.description, color: project.color }
        : { ...EMPTY },
    )
  }, [open, project])

  const submit = () => {
    const name = draft.name.trim()
    if (name === '') {
      setError('A project name is required.')
      return
    }
    if (name.length > MAX_NAME) {
      setError(`Keep the name under ${MAX_NAME} characters.`)
      return
    }
    const now = nowStamp()
    dispatch({
      type: 'project/save',
      project: {
        id: project?.id ?? createId('proj'),
        name,
        description: draft.description.trim(),
        color: draft.color,
        createdAt: project?.createdAt ?? now,
        updatedAt: now,
      },
    })
    toast.push('success', project ? 'Project updated.' : 'Project created.')
    onClose()
  }

  return (
    <Modal
      open={open}
      title={project ? 'Edit project' : 'New project'}
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} icon={<X size={15} />}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} icon={<Save size={15} />}>
            {project ? 'Save changes' : 'Create project'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Name" error={error}>
          {(id, describedBy) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              value={draft.name}
              maxLength={MAX_NAME}
              onChange={(event) => {
                setDraft({ ...draft, name: event.target.value })
                setError(undefined)
              }}
              placeholder="e.g. Website redesign"
            />
          )}
        </Field>

        <Field label="Description">
          {(id) => (
            <Textarea
              id={id}
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              placeholder="Optional: what is this project about?"
            />
          )}
        </Field>

        <fieldset>
          <legend className="tf-label">Color</legend>
          <div className="flex flex-wrap gap-2">
            {PROJECT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Color ${color}`}
                aria-pressed={draft.color === color}
                onClick={() => setDraft({ ...draft, color })}
                className={`h-7 w-7 rounded-full border-2 transition-transform ${
                  draft.color === color ? 'scale-110 border-ink' : 'border-transparent'
                }`}
                style={{ background: color }}
              />
            ))}
          </div>
        </fieldset>
      </div>
    </Modal>
  )
}
