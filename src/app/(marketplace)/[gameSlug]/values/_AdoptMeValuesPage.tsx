import { JsonLd, breadcrumbList } from '@/lib/seo/jsonld'
import { SITE_URL } from '@/config/site'
import { SabHeroBackdrop } from './_SabHeroBackdrop'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { getHubNavData, HUB_NAV_CLEAR } from '@/lib/content/hubNav'
import AdoptMeValuesClient from './_AdoptMeValuesClient'
import { getAdoptMePets } from './_adoptMeData'
import { HubBuyCta } from '@/components/content/HubBuyCta'

/**
 * /adopt-me/values — the Adopt Me pillar page. Kept as its own component so the
 * SAB values page stays untouched; the shared route delegates here for
 * gameSlug === 'adopt-me'. Same hub chrome (nav, backdrop, footer), Adopt-Me
 * data + client.
 */
export default async function AdoptMeValuesPage() {
  const [pets, hubNav] = await Promise.all([
    getAdoptMePets(),
    getHubNavData('adopt-me'),
  ])

  return (
    <main className="relative min-h-screen bg-[#0C0F0E]">
      <SabHeroBackdrop>
        <HubNav data={hubNav} />
        <JsonLd
          data={breadcrumbList([
            { name: 'Home', path: '/' },
            { name: 'Adopt Me', path: '/adopt-me' },
            { name: 'Values', path: '/adopt-me/values' },
          ])}
        />
        {/* ItemList — helps Google read this as a ranked list of pet value
            pages. Only pets that HAVE a page are listed (others aren't crawlable
            targets), ordered by their top trade value. */}
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Adopt Me Pet Value List',
            itemListElement: pets
              .filter((p) => p.hasPage)
              .sort((a, b) => b.topTradeValue - a.topTradeValue)
              .slice(0, 50)
              .map((p, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                url: `${SITE_URL}/adopt-me/values/${p.slug}`,
                name: p.name,
              })),
          }}
        />

        <section>
          <div className={`mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-8 ${HUB_NAV_CLEAR}`}>
            <div className="flex flex-col items-center text-center">
              <h1 className="text-balance text-[32px] font-bold leading-[1.04] tracking-[-0.03em] text-[#F2F6F0] sm:text-[42px] lg:text-[54px]">
                Adopt Me Value List
              </h1>
              <p className="mx-auto mt-4 max-w-3xl text-pretty text-[15px] leading-7 text-[#98A398] sm:text-[17px]">
                What every pet is worth — in community trade value and in real
                money. Pick a variant to reprice the whole list; Fly Ride is the
                trading benchmark.
              </p>
            </div>
          </div>
        </section>

        {/* The list MUST live inside SabHeroBackdrop: the backdrop is an
            absolutely-positioned band and only its `relative z-10` children
            stack above it. A section placed after </SabHeroBackdrop> fell under
            the band's dark overlay, hiding the variant selector and search. */}
        <section className="mx-auto w-full max-w-7xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
          {pets.length === 0 ? (
            <div className="border border-[#2E2338] bg-[#120E15] px-6 py-12 text-center">
              <h2 className="text-xl font-semibold text-[#F1F3F1]">
                Values are temporarily unavailable
              </h2>
              <p className="mt-2 text-[#9BA8A0]">
                The Adopt Me pet database could not be loaded. Please check again
                shortly.
              </p>
            </div>
          ) : (
            <AdoptMeValuesClient pets={pets} />
          )}

          {/* Shared end-of-page CTA with the per-game background hero. */}
          <HubBuyCta gameName="Adopt Me" gameSlug="adopt-me" buyHref="/adopt-me/buy-items" />
        </section>
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
