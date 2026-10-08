/**
 * "Accepted at Checkout": a full-bleed strip of the payment methods the
 * checkout really offers, built from the Payssion registry plus the crypto
 * card's coins, so a method can't appear here unless a buyer can pick it.
 *
 * Owner, 2026-10-06: no white cards — the marks float on the page, bigger,
 * and all look alike. Every mark is single-colour white at one height
 * (PAYMENT_METHOD_MONO); a method without a clean mark is set as a wordmark.
 * A slow sheen sweeps the strip and a mark brightens under the pointer.
 *
 * Duplicated track + the `animate-marquee` keyframe, right → left, slow
 * (90 s a lap); pauses on hover; no motion under reduced motion. Render OUTSIDE
 * any max-w wrapper.
 */

import { payssionSelectorMethods } from '@/lib/payments/providers/payssion/methods'
import { CHECKOUT_COINS, CHECKOUT_COINS_MONO, PAYMENT_METHOD_MONO } from '@/lib/payments/method-marks'

type Mark =
  | { key: string; label: string; kind: 'logo'; src: string }
  | { key: string; label: string; kind: 'coin'; src: string }
  | { key: string; label: string; kind: 'word'; text: string }

/**
 * Owner, 2026-10-07: only real marks ("Trustly, Pix and more, not fake
 * ones"). A method set in plain type (SPEI, Boleto, PSE…) read as made up, so
 * the strip shows the checkout methods that have a real logo, best known
 * first, then the coins. Every method is still in the screen-reader list.
 */
const LEAD = ['trustly', 'pix_br', 'paysafecard', 'blik_pl', 'p24_pl']
const LOGO_METHODS = payssionSelectorMethods()
  .filter((m) => {
    const mono = PAYMENT_METHOD_MONO[m.pmId]
    return !!mono && 'logo' in mono
  })
  .sort((a, b) => {
    const ai = LEAD.indexOf(a.pmId)
    const bi = LEAD.indexOf(b.pmId)
    return (ai < 0 ? LEAD.length : ai) - (bi < 0 ? LEAD.length : bi)
  })

const MARKS: Mark[] = [
  ...LOGO_METHODS.map((m): Mark => ({ key: m.pmId, label: m.label, kind: 'logo', src: (PAYMENT_METHOD_MONO[m.pmId] as { logo: string }).logo })),
  ...CHECKOUT_COINS.map((c): Mark => ({ key: c.key, label: c.label, kind: 'coin', src: CHECKOUT_COINS_MONO[c.key] })),
]

/** Every way to pay, for screen readers (the strip shows the logo ones). */
const ALL_LABELS = [...payssionSelectorMethods().map((m) => m.label), ...CHECKOUT_COINS.map((c) => c.label)]

function MarkView({ mark }: { mark: Mark }) {
  const base =
    'pm-mark flex h-12 shrink-0 select-none items-center opacity-90 transition-[opacity,transform] duration-300 hover:-translate-y-0.5 hover:opacity-100'
  if (mark.kind === 'word') {
    return <span className={`${base} whitespace-nowrap text-[28px] font-extrabold tracking-[-0.02em] text-white`}>{mark.text}</span>
  }
  if (mark.kind === 'coin') {
    return (
      <span className={`${base} gap-2.5`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static mark in /public */}
        <img src={mark.src} alt={`${mark.label} logo`} aria-hidden loading="lazy" decoding="async" className="h-10 w-10" />
        <span className="text-[27px] font-bold tracking-[-0.02em] text-white">{mark.label}</span>
      </span>
    )
  }
  return (
    <span className={base}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static mark in /public */}
      <img src={mark.src} alt={mark.label} loading="lazy" decoding="async" className="h-9 w-auto max-w-[190px] object-contain" />
    </span>
  )
}

export function PaymentsMarquee({ disclaimer }: { disclaimer?: string | null } = {}) {
  return (
    <section aria-labelledby="payments-strip-title" className="group relative mt-12 w-full overflow-hidden pb-4 sm:mt-16">
      {/* The strip speaks for itself; the heading stays for screen readers. */}
      <h2 id="payments-strip-title" className="sr-only">
        Accepted at Checkout
      </h2>
      {/* Screen readers get the list once, in plain words. */}
      <p className="sr-only">{ALL_LABELS.join(', ')}</p>

      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-bg-base to-transparent sm:w-40"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-bg-base to-transparent sm:w-40"
        />
        <div
          aria-hidden
          className="flex w-max animate-marquee items-center py-3 [animation-duration:90s] group-hover:[animation-play-state:paused] motion-reduce:animate-none"
        >
          {[0, 1].map((t) => (
            <div key={t} className="pm-track flex shrink-0 items-center gap-16 pr-16 sm:gap-20 sm:pr-20">
              {MARKS.map((m) => (
                <MarkView key={`${t}-${m.key}`} mark={m} />
              ))}
            </div>
          ))}
        </div>
      </div>
      {/* The page's per-game trademark line sits under the strip, above the
          footer (lib/seo/trademark). */}
      {disclaimer && (
        <p className="mx-auto mt-6 max-w-7xl px-4 text-center text-[12px] leading-5 text-text-tertiary sm:px-6 lg:px-8">{disclaimer}</p>
      )}
    </section>
  )
}
