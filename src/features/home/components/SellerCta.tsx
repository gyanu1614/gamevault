/**
 * SellerCta — the seller pitch section, as a 2-up + 1-wide bento.
 *
 * Sets no padding, margin, max-width or overflow: it opts into the page
 * measure and lets the rhythm container own the spacing around it, per the
 * section authoring contract in CLAUDE.md. The bento's own shape (2 on top,
 * 1 spanning the bottom) is the only thing the design brief dictates here —
 * the container, rhythm and title scale all follow the page rules.
 */

import { SellerCtaCard, type SellerCta as SellerCtaType } from './SellerCtaCard'

/** Card copy and layout. Edit here, not in the component. */
const CARDS: SellerCtaType[] = [
  {
    step: '01',
    title: 'List in Minutes',
    // Same stacked treatment as card 3: the qualifier sits small above the
    // word that carries the message. 1.5em here rather than card 3's 1.65
    // because MINUTES is a longer word on a card barely half as wide.
    titleStack: [
      { text: 'LIST IN', scale: 0.82 },
      { text: 'MINUTES', scale: 1.34 },
    ],
    // Two lines, each forced onto a single line — see the array handling in
    // SellerCtaCard.
    sub: ['One quick verification and you can start selling.', 'Sell Currency, Items, Accounts and more!'],
    tone: 'light',
    // Text at the top; a category cascade fills the lower area.
    layout: 'text-top',
    figureLeft: { src: '/images/steps/step-01.webp', width: 1848, height: 821 },
    // Saturated surface replaces the graphite token and the corner glow.
    // Third stop is #096D4F, not the specified #0B7F5C — same hue (162deg)
    // and saturation, 8% lower lightness. At #0B7F5C the spec's own
    // rgba(255,255,255,0.78) subtext measures 3.68:1, and no alpha can fix
    // it: pure white over that stop tops out at 4.99:1. #096D4F carries the
    // subtext to 4.53:1 and the white title to 6.34:1.
    gradient: 'linear-gradient(125deg, #0A4D5E 0%, #0A5F60 48%, #096D4F 100%)',
    // Renders only once the asset exists; see the note in the handover.
    pattern: '/images/decor/ak-pattern-v3.webp',
  },
  {
    step: '02',
    // ⚠️ UNSUPPORTED CLAIM. No `game_fee_overrides` row at 0% exists — the
    // only seeded overrides are three GTA `accounts` entries at 20%. The
    // schema permits it (`CHECK (pct >= 0 AND pct <= 50)`), so 0% needs a
    // row insert rather than a migration, but until those rows are live
    // this headline promises a rate no seller can obtain. Either insert the
    // rows before launch or revert to "Fees From 0% on Select Games",
    // which qualifies the claim.
    title: 'Fees as Low as 0%',
    titleBreak: ['FEES AS LOW', 'AS 0%'],
    // "select games free" dropped: the 0% row in the list below already
    // makes that claim, and the longer string wrapped to a one-word orphan.
    sub: 'Every category priced separately. Top-ups from 5%.',
    tone: 'prototype',
    // Text at the top, category fee ladder filling the lower half.
    layout: 'text-top',
    // Deep violet — distinct from card 1's teal and card 3's graphite, so
    // the row reads as three siblings rather than a repeat.
    gradient: 'linear-gradient(125deg, #3A2A52 0%, #2E2140 52%, #1E1730 100%)',
    // One quiet line, not a panel. Three segments; the last carries the
    // accent. See the note in SellerCtaCard: no money-bag asset exists in
    // public/images/decor, so the cluster's anchor object is the largest
    // coin rather than a bag.
    // Two segments, not three: at 12px JetBrains Mono the full line
    // ("New sellers 10% · Top rank 8% · Select games 0%") measures 367px
    // against a 257px column at 1440 and runs across the coin cluster at
    // every width. The brief's own fallback — drop the middle segment —
    // brings it to 252px, which clears the coins at 1440/1280/1150.
    feeLadder: [
      { label: 'New sellers', rate: '10%' },
      { label: 'Select games', rate: '0%', accent: true },
    ],
  },
  {
    step: '03 — SELLER',
    title: 'Start Earning Today',
    // Three stacked lines. START and TODAY sit at 0.92em = 35px, matching
    // card 1's 34.8px title so the two cards read as one type system;
    // EARNING carries the emphasis at 1.65em = 63px.
    titleStack: [
      { text: 'START', scale: 1.06 },
      // 1.07em of EARNING's own 63px = 67px, which is exactly half of
      // START's width. Measured from Archivo's hmtx table, not estimated:
      // START is 3.331em wide at 1.06em of a 38px base = 134px, so its
      // midpoint is 67px. (2.1em put this at 132px — the full width of
      // START, so EARNING began where START ended.)
      { text: 'EARNING', scale: 1.65, accent: true, indent: 1.07 },
      // Right-aligned so it sits flush under EARNING's tail — the "NING".
      { text: 'TODAY', scale: 1.14, align: 'right' },
    ],
    // The stacked title says the same thing in fewer words, and the 260px
    // card has no vertical room for both it and a two-line sub. Kept as one
    // short line for the trust point the title does not carry.
    sub: 'Payments, payouts and disputes handled.',
    tone: 'prototype',
    // Text on the left half, art bleeding off the bottom-right.
    layout: 'text-left',
    // Card 3's figure comes from CARD3_FIGURE in SellerCtaCard, not from
    // here — it needs its own offset and grade. step-01 / step-02
    // are unset, so cards 1 and 2 render a neutral placeholder.
    button: { label: 'Start Selling', href: '/sell' },
  },
]

export function SellerCta() {
  return (
    <section className="page-measure">
      {/* Centred, because this section carries no action link — the CTA is
          the pill button on the wide card. Per the section header rule, a
          section without a link centres its title rather than running a
          heading/link row. */}
      {/* Sits close to the grid on purpose: with no subtext beneath it, the
          heading reads as the bento's own label rather than as a floating
          section header. The gap is the grid's own row gap, so the heading
          and the first row of cards pair up. */}
      <h2 className="section-title">Sell on DropMarket</h2>

      {/* One column until the cards are wide enough to sit side by side.
          The third card spans both columns on the bottom row. */}
      {/* The right gutter is where card 3's figure lands. It overhangs the
          card by 80px, and `.page-stage` clips at the viewport edge, so the
          gutter has to be at least that wide or the figure loses its tip.
          Measured: at 1280px a 32px gutter left the figure 15px past the
          stage and it was silently cut. 80px + the measure's own padding
          clears it at every width the breakout is active. */}
      <ul className="mt-5 grid grid-cols-1 gap-3.5 lg:mt-6 lg:grid-cols-2 lg:gap-5 lg:pr-20">
        {CARDS.map((cta) => (
          <li key={cta.title} className={cta.layout === 'text-left' ? 'lg:col-span-2' : undefined}>
            <SellerCtaCard cta={cta} />
          </li>
        ))}
      </ul>
    </section>
  )
}
