import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount)
}

export function formatRelativeTime(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function formatDate(date: string | Date, formatStr = 'MMM d, yyyy'): string {
  return format(new Date(date), formatStr)
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

/**
 * QUAL-010 — the single slugify for the whole app.
 *
 * There used to be four divergent copies (lib/utils, AddGameDialog, GameWizard,
 * admin-template-builder, BlogEditor). Two of them generated `games.slug` — the
 * URL-visible game identifier — by different algorithms, so the same game
 * created through different admin paths got different public URLs.
 *
 * Behaviour, and why:
 *  - NFKD-normalise and strip combining marks first, so "Café" -> "cafe" rather
 *    than the old "caf" (lib/utils) or "caf-" (the admin copies). Accented
 *    letters become their base letter instead of vanishing.
 *  - Underscores are separators, not word characters. The old lib/utils used
 *    `[^\w-]` which KEEPS `_`, so "Pet_Simulator 99" slugged to
 *    "pet_simulator-99" there and "pet-simulator-99" everywhere else.
 *  - No truncation. Only AddGameDialog truncated (48 chars) and it is the one
 *    place a long slug is least likely; callers that need a length cap should
 *    apply it explicitly rather than have it hidden in here.
 *
 * Verified against production: all 26 rows in `games` that were generated (as
 * opposed to hand-edited to a short form like `lol`/`cs2`) slugify unchanged.
 * See src/lib/utils.slugify.test.ts.
 */
export function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
