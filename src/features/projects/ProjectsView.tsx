import { ArrowLeft, FolderKanban, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Project, Task } from '../../core/types'
import { projectProgress } from '../../store/selectors'
import { useDispatch, useAppState } from '../../store/AppStoreContext'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { Modal } from '../../ui/Modal'
import { PageHeader } from '../../ui/PageHeader'
import { ProgressBar } from '../../ui/Progress'
import { useToast } from '../../ui/Feedback'
import { TagsPanel } from '../tags/TagsPanel'
import { ImageAttachments } from '../attachments/ImageAttachments'
import { QuickAdd } from '../tasks/QuickAdd'
import { TaskEditor } from '../tasks/TaskEditor'
import { TaskRow } from '../tasks/TaskRow'
import { ProjectCard } from './ProjectCard'
import { ProjectEditor } from './ProjectEditor'

function ProjectDetail({
  project,
  onBack,
  onEdit,
  onDelete,
  onEditTask,
}: {
  project: Project
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
  onEditTask: (task: Task) => void
}) {
  const state = useAppState()
  const progress = projectProgress(state, project)
  const tasks = useMemo(
    () => state.tasks.filter((task) => task.projectId === project.id).sort((a, b) => a.order - b.order),
    [state.tasks, project.id],
  )
  const now = new Date()

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft size={15} /> All projects
      </button>

      <PageHeader
        title={project.name}
        description={project.description || 'No description yet.'}
        actions={
          <>
            <Button icon={<Pencil size={15} />} onClick={onEdit}>
              Edit
            </Button>
            <Button variant="danger" icon={<Trash2 size={15} />} onClick={onDelete}>
              Delete
            </Button>
          </>
        }
      />

      <div className="mb-5 flex items-center gap-4 rounded-xl border border-line bg-surface p-4">
        <span className="h-9 w-9 shrink-0 rounded-lg" style={{ background: project.color }} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="text-muted">
              {progress.completed} of {progress.total} tasks completed
            </span>
            <span className="font-semibold">{progress.percent}%</span>
          </div>
          <ProgressBar percent={progress.percent} tone={progress.percent === 100 && progress.total > 0 ? 'success' : 'accent'} />
        </div>
      </div>

      <div className="mb-5">
        <ImageAttachments ownerType="project" ownerId={project.id} />
      </div>

      <div className="mb-4">
        <QuickAdd defaultProjectId={project.id} />
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={<FolderKanban size={28} />}
          title="No tasks in this project yet"
          description="Add one above — it will be linked to this project automatically."
        />
      ) : (
        <div className="tf-card overflow-hidden">
          <ul>
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                now={now}
                onEdit={onEditTask}
                selected={false}
                onToggleSelect={() => undefined}
                selectable={false}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function ProjectsView() {
  const state = useAppState()
  const dispatch = useDispatch()
  const toast = useToast()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [taskEditorOpen, setTaskEditorOpen] = useState(false)

  const selected = state.projects.find((project) => project.id === selectedId) ?? null
  const taskCountOf = (project: Project) =>
    state.tasks.filter((task) => task.projectId === project.id).length

  const openNew = () => {
    setEditing(null)
    setEditorOpen(true)
  }

  const confirmDelete = (project: Project) => {
    setEditing(null)
    setDeleteTarget(project)
  }

  const deleteProject = (mode: 'keep-tasks' | 'delete-tasks') => {
    const project = deleteTarget
    if (!project) return
    if (mode === 'delete-tasks') {
      const ids = state.tasks.filter((task) => task.projectId === project.id).map((task) => task.id)
      if (ids.length > 0) dispatch({ type: 'task/remove', ids })
      toast.push('info', `Project deleted with ${ids.length} task${ids.length === 1 ? '' : 's'}.`)
    } else {
      toast.push('success', 'Project deleted. Its tasks were kept.')
    }
    dispatch({ type: 'project/remove', id: project.id })
    setDeleteTarget(null)
    setSelectedId(null)
  }

  return (
    <div className="mx-auto max-w-6xl">
      {selected ? (
        <ProjectDetail
          project={selected}
          onBack={() => setSelectedId(null)}
          onEdit={() => {
            setEditing(selected)
            setEditorOpen(true)
          }}
          onDelete={() => confirmDelete(selected)}
          onEditTask={(task) => {
            setEditingTask(task)
            setTaskEditorOpen(true)
          }}
        />
      ) : (
        <>
          <PageHeader
            title="Projects"
            description="Group related tasks and track their progress."
            actions={
              <Button variant="primary" icon={<Plus size={15} />} onClick={openNew}>
                New project
              </Button>
            }
          />

          {state.projects.length === 0 ? (
            <EmptyState
              icon={<FolderKanban size={28} />}
              title="No projects yet"
              description="Projects keep related tasks together with one shared progress bar."
              action={
                <Button variant="primary" size="sm" onClick={openNew}>
                  Create a project
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {state.projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onOpen={() => setSelectedId(project.id)}
                  onEdit={() => {
                    setEditing(project)
                    setEditorOpen(true)
                  }}
                  onDelete={() => confirmDelete(project)}
                />
              ))}
            </div>
          )}

          <TagsPanel />
        </>
      )}

      <ProjectEditor open={editorOpen} project={editing} onClose={() => setEditorOpen(false)} />

      <TaskEditor
        open={taskEditorOpen}
        task={editingTask}
        onClose={() => setTaskEditorOpen(false)}
      />

      <Modal
        open={deleteTarget !== null}
        title="Delete this project?"
        onClose={() => setDeleteTarget(null)}
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={() => deleteProject('keep-tasks')}>
              Keep its tasks
            </Button>
            <Button variant="danger" onClick={() => deleteProject('delete-tasks')}>
              Delete tasks too
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          <span className="font-medium text-ink">{deleteTarget?.name}</span> will be removed.
          It currently holds{' '}
          <span className="font-medium text-ink">
            {deleteTarget ? taskCountOf(deleteTarget) : 0} task
            {deleteTarget && taskCountOf(deleteTarget) === 1 ? '' : 's'}
          </span>
          . Choose whether those tasks should stay (they become “No project”) or be deleted with it.
        </p>
      </Modal>
    </div>
  )
}
