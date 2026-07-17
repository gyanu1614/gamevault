/**
 * Custom duotone pictograms for the seller-application How It Works row.
 * Hand-drawn for this flow (NOT stock lucide): forest strokes with ONE lime
 * accent shape each, 48×48 viewBox, rounded geometry to match the Forest
 * Ledger world. Purely decorative — parent supplies accessible labels.
 */

import { PALETTE } from '../theme'

interface IconProps {
  /** Rendered box size in px (default 44). */
  size?: number
}

const stroke = PALETTE.forest
const accent = PALETTE.lime

/** You List — a listing card with a lime cover image and text lines. */
export function IconList({ size = 44 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect x="9" y="7" width="30" height="34" rx="5" stroke={stroke} strokeWidth="2.5" />
      <rect x="15" y="13" width="18" height="10" rx="2.5" fill={accent} stroke={stroke} strokeWidth="2" />
      <line x1="15" y1="29" x2="33" y2="29" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="15" y1="35" x2="26" y2="35" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

/** Buyer Pays — a lime coin dropping into a cart. */
export function IconPay({ size = 44 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <circle cx="33" cy="9.5" r="5.5" fill={accent} stroke={stroke} strokeWidth="2" />
      <path d="M33 17v5" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeDasharray="1.5 3.5" />
      <path
        d="M7 16h5l3.2 15.2A3.5 3.5 0 0 0 18.6 34h13.9a3.5 3.5 0 0 0 3.4-2.7L38.5 22H14"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="41" r="2.75" stroke={stroke} strokeWidth="2.25" />
      <circle cx="32" cy="41" r="2.75" stroke={stroke} strokeWidth="2.25" />
    </svg>
  )
}

/** You Deliver — a parcel moving fast (lime speed dashes). */
export function IconDeliver({ size = 44 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect x="16" y="12" width="26" height="24" rx="5" stroke={stroke} strokeWidth="2.5" />
      <path d="M29 12v9l-4.5-2.5L29 21" stroke={stroke} strokeWidth="0" />
      <path d="M25 12v8.5l4-2 4 2V12" stroke={stroke} strokeWidth="2.25" strokeLinejoin="round" />
      <line x1="5" y1="17" x2="11" y2="17" stroke={accent} strokeWidth="3" strokeLinecap="round" />
      <line x1="3" y1="24" x2="11" y2="24" stroke={accent} strokeWidth="3" strokeLinecap="round" />
      <line x1="5" y1="31" x2="11" y2="31" stroke={accent} strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/** You Get Paid — an open hand receiving a lime coin. */
export function IconPaid({ size = 44 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <circle cx="24" cy="13" r="6.5" fill={accent} stroke={stroke} strokeWidth="2" />
      <path d="M24 10v6M21.5 13h5" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
      <path
        d="M8 32c3.5-3.5 7-4.5 10.5-3l6 2.4a3 3 0 0 1-1.6 5.8l-5.4-.9"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 41h6.5c2.8 1.4 6 1.4 9 .3l12-4.4a3.1 3.1 0 0 0-2.2-5.8l-6.5 2.3"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
