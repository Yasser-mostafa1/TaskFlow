import { createContext, useContext, type ReactNode } from 'react'
import { logger } from '../core/logger'
import type { Settings } from '../core/types'

export interface SettingsApi {
  settings: Settings
  update: (patch: Partial<Settings>) => void
}

const SettingsContext = createContext<SettingsApi | null>(null)

/** Mirrors AppStoreContext: provider at the root, `useSettings()` anywhere below. */
export function SettingsProvider({ value, children }: { value: SettingsApi; children: ReactNode }) {
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsApi {
  const api = useContext(SettingsContext)
  if (!api) {
    logger.error('settings.missing')
    throw new Error('useSettings must be used inside <SettingsProvider>')
  }
  return api
}
