/**
 * Custom duotone timeline pictograms for the seller application status page —
 * same hand-drawn family as the wizard's HowItWorksIcons (forest strokes, one
 * lime accent each, 48×48 viewBox). Decorative; parents label them.
 */

const FOREST = '#14432A'
const LIME = '#A3E635'

interface IconProps {
  size?: number
}

/** Application submitted — a document with a lime send arrow. */
export function IconSubmitted({ size = 26 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect x="10" y="6" width="24" height="34" rx="5" stroke={FOREST} strokeWidth="2.5" />
      <line x1="16" y1="15" x2="28" y2="15" stroke={FOREST} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="16" y1="22" x2="24" y2="22" stroke={FOREST} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M28 34l8-8m0 0v6.5M36 26h-6.5" stroke={FOREST} strokeWidth="0" />
      <circle cx="34" cy="32" r="9" fill={LIME} stroke={FOREST} strokeWidth="2" />
      <path d="M30.5 32l2.4 2.4 4.6-4.8" stroke={FOREST} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

/** Under review — a magnifier with a lime lens. */
export function IconReview({ size = 26 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <circle cx="21" cy="21" r="12" fill={LIME} fillOpacity="0.35" stroke={FOREST} strokeWidth="2.5" />
      <circle cx="21" cy="21" r="5" stroke={FOREST} strokeWidth="2" />
      <line x1="30" y1="30" x2="40" y2="40" stroke={FOREST} strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  )
}

/** Decision — a waypoint flag with a lime pennant. */
export function IconDecision({ size = 26 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <line x1="14" y1="6" x2="14" y2="42" stroke={FOREST} strokeWidth="3" strokeLinecap="round" />
      <path d="M14 9h18l-5 7 5 7H14" fill={LIME} stroke={FOREST} strokeWidth="2.25" strokeLinejoin="round" />
    </svg>
  )
}
