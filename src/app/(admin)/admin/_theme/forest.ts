/**
 * ADMIN_FOREST — the Forest Ledger theme for the admin redesign.
 *
 * Single source of truth for the deep-forest admin world. Deep-forest
 * canvas (never flat black), FOREST GLASS ledger cards (translucent white
 * glass on the canvas — no solid white surfaces), lime accents, amber/red
 * status tints tuned for dark surfaces.
 *
 * Plain TS — safe to import from server components, client components and
 * server actions alike. Inter only; Title Case labels.
 */

// ─── Color tokens ────────────────────────────────────────────────────────────

export const ADMIN_FOREST = {
  /** Page background gradient start (top). */
  canvas: '#0C1D14',
  /** Page background gradient end (bottom). */
  canvas2: '#0F2419',
  /** Sidebar rail base. */
  rail: '#0A1810',
  /** Sidebar gradient end. */
  rail2: '#0C1F14',

  /** Core forest greens (hero bands, headers, dark surfaces). */
  forest: '#14432A',
  forest2: '#1B5E3A',
  forest3: '#0F3320',
  /** Bright end of the hero gradient (105deg forest3 → forest → forestHi). */
  forestHi: '#1A5434',

  /** Forest-glass card surface (translucent white on the canvas). */
  glass: 'rgba(255,255,255,0.05)',
  /** Glass card border. */
  glassLine: 'rgba(255,255,255,0.09)',
  /** Glass inset surface (quotes, signature box, kv tiles). */
  glassInset: 'rgba(255,255,255,0.04)',
  /** Hairline between glass surfaces / list separators. */
  line: 'rgba(255,255,255,0.08)',
  lineSoft: 'rgba(255,255,255,0.08)',

  /** Lime accents. Lime on dark; limeDeep anchors gradient meters. */
  lime: '#A3E635',
  limeDeep: '#65A30D',
  /** Pale lime — lime-tinted text on dark (signature script, consent chips). */
  limePale: '#D9F99D',

  /** White text scale — ON forest/dark surfaces. */
  white1: 'rgba(255,255,255,0.92)',
  white2: 'rgba(255,255,255,0.6)',
  white3: 'rgba(255,255,255,0.38)',
  /** Hairline on dark surfaces. */
  hair: 'rgba(255,255,255,0.09)',

  /** Status tints (dark-surface variants). */
  amber: '#F59E0B',
  amberInk: '#FCD34D',
  amberBg: 'rgba(245,158,11,0.16)',
  red: '#B42318',
  redBg: 'rgba(180,35,24,0.2)',
  /** Soft red for ghost-destructive text/borders on dark surfaces. */
  redSoft: '#FCA5A5',
  /** Amber chip text on dark surfaces. */
  amberSoft: '#FCD34D',
} as const

export type AdminForestToken = keyof typeof ADMIN_FOREST

// ─── Composite gradients / backgrounds (inline style values) ─────────────────

export const FOREST_BG = {
  /** Main content canvas behind the ledger cards. */
  canvas: `linear-gradient(180deg, ${ADMIN_FOREST.canvas} 0%, ${ADMIN_FOREST.canvas2} 100%)`,

  /** Sidebar rail. */
  sidebar: `linear-gradient(180deg, ${ADMIN_FOREST.rail} 0%, ${ADMIN_FOREST.rail2} 100%)`,

  /** Detail-page hero band: lime radial glow top-right + forest sweep. */
  hero: [
    'radial-gradient(90% 160% at 85% -20%, rgba(163,230,53,0.13), transparent 55%)',
    'radial-gradient(120% 200% at 15% 120%, rgba(27,94,58,0.65), transparent 70%)',
    `linear-gradient(105deg, ${ADMIN_FOREST.forest3} 0%, ${ADMIN_FOREST.forest} 55%, ${ADMIN_FOREST.forestHi} 100%)`,
  ].join(', '),

  /** Subtle starlight noise overlay for the hero (::after / absolute inset-0). */
  heroNoise: [
    'radial-gradient(2px 2px at 12% 30%, rgba(255,255,255,0.18), transparent 40%)',
    'radial-gradient(2.5px 2.5px at 78% 62%, rgba(255,255,255,0.14), transparent 40%)',
    'radial-gradient(1.5px 1.5px at 45% 80%, rgba(255,255,255,0.12), transparent 40%)',
    'radial-gradient(60% 45% at 70% 20%, rgba(255,255,255,0.05), transparent 60%)',
  ].join(', '),

  /** List page header band. */
  listHeader: `linear-gradient(105deg, ${ADMIN_FOREST.forest3}, ${ADMIN_FOREST.forest})`,

  /** Fallback store-image tile (initial on forest gradient). */
  storeTile: 'linear-gradient(140deg, #2C7A4B, #14432A)',

  /** Doc thumb placeholder (PDF / no preview) — dark glass tile. */
  docThumb: 'rgba(255,255,255,0.06)',
} as const

// ─── Tailwind-compatible class snippets ──────────────────────────────────────
//
// Arbitrary-value classes so pages stay consistent without new tailwind
// config. Compose with cn(); pair the inline-style gradients above where a
// class can't express layered backgrounds.

export const FOREST_CLASSES = {
  /** Forest-glass ledger card on the canvas. */
  card: 'rounded-[14px] border border-white/[0.09] bg-white/[0.05] p-5 text-white/90 backdrop-blur-sm',
  /** Hover state for interactive glass surfaces (list rows). */
  cardHover: 'hover:border-white/[0.14] hover:bg-white/[0.08]',
  /** Card heading (white on glass, 14px extrabold). */
  cardTitle: 'flex items-center gap-2 text-[14px] font-extrabold text-white',
  /** Card sub-line under the heading. */
  cardSub: 'text-[11.5px] text-white/40',
  /** Glass inset (quotes, signature block, reference rows, kv tiles). */
  inset: 'rounded-[11px] border border-white/[0.08] bg-white/[0.04]',

  /** KV grid key / value (payout + applicant cards). */
  kvKey: 'text-[10.5px] font-bold uppercase tracking-[0.07em] text-white/40',
  kvValue: 'mt-0.5 text-[13px] font-semibold text-white/90',
  /** Masked account numbers / refs. */
  mono: 'font-mono text-[12px]',

  /** Hero action buttons. */
  btnApprove:
    'rounded-[10px] bg-[#A3E635] px-[18px] py-2.5 text-[13px] font-bold text-[#0F3320] shadow-[0_8px_20px_-8px_rgba(163,230,53,0.5)] hover:brightness-105 transition',
  btnChanges:
    'rounded-[10px] bg-white/[0.12] px-[18px] py-2.5 text-[13px] font-bold text-white hover:bg-white/[0.18] transition',
  btnReject:
    'rounded-[10px] border border-[#FCA5A5]/35 bg-transparent px-[18px] py-2.5 text-[13px] font-bold text-[#FCA5A5] hover:bg-[#FCA5A5]/10 transition',

  /** Verification check chips (meter strip, on glass). */
  checkOk:
    'inline-flex items-center gap-1.5 rounded-full bg-[#A3E635]/[0.15] px-3 py-1.5 text-[12px] font-semibold text-[#D9F99D]',
  checkOpen:
    'inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-[12px] font-semibold text-white/60',
  checkNa:
    'inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-[12px] font-semibold text-white/35',

  /** Per-game category chip. */
  gameCat:
    'rounded-md bg-white/[0.08] px-2 py-[2.5px] text-[10.5px] font-bold text-white/80',
  /** Amber "Other Games" free-text chip (amber-on-dark). */
  gameCatOther:
    'rounded-md bg-[#F59E0B]/[0.16] px-2 py-[2.5px] text-[10.5px] font-bold text-[#FCD34D]',

  /** Consent tick chip (agreement card). */
  consent:
    'rounded-md bg-[#A3E635]/[0.15] px-2.5 py-[3px] text-[10.5px] font-bold text-[#D9F99D]',

  /** Sidebar nav item + active state (lime inset rail). */
  navItem:
    'flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[13.5px] text-white/60 hover:bg-white/5 transition-colors',
  navItemActive:
    'bg-[#A3E635]/[0.12] font-semibold text-white shadow-[inset_2px_0_0_#A3E635]',
} as const

// ─── Status chips ────────────────────────────────────────────────────────────

export type ForestChipStatus =
  | 'pending'
  | 'under_review'
  | 'info_requested'
  | 'approved'
  | 'rejected'
  | 'withdrawn'

interface ForestStatusChip {
  /** Title Case label. */
  label: string
  /** Chip classes on DARK (hero/forest/glass) surfaces. */
  onDark: string
  /**
   * Legacy alias — every admin surface is forest glass now, so the
   * "light" variant is the same dark-tuned chip. Prefer onDark.
   */
  onLight: string
}

const chipBase =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-[11px] py-1 text-[11.5px] font-bold'

const CHIP_PENDING = `${chipBase} bg-[#F59E0B]/[0.16] text-[#FCD34D]`
const CHIP_APPROVED = `${chipBase} bg-[#A3E635]/[0.16] text-[#BEF264]`
const CHIP_REJECTED = `${chipBase} bg-[#B42318]/20 text-[#FCA5A5]`
const CHIP_NEUTRAL = `${chipBase} bg-white/[0.1] text-white/55`

export const FOREST_STATUS_CHIPS: Record<ForestChipStatus, ForestStatusChip> = {
  pending: {
    label: 'Pending Review',
    onDark: CHIP_PENDING,
    onLight: CHIP_PENDING,
  },
  under_review: {
    label: 'Under Review',
    onDark: CHIP_PENDING,
    onLight: CHIP_PENDING,
  },
  info_requested: {
    label: 'Changes Requested',
    onDark: CHIP_PENDING,
    onLight: CHIP_PENDING,
  },
  approved: {
    label: 'Approved',
    onDark: CHIP_APPROVED,
    onLight: CHIP_APPROVED,
  },
  rejected: {
    label: 'Rejected',
    onDark: CHIP_REJECTED,
    onLight: CHIP_REJECTED,
  },
  withdrawn: {
    label: 'Withdrawn',
    onDark: CHIP_NEUTRAL,
    onLight: CHIP_NEUTRAL,
  },
}

/** Didit chip (hero): lime tint on dark. */
export const FOREST_DIDIT_CHIP = `${chipBase} bg-[#A3E635]/[0.16] text-[#A3E635]`

export function forestStatusChip(status: string | null | undefined): ForestStatusChip {
  const known = FOREST_STATUS_CHIPS[(status ?? 'pending') as ForestChipStatus]
  if (known) return known
  // Unknown status: render it honestly (Title Case, neutral tint) instead of
  // mislabeling it as Pending Review (that's how withdrawn rows showed as
  // pending before this map had a withdrawn entry).
  const label = (status ?? 'Unknown')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  return { label, onDark: CHIP_NEUTRAL, onLight: CHIP_NEUTRAL }
}

// ─── Fallback game-tile gradients ────────────────────────────────────────────
//
// When a game has no image_url the UI shows a colored initial tile. The
// gradient is picked deterministically from the game name so a game keeps
// its color across renders/pages. (Real logos always win — this is only
// the fallback.) No purple/violet/pink/indigo.

export const GAME_TILE_GRADIENTS = [
  'linear-gradient(140deg, #E2231A, #8F1610)', // red
  'linear-gradient(140deg, #0EA5E9, #0369A1)', // sky
  'linear-gradient(140deg, #F59E0B, #B45309)', // amber
  'linear-gradient(140deg, #16A34A, #14532D)', // green
  'linear-gradient(140deg, #3D6ECC, #1E3A8A)', // blue
  'linear-gradient(140deg, #14B8A6, #0F766E)', // teal
  'linear-gradient(140deg, #EA580C, #9A3412)', // orange
  'linear-gradient(140deg, #64748B, #334155)', // slate
] as const

export function gameTileGradient(name: string | null | undefined): string {
  const key = name || '?'
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  }
  return GAME_TILE_GRADIENTS[hash % GAME_TILE_GRADIENTS.length]
}

// ─── Motion ──────────────────────────────────────────────────────────────────
//
// CSS-only stagger: className={FOREST_MOTION.fadeUp} + style={forestStagger(i)}.
// Uses the existing tailwind 'animate-fade-up' keyframe (fill-mode forwards).

export const FOREST_MOTION = {
  fadeUp: 'animate-fade-up opacity-0',
  fadeIn: 'animate-fade-in opacity-0',
} as const

export function forestStagger(index: number, stepMs = 60): { animationDelay: string } {
  return { animationDelay: `${index * stepMs}ms` }
}
