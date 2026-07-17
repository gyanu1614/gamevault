/**
 * ADMIN_FOREST — the Forest Ledger theme for the admin redesign.
 *
 * Single source of truth for the deep-forest admin world (approved mockup:
 * admin-forest-mockup.html). Deep-forest canvas (never flat black), white
 * "paper" ledger cards with ivory insets, lime accents (lime-deep on white
 * surfaces), amber/red status tints.
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

  /** Light card surfaces. */
  paper: '#FFFFFF',
  ivory: '#FAFAF7',
  /** Hairline between light surfaces. */
  line: '#E4E5DE',
  /** Inner hairline on light rows (games list separators). */
  lineSoft: '#F0F1EA',

  /** Ink scale — text ON white/ivory cards. */
  ink: '#1A1D19',
  ink2: '#5B6157',
  ink3: '#8A9083',

  /** Lime accents. On dark surfaces use lime; meters/ticks on white use limeDeep. */
  lime: '#A3E635',
  limeDeep: '#65A30D',

  /** White text scale — ON forest/dark surfaces. */
  white1: 'rgba(255,255,255,0.92)',
  white2: 'rgba(255,255,255,0.6)',
  white3: 'rgba(255,255,255,0.38)',
  /** Hairline on dark surfaces. */
  hair: 'rgba(255,255,255,0.09)',

  /** Status tints. */
  amber: '#F59E0B',
  amberInk: '#92400E',
  amberBg: '#FEF3C7',
  red: '#B42318',
  redBg: '#FEF2F1',
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

  /** Doc thumb placeholder (PDF / no preview). */
  docThumb: 'linear-gradient(140deg, #E9EBE2, #D8DCCE)',
} as const

// ─── Tailwind-compatible class snippets ──────────────────────────────────────
//
// Arbitrary-value classes so pages stay consistent without new tailwind
// config. Compose with cn(); pair the inline-style gradients above where a
// class can't express layered backgrounds.

export const FOREST_CLASSES = {
  /** White ledger card on the forest canvas. */
  card: 'rounded-[14px] bg-white p-5 text-[#1A1D19]',
  /** Card heading (forest ink, 14px extrabold). */
  cardTitle: 'flex items-center gap-2 text-[14px] font-extrabold text-[#14432A]',
  /** Card sub-line under the heading. */
  cardSub: 'text-[11.5px] text-[#8A9083]',
  /** Ivory inset (quotes, signature block, notes textarea). */
  inset: 'rounded-[11px] bg-[#FAFAF7]',

  /** KV grid key / value (payout + applicant cards). */
  kvKey: 'text-[10.5px] font-bold uppercase tracking-[0.07em] text-[#8A9083]',
  kvValue: 'mt-0.5 text-[13px] font-semibold text-[#1A1D19]',
  /** Masked account numbers / refs. */
  mono: 'font-mono text-[12px]',

  /** Hero action buttons. */
  btnApprove:
    'rounded-[10px] bg-[#A3E635] px-[18px] py-2.5 text-[13px] font-bold text-[#0F3320] shadow-[0_8px_20px_-8px_rgba(163,230,53,0.5)] hover:brightness-105 transition',
  btnChanges:
    'rounded-[10px] bg-white/[0.12] px-[18px] py-2.5 text-[13px] font-bold text-white hover:bg-white/[0.18] transition',
  btnReject:
    'rounded-[10px] border border-[#FCA5A5]/35 bg-transparent px-[18px] py-2.5 text-[13px] font-bold text-[#FCA5A5] hover:bg-[#FCA5A5]/10 transition',

  /** Verification check chips (meter card). */
  checkOk:
    'inline-flex items-center gap-1.5 rounded-full bg-[#A3E635]/[0.16] px-3 py-1.5 text-[12px] font-semibold text-[#14432A]',
  checkOpen:
    'inline-flex items-center gap-1.5 rounded-full border border-[#E4E5DE] px-3 py-1.5 text-[12px] font-semibold text-[#5B6157]',
  checkNa:
    'inline-flex items-center gap-1.5 rounded-full border border-[#E4E5DE] px-3 py-1.5 text-[12px] font-semibold text-[#5B6157] opacity-45',

  /** Per-game category chip. */
  gameCat:
    'rounded-md bg-[#14432A]/[0.08] px-2 py-[2.5px] text-[10.5px] font-bold text-[#14432A]',
  /** Amber "Other Games" free-text chip. */
  gameCatOther:
    'rounded-md bg-[#FEF3C7] px-2 py-[2.5px] text-[10.5px] font-bold text-[#92400E]',

  /** Consent tick chip (agreement card). */
  consent:
    'rounded-md bg-[#A3E635]/[0.18] px-2.5 py-[3px] text-[10.5px] font-bold text-[#14432A]',

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

interface ForestStatusChip {
  /** Title Case label. */
  label: string
  /** Chip classes on DARK (hero/forest) surfaces. */
  onDark: string
  /** Chip classes on LIGHT (white row) surfaces. */
  onLight: string
}

const chipBase =
  'inline-flex items-center gap-1.5 rounded-full px-[11px] py-1 text-[11.5px] font-bold'

export const FOREST_STATUS_CHIPS: Record<ForestChipStatus, ForestStatusChip> = {
  pending: {
    label: 'Pending Review',
    onDark: `${chipBase} bg-[#F59E0B]/[0.18] text-[#FCD34D]`,
    onLight: `${chipBase} bg-[#FEF3C7] text-[#92400E]`,
  },
  under_review: {
    label: 'Under Review',
    onDark: `${chipBase} bg-[#F59E0B]/[0.18] text-[#FCD34D]`,
    onLight: `${chipBase} bg-[#FEF3C7] text-[#92400E]`,
  },
  info_requested: {
    label: 'Changes Requested',
    onDark: `${chipBase} bg-white/[0.14] text-white/85`,
    onLight: `${chipBase} bg-[#E4E5DE]/60 text-[#5B6157]`,
  },
  approved: {
    label: 'Approved',
    onDark: `${chipBase} bg-[#A3E635]/[0.16] text-[#A3E635]`,
    onLight: `${chipBase} bg-[#A3E635]/25 text-[#14432A]`,
  },
  rejected: {
    label: 'Rejected',
    onDark: `${chipBase} bg-[#B42318]/25 text-[#FCA5A5]`,
    onLight: `${chipBase} bg-[#FEF2F1] text-[#B42318]`,
  },
}

/** Didit chip (hero): lime tint on dark. */
export const FOREST_DIDIT_CHIP = `${chipBase} bg-[#A3E635]/[0.16] text-[#A3E635]`

export function forestStatusChip(status: string | null | undefined): ForestStatusChip {
  return (
    FOREST_STATUS_CHIPS[(status ?? 'pending') as ForestChipStatus] ??
    FOREST_STATUS_CHIPS.pending
  )
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
