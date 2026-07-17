/**
 * Shared input surface tokens for the light seller-application fields. Kept in
 * one place so text inputs, the combobox trigger, and the phone number field
 * all present the same 1px hairline border, soft radius, and green focus ring.
 *
 * Focus styling can't be expressed purely inline (no :focus in a style object),
 * so the ring/hover live in a small utility class string that pairs with the
 * base inline style; both reference the PALETTE via CSS variables the shell
 * exposes on its root (var(--sa-*)).
 */

import type { CSSProperties } from 'react'

/** Base inline style — border color + text color come from shell CSS vars. */
export const inputBaseStyle: CSSProperties = {
  borderColor: 'var(--sa-line)',
  color: 'var(--sa-ink)',
  backgroundColor: 'var(--sa-paper)',
}

/**
 * Base class — layout + the focus/hover behaviour. The green focus ring uses
 * the forest-2 tone; invalid state is layered by callers on top. Placeholder is
 * muted ink. `peer` isn't needed; these are plain inputs.
 */
export const inputBaseClass =
  'w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-colors ' +
  'placeholder:text-[color:var(--sa-ink-2)]/55 ' +
  'hover:border-[color:var(--sa-forest-2)]/40 ' +
  'focus:border-[color:var(--sa-forest-2)] focus:ring-2 focus:ring-[color:var(--sa-forest-2)]/15'
