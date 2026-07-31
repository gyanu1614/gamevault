import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { JsonLd, breadcrumbList, faqPage } from '@/lib/seo/jsonld'
import { SabHeroBackdrop } from '../values/_SabHeroBackdrop'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { getHubNavData, HUB_NAV_CLEAR } from '@/lib/content/hubNav'
import { HubBuyCta } from '@/components/content/HubBuyCta'
import { getAdoptMeCalcPets } from '../calculator/_adoptMeCalcData'
import AdoptMeNeonClient from './_AdoptMeNeonClient'

export const revalidate = 3600

interface PageProps {
  params: Promise<{ gameSlug: string }>
}

const NEON_FAQ = [
  {
    q: 'How many pets do you need to make a Neon in Adopt Me?',
    a: 'A Neon pet is made by merging 4 full-grown copies of the same pet in the Neon Cave. So you need 4 base pets, each raised to full grown, to make one Neon.',
  },
  {
    q: 'How many pets does a Mega Neon need?',
    a: 'A Mega Neon is made from 4 Neons. Since each Neon needs 4 base pets, a Mega Neon takes 16 base pets in total, all grown to full grown and then merged twice.',
  },
  {
    q: 'Is it cheaper to build a Neon or buy one?',
    a: 'This calculator shows both: the cash cost to build (the Normal price times the number of base pets) versus the cash cost to buy the ready-made Neon or Mega. Buying is often cheaper once you count the time to collect and grow every pet, but the raw money comparison is shown here so you can decide.',
  },
]

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gameSlug } = await params
  if (gameSlug !== 'adopt-me') return { title: 'Not Found' }
  const monthYear = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const title = `Adopt Me Neon Cost Calculator (${monthYear}) — Build vs Buy`
  return {
    title,
    description: `How many pets to make a Neon or Mega Neon in Adopt Me, and what it costs. See the cash cost to build (4 pets for a Neon, 16 for a Mega) versus buying the ready-made form. Updated ${monthYear}.`,
    alternates: { canonical: '/adopt-me/neon-calculator' },
    keywords: [
      'adopt me neon calculator',
      'how many pets to make a neon adopt me',
      'adopt me mega neon cost',
      'adopt me neon cost calculator',
      'how many pets for a mega neon',
      'adopt me neon vs mega',
    ],
    openGraph: {
      title,
      description: 'Neon and Mega Neon cost in Adopt Me — build vs buy, in real money.',
      url: '/adopt-me/neon-calculator',
      type: 'website',
    },
  }
}

export default async function NeonCalculatorPage({ params }: PageProps) {
  const { gameSlug } = await params
  if (gameSlug !== 'adopt-me') notFound()

  const [pets, hubNav] = await Promise.all([getAdoptMeCalcPets(), getHubNavData('adopt-me')])

  return (
    <main className="relative min-h-screen bg-[#0C0F0E]">
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: 'Adopt Me', path: '/adopt-me' },
          { name: 'Neon Calculator', path: '/adopt-me/neon-calculator' },
        ])}
      />
      <JsonLd data={faqPage(NEON_FAQ)} />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'Adopt Me Neon Cost Calculator',
          applicationCategory: 'UtilitiesApplication',
          operatingSystem: 'Web',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        }}
      />

      <SabHeroBackdrop height={340}>
        <HubNav data={hubNav} />

        <div className={`mx-auto w-full max-w-3xl px-4 pb-6 sm:px-6 lg:px-8 ${HUB_NAV_CLEAR}`}>
          <div className="text-center">
            <h1 className="text-balance text-[30px] font-bold leading-[1.05] tracking-[-0.02em] text-[#F2F6F0] sm:text-[40px]">
              Adopt Me Neon Cost Calculator
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-pretty text-[15px] leading-7 text-[#98A398] sm:text-[16px]">
              How many pets it takes to make a Neon or Mega — and whether it&apos;s
              cheaper to build one or just buy it. In real money.
            </p>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-3xl px-4 pb-10 sm:px-6 lg:px-8">
          {pets.length === 0 ? (
            <div className="border border-[#1E2723] bg-[#0F1311] px-6 py-12 text-center">
              <h2 className="text-xl font-semibold text-[#F1F3F1]">Temporarily unavailable</h2>
              <p className="mt-2 text-[#9BA8A0]">The pet database could not be loaded. Please check again shortly.</p>
            </div>
          ) : (
            <AdoptMeNeonClient pets={pets} />
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
