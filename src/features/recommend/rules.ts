/**
 * Deterministic "What should I do now?" rules (spec §10).
 *
 * Pure: (state, now) → recommendation with a human reason, or null.
 * No AI, no randomness, no invented data — every reason is derived from
 * the task's own fields and the real clock.
 *
 * Ranking (lower bucket wins; ties broken inside the bucket):
 *   0 overdue → 1 due today → 2 due within 3 days → 3 already in progress
 *   → 4 due within 7 days → 5 later deadline → 6 no deadline
 * Inside a bucket: priority (high first) → earliest deadline →
 * shortest estimate → oldest task.
 */

import { addDaysKey, dateKey, formatDue } from '../../core/dates'
import type { AppState, Priority, Task } from '../../core/types'
import { blockInfo, indexTasks, isDueToday, isOverdue } from '../../store/selectors'

export interface Recommendation {
  task: Task
  reason: string
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

type RankKey = [number, number, string, number, number]

function bucketOf(task: Task, now: Date): number {
  if (isOverdue(task, now)) return 0
  if (isDueToday(task, now)) return 1
  const today = dateKey(now)
  const key = task.dueDate === null ? null : task.dueDate.slice(0, 10)
  if (key !== null && key <= addDaysKey(today, 3)) return 2
  if (task.status === 'in_progress') return 3
  if (key !== null && key <= addDaysKey(today, 7)) return 4
  if (key !== null) return 5
  return 6
}

function rankKey(task: Task, bucket: number): RankKey {
  return [
    bucket,
    PRIORITY_RANK[task.priority],
    task.dueDate ?? '9999-12-31',
    task.estimateMinutes ?? Number.MAX_SAFE_INTEGER,
    task.createdAt,
  ]
}

/** Lexicographic compare of two rank keys; negative when `a` should win. */
function compareKeys(a: RankKey, b: RankKey): number {
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i] as number | string
    const right = b[i] as number | string
    if (left === right) continue
    if (typeof left === 'string' || typeof right === 'string') {
      return String(left).localeCompare(String(right))
    }
    return (left as number) - (right as number)
  }
  return 0
}

function reasonFor(task: Task, bucket: number, now: Date): string {
  switch (bucket) {
    case 0:
      return `Overdue since ${formatDue(task.dueDate ?? '', now)}`
    case 1:
      return 'Due today'
    case 3:
      return 'Already in progress — continue where you left off'
    case 6:
      return task.priority === 'high' ? 'High priority, no deadline' : 'No deadline'
    default:
      return `Due ${formatDue(task.dueDate ?? '', now)}`
  }
}

/** Highest-ranked task that can actually be worked on right now. */
export function recommendNext(state: AppState, now: Date): Recommendation | null {
  const byId = indexTasks(state.tasks)
  let best: Task | null = null
  let bestKey: RankKey | null = null

  for (const task of state.tasks) {
    if (task.status === 'completed') continue
    if (blockInfo(task, byId).blocked) continue
    const key = rankKey(task, bucketOf(task, now))
    if (bestKey === null || compareKeys(key, bestKey) < 0) {
      best = task
      bestKey = key
    }
  }

  if (best === null || bestKey === null) return null
  return { task: best, reason: reasonFor(best, bestKey[0], now) }
}
