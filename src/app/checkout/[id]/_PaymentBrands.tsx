'use client'

/**
 * V19/P24/P7.s — Payment provider brand marks.
 *
 * Inline SVGs (no network calls, no font dependency, no licensed art —
 * these are stylised wordmarks rendered in the brand colours). Used by
 * the checkout payment-method picker tiles and the footer trust strip.
 *
 * If marketing later wants the real ®/™ logos, swap each <svg> body
 * for a licensed file (kept the same prop signature to make the swap
 * a one-line change per brand).
 */

type Props = { className?: string }

export function VisaBrand({ className }: Props) {
  return (
    <svg
      viewBox="0 0 64 22"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Visa"
      className={className}
    >
      <rect x="0" y="0" width="64" height="22" rx="3" fill="#1A1F71" />
      <text
        x="32"
        y="16"
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="13"
        fontWeight="900"
        fontStyle="italic"
        fill="#FFFFFF"
        letterSpacing="0.5"
      >
        VISA
      </text>
    </svg>
  )
}

export function MasterCardBrand({ className }: Props) {
  return (
    <svg
      viewBox="0 0 40 24"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Mastercard"
      className={className}
    >
      <circle cx="15" cy="12" r="9" fill="#EB001B" />
      <circle cx="25" cy="12" r="9" fill="#F79E1B" />
      <path
        d="M20 5.5a9 9 0 0 1 0 13 9 9 0 0 1 0-13z"
        fill="#FF5F00"
      />
    </svg>
  )
}

export function AmexBrand({ className }: Props) {
  return (
    <svg
      viewBox="0 0 64 22"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="American Express"
      className={className}
    >
      <rect x="0" y="0" width="64" height="22" rx="3" fill="#006FCF" />
      <text
        x="32"
        y="14.5"
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="9"
        fontWeight="900"
        fill="#FFFFFF"
        letterSpacing="0.5"
      >
        AMEX
      </text>
    </svg>
  )
}

export function PayPalBrand({ className }: Props) {
  return (
    <svg
      viewBox="0 0 64 22"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="PayPal"
      className={className}
    >
      <rect x="0" y="0" width="64" height="22" rx="3" fill="#FFFFFF" />
      <text
        x="14"
        y="15"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="11"
        fontWeight="900"
        fontStyle="italic"
        fill="#003087"
      >
        Pay
      </text>
      <text
        x="31"
        y="15"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="11"
        fontWeight="900"
        fontStyle="italic"
        fill="#009CDE"
      >
        Pal
      </text>
    </svg>
  )
}

export function ApplePayBrand({ className }: Props) {
  return (
    <svg
      viewBox="0 0 64 22"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Apple Pay"
      className={className}
    >
      <rect x="0" y="0" width="64" height="22" rx="3" fill="#000000" />
      <text
        x="32"
        y="15"
        textAnchor="middle"
        fontFamily="-apple-system, system-ui, sans-serif"
        fontSize="10.5"
        fontWeight="600"
        fill="#FFFFFF"
      >
         Pay
      </text>
    </svg>
  )
}

export function GooglePayBrand({ className }: Props) {
  return (
    <svg
      viewBox="0 0 64 22"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Google Pay"
      className={className}
    >
      <rect x="0" y="0" width="64" height="22" rx="3" fill="#FFFFFF" />
      <text
        x="11"
        y="15"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="11"
        fontWeight="700"
        fill="#4285F4"
      >
        G
      </text>
      <text
        x="18"
        y="15"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="11"
        fontWeight="700"
        fill="#EA4335"
      >
        o
      </text>
      <text
        x="25"
        y="15"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="11"
        fontWeight="700"
        fill="#FBBC04"
      >
        o
      </text>
      <text
        x="32"
        y="15"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="11"
        fontWeight="700"
        fill="#4285F4"
      >
        g
      </text>
      <text
        x="39"
        y="15"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="11"
        fontWeight="700"
        fill="#34A853"
      >
        l
      </text>
      <text
        x="43"
        y="15"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="11"
        fontWeight="700"
        fill="#EA4335"
      >
        e
      </text>
      <text
        x="51"
        y="15"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="10"
        fontWeight="500"
        fill="#5F6368"
      >
        Pay
      </text>
    </svg>
  )
}

/* ── Tile-style icon blocks for payment method picker ────────────── */
//
// Each is a 44×44 rounded square with brand colour + glyph. Used in
// the left-side payment method tiles. Larger and more clickable than
// the strip badges above.

export function PaysafeIcon({ className }: Props) {
  return (
    <div
      role="img"
      aria-label="Paysafe"
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#5527E6] ${className ?? ''}`}
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="none">
        <rect
          x="4"
          y="9"
          width="16"
          height="11"
          rx="2"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M8 9V7a4 4 0 0 1 8 0v2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

export function CryptoIcon({ className }: Props) {
  return (
    <div
      role="img"
      aria-label="Cryptocurrency"
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#F7931A] to-[#F2A900] ${className ?? ''}`}
    >
      <span className="font-black text-white text-[20px] leading-none">₿</span>
    </div>
  )
}

export function KlarnaIcon({ className }: Props) {
  return (
    <div
      role="img"
      aria-label="Klarna"
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#FFB3C7] ${className ?? ''}`}
    >
      <span className="font-black text-black text-[14px] leading-none tracking-tight">
        K.
      </span>
    </div>
  )
}

export function ApplePayIcon({ className }: Props) {
  return (
    <div
      role="img"
      aria-label="Apple Pay"
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-black ${className ?? ''}`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="currentColor">
        <path d="M17.6 13.4c0-2.5 2-3.7 2.1-3.8-1.2-1.7-2.9-1.9-3.6-1.9-1.5-.2-3 .9-3.7.9-.8 0-2-.9-3.3-.8-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.3 2.5 1.3-.1 1.8-.9 3.4-.9 1.5 0 2 .9 3.3.8 1.4 0 2.3-1.2 3.1-2.5.7-1 1.1-2 1.5-3-.1 0-2.9-1.1-2.9-4.3M14.9 5.8c.7-.9 1.2-2.1 1-3.4-1.1.1-2.4.7-3.1 1.6-.7.8-1.2 2-1 3.2 1.2.1 2.5-.6 3.1-1.4z" />
      </svg>
    </div>
  )
}

export function GooglePayIcon({ className }: Props) {
  return (
    <div
      role="img"
      aria-label="Google Pay"
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white ${className ?? ''}`}
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
        <path
          d="M22 12c0-.7-.1-1.4-.2-2H12v3.8h5.6c-.2 1.3-1 2.4-2.1 3.1v2.6h3.4c2-1.8 3.1-4.5 3.1-7.5z"
          fill="#4285F4"
        />
        <path
          d="M12 22c2.8 0 5.2-.9 6.9-2.5l-3.4-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.8v2.7C4.5 19.8 8 22 12 22z"
          fill="#34A853"
        />
        <path
          d="M6.2 13.6c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9V7.1H2.8C2.3 8.3 2 9.6 2 11s.3 2.7.8 3.9l3.4-2.7z"
          fill="#FBBC04"
        />
        <path
          d="M12 5.4c1.5 0 2.9.5 4 1.6L19 4.1C17.2 2.4 14.8 1.5 12 1.5 8 1.5 4.5 3.7 2.8 7l3.4 2.6C7 7.2 9.3 5.4 12 5.4z"
          fill="#EA4335"
        />
      </svg>
    </div>
  )
}

export function CardIcon({ className }: Props) {
  // Generic Visa + MC mini-stack for the "Debit/Credit cards" row
  return (
    <div
      role="img"
      aria-label="Cards"
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-bg-overlay ring-1 ring-border-default ${className ?? ''}`}
    >
      <div className="flex items-center gap-0.5">
        <svg viewBox="0 0 24 14" className="h-3 w-auto" fill="none">
          <rect width="24" height="14" rx="2" fill="#1A1F71" />
          <text
            x="12"
            y="10"
            textAnchor="middle"
            fontSize="7"
            fontWeight="900"
            fill="#FFFFFF"
            fontFamily="Inter, system-ui, sans-serif"
          >
            VISA
          </text>
        </svg>
        <svg viewBox="0 0 24 14" className="h-3 w-auto" fill="none">
          <rect width="24" height="14" rx="2" fill="#0F0F12" />
          <circle cx="10" cy="7" r="4" fill="#EB001B" />
          <circle cx="14" cy="7" r="4" fill="#F79E1B" />
        </svg>
      </div>
    </div>
  )
}

export function PayPalIcon({ className }: Props) {
  return (
    <div
      role="img"
      aria-label="PayPal"
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white ${className ?? ''}`}
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
        <path
          d="M7.5 21.5h2.8l.8-5h2.3c3.8 0 6.3-2.1 6.9-5.8.2-1.4 0-2.5-.6-3.3-.7-.9-1.9-1.4-3.5-1.4H9.8c-.5 0-.9.4-1 .8L6.5 20.6c-.1.5.3.9.8.9h.2z"
          fill="#009CDE"
        />
        <path
          d="M5.5 18.5h2.8l.8-5h2.3c3.8 0 6.3-2.1 6.9-5.8.2-1.4 0-2.5-.6-3.3-.7-.9-1.9-1.4-3.5-1.4H7.8c-.5 0-.9.4-1 .8L4.5 17.6c-.1.5.3.9.8.9h.2z"
          fill="#003087"
        />
      </svg>
    </div>
  )
}

/* ── Compact trust strip — all 6 brand marks in a row ─────────────── */

// V19/P24/P7.hh — Brand strip is now a horizontal marquee. Same
// pure-CSS "duplicated track + translateX(-50%)" pattern Aceternity /
// Magic UI / shadcn examples use. Pauses on hover so a buyer can
// read a logo. Edge fades soften the in/out so logos never feel cut.
export function PaymentBrandStrip({ className }: Props) {
  const brands = [
    VisaBrand,
    MasterCardBrand,
    AmexBrand,
    PayPalBrand,
    ApplePayBrand,
    GooglePayBrand,
  ]
  // Render the brand list twice so the `-50%` translate wraps seamlessly.
  const tracks = [brands, brands] as const
  return (
    <div
      className={`group relative w-full overflow-hidden ${className ?? ''}`}
    >
      {/* Edge fade-outs */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-bg-raised to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-bg-raised to-transparent"
      />

      <div className="flex w-max animate-marquee items-center gap-3 group-hover:[animation-play-state:paused]">
        {tracks.map((track, t) => (
          <div
            key={t}
            className="flex shrink-0 items-center gap-3"
            aria-hidden={t === 1}
          >
            {track.map((Brand, i) => (
              <Brand key={`${t}-${i}`} className="h-5 w-auto" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
