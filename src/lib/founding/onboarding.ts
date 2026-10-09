/**
 * Open seller signup (/founding) — the plain, client-safe half: step model,
 * input schemas and pure helpers. The server actions in
 * src/lib/actions/founding-onboarding.ts import from here; so does the flow UI.
 */
import { z } from 'zod'
import { COUNTRIES } from '@/app/account/become-seller/data/countries'
import { SECTION_ORDER, type SellerCategorySection } from '@/app/account/become-seller/_redesign/game-categories-shared'
import type { LegalDoc } from '@/lib/legal/documents'

export const FOUNDING_STEPS = [
  { id: 1, label: 'Account', title: 'Sign Up Or Log In' },
  { id: 2, label: 'Details', title: 'A Few Details' },
  { id: 3, label: 'Store', title: 'Set Up Your Store' },
  { id: 4, label: 'Agreement', title: 'Seller Agreement' },
] as const
export type FoundingStepId = 1 | 2 | 3 | 4
/** 5 = finished (the seller is live). */
export type FoundingStage = FoundingStepId | 5

const ISO2 = new Set(COUNTRIES.map((c) => c.iso2))
const SECTIONS = new Set<string>(SECTION_ORDER)

/** One game the seller trades in, with the category sections they picked. */
export const sellsEntrySchema = z.object({
  game: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/, 'bad game slug'),
  categories: z
    .array(z.string().refine((s): s is SellerCategorySection => SECTIONS.has(s), 'unknown category'))
    .min(1, 'Pick at least one category')
    .max(SECTION_ORDER.length),
})
export type SellsEntry = z.infer<typeof sellsEntrySchema>

/** Discord: new-style handle (2–32, lowercase letters/digits/._) or legacy Name#1234. */
export const DISCORD_RE = /^(?:[a-z0-9._]{2,32}|[^#@:`\s]{2,32}#\d{4})$/

export const detailsSchema = z.object({
  country: z.string().trim().toUpperCase().refine((c) => ISO2.has(c), 'Pick your country'),
  sells: z.array(sellsEntrySchema).min(1, 'Pick at least one game').max(40),
  discord: z
    .string()
    .trim()
    .max(64)
    .transform((s) => s.replace(/^@/, ''))
    .refine((s) => s === '' || DISCORD_RE.test(s), 'That does not look like a Discord username')
    .optional()
    .default(''),
  isAdult: z.literal(true, { errorMap: () => ({ message: 'You must be 18 or older to sell' }) }),
  /** Where they came from (banner / footer / nav…). Hash tag only; free text is ignored. */
  source: z.string().trim().max(40).regex(/^[a-z0-9_-]*$/i).optional(),
})
export type DetailsInput = z.input<typeof detailsSchema>

/** Store name: 3–50 chars, letters/digits plus space . ' & - ; must start with a letter or digit. */
export const STORE_NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} .'&-]{1,48}[\p{L}\p{N}.!]?$/u
export const storeNameSchema = z
  .string()
  .trim()
  .min(3, 'At least 3 characters')
  .max(50, 'At most 50 characters')
  .refine((s) => STORE_NAME_RE.test(s), 'Letters, numbers, spaces and . \' & - only')
  .refine((s) => /[\p{L}\p{N}]{2}/u.test(s.replace(/[^\p{L}\p{N}]/gu, '')), 'Add a few more letters or numbers')

export const typedNameSchema = z
  .string()
  .trim()
  .min(2, 'Enter your full name')
  .max(120)
  .refine((s) => /^[\p{L}][\p{L}\p{M} .'’-]*$/u.test(s), 'Letters, spaces, apostrophes and hyphens only')

/** Signature PNG: at most this many bytes after base64 decoding (bucket cap is 256 KB). */
export const SIGNATURE_MAX_BYTES = 200 * 1024
/** Store logo (a data URL the client already downscaled): the avatar action re-checks it. */
export const LOGO_MAX_BYTES = 2 * 1024 * 1024

/** Decode an image/png data URL; returns the bytes or a user-facing error. */
export function parsePngDataUrl(dataUrl: unknown, maxBytes = SIGNATURE_MAX_BYTES): { ok: true; bytes: Buffer } | { ok: false; error: string } {
  if (typeof dataUrl !== 'string') return { ok: false, error: 'Draw your signature first.' }
  const m = /^data:image\/png;base64,([A-Za-z0-9+/]+=*)$/.exec(dataUrl)
  if (!m) return { ok: false, error: 'The signature must be a PNG image.' }
  // 4 base64 chars → 3 bytes; refuse before decoding anything oversized.
  if ((m[1].length * 3) / 4 > maxBytes + 3) return { ok: false, error: 'That signature image is too large.' }
  const bytes = Buffer.from(m[1], 'base64')
  if (bytes.byteLength < 100) return { ok: false, error: 'Draw your signature first.' }
  if (bytes.byteLength > maxBytes) return { ok: false, error: 'That signature image is too large.' }
  // PNG magic number
  if (bytes.readUInt32BE(0) !== 0x89504e47) return { ok: false, error: 'The signature must be a PNG image.' }
  return { ok: true, bytes }
}

export interface FoundingProgressState {
  signedIn: boolean
  isSeller: boolean
  details: boolean
  store: boolean
  agreement: boolean
}

/** Which step the seller should see next. */
export function deriveStage(s: FoundingProgressState): FoundingStage {
  if (s.isSeller) return 5
  if (!s.signedIn) return 1
  if (!s.details) return 2
  if (!s.store) return 3
  return 4
}

/**
 * The agreement text as the signer saw it, flattened to one canonical string
 * (title, version, every heading and block in order). The server hashes this
 * with SHA-256 and stores the digest beside the signature, so a later edit to
 * documents.ts can never be mistaken for what was signed.
 */
export function agreementCanonicalText(doc: Pick<LegalDoc, 'slug' | 'title' | 'version' | 'sections'>, fallbackVersion: string): string {
  const lines: string[] = [`slug:${doc.slug}`, `title:${doc.title}`, `version:${agreementVersionOf(doc, fallbackVersion)}`]
  for (const section of doc.sections) {
    if (section.h) lines.push(`h:${section.h}`)
    for (const b of section.blocks) {
      if (b.t === 'p' || b.t === 'note') lines.push(`${b.t}:${b.md}`)
      else if (b.t === 'ul') lines.push(`ul:${b.items.join('\u001f')}`)
      else if (b.t === 'table') lines.push(`table:${b.head.join('\u001f')}\u001e${b.rows.map((r) => r.join('\u001f')).join('\u001e')}`)
    }
  }
  return lines.join('\n')
}

export function agreementVersionOf(doc: Pick<LegalDoc, 'version'>, fallbackVersion: string): string {
  return doc.version ?? fallbackVersion
}

/** Human copy for a seller_onboarding_complete refusal. */
export function completionRefusalMessage(reason: string | null | undefined): string {
  switch (reason) {
    case 'details_incomplete': return 'Finish your details first (country, what you sell, and the 18+ confirmation).'
    case 'store_incomplete': return 'Choose your store name first.'
    case 'store_name_taken': return 'That store name was just taken. Pick another.'
    case 'agreement_missing': return 'Sign the seller agreement to finish.'
    case 'staff_account': return 'Staff accounts publish through the admin tools.'
    case 'no_profile': return 'We could not find your account. Sign in again.'
    default: return 'Something went wrong finishing your setup. Try again.'
  }
}
