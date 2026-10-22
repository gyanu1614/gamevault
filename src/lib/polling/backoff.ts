/**
 * Delay before fallback poll number `attempt` (0-based): base × factor^attempt,
 * capped. For polls that back up a realtime signal, where the first seconds
 * matter and later ones only catch a missed event. Pure.
 */
export function backoffDelayMs(
  attempt: number,
  { baseMs, maxMs, factor = 1.5 }: { baseMs: number; maxMs: number; factor?: number },
): number {
  return Math.min(maxMs, Math.round(baseMs * factor ** Math.max(0, attempt)))
}
