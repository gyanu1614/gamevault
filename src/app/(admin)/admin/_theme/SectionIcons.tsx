/**
 * Custom duotone section pictograms for the Forest Ledger admin cards —
 * same hand-drawn family as the seller wizard's icons, tuned for DARK GLASS:
 * white strokes with one lime accent each, 48×48 viewBox, drawn bold enough
 * to read at 20–24px. Decorative; parents label the sections.
 */

const STROKE = 'rgba(255,255,255,0.9)'
const LIME = '#A3E635'

interface IconProps {
  size?: number
}

/** Games & Categories — a gamepad with a lime action button. */
export function IconGamepad({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path
        d="M14 14h20c6 0 10 5 10 11 0 5-3 9-7 9-3 0-4.5-2-6-4h-14c-1.5 2-3 4-6 4-4 0-7-4-7-9 0-6 4-11 10-11z"
        stroke={STROKE} strokeWidth="2.75" strokeLinejoin="round"
      />
      <path d="M17 21v8M13 25h8" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="33" cy="22" r="3" fill={LIME} />
      <circle cx="28" cy="28" r="2.25" stroke={STROKE} strokeWidth="2" />
    </svg>
  )
}

/** Identity & Documents — an ID card with a lime portrait. */
export function IconIdCard({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect x="5" y="10" width="38" height="28" rx="5" stroke={STROKE} strokeWidth="2.75" />
      <circle cx="16" cy="21" r="4" fill={LIME} />
      <path d="M10.5 31c1.2-3.4 3.2-5 5.5-5s4.3 1.6 5.5 5" stroke={STROKE} strokeWidth="2.25" strokeLinecap="round" />
      <line x1="27" y1="19" x2="38" y2="19" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="27" y1="26" x2="36" y2="26" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

/** Payout — a bank with a lime coin. */
export function IconBank({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M6 18L24 8l18 10" stroke={STROKE} strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="9" y1="22" x2="9" y2="34" stroke={STROKE} strokeWidth="2.75" strokeLinecap="round" />
      <line x1="19" y1="22" x2="19" y2="34" stroke={STROKE} strokeWidth="2.75" strokeLinecap="round" />
      <line x1="29" y1="22" x2="29" y2="34" stroke={STROKE} strokeWidth="2.75" strokeLinecap="round" />
      <line x1="39" y1="22" x2="39" y2="34" stroke={STROKE} strokeWidth="2.75" strokeLinecap="round" />
      <line x1="6" y1="39" x2="42" y2="39" stroke={STROKE} strokeWidth="2.75" strokeLinecap="round" />
      <circle cx="24" cy="17" r="3" fill={LIME} />
    </svg>
  )
}

/** Experience & Agreement — a fountain pen with a lime ink dot. */
export function IconSignaturePen({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path
        d="M30 8l10 10-19 19-12 3 3-12L30 8z"
        stroke={STROKE} strokeWidth="2.75" strokeLinejoin="round"
      />
      <path d="M26 12l10 10" stroke={STROKE} strokeWidth="2.25" />
      <circle cx="13" cy="36" r="3" fill={LIME} />
      <path d="M8 43c8-2.5 18-2.5 32 0" stroke={LIME} strokeWidth="2.25" strokeLinecap="round" />
    </svg>
  )
}

/** Applicant — a person with a lime status dot. */
export function IconPerson({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <circle cx="24" cy="16" r="8" stroke={STROKE} strokeWidth="2.75" />
      <path d="M8 41c2.6-8 8.6-12 16-12s13.4 4 16 12" stroke={STROKE} strokeWidth="2.75" strokeLinecap="round" />
      <circle cx="31" cy="21" r="3.5" fill={LIME} />
    </svg>
  )
}

/** Timeline — a clock with a lime hand. */
export function IconTimeline({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <circle cx="24" cy="24" r="17" stroke={STROKE} strokeWidth="2.75" />
      <path d="M24 14v10l7 5" stroke={LIME} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Admin Notes — a note sheet with a lime folded corner. */
export function IconNotes({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M10 8h22l8 8v24H10V8z" stroke={STROKE} strokeWidth="2.75" strokeLinejoin="round" />
      <path d="M32 8v8h8" fill="none" stroke={LIME} strokeWidth="2.5" strokeLinejoin="round" />
      <line x1="16" y1="22" x2="32" y2="22" stroke={STROKE} strokeWidth="2.25" strokeLinecap="round" />
      <line x1="16" y1="29" x2="28" y2="29" stroke={STROKE} strokeWidth="2.25" strokeLinecap="round" />
    </svg>
  )
}

/** Business — a briefcase with a lime clasp. */
export function IconBriefcase({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect x="6" y="15" width="36" height="24" rx="5" stroke={STROKE} strokeWidth="2.75" />
      <path d="M17 15v-4a3 3 0 013-3h8a3 3 0 013 3v4" stroke={STROKE} strokeWidth="2.75" />
      <path d="M6 25h36" stroke={STROKE} strokeWidth="2.25" />
      <rect x="20.5" y="22" width="7" height="6" rx="1.5" fill={LIME} />
    </svg>
  )
}

/** Agreement PDF — a document with a lime seal. */
export function IconContract({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M12 6h18l8 8v28H12V6z" stroke={STROKE} strokeWidth="2.75" strokeLinejoin="round" />
      <line x1="18" y1="18" x2="30" y2="18" stroke={STROKE} strokeWidth="2.25" strokeLinecap="round" />
      <line x1="18" y1="25" x2="32" y2="25" stroke={STROKE} strokeWidth="2.25" strokeLinecap="round" />
      <circle cx="30" cy="35" r="5" fill="none" stroke={LIME} strokeWidth="2.5" />
      <path d="M28 35l1.6 1.6 2.8-3" stroke={LIME} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

/** Seller management — a shield with a lime check. */
export function IconShield({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path
        d="M24 5l15 6v11c0 10-6.5 17.5-15 21C15.5 39.5 9 32 9 22V11l15-6z"
        stroke={STROKE} strokeWidth="2.75" strokeLinejoin="round"
      />
      <path d="M17.5 23.5l4.5 4.5 9-9" stroke={LIME} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Didit video verification — a camera with a lime record dot. */
export function IconDiditVideo({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect x="5" y="13" width="26" height="22" rx="6" stroke={STROKE} strokeWidth="2.75" />
      <path d="M31 21l12-6v18l-12-6" stroke={STROKE} strokeWidth="2.75" strokeLinejoin="round" />
      <circle cx="14" cy="21" r="3" fill={LIME} />
    </svg>
  )
}

/** Proof of address — a document with a lime location pin. */
export function IconAddressProof({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M11 6h20l7 7v29H11V6z" stroke={STROKE} strokeWidth="2.75" strokeLinejoin="round" />
      <line x1="17" y1="32" x2="31" y2="32" stroke={STROKE} strokeWidth="2.25" strokeLinecap="round" />
      <path
        d="M24 13c3.6 0 6.5 2.8 6.5 6.2 0 4.6-6.5 9.3-6.5 9.3s-6.5-4.7-6.5-9.3c0-3.4 2.9-6.2 6.5-6.2z"
        stroke={STROKE} strokeWidth="2.25" strokeLinejoin="round"
      />
      <circle cx="24" cy="19.5" r="2.4" fill={LIME} />
    </svg>
  )
}
