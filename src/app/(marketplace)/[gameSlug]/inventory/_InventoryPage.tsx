import { Suspense, cache, type ComponentType } from 'react'
import type { IconProps } from '@phosphor-icons/react'
import Link from '@/components/navigation/AppLink'
import { CaretRightIcon } from '@phosphor-icons/react/dist/ssr/CaretRight'
import { ChartBarIcon } from '@phosphor-icons/react/dist/ssr/ChartBar'
import { CurrencyDollarIcon } from '@phosphor-icons/react/dist/ssr/CurrencyDollar'
import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/ssr/MagnifyingGlass'
import { ShareNetworkIcon } from '@phosphor-icons/react/dist/ssr/ShareNetwork'
import { StackIcon } from '@phosphor-icons/react/dist/ssr/Stack'
import { JsonLd, breadcrumbList, faqPage, webApplication } from '@/lib/seo/jsonld'
import { GameHeroBackdrop } from '@/components/marketplace/GameHeroBackdrop'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { HubHero } from '@/components/content/HubHero'
import { HubFaqSection } from '@/components/content/HubFaqSection'
import { ValueCallout } from '@/components/values/ValueCallout'
import { ValuesEmptyState } from '@/components/values/ValuesEmptyState'
import { HUB_GROUND, VALUE_LABEL, VALUE_SURFACE, VALUE_SURFACE_LINK } from '@/components/values/styles'
import { getGameContentTheme, hasHubPage } from '@/lib/content/theme'
import { getHubNavData } from '@/lib/content/hubNav'
import { getValueItems } from '@/lib/values/data'
import { valueListHub } from '@/lib/values/hub-config'
import { packCatalogue, type PackedCatalogue } from '@/lib/values/inventory'
import { cn } from '@/lib/utils'
import { HubLeadSkeleton } from '../events/_EventsSkeleton'
import {
  faq as inventoryFaq,
  lead,
  methodLead,
  methodSteps,
  methodTitle,
  pageTitle,
  pricesCallout,
  type CopyCtx,
  type InventoryStats,
  type MethodStep,
} from './_inventoryCopy'
import { InventoryTool } from './_InventoryTool'
import { InventorySkeleton } from './_InventorySkeleton'

/**
 * /[game]/inventory — "MM2 Inventory Value Calculator". The H1 (the search)
 * ships in the first flush; the answer-first lead (live counts) and the body
 * stream behind in-page Suspense boundaries whose skeletons mirror them (no
 * route loading.tsx: it would flush a 200 before a page can 404).
 *
 * The tool itself is a client component fed ONE compact packed catalogue of
 * every priced item (lib/values/inventory). Everything a crawler needs is
 * server text: the lead, the method section (steps + the price definitions)
 * and the FAQ, which is also the FAQPage schema. Every number comes from the
 * tagged values read, so the values-revalidate route refreshes the page with
 * the rest of the hub.
 */

const GREEN = '63,217,134'

/** Rarities whose items make a sensible quick-add (the money tiers). */
const QUICK_ADD_RARITIES = new Set(['Godly', 'Ancient', 'Chroma'])

export function inventoryCopyCtx(gameSlug: string): CopyCtx {
  const theme = getGameContentTheme(gameSlug)
  return { gameName: theme.name, shortName: valueListHub(gameSlug)?.shortName ?? theme.initials }
}

interface InventoryData {
  catalogue: PackedCatalogue
  stats: InventoryStats
  /** Quick-add picks for the empty state: the most listed money-tier items. */
  popular: string[]
}

/** One request's read of the catalogue + prices (shared by metadata, lead and body). */
export const loadInventory = cache(async (gameSlug: string): Promise<InventoryData> => {
  const items = await getValueItems(gameSlug, { kinds: ['item'] })
  const priced = items.filter((i) => i.price?.cheapestUsd != null && i.price.cheapestUsd > 0)
  // The shared prefix of the standard art URLs (…/values-items/<game>/<slug>.webp).
  const std = items.find((i) => i.imageUrl?.endsWith(`/${i.slug}.webp`))
  const imageBase = std ? std.imageUrl!.slice(0, -`${std.slug}.webp`.length) : ''
  const catalogue = packCatalogue(
    priced.map((i) => ({
      slug: i.slug,
      name: i.name,
      rarity: i.rarity,
      imageUrl: i.imageUrl,
      cheapestUsd: i.price!.cheapestUsd,
      marketUsd: i.price!.averageUsd,
    })),
    imageBase,
  )
  const byPrice = [...priced].sort((a, b) => b.price!.cheapestUsd! - a.price!.cheapestUsd!)
  const top = byPrice[0] ?? null
  const popular = priced
    .filter((i) => i.rarity && QUICK_ADD_RARITIES.has(i.rarity) && i.imageUrl)
    .sort((a, b) => b.price!.sampleSize - a.price!.sampleSize || b.price!.cheapestUsd! - a.price!.cheapestUsd!)
    .slice(0, 3)
    .map((i) => i.slug)
  return {
    catalogue,
    popular,
    stats: {
      priced: catalogue.rows.length,
      total: items.length,
      listings: priced.reduce((s, i) => s + (i.price?.sampleSize ?? 0), 0),
      top: top ? { name: top.name, usd: top.price!.cheapestUsd! } : null,
    },
  }
})

export default async function InventoryPage({ gameSlug }: { gameSlug: string }) {
  const theme = getGameContentTheme(gameSlug)
  const hubNav = await getHubNavData(gameSlug)
  const ctx = inventoryCopyCtx(gameSlug)

  return (
    <main className={`relative min-h-screen ${HUB_GROUND}`}>
      <GameHeroBackdrop gameSlug={gameSlug} size="hub">
        <HubNav data={hubNav} />
        <JsonLd
          data={breadcrumbList([
            { name: 'Home', path: '/' },
            { name: theme.name, path: `/${gameSlug}` },
            { name: 'Inventory Value Calculator', path: `/${gameSlug}/inventory` },
          ])}
        />
        <section>
          <HubHero
            title={pageTitle(ctx)}
            lead={
              <Suspense fallback={<HubLeadSkeleton />}>
                <Lead gameSlug={gameSlug} ctx={ctx} />
              </Suspense>
            }
          />
        </section>

        <Suspense fallback={<InventorySkeleton />}>
          <InventoryBody gameSlug={gameSlug} ctx={ctx} sellHref={hubNav.sellHref ?? `/${gameSlug}/sell`} />
        </Suspense>
      </GameHeroBackdrop>

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

async function Lead({ gameSlug, ctx }: { gameSlug: string; ctx: CopyCtx }) {
  const { stats } = await loadInventory(gameSlug)
  if (stats.priced === 0) return null
  const l = lead(ctx, stats)
  return (
    <>
      <strong className="font-semibold text-text-primary">{l.strong}</strong> {l.rest}
    </>
  )
}

const STEP_ICON: Record<MethodStep['icon'], ComponentType<IconProps>> = {
  search: MagnifyingGlassIcon,
  qty: StackIcon,
  total: CurrencyDollarIcon,
  share: ShareNetworkIcon,
}

async function InventoryBody({ gameSlug, ctx, sellHref }: { gameSlug: string; ctx: CopyCtx; sellHref: string }) {
  const { catalogue, stats, popular } = await loadInventory(gameSlug)
  if (stats.priced === 0) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        <ValuesEmptyState
          title="Prices are temporarily unavailable"
          body={`The ${ctx.gameName} price list could not be loaded. Please check again shortly.`}
        />
      </div>
    )
  }

  const hub = valueListHub(gameSlug)
  const qa = inventoryFaq(ctx, stats)
  const l = lead(ctx, stats)
  const m = methodLead(ctx, stats)
  const steps = methodSteps(ctx, stats)

  return (
    <>
      <JsonLd data={faqPage(qa)} />
      <JsonLd
        data={webApplication({
          name: pageTitle(ctx),
          path: `/${gameSlug}/inventory`,
          description: `${l.strong} ${l.rest}`,
        })}
      />

      <div className="mx-auto w-full max-w-7xl space-y-12 px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <InventoryTool
          gameSlug={gameSlug}
          shortName={ctx.shortName}
          catalogue={catalogue}
          popular={popular}
          pageRarities={hub?.pageRarities ?? []}
          sellHref={sellHref}
        />

        {/* How it works — ONE surface: answer-first line, steps in one row, one callout. */}
        <section aria-labelledby="inventory-method" className={cn(VALUE_SURFACE, 'relative isolate overflow-hidden')}>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{ background: `radial-gradient(50% 60% at 100% 0%, rgba(${GREEN},0.07) 0%, transparent 70%)` }}
          />
          <div className="p-5 sm:p-8">
            <h2 id="inventory-method" className="text-heading font-bold tracking-tight text-text-primary">
              {methodTitle(ctx)}
            </h2>
            <p className="mt-4 text-body leading-7 text-text-secondary">
              <strong className="font-semibold text-text-primary">{m.strong}</strong> {m.rest}{' '}
              <Link href={`/${gameSlug}/values/methodology`} className="font-medium text-text-primary underline decoration-white/30 underline-offset-2 hover:decoration-white">
                How we price {ctx.shortName} items
              </Link>
              .
            </p>
            <ol className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-white/[0.07] pt-6 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, i) => {
                const Icon = STEP_ICON[step.icon]
                return (
                  <li key={step.title} className="flex items-start gap-3">
                    <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-md" style={{ background: `rgba(${GREEN},0.14)`, color: `rgb(${GREEN})` }}>
                      <Icon size={18} weight="duotone" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold leading-5 text-text-primary">
                        <span className="sr-only">Step {i + 1}: </span>
                        {step.title}
                      </p>
                      <p className="mt-0.5 text-[13px] leading-5 text-text-secondary">{step.value}</p>
                    </div>
                  </li>
                )
              })}
            </ol>
            <ValueCallout tone="blue" icon={ChartBarIcon} title={pricesCallout.title} className="mt-6">
              {pricesCallout.body}
            </ValueCallout>
          </div>
        </section>

        <HubFaqSection
          title="Frequently Asked Questions"
          subtitle={`What your ${ctx.gameName} inventory is worth, and where the prices come from.`}
          items={qa}
        />

        <nav aria-label={`More ${ctx.gameName} guides`} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <CrossLink href={`/${gameSlug}/values`} label="Every Item's Price" title={`${ctx.shortName} Value List`} />
          {hasHubPage(gameSlug, 'chromas') && (
            <CrossLink href={`/${gameSlug}/chromas`} label="Chroma vs Normal Prices" title={`${ctx.shortName} Chroma Values`} />
          )}
          {hasHubPage(gameSlug, 'freeItems') && (
            <CrossLink href={`/${gameSlug}/free-items`} label="Every Real Free Way" title={`Free ${ctx.shortName} Items`} />
          )}
        </nav>
      </div>
    </>
  )
}

function CrossLink({ href, label, title }: { href: string; label: string; title: string }) {
  return (
    <Link
      href={href}
      className={`${VALUE_SURFACE_LINK} group flex items-center justify-between gap-3 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring`}
    >
      <span>
        <span className={`block ${VALUE_LABEL}`}>{label}</span>
        <span className="block text-body-sm font-semibold text-text-primary">{title}</span>
      </span>
      <CaretRightIcon aria-hidden size={20} weight="bold" className="shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-text-primary" />
    </Link>
  )
}
