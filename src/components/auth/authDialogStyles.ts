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
  forest2: '#1B5E3A', // hover / focus
  forest3: '#0F3320', // deepest shade
  lime: '#A3E635', // tiny accents ONLY
  ink: '#1A1D19', // primary text
  ink2: '#5B6157', // secondary text
  line: '#E4E5DE', // hairline borders
} as const

/* Shared light-world class recipes (all literal for Tailwind JIT). */
const inputCls =
  // Filled field, no outline: a tone darker than the ivory canvas, white on
  // focus with a thin neutral ring (never the accent). text-base below sm
  // keeps iOS from zooming the page on focus (16px rule).
  'h-11 rounded-md border-0 bg-[#EEEFE8] px-4 text-base text-[#1A1D19] shadow-none placeholder:text-[#5B6157]/60 transition-[background-color,box-shadow] duration-150 hover:bg-[#E8E9E2] focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-[#1A1D19]/[0.14] focus-visible:ring-offset-0 sm:text-sm'
const labelCls = 'text-[13px] font-medium text-[#1A1D19]'
const eyebrowCls = 'text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[#1B5E3A]'
const headingCls = 'text-[26px] font-bold leading-tight tracking-tight text-[#1A1D19]'
const fieldErrorCls = 'text-[12px] text-[#B91C1C]'
const errorBoxCls =
  'rounded-md bg-[#FBE9E9] px-3 py-2.5 text-[13px] text-[#B91C1C]'
const linkCls = 'font-semibold text-[#1B5E3A] transition-colors hover:text-[#14432A]'
const switchLineCls = 'text-center text-[13px] text-[#5B6157]'
const eyeBtnCls =
  'absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-[#5B6157] transition-colors hover:text-[#1A1D19]'
const ctaCls =
  'auth-cta flex h-11 w-full items-center justify-center gap-2 rounded-md text-[15px] font-semibold text-white'

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
