import { logger } from '../core/logger'
import type { Settings, SortPref, ThemePref } from '../core/types'

const KEY = 'taskflow.settings'

export const DURATION_MIN_MINUTES = 1
export const DURATION_MAX_MINUTES = 240

const SORT_PREFS: readonly SortPref[] = ['manual', 'due', 'priority', 'created', 'title', 'updated']
const THEME_PREFS: readonly ThemePref[] = ['light', 'dark', 'system']

export const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  sidebarCollapsed: false,
  focusDurationMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  notificationsEnabled: false,
  defaultSort: 'manual',
}

function readThemeHint(): ThemePref {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function clampMinutes(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(DURATION_MAX_MINUTES, Math.max(DURATION_MIN_MINUTES, Math.round(value)))
}

/**
 * Field-by-field validation of anything that claims to be settings — a single
 * bad value falls back to its default instead of poisoning the whole object.
 */
export function sanitizeSettings(raw: unknown): Settings {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const theme = source.theme
  const sort = source.defaultSort
  return {
    theme: THEME_PREFS.includes(theme as ThemePref) ? (theme as ThemePref) : DEFAULT_SETTINGS.theme,
    sidebarCollapsed: source.sidebarCollapsed === true,
    focusDurationMinutes: clampMinutes(source.focusDurationMinutes, DEFAULT_SETTINGS.focusDurationMinutes),
    shortBreakMinutes: clampMinutes(source.shortBreakMinutes, DEFAULT_SETTINGS.shortBreakMinutes),
    longBreakMinutes: clampMinutes(source.longBreakMinutes, DEFAULT_SETTINGS.longBreakMinutes),
    notificationsEnabled: source.notificationsEnabled === true,
    defaultSort: SORT_PREFS.includes(sort as SortPref) ? (sort as SortPref) : DEFAULT_SETTINGS.defaultSort,
  }
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_SETTINGS, theme: readThemeHint() }
    return sanitizeSettings(JSON.parse(raw))
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

export function applyTheme(theme: 'light' | 'dark'): void {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
}

/** Resolves a preference against the OS colour scheme ('system' → hint). */
export function resolveTheme(pref: ThemePref): 'light' | 'dark' {
  return pref === 'system' ? (readThemeHint() === 'dark' ? 'dark' : 'light') : pref
}

/**
 * Re-applies 'system' theme when the OS preference changes.
 * Returns an unsubscribe function (always callable, even without matchMedia).
 */
export function watchSystemTheme(listener: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => undefined
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  if (typeof media.addEventListener !== 'function') return () => undefined
  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}
