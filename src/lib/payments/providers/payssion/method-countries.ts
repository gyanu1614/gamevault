/**
 * Long country lists for multi-country Payssion methods, kept out of the
 * registry (./methods.ts) so it stays readable. ISO-3166 alpha-2. A filter
 * only: the list decides who sees a method up front at checkout, never who
 * may pay with it.
 */

/**
 * Skrill — every country of residence Skrill's own sign-up form offers
 * (account.skrill.com sign-up "Country of residence" list, read 2026-10-15:
 * 116 countries). Notably absent: JP, IN (no new sign-ups), TR, RU.
 * Re-read it when Skrill changes its markets.
 */
export const SKRILL_COUNTRIES: string[] = [
  'AD', 'AE', 'AL', 'AM', 'AR', 'AT', 'AU', 'AW', 'AZ', 'BA', 'BD', 'BE', 'BG', 'BN', 'BO', 'BR', 'BS', 'BW', 'CA', 'CH',
  'CL', 'CM', 'CN', 'CO', 'CR', 'CX', 'CY', 'CZ', 'DE', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE', 'EG', 'ES', 'FI', 'FK', 'FR',
  'GB', 'GE', 'GG', 'GH', 'GI', 'GR', 'GU', 'HK', 'HR', 'HU', 'ID', 'IE', 'IL', 'IM', 'IS', 'IT', 'JE', 'KE', 'KH', 'KR',
  'KW', 'KZ', 'LI', 'LK', 'LS', 'LT', 'LU', 'LV', 'MA', 'MC', 'MD', 'ME', 'MG', 'MK', 'MN', 'MT', 'MU', 'MV', 'MX', 'MY',
  'NA', 'NG', 'NI', 'NL', 'NO', 'NP', 'NZ', 'PA', 'PE', 'PH', 'PK', 'PL', 'PR', 'PT', 'PY', 'QA', 'RO', 'RS', 'SA', 'SE',
  'SG', 'SI', 'SK', 'SM', 'SN', 'TH', 'TN', 'TW', 'TZ', 'UA', 'US', 'UY', 'VG', 'VI', 'VN', 'ZA',
]

/** Satispay — the markets its own site serves (Italy, France, Luxembourg). */
export const SATISPAY_COUNTRIES: string[] = ['IT', 'FR', 'LU']
export const SATISPAY_COVERAGE = 'Italy, France & Luxembourg'

/** MyBank — Italy, plus Belgium, Spain and Portugal (MyBank Merchant Guide 2025). */
export const MYBANK_COUNTRIES: string[] = ['IT', 'BE', 'ES', 'PT']
export const MYBANK_COVERAGE = 'Italy, Belgium, Spain & Portugal'
