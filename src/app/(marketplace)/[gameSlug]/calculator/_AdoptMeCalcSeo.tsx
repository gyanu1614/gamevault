import Link from 'next/link'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { VARIANTS, VARIANT_LABEL } from './_adoptMeCalcTypes'
import { variantColor } from '../values/[brainrotSlug]/_adoptMeVariantColor'
import type { AdoptMeTopValue } from './_adoptMeCalcData'

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

const RARITY_LABEL: Record<string, string> = {
  legendary: 'Legendary',
  ultra_rare: 'Ultra-Rare',
  rare: 'Rare',
  uncommon: 'Uncommon',
  common: 'Common',
}

/**
 * SEO content package rendered BELOW the Adopt Me WFL calculator. Mirrors SAB's
 * CalculatorSeo (value table + reference block + ~1,000-word guide + internal
 * links) so the two games rank the same way — tuned to Adopt Me: trade points
 * vs cash, the Fly/Ride/Neon/Mega ladder, and the honest no-age-slider stance.
 * The FAQ is rendered by the page itself (shared with the JSON-LD), not here.
 */
export function AdoptMeCalcSeo({
  monthYear,
  topValues,
}: {
  monthYear: string
  topValues: AdoptMeTopValue[]
}) {
  return (
    <div className="mx-auto mt-10 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* Live value table — links each pet to its value page. */}
      {topValues.length > 0 && (
        <section>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-lg font-semibold text-[#F1F3F1]">
              Top Adopt Me pet values ({monthYear})
            </h2>
            <Link
              href="/adopt-me/values"
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#8FBF9C] hover:underline"
            >
              See all Adopt Me values
              <ArrowForwardIcon sx={{ fontSize: 16 }} />
            </Link>
          </div>
          <p className="mt-1 text-sm text-[#9BA8A0]">
            Cheapest Fly Ride (FR) cash prices for the most valuable pets, from sellers
            with 100+ reviews. Click any pet for its full value, every variant, and its
            daily price trend.
          </p>

          <div className="mt-4 overflow-hidden border border-[#1E2723]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E2723] bg-white/[0.02] text-left text-xs uppercase tracking-wide text-[#6D7A72]">
                  <th className="px-4 py-2.5 font-semibold">Pet</th>
                  <th className="px-4 py-2.5 font-semibold">Rarity</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Cheapest (FR)</th>
                </tr>
              </thead>
              <tbody>
                {topValues.map((row) => (
                  <tr
                    key={row.slug}
                    className="border-b border-[#161d19] transition hover:bg-white/[0.02] last:border-0"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/adopt-me/values/${row.slug}`}
                        className="font-medium text-[#EDF3E9] hover:text-[#8FBF9C] hover:underline"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-[#9BA8A0]">
                      {RARITY_LABEL[row.rarity] ?? row.rarity}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums text-[#8FBF9C]">
                      {row.cheapestUsd != null ? USD.format(row.cheapestUsd) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Variant reference — Adopt Me's 8-form ladder (the price dimension). */}
      <section className="mt-6 border border-[#1E2723] bg-[#0E1211] p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-[#F1F3F1]">Adopt Me pet variants</h2>
        <p className="mt-1 text-sm text-[#9BA8A0]">
          A pet&apos;s value depends on which potions have been applied. Fly Ride (FR) is
          the standard trading benchmark; Neon and Mega forms are worth the most because
          they take many pets to build.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(VARIANTS as readonly string[]).map((v) => (
            <div
              key={v}
              className="flex items-center gap-2 border border-[#1E2723] bg-[#111613] px-3 py-2"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: variantColor(v) }}
              />
              <span
                className="text-sm font-medium"
                style={{ color: variantColor(v) }}
              >
                {VARIANT_LABEL[v as keyof typeof VARIANT_LABEL]}{' '}
                <span className="text-[#6D7A72]">({v})</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Long-form guide — the ranking engine. */}
      <section className="mt-8 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-[#F1F3F1]">
            Find accurate Adopt Me trade values
          </h2>
          <p className="mt-3 leading-7 text-[#9BA8A0]">
            Whether you&apos;re trading pets or buying one outright, knowing what a pet is
            really worth matters. The DropMarket Adopt Me WFL calculator scores any trade
            two ways at once — in <strong className="text-[#EDF3E9]">community trade
            value</strong> and in <strong className="text-[#EDF3E9]">real money
            (USD)</strong> — so you never accept a trade that looks fair on points but
            loses you cash. Add the pets on each side, pick each pet&apos;s variant, and
            get an instant Win, Fair, or Loss verdict.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-[#F1F3F1]">
            Why use the DropMarket Adopt Me calculator?
          </h2>
          <p className="mt-3 leading-7 text-[#9BA8A0]">
            Most Adopt Me calculators only score trades in community value points. Those
            points are useful, but they don&apos;t tell you what a pet costs in real money —
            and the two often disagree. DropMarket holds a live cash value for every priced
            pet, taken from real marketplace listings, so this is the only WFL checker that
            shows both sides. A trade can be fair on points and still be a real-money loss;
            the cash verdict catches it.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-[#F1F3F1]">
            What determines an Adopt Me pet&apos;s value?
          </h2>
          <p className="mt-3 leading-7 text-[#9BA8A0]">
            A pet&apos;s worth comes down to a few factors, all of which the calculator
            accounts for:
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <h3 className="text-[15px] font-semibold text-[#EDF3E9]">Rarity</h3>
              <p className="mt-1.5 leading-7 text-[#9BA8A0]">
                From Common up to Legendary. Legendary pets — especially unobtainable ones
                from past events — are the most sought-after and hold the highest values.
                Compare every pet in the{' '}
                <Link href="/adopt-me/values" className="text-[#8FBF9C] underline underline-offset-2 hover:text-[#B9DCC4]">
                  Adopt Me value list
                </Link>
                .
              </p>
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-[#EDF3E9]">Variant (Fly &amp; Ride, Neon, Mega)</h3>
              <p className="mt-1.5 leading-7 text-[#9BA8A0]">
                Potions change a pet&apos;s value dramatically. A Fly Ride (FR) is the
                trading benchmark; a Neon takes four full-grown pets to make, and a Mega
                takes four Neons — so Neon and Mega forms command a large premium. The
                calculator prices each variant from its own listings.
              </p>
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-[#EDF3E9]">Demand &amp; availability</h3>
              <p className="mt-1.5 leading-7 text-[#9BA8A0]">
                Once a pet leaves the game it can only be traded, so demand — not supply —
                sets the price, and values drift as the community&apos;s wants change. Our
                cash prices refresh daily to keep pace; see how we build them in the{' '}
                <Link href="/adopt-me/values/methodology" className="text-[#8FBF9C] underline underline-offset-2 hover:text-[#B9DCC4]">
                  pricing methodology
                </Link>
                .
              </p>
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-[#EDF3E9]">Real cash price</h3>
              <p className="mt-1.5 leading-7 text-[#9BA8A0]">
                What a pet actually sells for, not a made-up score. Every cash value here
                comes from live listings from reputable sellers — you can{' '}
                <Link href="/adopt-me/buy-items" className="text-[#8FBF9C] underline underline-offset-2 hover:text-[#B9DCC4]">
                  buy Adopt Me pets
                </Link>{' '}
                at these prices with SafeDrop protection.
              </p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-[#F1F3F1]">How to use the WFL calculator</h2>
          <p className="mt-3 leading-7 text-[#9BA8A0]">
            Add the pets you&apos;d give to your side and the pets you&apos;d receive to
            theirs, picking each pet&apos;s variant from the two-axis selector. The
            calculator totals both sides and returns a Win, Fair, or Loss verdict — shown
            separately for trade value and for cash, since the two don&apos;t always agree.
            When you&apos;re ready, click through to buy any pet from verified DropMarket
            sellers, with buyer protection on every order.
          </p>
        </div>
      </section>
    </div>
  )
}
