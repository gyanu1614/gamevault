/**
 * Wiki amounts ("322.5K", "$23.5B", "12.5B/s") → numbers, shared by the game
 * adapters so they never import each other.
 */
import { plainText } from '../wiki/markup'

const SUFFIX: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, t: 1e12, q: 1e15, qa: 1e15, qi: 1e18 }

/** "322.5K" → 322500, "$23.5B" → 23500000000; null when it isn't a plain amount. */
export function parseAmount(raw: string | undefined): number | null {
  const m = plainText(raw ?? '').replace(/[$,\s]/g, '').match(/^(\d+(?:\.\d+)?)(qa|qi|[kmbtq])?(?:\/s)?$/i)
  if (!m) return null
  return Math.round(Number(m[1]) * (m[2] ? SUFFIX[m[2].toLowerCase()] : 1))
}
