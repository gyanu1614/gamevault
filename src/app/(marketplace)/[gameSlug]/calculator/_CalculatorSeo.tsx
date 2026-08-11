import Link from 'next/link'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { sabCard } from '@/lib/sab/theme'
import { formatCash } from '@/lib/sab/format'
import { MUTATIONS, mutationVisual } from '@/lib/sab/mutations'
import { FaqCards } from '@/components/marketplace/FaqCards'

export type TopValueRow = {
  slug: string
  name: string
  rarity: string
  priceUsd: number | null
}

// Exported so the page can emit matching FAQPage JSON-LD (schema must mirror
// the rendered Q&As exactly).
export const CALCULATOR_FAQ: { q: string; a: string }[] = [
  {
    q: 'How does the Steal a Brainrot value calculator work?',
    a: `The DropMarket calculator looks up the live cash value (in USD) of any Brainrot and mutation from real marketplace listings, refreshed every few hours. Pick a Brainrot in Cash Price mode to see its current worth, or use Trade / WFL mode to add Brainrots to both sides and get an instant Win, Fair, or Loss verdict based on real market prices — not made-up value points.`,
  },
  {
    q: 'What is a WFL trade check in Steal a Brainrot?',
    a: `WFL stands for Win, Fair, or Loss. It tells you whether a trade is worth taking. Add the Brainrots you'd give and the Brainrots you'd receive; the calculator totals each side's real cash value and returns WIN (you gain value), FAIR (within 5%), or LOSS (you lose value). Because it uses live USD prices, the verdict reflects the actual market, not opinion.`,
  },
  {
    q: "How much do mutations increase a Brainrot's value?",
    a: `Mutations multiply a Brainrot's income and its market value. Higher mutations like Rainbow, Cursed, and Galaxy can be worth several times the default. The calculator prices each mutation separately from live listings, so a Rainbow or Diamond variant shows its own real cash value instead of a guess.`,
  },
  {
    q: 'Are these Steal a Brainrot values accurate and up to date?',
    a: `Yes. Prices come from live marketplace listings across sources and refresh every day, so the values track the real market as it moves after updates and new Brainrot releases. Each value links to a full item page showing the price range, confidence, and daily trend.`,
  },
  {
    q: 'Where can I buy or sell Steal a Brainrot Brainrots safely?',
    a: `You can buy any Brainrot from verified sellers on DropMarket, where every purchase is covered by buyer protection — you only pay after delivery is confirmed. Use the calculator to check the fair price first, then click through to live listings.`,
  },
  {
    q: 'What makes a Brainrot high value in Steal a Brainrot?',
    a: `Value is driven by base income per second, rarity (Secret and OG tiers are the most sought-after), and mutations. A high-income Secret or OG Brainrot with a strong mutation like Rainbow commands the highest cash prices. The calculator factors all of this from real listing data.`,
  },
]

/**
 * SEO content package rendered BELOW the calculator tool. Competitors
 * (bloxultra, igitems) rank on ~1,200 words of keyword-rich guide content +
 * value tables + internal links — not the tool itself. This gives us all of
 * that PLUS our edge: live daily prices linking to 498 real item pages.
 */
/** "3h ago", "just now", "2d ago" — compact relative time from an ISO string. */
function timeAgo(iso: string | null): string | null {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

export function CalculatorSeo({
  monthYear,
  topValues,
  lastUpdated,
}: {
  monthYear: string
  topValues: TopValueRow[]
  lastUpdated?: string | null
}) {
  const faqItems = CALCULATOR_FAQ
  const updatedAgo = timeAgo(lastUpdated ?? null)

  return (
    <div className="mx-auto mt-8 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* Live value table — floats on the page (no wrapping card box). */}
      {topValues.length > 0 && (
        <section>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-lg font-semibold text-[#F1F3F1]">
              Top Steal a Brainrot values ({monthYear})
            </h2>
            <div className="flex flex-col items-end gap-1.5">
              <Link
                href="/steal-a-brainrot/values"
                className="inline-flex items-center gap-1 text-sm font-semibold text-[#4FB477] hover:underline"
              >
                See all 498 values
                <ArrowForwardIcon sx={{ fontSize: 16 }} />
              </Link>
              {updatedAgo && (
                <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-[#8FBF9C]">
                  <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#3FA35C]" />
                  Updated {updatedAgo}
                </span>
              )}
            </div>
          </div>
          <p className="mt-1 text-sm text-[#9BA8A0]">
            Live cash prices for the most valuable Brainrots, refreshed every few hours from real
            listings. Click any Brainrot for its full value, mutation prices, and daily trend.
          </p>

          <div className="mt-4 overflow-hidden border border-[#1E2723]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E2723] bg-white/[0.02] text-left text-xs uppercase tracking-wide text-[#6D7A72]">
                  <th className="px-4 py-2.5 font-semibold">Brainrot</th>
                  <th className="px-4 py-2.5 font-semibold">Rarity</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Cash value</th>
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
                        href={`/steal-a-brainrot/values/${row.slug}`}
                        className="font-medium text-[#EDF3E9] hover:text-[#4FB477] hover:underline"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-[#9BA8A0]">{row.rarity}</td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums text-[#F1F3F1]">
                      {formatCash(row.priceUsd) ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Mutation multiplier reference. */}
      <section className={`${sabCard} mt-6 p-5 sm:p-6`}>
        <h2 className="text-lg font-semibold text-[#F1F3F1]">Steal a Brainrot mutation multipliers</h2>
        <p className="mt-1 text-sm text-[#9BA8A0]">
          Mutations multiply a Brainrot&apos;s income and cash value. The calculator prices each
          mutation from live listings — these multipliers show the relative income boost.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {MUTATIONS.filter((m) => m.slug !== 'default').map((m) => {
            const v = mutationVisual(m.slug)
            return (
              <div
                key={m.slug}
                className="flex items-center gap-2 border border-[#1E2723] bg-[#111613] px-3 py-2"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={v.gradient ? { backgroundImage: v.gradient } : { backgroundColor: v.color }}
                />
                <span className="text-sm font-medium" style={{ color: v.color }}>
                  {m.name}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Long-form guide content — the ranking engine. */}
      <section className="mt-8 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-[#F1F3F1]">
            Find accurate Steal a Brainrot trading values
          </h2>
          <p className="mt-3 leading-7 text-[#9BA8A0]">
            Whether you&apos;re buying, selling, or trading Brainrots in Steal a Brainrot, knowing the
            real cash value matters. The DropMarket Steal a Brainrot value calculator gives you the
            live USD worth of every Brainrot and mutation, pulled from real marketplace listings and
            refreshed daily — so you never overpay, get lowballed, or accept a bad trade. Use{' '}
            <strong className="text-[#EDF3E9]">Cash Price</strong> mode to check what a single
            Brainrot is worth, or <strong className="text-[#EDF3E9]">Trade / WFL</strong> mode to
            compare a full trade and get an instant Win, Fair, or Loss verdict.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-[#F1F3F1]">
            Why use the DropMarket Brainrot calculator?
          </h2>
          <p className="mt-3 leading-7 text-[#9BA8A0]">
            Most Brainrot value lists use static &quot;value points&quot; that go stale within days of
            an update. DropMarket is different: our values are real cash prices in USD, sourced from
            live listings and updated every day. That means the WFL verdict you get reflects the
            actual market — what people are really paying right now — not a made-up score. Every value
            also links to a full item page with the price range, confidence level, per-mutation
            pricing, and a daily price trend, so you can verify before you trade.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-[#F1F3F1]">
            What determines a Brainrot&apos;s value?
          </h2>
          <p className="mt-3 leading-7 text-[#9BA8A0]">
            A Brainrot&apos;s worth comes down to a few factors, all of which the calculator accounts
            for:
          </p>

          {/* Entity-named H3s rather than one prose block. Each sub-heading is
              the exact thing players search ("brainrot income per second",
              "brainrot mutations value"), which gives the section real topical
              coverage instead of burying the terms mid-paragraph. Same copy,
              same visual weight — no hidden text, which would be cloaking. */}
          <div className="mt-4 space-y-4">
            <div>
              <h3 className="text-[15px] font-semibold text-[#EDF3E9]">Income Per Second</h3>
              <p className="mt-1.5 leading-7 text-[#9BA8A0]">
                The core value driver. Higher-earning Brainrots are worth more because they generate
                cash faster in-game — you can compare every Brainrot&apos;s income side by side in the{' '}
                <Link href="/steal-a-brainrot/values" className="text-[#8FBF9C] underline underline-offset-2 hover:text-[#B9DCC4]">
                  Steal a Brainrot value list
                </Link>
                .
              </p>
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-[#EDF3E9]">Brainrot Rarity</h3>
              <p className="mt-1.5 leading-7 text-[#9BA8A0]">
                From Common up to Mythic, Legendary, Secret, and the top-tier OG Brainrots. Secret
                and OG variants are the most sought-after and command the highest prices.
              </p>
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-[#EDF3E9]">Applied Mutations</h3>
              <p className="mt-1.5 leading-7 text-[#9BA8A0]">
                Traits like Rainbow, Cursed, Galaxy, and Diamond multiply both income and value. A
                mutated Brainrot can be worth several times its default price, which is why the
                calculator prices each mutation separately rather than deriving it from a multiplier.
              </p>
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-[#EDF3E9]">Market Trends &amp; Demand</h3>
              <p className="mt-1.5 leading-7 text-[#9BA8A0]">
                Prices shift after game updates and new releases. Because our data updates daily, the
                values you see keep pace with the real market — see how we build them in the{' '}
                <Link href="/steal-a-brainrot/values/methodology" className="text-[#8FBF9C] underline underline-offset-2 hover:text-[#B9DCC4]">
                  pricing methodology
                </Link>
                .
              </p>
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-[#EDF3E9]">Purchase Price</h3>
              <p className="mt-1.5 leading-7 text-[#9BA8A0]">
                What a Brainrot actually sells for in cash, rather than what a value list claims.
                Every price here comes from completed sales and live listings — you can{' '}
                <Link href="/steal-a-brainrot/buy-items" className="text-[#8FBF9C] underline underline-offset-2 hover:text-[#B9DCC4]">
                  buy Steal a Brainrot items
                </Link>{' '}
                or{' '}
                <Link href="/steal-a-brainrot/buy-accounts" className="text-[#8FBF9C] underline underline-offset-2 hover:text-[#B9DCC4]">
                  browse accounts
                </Link>{' '}
                at these prices with SafeDrop protection.
              </p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-[#F1F3F1]">How to use the value calculator</h2>
          <p className="mt-3 leading-7 text-[#9BA8A0]">
            In <strong className="text-[#EDF3E9]">Cash Price</strong> mode, search for a Brainrot,
            pick a mutation, and see its live cash value, typical range, and confidence. In{' '}
            <strong className="text-[#EDF3E9]">Trade / WFL</strong> mode, add the Brainrots you&apos;d
            give to your side and the ones you&apos;d receive to theirs — the calculator totals both
            sides and returns a Win, Fair, or Loss verdict. When you&apos;re ready, click through to
            buy any Brainrot from verified DropMarket sellers, with buyer protection on every order.
          </p>
        </div>
      </section>

      {/* FAQ — neither competitor has one on their calculator page. */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-[#F1F3F1]">
          Steal a Brainrot calculator — frequently asked questions
        </h2>
        <FaqCards items={faqItems} defaultOpen={0} className="mt-5" square />
      </section>
    </div>
  )
}

export { }
