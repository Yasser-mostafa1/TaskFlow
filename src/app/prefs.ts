import { logger } from '../core/logger'
import type { Settings } from '../core/types'

const KEY = 'taskflow.settings'

export const DEFAULT_SETTINGS: Settings = { theme: 'light', sidebarCollapsed: false }

function readThemeHint(): 'light' | 'dark' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_SETTINGS, theme: readThemeHint() }
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      theme: parsed.theme === 'dark' ? 'dark' : 'light',
      sidebarCollapsed: parsed.sidebarCollapsed === true,
    }
  } catch (err) {
    logger.warn('settings.load.failed')
    void err
    return { ...DEFAULT_SETTINGS, theme: readThemeHint() }
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch (err) {
    logger.warn('settings.save.failed')
    void err
  }
}

export function applyTheme(theme: Settings['theme']): void {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
}
