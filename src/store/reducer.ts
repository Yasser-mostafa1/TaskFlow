import { nowStamp } from '../core/dates'
import type {
  AppState,
  FocusSession,
  Project,
  Tag,
  Task,
  TaskStatus,
  TimerState,
} from '../core/types'

/** Every state change in the app goes through exactly one of these actions. */
export type Action =
  | { type: 'task/add'; task: Task }
  | { type: 'task/update'; id: string; patch: Partial<Task> }
  | { type: 'task/remove'; ids: string[] }
  | { type: 'task/setStatus'; ids: string[]; status: TaskStatus }
  | {
      type: 'task/move'
      activeId: string
      overId: string | null
      position: 'before' | 'after'
      status?: TaskStatus
    }
  | { type: 'project/save'; project: Project }
  | { type: 'project/remove'; id: string }
  | { type: 'tag/save'; tag: Tag }
  | { type: 'tag/remove'; id: string }
  | { type: 'session/add'; session: FocusSession }
  | { type: 'session/removeForTask'; taskId: string }
  | { type: 'timer/set'; timer: TimerState }
  | { type: 'attachment/add'; attachment: AppState['attachments'][number] }
  | { type: 'attachment/remove'; id: string }
  | { type: 'attachment/removeForOwner'; ownerType: 'task' | 'project'; ownerId: string }
  | { type: 'state/replace'; state: AppState }

const byOrder = (a: Task, b: Task): number => a.order - b.order

function withStatus(task: Task, status: TaskStatus, now: number): Task {
  if (task.status === status) return task
  return {
    ...task,
    status,
    completedAt: status === 'completed' ? now : null,
    updatedAt: now,
  }
}

/**
 * Relocates one task in the global order and (optionally) changes its status,
 * then renumbers everything so the persisted order is always consistent.
 */
export function applyMove(
  tasks: Task[],
  activeId: string,
  overId: string | null,
  position: 'before' | 'after',
  status: TaskStatus | undefined,
  now: number,
): Task[] {
  const ordered = [...tasks].sort(byOrder)
  const activeIndex = ordered.findIndex((t) => t.id === activeId)
  if (activeIndex === -1) return tasks

  const current = ordered[activeIndex] as Task
  const active = status ? withStatus(current, status, now) : current
  const rest = ordered.filter((t) => t.id !== activeId)

  let insertAt = rest.length
  if (overId !== null) {
    const overIndex = rest.findIndex((t) => t.id === overId)
    if (overIndex >= 0) insertAt = position === 'before' ? overIndex : overIndex + 1
  }
  rest.splice(insertAt, 0, active)

  // Renumber the whole list so stored order values never collide.
  return rest.map((task, index) => (task.order === index ? task : { ...task, order: index }))
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'task/add':
      return { ...state, tasks: [...state.tasks, action.task] }

    case 'task/update': {
      const now = nowStamp()
      return {
        ...state,
        tasks: state.tasks.map((task) => {
          if (task.id !== action.id) return task
          const next: Task = { ...task, ...action.patch, updatedAt: now }
          if (action.patch.status !== undefined && action.patch.completedAt === undefined) {
            next.completedAt = action.patch.status === 'completed' ? now : null
          }
          return next
        }),
      }
    }

    case 'task/remove': {
      const ids = new Set(action.ids)
      return {
        ...state,
        tasks: state.tasks
          .filter((task) => !ids.has(task.id))
          .map((task) =>
            task.dependsOn.some((dep) => ids.has(dep))
              ? { ...task, dependsOn: task.dependsOn.filter((dep) => !ids.has(dep)) }
              : task,
          ),
        sessions: state.sessions.filter((session) => !ids.has(session.taskId)),
        attachments: state.attachments.filter(
          (attachment) => !(attachment.ownerType === 'task' && ids.has(attachment.ownerId)),
        ),
        timer:
          state.timer.taskId !== null && ids.has(state.timer.taskId)
            ? { taskId: null, startedAt: null, accumulatedMs: 0 }
            : state.timer,
      }
    }

    case 'task/setStatus': {
      const now = nowStamp()
      const ids = new Set(action.ids)
      return {
        ...state,
        tasks: state.tasks.map((task) => (ids.has(task.id) ? withStatus(task, action.status, now) : task)),
      }
    }

    case 'task/move': {
      const now = nowStamp()
      return {
        ...state,
        tasks: applyMove(
          state.tasks,
          action.activeId,
          action.overId,
          action.position,
          action.status,
          now,
        ),
      }
    }

    case 'project/save': {
      const now = nowStamp()
      const exists = state.projects.some((project) => project.id === action.project.id)
      return {
        ...state,
        projects: exists
          ? state.projects.map((project) =>
              project.id === action.project.id
                ? { ...action.project, createdAt: project.createdAt, updatedAt: now }
                : project,
            )
          : [...state.projects, { ...action.project, updatedAt: now }],
      }
    }

    /** Projects are never deleted together with their tasks (spec §13). */
    case 'project/remove':
      return {
        ...state,
        projects: state.projects.filter((project) => project.id !== action.id),
        tasks: state.tasks.map((task) =>
          task.projectId === action.id ? { ...task, projectId: null } : task,
        ),
        attachments: state.attachments.filter(
          (attachment) => !(attachment.ownerType === 'project' && attachment.ownerId === action.id),
        ),
      }

    case 'tag/save': {
      const now = nowStamp()
      const exists = state.tags.some((tag) => tag.id === action.tag.id)
      return {
        ...state,
        tags: exists
          ? state.tags.map((tag) => (tag.id === action.tag.id ? { ...action.tag, createdAt: tag.createdAt } : tag))
          : [...state.tags, { ...action.tag, createdAt: now }],
      }
    }

    case 'tag/remove':
      return {
        ...state,
        tags: state.tags.filter((tag) => tag.id !== action.id),
        tasks: state.tasks.map((task) =>
          task.tagIds.includes(action.id)
            ? { ...task, tagIds: task.tagIds.filter((id) => id !== action.id) }
            : task,
        ),
      }

    case 'session/add':
      return { ...state, sessions: [...state.sessions, action.session] }

    case 'session/removeForTask':
      return { ...state, sessions: state.sessions.filter((s) => s.taskId !== action.taskId) }

    case 'timer/set':
      return { ...state, timer: action.timer }

    case 'attachment/add':
      return { ...state, attachments: [...state.attachments, action.attachment] }

    case 'attachment/remove':
      return { ...state, attachments: state.attachments.filter((a) => a.id !== action.id) }

    case 'attachment/removeForOwner':
      return {
        ...state,
        attachments: state.attachments.filter(
          (a) => !(a.ownerType === action.ownerType && a.ownerId === action.ownerId),
        ),
      }

    case 'state/replace':
      return action.state

    default: {
      const exhaustive: never = action
      void exhaustive
      return state
    }
  }
}
