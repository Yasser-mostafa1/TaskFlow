import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { logger } from '../core/logger'
import type { SectionId, Settings } from '../core/types'
import { loadState } from '../db/schema'
import { createAppStore, EMPTY_STATE } from '../store/appStore'
import { AppStoreProvider, attachPersistence } from '../store/AppStoreContext'
import { applyTheme, loadSettings, resolveTheme, sanitizeSettings, saveSettings, watchSystemTheme } from './prefs'
import { SettingsProvider } from './SettingsContext'
import { AppShell } from './AppShell'
import type { NavigateFn } from './Navigation'
import { FeedbackProvider, useToast } from '../ui/Feedback'
import type { TaskFilter } from '../store/selectors'
import { DashboardView } from '../features/dashboard/DashboardView'
import { TasksView } from '../features/tasks/TasksView'
import { ProjectsView } from '../features/projects/ProjectsView'
import { CalendarView } from '../features/calendar/CalendarView'
import { FocusView } from '../features/focus/FocusView'
import { InsightsView } from '../features/insights/InsightsView'
import { SettingsView } from '../features/settings/SettingsView'

/** Single application store for the running app (tests build their own). */
export const appStore = createAppStore(EMPTY_STATE)

const SECTION_KEY = 'taskflow.section'

function readInitialSection(): SectionId {
  const valid: SectionId[] = ['dashboard', 'tasks', 'projects', 'calendar', 'focus', 'insights', 'settings']
  try {
    const stored = localStorage.getItem(SECTION_KEY)
    if (stored && (valid as string[]).includes(stored)) return stored as SectionId
  } catch {
    /* storage unavailable — default section is fine */
  }
  return 'dashboard'
}

function Root() {
  const toast = useToast()
  const [ready, setReady] = useState(false)
  const [settings, setSettings] = useState(loadSettings)
  const [section, setSection] = useState<SectionId>(readInitialSection)
  const [pendingFilter, setPendingFilter] = useState<Partial<TaskFilter> | undefined>(undefined)

  const resolvedTheme = resolveTheme(settings.theme)

  /**
   * The toast API is referentially stable (Feedback memoizes it), but this
   * effect owns persistence hydration — an accidental re-run would re-race
   * IndexedDB against live state. Going through a ref makes "exactly once per
   * mount" explicit regardless of downstream identity changes.
   */
  const toastRef = useRef(toast)
  toastRef.current = toast

  useEffect(() => {
    applyTheme(resolvedTheme)
    saveSettings(settings)
  }, [settings, resolvedTheme])

  /** 'system' tracks the OS preference live, without touching stored settings. */
  useEffect(() => {
    if (settings.theme !== 'system') return undefined
    return watchSystemTheme(() => applyTheme(resolveTheme('system')))
  }, [settings.theme])

  useEffect(() => {
    let disposed = false
    const persistence = attachPersistence(appStore, (message) => toastRef.current.push('error', message))

    loadState()
      .then((loaded) => {
        if (disposed) return
        appStore.dispatch({ type: 'state/replace', state: loaded })
        setReady(true)
      })
      .catch((err: unknown) => {
        logger.errorObj('app.hydrate.failed', err)
        if (disposed) return
        setReady(true)
        toastRef.current.push('error', 'Saved data could not be loaded. Starting with an empty workspace.')
      })

    return () => {
      disposed = true
      void persistence.flush()
      persistence.dispose()
    }
  }, [])

  const navigate = useCallback<NavigateFn>((next, filter) => {
    setPendingFilter(filter)
    setSection(next)
    try {
      localStorage.setItem(SECTION_KEY, next)
    } catch {
      /* non-critical preference */
    }
  }, [])

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => sanitizeSettings({ ...current, ...patch }))
  }, [])

  const toggleTheme = useCallback(() => {
    setSettings((current) =>
      sanitizeSettings({ ...current, theme: resolveTheme(current.theme) === 'dark' ? 'light' : 'dark' }),
    )
  }, [])

  const toggleCollapsed = useCallback(() => {
    setSettings((current) => ({ ...current, sidebarCollapsed: !current.sidebarCollapsed }))
  }, [])

  const settingsApi = useMemo(() => ({ settings, update: updateSettings }), [settings, updateSettings])

  const content = useMemo(() => {
    if (!ready) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-muted">Loading your workspace…</div>
      )
    }
    switch (section) {
      case 'dashboard':
        return <DashboardView onNavigate={navigate} />
      case 'tasks':
        return <TasksView initialFilter={pendingFilter} />
      case 'projects':
        return <ProjectsView />
      case 'calendar':
        return <CalendarView onNavigate={navigate} />
      case 'focus':
        return <FocusView onNavigate={navigate} />
      case 'insights':
        return <InsightsView />
      case 'settings':
        return <SettingsView />
      default:
        return null
    }
  }, [section, ready, navigate, pendingFilter])

  return (
    <AppShell
      active={section}
      onNavigate={navigate}
      collapsed={settings.sidebarCollapsed}
      onToggleCollapsed={toggleCollapsed}
      theme={resolvedTheme}
      onToggleTheme={toggleTheme}
    >
      <SettingsProvider value={settingsApi}>{content}</SettingsProvider>
    </AppShell>
  )
}

export function App() {
  return (
    <AppStoreProvider store={appStore}>
      <FeedbackProvider>
        <Root />
      </FeedbackProvider>
    </AppStoreProvider>
  )
}
