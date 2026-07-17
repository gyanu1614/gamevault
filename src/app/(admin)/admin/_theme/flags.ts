/**
 * countryFlag — emoji flag for the stored country NAME (the wizard persists
 * human-readable names). Resolves the ISO2 via the wizard's country dataset;
 * tolerant of case and a few common free-text variants. Returns '' when
 * unresolvable (e.g. "Other" free-text countries) so callers can skip it.
 */

import { COUNTRIES } from '@/app/account/become-seller/data/countries'

const ALIASES: Record<string, string> = {
  usa: 'US',
  us: 'US',
  'united states of america': 'US',
  uk: 'GB',
  'united kingdom': 'GB',
  uae: 'AE',
  vietnams: 'VN',
}

function iso2For(name: string): string | null {
  const needle = name.trim().toLowerCase()
  if (!needle) return null
  if (ALIASES[needle]) return ALIASES[needle]
  const hit = COUNTRIES.find((c) => c.name.toLowerCase() === needle)
  if (hit) return hit.iso2
  // Loose prefix match as a last resort ("Korea, South" style variants).
  const loose = COUNTRIES.find(
    (c) => c.name.toLowerCase().startsWith(needle) || needle.startsWith(c.name.toLowerCase()),
  )
  return loose?.iso2 ?? null
}

export function countryFlag(name: string | null | undefined): string {
  if (!name) return ''
  const iso2 = iso2For(name)
  if (!iso2) return ''
  return iso2
    .toUpperCase()
    .replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)))
}
