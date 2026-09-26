/**
 * Shared "Forest Ledger" palette + form class strings for the auth modal.
 *
 * PERF-005 — split out of AuthDialog.tsx so the eagerly-loaded provider and the
 * lazily-loaded dialog body can both reference these without the provider
 * pulling the dialog's chunk back onto the first-paint path.
 */

/* ──────────────────────────────────────────────────────────────────
   "Forest Ledger" palette — hardcoded locally, same values as the
   seller application (become-seller/_redesign/theme.ts). The Tailwind
   arbitrary classes below repeat these hexes as literals because the
   JIT compiler can't see interpolated strings; keep both in sync.
   Lime is RESERVED: tiny accents only — never fills or text blocks.
   ────────────────────────────────────────────────────────────────── */

const PALETTE = {
  ivory: '#FAFAF7', // canvas
  paper: '#FFFFFF', // cards / inputs
  forest: '#14432A', // primary
  forest2: 'var(--color-accent-default)', // hover / focus
  forest3: '#0F3320', // deepest shade
  lime: '#A3E635', // tiny accents ONLY
  ink: '#1A1D19', // primary text
  ink2: '#5B6157', // secondary text
  line: '#E4E5DE', // hairline borders
} as const

/* Shared light-world class recipes (all literal for Tailwind JIT). */
const inputCls =
  // text-base below sm keeps iOS from zooming the page on focus (16px rule).
  'h-11 rounded-xl border-[#E4E5DE] bg-white px-4 text-base text-[#1A1D19] placeholder:text-[#5B6157]/55 transition-[border-color,box-shadow] duration-150 focus-visible:border-[var(--color-accent-default)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent-default)]/[0.18] focus-visible:ring-offset-0 sm:text-sm'
const labelCls = 'text-[13px] font-medium text-[#1A1D19]'
const eyebrowCls = 'text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent-default)]'
const headingCls = 'text-[26px] font-bold leading-tight tracking-tight text-[#1A1D19]'
const fieldErrorCls = 'text-[12px] text-[#B91C1C]'
const errorBoxCls =
  'rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2.5 text-[13px] text-[#B91C1C]'
const linkCls = 'font-semibold text-[var(--color-accent-default)] transition-colors hover:text-[#14432A]'
const switchLineCls = 'text-center text-[13px] text-[#5B6157]'
const eyeBtnCls =
  'absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#5B6157] transition-colors hover:text-[#1A1D19]'
const ctaCls =
  'auth-cta flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold text-white'

export type AuthMode = 'login' | 'signup'

export {
  PALETTE,
  inputCls,
  labelCls,
  eyebrowCls,
  headingCls,
  fieldErrorCls,
  errorBoxCls,
  linkCls,
  switchLineCls,
  eyeBtnCls,
  ctaCls,
}
