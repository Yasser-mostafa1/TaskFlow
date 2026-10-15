import { render, type RenderResult } from '@testing-library/react'
import { useCallback, useRef, useState, type ReactNode } from 'react'
import { DEFAULT_SETTINGS } from '../app/prefs'
import { SettingsProvider } from '../app/SettingsContext'
import type { AppState, Settings } from '../core/types'
import { createAppStore, type AppStore } from '../store/appStore'
import { AppStoreProvider } from '../store/AppStoreContext'
import { FeedbackProvider } from '../ui/Feedback'
import { makeState } from './factories'

export interface AppRenderResult extends RenderResult {
  store: AppStore
  /** Live settings value after in-test updates (mirrors the app's Root state). */
  getSettings: () => Settings
}

function SettingsHarness({
  initial,
  latest,
  children,
}: {
  initial: Settings
  latest: { current: Settings }
  children: ReactNode
}) {
  const [settings, setSettings] = useState(initial)
  const update = useCallback(
    (patch: Partial<Settings>) => setSettings((current) => ({ ...current, ...patch })),
    [],
  )
  latest.current = settings
  return <SettingsProvider value={{ settings, update }}>{children}</SettingsProvider>
}

/** Renders a view with its own isolated store, settings and the feedback layer. */
export function renderWithApp(
  ui: ReactNode,
  initial: Partial<AppState> = {},
  settings: Partial<Settings> = {},
): AppRenderResult {
  const store = createAppStore(makeState(initial))
  const latest = { current: { ...DEFAULT_SETTINGS, ...settings } }
  const result = render(
    <AppStoreProvider store={store}>
      <SettingsHarness initial={latest.current} latest={latest}>
        <FeedbackProvider>{ui}</FeedbackProvider>
      </SettingsHarness>
    </AppStoreProvider>,
  )
  return { ...result, store, getSettings: () => latest.current }
}
