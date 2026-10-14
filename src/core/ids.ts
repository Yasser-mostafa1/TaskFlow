let counter = 0

/**
 * Compact, collision-safe id. Uses the platform UUID when available and
 * falls back to a timestamp + counter + random mix (still unique per session).
 */
export function createId(prefix: string): string {
  const uuid: string | undefined =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : undefined
  if (uuid) return `${prefix}_${uuid.replace(/-/g, '').slice(0, 20)}`
  counter += 1
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`
}
