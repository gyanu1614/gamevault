/**
 * Long country lists for multi-country Payssion methods, kept out of the
 * registry (./methods.ts) so it stays readable. ISO-3166 alpha-2. A filter
 * only: the list decides who sees a method up front at checkout, never who
 * may pay with it.
 */

/**
 * Skrill — where Payssion's Skrill page actually works: the EU/EEA, the UK
 * and Switzerland. Skrill's own sign-up list is far wider (116 countries,
 * 2026-10-15), but Payssion's page answers "Your current network location
 * are not supported for Skrill" outside Europe (seen 2026-10-16 from a US
 * connection; a Belgian one opened the Skrill wallet). Widen only once
 * Payssion confirms the countries its Skrill route serves.
 */
export const SKRILL_COUNTRIES: string[] = [
  // EU 27
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  // EEA / EFTA + UK
  'IS', 'LI', 'NO', 'GB', 'CH',
]

/** Satispay — the markets its own site serves (Italy, France, Luxembourg). */
export const SATISPAY_COUNTRIES: string[] = ['IT', 'FR', 'LU']
export const SATISPAY_COVERAGE = 'Italy, France & Luxembourg'

/** MyBank — Italy, plus Belgium, Spain and Portugal (MyBank Merchant Guide 2025). */
export const MYBANK_COUNTRIES: string[] = ['IT', 'BE', 'ES', 'PT']
export const MYBANK_COVERAGE = 'Italy, Belgium, Spain & Portugal'
