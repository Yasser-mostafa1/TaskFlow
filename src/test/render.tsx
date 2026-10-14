import { render, type RenderResult } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { AppState } from '../core/types'
import { createAppStore, type AppStore } from '../store/appStore'
import { AppStoreProvider } from '../store/AppStoreContext'
import { FeedbackProvider } from '../ui/Feedback'
import { makeState } from './factories'

export interface AppRenderResult extends RenderResult {
  store: AppStore
}

/** Renders a view with its own isolated store and the feedback (toast/confirm) layer. */
export function renderWithApp(ui: ReactNode, initial: Partial<AppState> = {}): AppRenderResult {
  const store = createAppStore(makeState(initial))
  const result = render(
    <AppStoreProvider store={store}>
      <FeedbackProvider>{ui}</FeedbackProvider>
    </AppStoreProvider>,
  )
  return { ...result, store }
}
