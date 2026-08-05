import { JsonLd, breadcrumbList, faqPage } from '@/lib/seo/jsonld'
import { SabHeroBackdrop } from '../values/_SabHeroBackdrop'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { getHubNavData } from '@/lib/content/hubNav'
import { HubBuyCta } from '@/components/content/HubBuyCta'
import { HubHero } from '@/components/content/HubHero'
import AdoptMeWflClient from './_AdoptMeWflClient'
import { getAdoptMeCalcPets } from './_adoptMeCalcData'

export const ADOPT_ME_CALC_FAQ = [
  {
    q: 'How does the Adopt Me WFL calculator work?',
    a: 'Add the pets on each side of the trade and pick each pet’s variant (Normal, Fly Ride, Neon, Mega and so on). The calculator totals both sides and tells you whether the trade is a Win, Fair or Loss — in community trade value AND in real money (USD).',
  },
  {
    q: 'What makes this different from other Adopt Me calculators?',
    a: 'Other calculators only score a trade in community trade points. This one also scores it in real money, because DropMarket holds cash values for pets. A trade can be fair in trade value but a real-money loss — this is the only calculator that shows both.',
  },
  {
    q: 'Why is there no age slider?',
    a: 'We price pets from real marketplace listings, and those listings do not consistently report age, so we do not hold age-based pricing. Rather than show a guessed age multiplier as if it were a fact, we leave it out. The variant (Fly Ride, Neon, Mega and so on) is the price dimension we can measure honestly.',
  },
  {
    q: 'What does Win / Fair / Loss mean?',
    a: 'Fair means the two sides are within about 5% of each other. Win means the side you receive is worth more than the side you give; Loss means it is worth less. The verdict is shown separately for trade value and for cash, since the two do not always agree.',
  },
]

export default async function AdoptMeCalculatorPage() {
  const [pets, hubNav] = await Promise.all([
    getAdoptMeCalcPets(),
    getHubNavData('adopt-me'),
  ])

  return (
    <main className="relative min-h-screen bg-[#0C0F0E]">
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: 'Adopt Me', path: '/adopt-me' },
          { name: 'WFL Calculator', path: '/adopt-me/calculator' },
        ])}
      />
      <JsonLd data={faqPage(ADOPT_ME_CALC_FAQ)} />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'Adopt Me WFL Calculator',
          applicationCategory: 'UtilitiesApplication',
          operatingSystem: 'Web',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        }}
      />

      <SabHeroBackdrop height={360}>
        <HubNav data={hubNav} calcMode="trade" />

        <HubHero
          title="Adopt Me WFL Calculator"
          lead={
            <>
              Put both sides of a trade in and see instantly whether it&apos;s a
              Win, Fair or Loss — in trade value and in real money. The only
              WFL checker that shows the cash side.
            </>
          }
        />
        {/* pb spacer between hero and calculator retained from the old pb-6. */}

        <div className="relative mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
          {pets.length === 0 ? (
            <div className="border border-[#1E2723] bg-white/[0.04] px-6 py-12 text-center">
              <h2 className="text-xl font-semibold text-[#F1F3F1]">Calculator temporarily unavailable</h2>
              <p className="mt-2 text-[#9BA8A0]">The pet database could not be loaded. Please check again shortly.</p>
            </div>
          ) : (
            <AdoptMeWflClient pets={pets} />
          )}

          <HubBuyCta gameName="Adopt Me" gameSlug="adopt-me" buyHref="/adopt-me/buy-items" />
        </div>
      </SabHeroBackdrop>

      <HubFooter
        gameName={hubNav.current.name}
        gameSlug={hubNav.current.slug}
        tools={hubNav.tools}
        itemsHref={hubNav.itemsHref}
        accountsHref={hubNav.accountsHref}
      />
    </main>
  )
}
