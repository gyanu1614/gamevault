/**
 * "Forest Ledger" palette — the redesigned seller application deliberately
 * lives in a single LIGHT visual world (fintech-authentic), even under a dark
 * OS theme. It's a formal application; the committed light look reads as
 * trustworthy paperwork, not a gamer UI.
 *
 * These are plain hex consts (not Tailwind tokens) because this shell opts OUT
 * of the site's theme system on purpose. Import PALETTE into inline styles /
 * CSS-variable declarations so every shell + step component stays in lockstep.
 * Lime is reserved: active-step dot, completed checkmarks, and the primary-CTA
 * hover accent ONLY — never as a fill or text color for content.
 */
export const PALETTE = {
  ivory: '#FAFAF7', // canvas (right pane)
  paper: '#FFFFFF', // cards / inputs
  forest: '#14432A', // primary / left panel
  forest2: '#1B5E3A', // focus / hover
  forest3: '#0F3320', // deepest shade
  lime: '#A3E635', // active dot · completed checks · CTA hover accent ONLY
  ink: '#1A1D19', // primary text
  ink2: '#5B6157', // secondary text
  line: '#E4E5DE', // hairline borders
} as const

export type PaletteKey = keyof typeof PALETTE

/**
 * The CSS custom properties the shell exposes on its root so step components
 * can reference `var(--sa-forest)` etc. instead of re-importing PALETTE. Kept
 * as an object so <SellerAppLayout> can spread it into a style prop.
 */
export const PALETTE_VARS: React.CSSProperties = {
  ['--sa-ivory' as string]: PALETTE.ivory,
  ['--sa-paper' as string]: PALETTE.paper,
  ['--sa-forest' as string]: PALETTE.forest,
  ['--sa-forest-2' as string]: PALETTE.forest2,
  ['--sa-forest-3' as string]: PALETTE.forest3,
  ['--sa-lime' as string]: PALETTE.lime,
  ['--sa-ink' as string]: PALETTE.ink,
  ['--sa-ink-2' as string]: PALETTE.ink2,
  ['--sa-line' as string]: PALETTE.line,
}

/** The five steps, in order. Labels only — no subtext under the stepper. */
export const REDESIGN_STEPS = [
  { id: 1, label: 'Account & Games' },
  { id: 2, label: 'Personal Info' },
  { id: 3, label: 'Identity' },
  { id: 4, label: 'Payout Setup' },
  { id: 5, label: 'Review & Sign' },
] as const

export const TOTAL_REDESIGN_STEPS = REDESIGN_STEPS.length

/**
 * "Why we ask this" trust copy, one line per step, cross-faded in the left rail
 * to match the active step. Outcome language — what the seller gets / why it
 * protects them — never bureaucratic.
 */
export const TRUST_BY_STEP: Record<number, { title: string; body: string }> = {
  1: {
    title: 'Why we ask',
    body: 'Telling us your games and categories routes buyers straight to what you sell.',
  },
  2: {
    title: 'Why we ask',
    body: 'Your legal details keep payouts landing in the right account, on time.',
  },
  3: {
    title: 'Why we ask',
    body: 'A quick identity check is what lets buyers trust every seller on the marketplace.',
  },
  4: {
    title: 'Why we ask',
    body: 'Your payout method is where your earnings arrive — encrypted and never shared.',
  },
  5: {
    title: 'Why we ask',
    body: 'One signature confirms the agreement and gets your application into review.',
  },
}
