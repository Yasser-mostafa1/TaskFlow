/**
 * Thin wrapper over the browser Notification API.
 *
 * Permission is only ever requested from an explicit user action (the
 * Settings toggle), and every read is defensive — jsdom, insecure contexts
 * and privacy modes can all make `Notification` unavailable.
 */

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.Notification === 'function'
}

export function currentPermission(): NotificationPermission | 'unsupported' {
  if (!notificationsSupported()) return 'unsupported'
  const permission = window.Notification.permission
  return permission === 'granted' || permission === 'denied' || permission === 'default'
    ? permission
    : 'unsupported'
}

/** Must be called from a user gesture; resolves with the resulting permission. */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported() || typeof window.Notification.requestPermission !== 'function') {
    return 'unsupported'
  }
  try {
    return await window.Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

/** Best-effort notify: silently does nothing when unsupported or not granted. */
export function notifySessionComplete(title: string, body: string): boolean {
  if (!notificationsSupported() || window.Notification.permission !== 'granted') return false
  try {
    new window.Notification(title, { body })
    return true
  } catch {
    return false
  }
}
