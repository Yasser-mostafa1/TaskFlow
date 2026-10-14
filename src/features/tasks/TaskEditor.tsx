import { CalendarDays, FolderKanban, Save, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatDuration } from '../../core/dates'
import { validateTaskDraft, type DraftErrors } from '../../core/guards'
import { logger } from '../../core/logger'
import { PRIORITIES, PRIORITY_LABEL, STATUS_LABEL, TASK_STATUSES } from '../../core/types'
import type { Task, TaskStatus } from '../../core/types'
import { useDispatch, useAppState } from '../../store/AppStoreContext'
import { Button } from '../../ui/Button'
import { Field, Input, Select, Textarea } from '../../ui/Field'
import { Modal } from '../../ui/Modal'
import { useToast } from '../../ui/Feedback'
import { TagPicker } from '../tags/TagPicker'
import { ImageAttachments } from '../attachments/ImageAttachments'
import { DependencyPicker } from './DependencyPicker'
import { SubtaskEditor } from './SubtaskEditor'
import { createTaskFromDraft, draftFromTask, EMPTY_DRAFT, type TaskDraft } from './factory'

export function TaskEditor({
  open,
  task,
  defaultProjectId,
  onClose,
}: {
  open: boolean
  task: Task | null
  defaultProjectId?: string | null
  onClose: () => void
}) {
  const state = useAppState()
  const dispatch = useDispatch()
  const toast = useToast()
  const [draft, setDraft] = useState<TaskDraft>(EMPTY_DRAFT)
  const [errors, setErrors] = useState<DraftErrors>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    if (task) setDraft(draftFromTask(task))
    else setDraft({ ...EMPTY_DRAFT, projectId: defaultProjectId ?? null })
  }, [open, task, defaultProjectId])

  const patch = (next: Partial<TaskDraft>) => setDraft((current) => ({ ...current, ...next }))

  const submit = () => {
    const found = validateTaskDraft(draft)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      logger.info('task.editor.invalid', { fields: Object.keys(found).length })
      return
    }
    if (task) {
      dispatch({ type: 'task/update', id: task.id, patch: { ...draft } })
      toast.push('success', 'Task updated.')
    } else {
      dispatch({ type: 'task/add', task: createTaskFromDraft(draft, state) })
      toast.push('success', 'Task created.')
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      title={task ? 'Edit task' : 'New task'}
      onClose={onClose}
      width="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} icon={<X size={15} />}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} icon={<Save size={15} />}>
            {task ? 'Save changes' : 'Create task'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Title" error={errors.title}>
          {(id, describedBy) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              value={draft.title}
              onChange={(event) => patch({ title: event.target.value })}
              placeholder="What needs to be done?"
              maxLength={300}
            />
          )}
        </Field>

        <Field label="Description" error={errors.description}>
          {(id, describedBy) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              value={draft.description}
              onChange={(event) => patch({ description: event.target.value })}
              placeholder="Optional details, links, acceptance criteria…"
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status">
            {(id) => (
              <Select id={id} value={draft.status} onChange={(event) => patch({ status: event.target.value as TaskStatus })}>
                {TASK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABEL[status]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Priority">
            {(id) => (
              <Select id={id} value={draft.priority} onChange={(event) => patch({ priority: event.target.value as Task['priority'] })}>
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {PRIORITY_LABEL[priority]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Due date" error={errors.dueDate} hint="Date only, or date and time">
            {(id, describedBy) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                type="datetime-local"
                value={draft.dueDate ?? ''}
                onChange={(event) => patch({ dueDate: event.target.value === '' ? null : event.target.value })}
              />
            )}
          </Field>

          <Field label="Start date">
            {(id) => (
              <Input
                id={id}
                type="date"
                value={draft.startDate ?? ''}
                onChange={(event) => patch({ startDate: event.target.value === '' ? null : event.target.value })}
              />
            )}
          </Field>

          <Field label="Estimate" error={errors.estimateMinutes} hint={draft.estimateMinutes ? formatDuration(draft.estimateMinutes) : 'Minutes'}>
            {(id, describedBy) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                type="number"
                min={1}
                max={43200}
                value={draft.estimateMinutes ?? ''}
                onChange={(event) =>
                  patch({ estimateMinutes: event.target.value === '' ? null : Number(event.target.value) })
                }
                placeholder="e.g. 45"
              />
            )}
          </Field>

          <Field label="Project">
            {(id) => (
              <Select
                id={id}
                value={draft.projectId ?? ''}
                onChange={(event) => patch({ projectId: event.target.value === '' ? null : event.target.value })}
              >
                <option value="">No project</option>
                {state.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <section aria-label="Tags">
          <span className="tf-label">Tags</span>
          <TagPicker selected={draft.tagIds} onChange={(tagIds) => patch({ tagIds })} />
        </section>

        <SubtaskEditor subtasks={draft.subtasks} onChange={(subtasks) => patch({ subtasks })} />

        <DependencyPicker taskId={task?.id ?? null} dependsOn={draft.dependsOn} onChange={(dependsOn) => patch({ dependsOn })} />

        {task && <ImageAttachments ownerType="task" ownerId={task.id} />}
        {!task && (
          <p className="text-xs text-faint">Save the task first, then attach images to it.</p>
        )}

        <p className="flex items-center gap-1.5 text-xs text-faint">
          <CalendarDays size={13} /> Times are stored in your local timezone.
          <FolderKanban size={13} className="ml-2" /> Changes are saved automatically.
        </p>
      </div>
    </Modal>
  )
}
