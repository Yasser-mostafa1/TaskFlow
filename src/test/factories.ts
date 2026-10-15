import { createId } from '../core/ids'
import type { AppState, Project, Tag, Task } from '../core/types'

let orderCounter = 0

export function makeTask(overrides: Partial<Task> = {}): Task {
  orderCounter += 1
  const stamp = 1_700_000_000_000 + orderCounter
  return {
    id: createId('task'),
    title: 'Sample task',
    description: '',
    status: 'todo',
    priority: 'medium',
    dueDate: null,
    startDate: null,
    estimateMinutes: null,
    projectId: null,
    tagIds: [],
    subtasks: [],
    dependsOn: [],
    order: orderCounter,
    createdAt: stamp,
    updatedAt: stamp,
    completedAt: null,
    ...overrides,
  }
}

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: createId('proj'),
    name: 'Project',
    description: '',
    color: '#4f46e5',
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...overrides,
  }
}

export function makeTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: createId('tag'),
    name: 'tag',
    color: '#667085',
    createdAt: 1_700_000_000_000,
    ...overrides,
  }
}

export function makeState(partial: Partial<AppState> = {}): AppState {
  return {
    tasks: [],
    projects: [],
    tags: [],
    sessions: [],
    attachments: [],
    timer: { taskId: null, startedAt: null, accumulatedMs: 0, targetMs: null },
    ...partial,
  }
}
