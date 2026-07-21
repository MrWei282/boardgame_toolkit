/**
 * crypto.randomUUID() only exists in secure contexts. Testing on a phone means
 * hitting the dev server over plain http on the LAN, where it is undefined — so
 * this falls back rather than throwing at the worst possible moment.
 */
export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
