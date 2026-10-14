import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import type { Project } from '../../core/types'
import { projectProgress } from '../../store/selectors'
import { useAppState } from '../../store/AppStoreContext'
import { Dropdown } from '../../ui/Dropdown'
import { ProgressBar } from '../../ui/Progress'
import { useObjectUrl } from '../attachments/objectUrls'

function Cover({ projectId, color }: { projectId: string; color: string }) {
  const state = useAppState()
  const cover = state.attachments.find((a) => a.ownerType === 'project' && a.ownerId === projectId)
  const url = useObjectUrl(cover?.blob)

  if (!cover || !url) {
    return <div className="h-16 w-full" style={{ background: color }} aria-hidden="true" />
  }
  return <img src={url} alt="" className="h-16 w-full object-cover" />
}

export function ProjectCard({
  project,
  onOpen,
  onEdit,
  onDelete,
}: {
  project: Project
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const state = useAppState()
  const progress = projectProgress(state, project)
  const attachmentCount = state.attachments.filter(
    (a) => a.ownerType === 'project' && a.ownerId === project.id,
  ).length

  return (
    <article className="tf-card group overflow-hidden">
      <button type="button" onClick={onOpen} className="block w-full text-left" aria-label={`Open ${project.name}`}>
        <Cover projectId={project.id} color={project.color} />
      </button>

      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <button type="button" onClick={onOpen} className="min-w-0 text-left">
            <h3 className="truncate text-sm font-semibold group-hover:text-accent">{project.name}</h3>
            {project.description && (
              <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">{project.description}</p>
            )}
          </button>
          <Dropdown
            label={`Actions for ${project.name}`}
            items={[
              { label: 'Open project', icon: <MoreHorizontal size={14} />, onSelect: onOpen },
              { label: 'Edit project', icon: <Pencil size={14} />, onSelect: onEdit },
              { label: 'Delete project', icon: <Trash2 size={14} />, onSelect: onDelete, danger: true },
            ]}
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-muted">
          <span>
            {progress.completed}/{progress.total} tasks
            {attachmentCount > 0 ? ` · ${attachmentCount} image${attachmentCount > 1 ? 's' : ''}` : ''}
          </span>
          <span className="font-medium">{progress.percent}%</span>
        </div>
        <div className="mt-1.5">
          <ProgressBar percent={progress.percent} tone={progress.percent === 100 && progress.total > 0 ? 'success' : 'accent'} />
        </div>
      </div>
    </article>
  )
}
