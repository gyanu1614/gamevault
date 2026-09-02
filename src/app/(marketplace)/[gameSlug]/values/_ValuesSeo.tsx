import Link from 'next/link'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { HubFaqSection } from '@/components/content/HubFaqSection'

/**
 * ValuesSeo — the SEO content package rendered BELOW the value directory.
 *
 * The value list is the site's highest-intent head term ("{game} value list"),
 * yet it shipped as a bare interactive table — the THINNEST page on the term
 * competitors rank on with wrapper content. This adds the depth Google rewards:
 * an answer-first intro, a "how we price values" section (linking the
 * methodology page), and a real, rendered FAQ that also emits FAQPage schema.
 *
 * Game-agnostic via props (unit = "Brainrot"/"pet") so both SAB and Adopt Me
 * reuse it. The FAQ is EXPORTED so the page can emit matching faqPage() JSON-LD
 * — schema must mirror the visible Q&As exactly (no synthesised entries).
 */

export type ValuesFaqItem = { q: string; a: string }

/** Build the value-list FAQ for a game. Exported so the page emits matching schema. */
export function valuesFaq({
  gameName,
  unit,
}: {
  gameName: string
  unit: string
}): ValuesFaqItem[] {
  const u = unit.toLowerCase()
  return [
    {
      q: `How much is a ${u} worth in ${gameName}?`,
      a: `Every ${u}'s worth is listed here in real US dollars, pulled from live marketplace listings and completed sales and refreshed every day. Search or browse the list to see any ${u}'s current cash value, its typical price range, and how confident we are in the number — not a made-up "value points" score.`,
    },
    {
      q: `Do these ${gameName} values update?`,
      a: `Yes — the whole list refreshes daily. Prices move after game updates and new releases, so we re-price from fresh listing data every day and each ${u} shows a daily trend. That keeps the values tracking the real market instead of going stale like static value lists.`,
    },
    {
      q: `What's the difference between trade value and cash value?`,
      a: `Trade value is what a ${u} is worth against other ${u}s in a swap; cash value is what it sells for in real money (USD). A trade can look even in points but be a real-money loss. This list shows the cash value so you always know the actual dollar worth — and you can check a full trade in the calculator.`,
    },
    {
      q: `How do you calculate ${gameName} values?`,
      a: `We aggregate real marketplace listings and completed sales across sources, apply a correction layer to filter outliers, and publish an average current market price with a confidence label. The full method — sources, dating, and quality checks — is documented on our pricing methodology page so you can trust and cite the number.`,
    },
    {
      q: `How do I sell my ${gameName} ${u}s for money?`,
      a: `Price your ${u} against this list, then list it for sale on DropMarket. Every order is covered by SafeDrop escrow, so you're paid on delivery with no chargebacks. Buyers find your listing through these same value pages, which rank on Google.`,
    },
  ]
}

export function ValuesSeo({
  gameSlug,
  gameName,
  unit,
  buyHref,
  methodologyHref = `/${gameSlug}/values/methodology`,
  calculatorHref = `/${gameSlug}/calculator`,
}: {
  gameSlug: string
  gameName: string
  /** The item noun for this game — "Brainrot" (SAB) or "pet" (Adopt Me). */
  unit: string
  buyHref: string
  methodologyHref?: string
  calculatorHref?: string
}) {
  const u = unit.toLowerCase()
  const faqItems = valuesFaq({ gameName, unit })

  return (
    <div className="mx-auto w-full max-w-7xl border-t border-[#1A211A] px-4 pb-4 pt-12 sm:px-6 lg:px-8">
      {/* Answer-first intro — the extractable summary Google wants on the head
          term. First sentence directly answers "what is this / how much".
          space-y-8 gives each sub-section clear breathing room. */}
      <section className="space-y-8">
        <div>
          <h2 className="text-xl font-semibold text-[#F1F3F1]">
            The {gameName} value list, in real money
          </h2>
          <p className="mt-3 leading-7 text-[#9BA8A0]">
            This is the DropMarket {gameName} value list: every {u}&apos;s worth in real US
            dollars, sourced from live marketplace listings and completed sales and updated
            daily. Instead of static &quot;value points&quot; that go stale within days of an
            update, each price is a real cash value you can act on — so you never overpay, get
            lowballed, or accept a bad trade. Search any {u} to see its current value, price
            range, and daily trend, or check a full swap in the{' '}
            <Link
              href={calculatorHref}
              className="text-[#8FBF9C] underline underline-offset-2 hover:text-[#B9DCC4]"
            >
              {gameName} WFL calculator
            </Link>
            .
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-[#F1F3F1]">
            How we price {gameName} values
          </h2>
          <p className="mt-3 leading-7 text-[#9BA8A0]">
            Every value on this list comes from real marketplace data — live listings and
            completed sales aggregated across sources, cleaned of outliers, and published as an
            average current market price with a confidence label. We re-price every day so the
            list keeps pace with the real market after updates and new releases. See exactly how
            each number is sourced, dated, and quality-checked in our{' '}
            <Link
              href={methodologyHref}
              className="text-[#8FBF9C] underline underline-offset-2 hover:text-[#B9DCC4]"
            >
              pricing methodology
            </Link>
            {' '}— so you can trust the value and cite it with confidence.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-[#F1F3F1]">
            What drives a {u}&apos;s value in {gameName}?
          </h2>
          <p className="mt-3 leading-7 text-[#9BA8A0]">
            A {u}&apos;s worth comes down to a few factors, all reflected in the prices on this
            list: its rarity, its demand after recent updates, and — for {gameName} — the
            variants or mutations applied to it, which can multiply its value several times over.
            Because we price from real sales rather than a fixed multiplier, each variant shows
            its own honest cash value. When you know what a {u} is worth, you can{' '}
            <Link
              href={buyHref}
              className="text-[#8FBF9C] underline underline-offset-2 hover:text-[#B9DCC4]"
            >
              buy {gameName} items
            </Link>{' '}
            at a fair price with SafeDrop protection, or list your own to sell.
          </p>
        </div>
      </section>

      {/* Shared FAQ block — centered title, standard spacing (see HubFaqSection).
          Rendered visibly; the page emits matching FAQPage schema. */}
      <HubFaqSection
        title={`${gameName} Values — Frequently Asked Questions`}
        subtitle={`Everything about how ${gameName} values work, update, and translate to real money.`}
        items={faqItems}
        footer={
          <Link
            href={calculatorHref}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#4FB477] hover:underline"
          >
            Open the {gameName} calculator
            <ArrowForwardIcon sx={{ fontSize: 16 }} />
          </Link>
        }
      />
    </div>
  )
}
