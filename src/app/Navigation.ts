import {
  CalendarDays,
  ChartColumnIncreasing,
  CheckSquare,
  FolderKanban,
  LayoutDashboard,
  Settings as SettingsIcon,
  Timer,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { SectionId } from '../core/types'
import type { TaskFilter } from '../store/selectors'

export interface SectionMeta {
  id: SectionId
  label: string
  icon: LucideIcon
}

/** Section navigation with an optional filter handed to My Tasks on arrival. */
export type NavigateFn = (section: SectionId, filter?: Partial<TaskFilter>) => void

export const SECTIONS: SectionMeta[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tasks', label: 'My Tasks', icon: CheckSquare },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'focus', label: 'Focus Mode', icon: Timer },
  { id: 'insights', label: 'Insights', icon: ChartColumnIncreasing },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
]
