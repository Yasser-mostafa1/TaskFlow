import { Search, X } from 'lucide-react'
import { PRIORITIES, PRIORITY_LABEL, TASK_STATUSES, STATUS_LABEL } from '../../core/types'
import type { Priority, TaskStatus } from '../../core/types'
import { DEFAULT_FILTER, type SortKey, type TaskFilter } from '../../store/selectors'
import { useAppState } from '../../store/AppStoreContext'
import { Segmented } from '../../ui/Segmented'
import { Select } from '../../ui/Field'

export const SORTS: Array<{ value: SortKey; label: string }> = [
  { value: 'manual', label: 'Manual order' },
  { value: 'due', label: 'Due date' },
  { value: 'priority', label: 'Priority' },
  { value: 'created', label: 'Newest first' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'updated', label: 'Recently updated' },
]

const SCOPES = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due today' },
] as const

export function isDefaultFilter(filter: TaskFilter): boolean {
  return (
    filter.query === DEFAULT_FILTER.query &&
    filter.status === DEFAULT_FILTER.status &&
    filter.priority === DEFAULT_FILTER.priority &&
    filter.projectId === DEFAULT_FILTER.projectId &&
    filter.tagId === DEFAULT_FILTER.tagId &&
    filter.scope === DEFAULT_FILTER.scope
  )
}

export function FilterBar({
  filter,
  onFilter,
  sort,
  onSort,
}: {
  filter: TaskFilter
  onFilter: (next: TaskFilter) => void
  sort: SortKey
  onSort: (next: SortKey) => void
}) {
  const state = useAppState()
  const dirty = !isDefaultFilter(filter)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={filter.query}
            onChange={(event) => onFilter({ ...filter, query: event.target.value })}
            placeholder="Search tasks and tags"
            aria-label="Search tasks"
            className="tf-input pl-8"
          />
        </div>

        <Segmented
          ariaLabel="Task scope"
          value={filter.scope}
          options={SCOPES.map((scope) => ({ value: scope.value, label: scope.label }))}
          onChange={(scope) => onFilter({ ...filter, scope })}
        />

        <Select
          aria-label="Sort tasks"
          value={sort}
          onChange={(event) => onSort(event.target.value as SortKey)}
          className="w-auto cursor-pointer"
        >
          {SORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Filter by status"
          value={filter.status}
          onChange={(event) => onFilter({ ...filter, status: event.target.value as 'all' | TaskStatus })}
          className="h-8 w-auto text-[13px]"
        >
          <option value="all">Any status</option>
          {TASK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Filter by priority"
          value={filter.priority}
          onChange={(event) => onFilter({ ...filter, priority: event.target.value as 'all' | Priority })}
          className="h-8 w-auto text-[13px]"
        >
          <option value="all">Any priority</option>
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {PRIORITY_LABEL[priority]}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Filter by project"
          value={filter.projectId}
          onChange={(event) => onFilter({ ...filter, projectId: event.target.value })}
          className="h-8 w-auto max-w-48 text-[13px]"
        >
          <option value="all">All projects</option>
          <option value="none">No project</option>
          {state.projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Filter by tag"
          value={filter.tagId}
          onChange={(event) => onFilter({ ...filter, tagId: event.target.value })}
          className="h-8 w-auto text-[13px]"
        >
          <option value="all">All tags</option>
          {state.tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </Select>

        {dirty && (
          <button
            type="button"
            onClick={() => onFilter({ ...DEFAULT_FILTER })}
            className="tf-btn tf-btn-sm tf-btn-ghost"
          >
            <X size={13} /> Clear filters
          </button>
        )}
      </div>
    </div>
  )
}
