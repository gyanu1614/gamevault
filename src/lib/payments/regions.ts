/**
 * Checkout regions — the buyer-facing grouping of local payment rails
 * (checkout regions revamp, 2026-09-26).
 *
 * The selector no longer pins a COUNTRY; it reads the buyer's REGION from
 * the geo country and orders the flat method list as:
 *
 *   1. rails local to the buyer's own country   (Romania → Trustly)
 *   2. the rest of the region's rails           (BLIK, EPS, MB Way, …)
 *   3. Cryptocurrency, always last              (first and only when 1+2 are empty)
 *
 * "Rest of World", "Middle East & Africa" and "East Asia" are not coherent
 * markets, so they carry no regional spill: a buyer there sees only rails
 * that list their exact country.
 *
 * Pure and client-safe (no server imports): the form and its unit tests
 * share it. Membership sets are ISO-3166 alpha-2.
 */

export type RegionId = 'eu' | 'latam' | 'sea' | 'mea' | 'eastasia' | 'row'

export interface Region {
  id: RegionId
  label: string
  /** Countries the region contains; 'row' is everything else. */
  countries: ReadonlySet<string>
  /** Whether rails for OTHER countries of the region are offered too. */
  spill: boolean
}

const EUROPE = [
  // EU 27
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  // EEA / EFTA + UK + the rest of geographic Europe
  'IS', 'LI', 'NO', 'CH', 'GB', 'GI', 'AD', 'MC', 'SM', 'VA', 'AL', 'BA', 'ME', 'MK', 'RS', 'XK', 'MD', 'UA', 'GE', 'AM', 'TR',
]
const LATAM = [
  'AR', 'BO', 'BR', 'CL', 'CO', 'CR', 'CU', 'DO', 'EC', 'SV', 'GT', 'HN', 'MX', 'NI', 'PA', 'PY', 'PE', 'PR', 'UY', 'VE',
]
const SEA = ['BN', 'KH', 'ID', 'LA', 'MY', 'MM', 'PH', 'SG', 'TH', 'TL', 'VN']
// Middle East (Türkiye and Cyprus sit in EUROPE) + all of Africa.
const MEA = [
  'AE', 'BH', 'IL', 'IQ', 'IR', 'JO', 'KW', 'LB', 'OM', 'PS', 'QA', 'SA', 'SY', 'YE',
  'DZ', 'AO', 'BJ', 'BW', 'BF', 'BI', 'CV', 'CM', 'CF', 'TD', 'KM', 'CD', 'CG', 'CI', 'DJ', 'EG', 'GQ', 'ER', 'SZ', 'ET',
  'GA', 'GM', 'GH', 'GN', 'GW', 'KE', 'LS', 'LR', 'LY', 'MG', 'MW', 'ML', 'MR', 'MU', 'MA', 'MZ', 'NA', 'NE', 'NG', 'RW',
  'ST', 'SN', 'SC', 'SL', 'SO', 'ZA', 'SS', 'SD', 'TZ', 'TG', 'TN', 'UG', 'ZM', 'ZW', 'EH', 'RE', 'YT', 'SH',
]
const EAST_ASIA = ['KR', 'JP', 'CN', 'TW', 'HK', 'MO', 'MN']

// Middle East & Africa and East Asia are not one market each (a Saudi card
// rail means nothing to a buyer in Kenya), so like Rest of World they carry
// no spill: a buyer sees only rails that list their exact country.
export const REGIONS: readonly Region[] = [
  { id: 'eu', label: 'Europe', countries: new Set(EUROPE), spill: true },
  { id: 'latam', label: 'Latin America', countries: new Set(LATAM), spill: true },
  { id: 'sea', label: 'Southeast Asia', countries: new Set(SEA), spill: true },
  { id: 'mea', label: 'Middle East & Africa', countries: new Set(MEA), spill: false },
  { id: 'eastasia', label: 'East Asia', countries: new Set(EAST_ASIA), spill: false },
  { id: 'row', label: 'Rest of World', countries: new Set(), spill: false },
]

export function regionById(id: RegionId): Region {
  return REGIONS.find((r) => r.id === id) ?? REGIONS[REGIONS.length - 1]
}

/** The region a country belongs to; unknown / garbage → 'row'. */
export function regionForCountry(country: string | null | undefined): RegionId {
  const cc = (country ?? '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(cc)) return 'row'
  return REGIONS.find((r) => r.countries.has(cc))?.id ?? 'row'
}

/** The minimum a method needs for ordering: its country list. */
export interface RegionalMethod {
  countries: string[]
}

/**
 * Split a region's rails into the buyer's own-country rails and the rest,
 * both in registry order. `country` may sit outside `region` (the buyer
 * switched region by hand): then nothing is "local" and the whole region
 * is "regional". A no-spill region never offers another country's rails.
 */
export function orderMethodsForRegion<M extends RegionalMethod>(
  methods: readonly M[],
  region: RegionId,
  country: string | null | undefined
): { local: M[]; regional: M[] } {
  const r = regionById(region)
  const cc = (country ?? '').trim().toUpperCase()
  const ccInRegion = region === 'row' ? regionForCountry(cc) === 'row' : r.countries.has(cc)
  const local: M[] = []
  const regional: M[] = []
  for (const m of methods) {
    if (ccInRegion && cc && m.countries.includes(cc)) local.push(m)
    else if (r.spill && m.countries.some((c) => r.countries.has(c))) regional.push(m)
  }
  return { local, regional }
}

/**
 * Regions worth a switcher chip: spill regions with at least one rail, plus
 * the buyer's own. A no-spill region shows nothing to an outsider (its rails
 * are exact-country), so its chip appears only for its own buyers.
 */
export function regionsWithMethods<M extends RegionalMethod>(methods: readonly M[], current: RegionId): Region[] {
  return REGIONS.filter((r) => r.id === current || (r.spill && methods.some((m) => m.countries.some((c) => r.countries.has(c)))))
}
