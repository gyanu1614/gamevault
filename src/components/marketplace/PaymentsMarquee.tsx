'use client'

/**
 * V43 — Accepted payments: full-bleed monochrome wordmark marquee
 * (Eldorado-style strip). Duplicated track + the `animate-marquee`
 * keyframe run in REVERSE so logos flow left → right; pauses on hover.
 * Stylised text wordmarks — no licensed art. Render OUTSIDE any max-w
 * wrapper so it spans the whole viewport.
 */

const PAYMENT_WORDMARKS: Array<{ key: string; node: React.ReactNode }> = [
  { key: 'sepa', node: <span className="text-[30px] font-black tracking-tight">S€PA</span> },
  { key: 'paysafe', node: <span className="text-[26px] font-bold lowercase tracking-tight">paysafe<span className="font-normal">card</span></span> },
  { key: 'btc', node: <span className="inline-flex items-baseline gap-1 text-[28px] font-bold lowercase"><span aria-hidden>₿</span>bitcoin</span> },
  { key: 'skrill', node: <span className="text-[30px] font-black tracking-tight">Skrill</span> },
  { key: 'neteller', node: <span className="text-[25px] font-black italic uppercase tracking-wide">Neteller</span> },
  { key: 'visa', node: <span className="text-[30px] font-black italic tracking-wider">VISA</span> },
  {
    key: 'mastercard',
    node: (
      <span className="inline-flex items-center gap-2">
        <span aria-hidden className="relative inline-block h-7 w-11">
          <span className="absolute left-0 top-0 h-7 w-7 rounded-full bg-current opacity-60" />
          <span className="absolute right-0 top-0 h-7 w-7 rounded-full bg-current opacity-35" />
        </span>
        <span className="text-[25px] font-medium lowercase tracking-tight">mastercard</span>
      </span>
    ),
  },
  { key: 'applepay', node: <span className="text-[28px] font-semibold tracking-tight">&#63743; Pay</span> },
  { key: 'gpay', node: <span className="text-[28px] font-semibold tracking-tight"><span className="font-bold">G</span> Pay</span> },
  { key: 'klarna', node: <span className="text-[28px] font-black tracking-tight">Klarna.</span> },
  { key: 'usdt', node: <span className="text-[28px] font-bold tracking-tight">₮ Tether</span> },
  { key: 'eth', node: <span className="inline-flex items-baseline gap-1 text-[28px] font-semibold"><span aria-hidden>⟠</span>ethereum</span> },
]

export function PaymentsMarquee() {
  const tracks = [PAYMENT_WORDMARKS, PAYMENT_WORDMARKS] as const
  return (
    <section
      aria-label="Accepted payment methods"
      className="group relative mt-16 w-full overflow-hidden py-6 sm:mt-24"
    >
      {/* Edge fades so wordmarks slide in/out softly */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-bg-base to-transparent sm:w-32"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-bg-base to-transparent sm:w-32"
      />
      <div className="flex w-max animate-marquee items-center gap-16 text-text-tertiary [animation-direction:reverse] group-hover:[animation-play-state:paused] sm:gap-20">
        {tracks.map((track, t) => (
          <div
            key={t}
            aria-hidden={t === 1}
            className="flex shrink-0 items-center gap-16 sm:gap-20"
          >
            {track.map((m) => (
              <span key={`${t}-${m.key}`} className="shrink-0 select-none whitespace-nowrap opacity-80">
                {m.node}
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
