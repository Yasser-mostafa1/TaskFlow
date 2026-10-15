import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_SETTINGS,
  loadSettings,
  resolveTheme,
  sanitizeSettings,
  saveSettings,
  watchSystemTheme,
} from './prefs'

const KEY = 'taskflow.settings'

function stubMatchMedia(matches: boolean): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  )
}

describe('prefs', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    stubMatchMedia(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('falls back to system hints and defaults when nothing is stored', () => {
    const settings = loadSettings()
    expect(settings).toEqual({ ...DEFAULT_SETTINGS, theme: 'light' })
    stubMatchMedia(true)
    expect(loadSettings().theme).toBe('dark')
  })

  it('survives corrupt JSON and returns defaults', () => {
    localStorage.setItem(KEY, '{not json')
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, theme: 'light' })
  })

  it('keeps a previously saved settings object', () => {
    saveSettings({ ...DEFAULT_SETTINGS, theme: 'dark', focusDurationMinutes: 50, sidebarCollapsed: true })
    const loaded = loadSettings()
    expect(loaded.theme).toBe('dark')
    expect(loaded.focusDurationMinutes).toBe(50)
    expect(loaded.sidebarCollapsed).toBe(true)
  })

  it('migrates the old two-field shape, filling new defaults', () => {
    localStorage.setItem(KEY, JSON.stringify({ theme: 'dark', sidebarCollapsed: true }))
    const loaded = loadSettings()
    expect(loaded.theme).toBe('dark')
    expect(loaded.sidebarCollapsed).toBe(true)
    expect(loaded.focusDurationMinutes).toBe(DEFAULT_SETTINGS.focusDurationMinutes)
    expect(loaded.shortBreakMinutes).toBe(DEFAULT_SETTINGS.shortBreakMinutes)
    expect(loaded.longBreakMinutes).toBe(DEFAULT_SETTINGS.longBreakMinutes)
    expect(loaded.notificationsEnabled).toBe(false)
    expect(loaded.defaultSort).toBe('manual')
  })

  it('sanitizes every invalid field back to defaults', () => {
    const cleaned = sanitizeSettings({
      theme: 'blue',
      sidebarCollapsed: 'yes',
      focusDurationMinutes: 'lots',
      shortBreakMinutes: Number.NaN,
      longBreakMinutes: 'soon',
      notificationsEnabled: 'true',
      defaultSort: 'chaos',
    })
    expect(cleaned).toEqual(DEFAULT_SETTINGS)
  })

  it('clamps durations into the 1–240 minute range and rounds', () => {
    expect(sanitizeSettings({ focusDurationMinutes: 999 }).focusDurationMinutes).toBe(240)
    expect(sanitizeSettings({ focusDurationMinutes: 0 }).focusDurationMinutes).toBe(1)
    expect(sanitizeSettings({ focusDurationMinutes: 25.6 }).focusDurationMinutes).toBe(26)
    expect(sanitizeSettings({ shortBreakMinutes: 5.4 }).shortBreakMinutes).toBe(5)
  })

  it("accepts 'system' as a theme and only 'true' as enabled", () => {
    expect(sanitizeSettings({ theme: 'system' }).theme).toBe('system')
    expect(sanitizeSettings({ notificationsEnabled: true }).notificationsEnabled).toBe(true)
    expect(sanitizeSettings({ notificationsEnabled: 1 }).notificationsEnabled).toBe(false)
  })

  it('resolveTheme maps system through the OS hint and keeps explicit values', () => {
    stubMatchMedia(true)
    expect(resolveTheme('system')).toBe('dark')
    stubMatchMedia(false)
    expect(resolveTheme('system')).toBe('light')
    expect(resolveTheme('dark')).toBe('dark')
    expect(resolveTheme('light')).toBe('light')
  })

  it('watchSystemTheme fires on OS changes and unsubscribes cleanly', () => {
    const holder: { cb: (() => void) | null } = { cb: null }
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: false,
          media: query,
          onchange: null,
          addListener: () => undefined,
          removeListener: () => undefined,
          addEventListener: (_event: string, cb: () => void) => {
            holder.cb = cb
          },
          removeEventListener: () => {
            holder.cb = null
          },
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
    )
    const seen: string[] = []
    const stop = watchSystemTheme(() => seen.push('changed'))
    expect(typeof stop).toBe('function')
    expect(holder.cb).not.toBeNull()
    holder.cb?.()
    expect(seen).toEqual(['changed'])
    stop()
    expect(holder.cb).toBeNull()
  })
})
