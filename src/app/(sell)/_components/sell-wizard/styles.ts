import { cn } from '@/lib/utils'

// Wizard buttons — one system for Back, Bulk upload, Continue, Create Offer
// and the go-back dialog. Same height and radius as the fields; `border` on
// every variant (transparent where not visible) so all are the same box.
export const BTN_BASE =
  'inline-flex h-12 items-center justify-center gap-1.5 rounded-lg border px-4 text-sm font-semibold transition-[background-color,border-color,color,transform] active:scale-[0.98] disabled:pointer-events-none sm:h-11 sm:px-5'
export const BTN_PRIMARY = cn(BTN_BASE, 'border-transparent bg-lime text-text-inverse hover:bg-lime-hover active:bg-lime-pressed')
export const BTN_SECONDARY = cn(BTN_BASE, 'border-white/[0.07] bg-white/[0.05] text-text-secondary hover:bg-white/[0.08] hover:text-text-primary')
export const BTN_PRIMARY_DISABLED = cn(BTN_BASE, 'cursor-not-allowed border-transparent bg-white/[0.05] text-text-disabled')
export const BTN_DANGER = cn(BTN_BASE, 'border-transparent bg-[rgba(225,85,85,0.16)] text-[#F08A8A] hover:bg-[rgba(225,85,85,0.24)]')

// Fields: a soft fill with a faint edge (no outline box), 48px on phones
// (16px text so iOS does not zoom on focus), 44px with a mouse. Focus
// brightens the edge to near-white; never the accent (neutral-focus guard).
export const FIELD_SURFACE =
  'rounded-md border border-white/[0.07] bg-white/[0.035] transition-colors hover:border-white/[0.13] focus-within:border-focus-border'

export const inputCls = cn(
  FIELD_SURFACE,
  'h-11 w-full px-3.5 text-base text-text-primary placeholder:text-text-tertiary focus:border-focus-border focus:outline-none sm:h-10 sm:text-[15px] aria-[invalid=true]:border-error aria-[invalid=true]:focus:border-error',
)
