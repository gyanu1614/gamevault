import { cn } from '@/lib/utils'

// that the sharp corners felt severe. Still transparent over the sub-card
// surface; border defines the field. Focus lightens the border to near-white
// (no lime glow ring) — lime is reserved for selection and the primary CTA,
// and a lime ring on every field made the form read as all-accent.
// Mobile uses text-base (16px) so iOS Safari doesn't auto-zoom the page on
// focus (14px inputs trigger the zoom + horizontal panning); sm+ keeps text-sm.
// Wizard buttons — one system for Back, Bulk upload, Continue, Create
// Offer and the go-back dialog. Rectangular (rounded-md) like the inputs,
// one height, no glow. `border` on every variant (transparent where not
// visible) so primary and secondary are exactly the same box size.
export const BTN_BASE =
  'inline-flex h-11 items-center justify-center gap-1.5 rounded-md border px-4 text-sm font-semibold transition-colors disabled:pointer-events-none sm:h-10 sm:px-5'
export const BTN_PRIMARY = cn(BTN_BASE, 'border-transparent bg-lime text-text-inverse hover:bg-lime-hover active:bg-lime-pressed')
export const BTN_SECONDARY = cn(BTN_BASE, 'border-border-default bg-bg-overlay text-text-secondary hover:border-border-strong hover:text-text-primary')
export const BTN_PRIMARY_DISABLED = cn(BTN_BASE, 'cursor-not-allowed border-border-subtle bg-bg-overlay text-text-disabled')
export const BTN_DANGER = cn(BTN_BASE, 'border-transparent bg-error text-white hover:opacity-90')

export const inputCls =
  'h-11 w-full rounded-md border border-border-default bg-transparent px-3 text-base sm:h-10 sm:text-sm text-text-primary placeholder:text-text-tertiary hover:border-border-strong focus:border-text-secondary focus:outline-none transition-colors aria-[invalid=true]:border-error aria-[invalid=true]:focus:border-error'
