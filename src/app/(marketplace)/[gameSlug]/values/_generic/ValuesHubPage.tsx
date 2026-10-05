import { JsonLd, breadcrumbList, itemList } from '@/lib/seo/jsonld'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { HubHero } from '@/components/content/HubHero'
import { HubBuyCta } from '@/components/content/HubBuyCta'
import { getHubNavData } from '@/lib/content/hubNav'
import { getGameContentTheme } from '@/lib/content/theme'
import { HUB_GROUND } from '@/components/values/styles'
import { PriceStatPair, RarityLabel, ValueCard } from '@/components/values/ValueCard'
import { rarityMeta } from '@/lib/values/rarity'
import { ValuesFreshnessBadge } from '@/components/content/ValuesFreshnessBadge'
import { getValueItems, getValuesFreshness, type ValueItem } from '@/lib/values/data'

/**
 * Generic values hub for any game on the values_* pipeline.
 *
 * Renders through the SHARED hub components (HubNav / HubHero / HubFooter /
 * HubBuyCta) and the per-game content config, so a game on this pipeline gets
 * the same chrome and styling as SAB and Adopt Me with its own data. There are
 * no per-game components here.
 *
 * Section order is driven by where the money is, not by taxonomy tidiness:
 * accounts first (the commercial half — 27% of live Steal An Egg listings and
 * the only four-figure-volume segment), then eggs/areas, then the pet
 * catalogue, which is unpriced by design.
 */

const usd = (v: number) =>
  v < 1 ? `$${v.toFixed(2)}` : v.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

function formatIncome(perSec: number): string {
  const units: Array<[number, string]> = [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ]
  for (const [size, suffix] of units) {
    if (perSec >= size) {
      const n = perSec / size
      return `${n >= 10 ? Math.round(n) : n.toFixed(1)}${suffix}/s`
    }
  }
  return `${perSec}/s`
}

/**
 * One item on the SHARED ValueCard (same card as SAB + Adopt Me; only the
 * values differ): area + rarity header → art + name (income as the sub line)
 * → Cheapest / Average footer, "No Price Yet" when nothing is published.
 */
function ItemCard({ item, gameSlug }: { item: ValueItem; gameSlug: string }) {
  const p = item.price
  const rarity = item.rarity ? rarityMeta(gameSlug, item.rarity) : null
  const priced = p != null && p.cheapestUsd != null
  return (
    <ValueCard
      href={`/${gameSlug}/values/${item.slug}`}
      headerLeft={
        item.area ? (
          <span className="truncate text-[11px] font-medium text-text-tertiary">{item.area}</span>
        ) : undefined
      }
      headerRight={rarity ? <RarityLabel label={rarity.label} color={rarity.color} /> : undefined}
      imageSrc={item.imageUrl}
      imageAlt={item.name}
      name={item.name}
      sub={
        item.incomePerSec != null ? (
          <span className="tabular-nums text-[#7EE0A6]">{formatIncome(item.incomePerSec)}</span>
        ) : undefined
      }
      footer={
        <PriceStatPair
          empty={priced ? null : 'No Price Yet'}
          stats={[
            {
              label: 'Cheapest',
              value: p?.cheapestUsd != null ? usd(p.cheapestUsd) : null,
              sub: p?.sampleSize ? `${p.sampleSize} listings` : undefined,
            },
            { label: 'Average', value: p?.averageUsd != null ? usd(p.averageUsd) : null },
          ]}
        />
      }
    />
  )
}

function Section({
  id,
  title,
  lead,
  items,
  gameSlug,
}: {
  id: string
  title: string
  lead: string
  items: ValueItem[]
  gameSlug: string
}) {
  if (!items.length) return null
  return (
    <section id={id} className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
      <div className="mb-4">
        <h2 className="text-[20px] font-semibold tracking-tight text-text-primary sm:text-[24px]">
          {title}
        </h2>
        <p className="mt-1.5 max-w-3xl text-[14px] leading-relaxed text-text-secondary">
          {lead}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} gameSlug={gameSlug} />
        ))}
      </div>
    </section>
  )
}

export default async function ValuesHubPage({ gameSlug }: { gameSlug: string }) {
  const theme = getGameContentTheme(gameSlug)
  const [items, freshness, hubNav] = await Promise.all([
    getValueItems(gameSlug),
    getValuesFreshness(gameSlug),
    getHubNavData(gameSlug),
  ])

  const accounts = items
    .filter((i) => i.kind === 'account_bracket')
    .sort((a, b) => (a.bracketMin ?? 0) - (b.bracketMin ?? 0))
  const areas = items.filter((i) => i.kind === 'area')
  const eggs = items.filter((i) => i.kind === 'egg')
  const pets = items.filter((i) => i.kind === 'pet')

  // Only priced items carry SEO weight; a catalogue page has no value to rank.
  const pricedForSchema = [...accounts, ...areas, ...eggs]
    .filter((i) => i.price?.cheapestUsd != null)
    .sort((a, b) => (b.price!.cheapestUsd ?? 0) - (a.price!.cheapestUsd ?? 0))
    .slice(0, 50)

  return (
    <main className={`relative min-h-screen ${HUB_GROUND}`}>
      <HubNav data={hubNav} />
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: theme.name, path: `/${gameSlug}` },
          { name: 'Values', path: `/${gameSlug}/values` },
        ])}
      />
      {pricedForSchema.length > 0 && (
        <JsonLd
          data={itemList(
            pricedForSchema.map((i) => ({
              name: i.name,
              path: `/${gameSlug}/values/${i.slug}`,
            })),
          )}
        />
      )}

      <HubHero title={theme.heroTitle} lead={theme.heroLead} />

      <div className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <ValuesFreshnessBadge
          lastChangedAt={freshness.lastChangedAt}
          listingCount={freshness.listingCount}
          sourceCount={freshness.sourceCount}
        />
      </div>

      {/* Accounts lead: the commercial half of this market. */}
      <Section
        id="accounts"
        title="Account values by income"
        lead="Accounts are priced by how much income they generate per second. These are the typical prices sellers actually get, by income bracket."
        items={accounts}
        gameSlug={gameSlug}
      />

      <Section
        id="areas"
        title="Egg values by area"
        lead="Eggs are sold sealed and by area — what hatches is random — so this is what a single egg from each area costs."
        items={areas}
        gameSlug={gameSlug}
      />

      <Section
        id="eggs"
        title="Named eggs"
        lead="Eggs that sellers list by name rather than by area."
        items={eggs}
        gameSlug={gameSlug}
      />

      <Section
        id="pets"
        title={`Every ${theme.itemNounPlural === 'Eggs' ? 'pet' : theme.itemNoun.toLowerCase()} and where it comes from`}
        lead="Pets are not sold directly on the marketplaces we track — players hatch them. Each page shows the pet's rarity, area and income, and links to the egg it comes from, which does have a live price."
        items={pets}
        gameSlug={gameSlug}
      />

      <HubBuyCta
        gameName={theme.name}
        gameSlug={gameSlug}
        buyHref={hubNav.itemsHref ?? `/${gameSlug}`}
      />

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
