import Link from 'next/link'
import { HubFaqSection } from '@/components/content/HubFaqSection'

/**
 * AdoptMeCalculatorSeo — the long-form guide rendered BELOW the Adopt Me WFL
 * calculator, bringing it to content parity with the Steal a Brainrot
 * calculator (which ships ~1,200 words via CalculatorSeo). Before this, the
 * Adopt Me page was tool + FAQ-schema only — and the FAQ was emitted as JSON-LD
 * WITHOUT being rendered, a schema/visible-content mismatch. This renders that
 * FAQ (via the shared HubFaqSection) and adds the guide content Google rewards.
 *
 * Adopt Me's genuine differentiator — showing the CASH side of a trade, not just
 * trade points — is leaned on hard in the H2s, since no competitor does it.
 *
 * The FAQ is passed in (rather than imported) so this file and the page don't
 * form an import cycle; the page owns ADOPT_ME_CALC_FAQ + its FAQPage schema.
 */
export function AdoptMeCalculatorSeo({
  faq,
}: {
  faq: { q: string; a: string }[]
}) {
  return (
    <div className="mx-auto mt-8 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <section className="space-y-8">
        <div>
          <h2 className="text-xl font-semibold text-[#F1F3F1]">
            How the Adopt Me WFL calculator works
          </h2>
          <p className="mt-3 leading-7 text-[#9BA8A0]">
            Add the pets on each side of a trade, pick each pet&apos;s variant (Normal, Fly
            Ride, Neon, Mega, and so on), and the calculator instantly totals both sides and
            returns a <strong className="text-[#EDF3E9]">Win, Fair, or Loss</strong> verdict. It
            scores the trade two ways: in community <strong className="text-[#EDF3E9]">trade
            value</strong> and in real <strong className="text-[#EDF3E9]">money (USD)</strong>.
            Look up any pet&apos;s worth in the{' '}
            <Link
              href="/adopt-me/values"
              className="text-[#8FBF9C] underline underline-offset-2 hover:text-[#B9DCC4]"
            >
              Adopt Me value list
            </Link>
            .
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-[#F1F3F1]">
            Trade value vs real money — the difference that matters
          </h2>
          <p className="mt-3 leading-7 text-[#9BA8A0]">
            Most Adopt Me calculators only score a trade in community trade points. This one
            also scores it in real money, because DropMarket holds live cash values for pets. A
            trade can look fair in trade value but be a real-money loss — this is the only
            calculator that shows both sides, so you know whether you&apos;re winning on points,
            on cash, or both before you accept.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-[#F1F3F1]">
            What makes an Adopt Me pet valuable?
          </h2>
          <p className="mt-3 leading-7 text-[#9BA8A0]">
            A pet&apos;s worth comes down to its rarity and, above all, its variant. The
            calculator prices each variant from real data rather than a fixed multiplier:
          </p>

          <div className="mt-4 space-y-4">
            <div>
              <h3 className="text-[15px] font-semibold text-[#EDF3E9]">Fly &amp; Ride</h3>
              <p className="mt-1.5 leading-7 text-[#9BA8A0]">
                The trading benchmark. Fly Ride (FR) is the standard most values are quoted
                against, so it&apos;s the fairest way to compare two pets on equal footing.
              </p>
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-[#EDF3E9]">Neon</h3>
              <p className="mt-1.5 leading-7 text-[#9BA8A0]">
                Made by combining four full-grown copies of a pet. A Neon is worth well above
                four base pets because of the time and pets it takes to build — see the exact
                cost in the{' '}
                <Link
                  href="/adopt-me/neon-calculator"
                  className="text-[#8FBF9C] underline underline-offset-2 hover:text-[#B9DCC4]"
                >
                  Neon cost calculator
                </Link>
                .
              </p>
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-[#EDF3E9]">Mega Neon</h3>
              <p className="mt-1.5 leading-7 text-[#9BA8A0]">
                The top variant — four Neons (sixteen base pets) merged again. Megas command the
                highest prices, and the calculator prices them from real listings rather than a
                guessed multiple.
              </p>
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-[#EDF3E9]">Rarity &amp; demand</h3>
              <p className="mt-1.5 leading-7 text-[#9BA8A0]">
                Legendary and event-exclusive pets hold value long after they leave the game.
                Because our data updates daily, the values keep pace with demand as it shifts.
              </p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-[#F1F3F1]">How to use the calculator</h2>
          <p className="mt-3 leading-7 text-[#9BA8A0]">
            Add the pets you&apos;d give to your side and the pets you&apos;d receive to theirs,
            set each pet&apos;s variant, and read the verdict. When you&apos;re ready to trade
            for real money instead, you can{' '}
            <Link
              href="/adopt-me/buy-items"
              className="text-[#8FBF9C] underline underline-offset-2 hover:text-[#B9DCC4]"
            >
              buy Adopt Me pets
            </Link>{' '}
            from verified sellers with SafeDrop protection, or price your own to sell.
          </p>
        </div>
      </section>

      {/* Shared FAQ block — renders the same Q&As emitted as FAQPage schema on
          the page (fixes the previous schema-without-visible-content mismatch). */}
      <HubFaqSection
        title="Adopt Me Calculator — Frequently Asked Questions"
        subtitle="How the WFL calculator works, how variants are priced, and reading a Win, Fair, or Loss verdict."
        items={faq}
      />
    </div>
  )
}
