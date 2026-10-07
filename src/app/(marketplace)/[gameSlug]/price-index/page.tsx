/**
 * /[game]/price-index — the Brainrot Price Index.
 *
 * A citable data-story page (the digital-PR / link-magnet play): ranks the
 * highest-value brainrots right now and, once >=2 days of sab_price_history
 * exist, surfaces the biggest weekly movers. Designed to be the reference the
 * community/press links to — dated, data-rich, "updated daily".
 *
 * SAB-only for now (guarded); generalizes when other games get price history.
 */

import { DEFAULT_OG_IMAGES } from '@/lib/seo/title'
import type { Metadata } from 'next'
import Link from '@/components/navigation/AppLink'
import { notFound } from 'next/navigation'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/ssr/ArrowRight'
import { TrendUpIcon } from '@phosphor-icons/react/dist/ssr/TrendUp'
import { TrendDownIcon } from '@phosphor-icons/react/dist/ssr/TrendDown'
import { cn } from '@/lib/utils'
import { HubSection } from '@/components/values/HubSection'
import { HUB_GROUND, VALUE_BTN_SECONDARY, VALUE_LABEL } from '@/components/values/styles'
import { createValueListReadClient } from '@/lib/values/read-client'
import { formatCash } from '@/lib/sab/format'
import { JsonLd, breadcrumbList } from '@/lib/seo/jsonld'
import { ContentDisclaimer } from '@/components/content/ContentDisclaimer'
import { GameHeroBackdrop } from '@/components/marketplace/GameHeroBackdrop'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { getHubNavData, HUB_NAV_CLEAR } from '@/lib/content/hubNav'
import { contentHubSlugsFor, hasHubPage } from '@/lib/content/theme'

export const revalidate = 3600
/**
 * Closed set: generateStaticParams lists every slug this route serves, so an
 * unknown slug is a static 404 with no function invocation (Step 7a — the
 * crawl of 233 `/{game}/…` hub URLs was rendering an empty page each).
 */
export const dynamicParams = false

/**
 * Prerender the game slug(s) this route serves; every other slug notFound()s
 * below, so there is nothing else to build. Driven by the content config
 * (`pages.priceIndex`) rather than a hardcoded slug — today that resolves to
 * exactly ['steal-a-brainrot'], so the built set is unchanged.
 */
export function generateStaticParams() {
  return contentHubSlugsFor('priceIndex').map((gameSlug) => ({ gameSlug }))
}

type TopValue = { slug: string; name: string; rarity: string; priceUsd: number }
type Mover = { slug: string; name: string; from: number; to: number; pct: number }

async function getTopValues(): Promise<TopValue[]> {
  const supabase = createValueListReadClient('steal-a-brainrot')
  const { data } = await (supabase as any)
    .from('sab_price_display')
    .select('brainrot_slug,brainrot_name,rarity,market_value_usd,mutation_slug')
    .eq('mutation_slug', 'default')
    .order('market_value_usd', { ascending: false })
    .limit(25)
  return ((data ?? []) as any[])
    .filter((r) => r.market_value_usd != null)
    .map((r) => ({
      slug: r.brainrot_slug,
      name: r.brainrot_name,
      rarity: r.rarity,
      priceUsd: Number(r.market_value_usd),
    }))
}

/**
 * Biggest movers over the last ~7 days of history: compare each brainrot's
 * default median on the newest capture date vs the oldest within the window.
 * Returns [] when there's <2 distinct dates (page shows a "collecting" note).
 */
async function getMovers(): Promise<{ gainers: Mover[]; losers: Mover[]; days: number }> {
  const supabase = createValueListReadClient('steal-a-brainrot')
  const { data: mut } = await supabase
    .from('sab_mutations')
    .select('id')
    .eq('slug', 'default')
    .maybeSingle()
  const defaultMutId = (mut as { id: string } | null)?.id
  if (!defaultMutId) return { gainers: [], losers: [], days: 0 }

  const since = new Date()
  since.setDate(since.getDate() - 8)
  const { data: rows } = await (supabase as any)
    .from('sab_price_history')
    .select('brainrot_id,history_date,median_usd')
    .eq('mutation_id', defaultMutId)
    .gte('history_date', since.toISOString().slice(0, 10))
    .order('history_date', { ascending: true })

  const history = (rows ?? []) as { brainrot_id: string; history_date: string; median_usd: number }[]
  const dates = Array.from(new Set(history.map((r) => r.history_date)))
  if (dates.length < 2) return { gainers: [], losers: [], days: dates.length }

  const oldest = dates[0]
  const newest = dates[dates.length - 1]
  const byBrainrot = new Map<string, { first?: number; last?: number }>()
  for (const r of history) {
    const e = byBrainrot.get(r.brainrot_id) ?? {}
    if (r.history_date === oldest) e.first = Number(r.median_usd)
    if (r.history_date === newest) e.last = Number(r.median_usd)
    byBrainrot.set(r.brainrot_id, e)
  }

  // Resolve names for the movers.
  const ids = Array.from(byBrainrot.keys())
  const { data: names } = await supabase
    .from('sab_brainrot_catalog')
    .select('id,name,slug')
    .in('id', ids)
  const nameById = new Map(
    ((names ?? []) as { id: string; name: string; slug: string }[]).map((n) => [n.id, n]),
  )

  const moves: Mover[] = []
  for (const [id, e] of byBrainrot) {
    if (e.first == null || e.last == null || e.first <= 0) continue
    const n = nameById.get(id)
    if (!n) continue
    const pct = ((e.last - e.first) / e.first) * 100
    if (Math.abs(pct) < 1) continue
    moves.push({ slug: n.slug, name: n.name, from: e.first, to: e.last, pct })
  }

  const gainers = moves.filter((m) => m.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 8)
  const losers = moves.filter((m) => m.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, 8)
  return { gainers, losers, days: dates.length }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ gameSlug: string }>
}): Promise<Metadata> {
  const { gameSlug } = await params
  if (!hasHubPage(gameSlug, 'priceIndex')) return { title: 'Not Found' }
  const monthYear = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const title = `Steal a Brainrot Price Index (${monthYear}) — Top Values & Movers`
  return {
    title,
    description: `The Steal a Brainrot Price Index for ${monthYear}: the most valuable Brainrots and the biggest price movers this week, from live DropMarket marketplace data, updated daily.`,
    alternates: { canonical: '/steal-a-brainrot/price-index' },
    openGraph: { images: DEFAULT_OG_IMAGES, title, type: 'article', url: '/steal-a-brainrot/price-index' },
  }
}

export default async function PriceIndexPage({
  params,
}: {
  params: Promise<{ gameSlug: string }>
}) {
  const { gameSlug } = await params
  if (!hasHubPage(gameSlug, 'priceIndex')) notFound()

  const [topValues, movers, hubNav] = await Promise.all([
    getTopValues(),
    getMovers(),
    getHubNavData(gameSlug),
  ])
  const monthYear = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <main className={`relative min-h-screen ${HUB_GROUND}`}>
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: 'Steal a Brainrot', path: '/steal-a-brainrot' },
          { name: 'Price Index', path: '/steal-a-brainrot/price-index' },
        ])}
      />
      <GameHeroBackdrop gameSlug={gameSlug} size="hub">
        <HubNav data={hubNav} />
        {/* pt clears the fixed HubNav. */}
        <div className={`mx-auto w-full max-w-4xl px-4 pb-6 sm:px-6 lg:px-8 ${HUB_NAV_CLEAR}`}>
          <p className={`mb-2 ${VALUE_LABEL}`}>DropMarket Value Database</p>
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-text-primary sm:text-[32px]">
            Steal a Brainrot Price Index — {monthYear}
          </h1>
          {/* Answer-first, dated, quotable lead (citation bait). */}
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
            The most valuable Steal a Brainrot pets and the biggest price movers this week, compiled
            from live DropMarket marketplace data as of {today}. As of {today}, the most valuable
            Brainrot is{' '}
            <strong className="font-semibold text-text-primary">
              {topValues[0]?.name ?? '—'}
            </strong>{' '}
            at{' '}
            <strong className="font-semibold text-text-primary">
              {topValues[0] ? formatCash(topValues[0].priceUsd) : '—'}
            </strong>
            .
          </p>
        </div>
      </GameHeroBackdrop>

      <div className="relative z-10 mx-auto w-full max-w-4xl space-y-6 px-4 sm:px-6 lg:px-8">
        {/* Top values ranking. */}
        <HubSection title="Most valuable Brainrots">
          {/* Hairlines BETWEEN rows only — the card itself has no outline. */}
          <ol className="divide-y divide-white/[0.07]">
            {topValues.map((v, i) => (
              <li key={v.slug} className="flex items-center gap-3 py-2.5">
                <span className="w-6 shrink-0 text-[13px] font-semibold tabular-nums text-text-tertiary">
                  {i + 1}
                </span>
                <Link
                  href={`/steal-a-brainrot/values/${v.slug}`}
                  className="min-w-0 flex-1 truncate text-[14px] font-medium text-text-primary transition-colors hover:text-text-secondary"
                >
                  {v.name}
                </Link>
                <span className="shrink-0 text-[11px] font-medium text-text-tertiary">
                  {v.rarity}
                </span>
                <span className="shrink-0 text-[14px] font-semibold tabular-nums text-lime-text">
                  {formatCash(v.priceUsd)}
                </span>
              </li>
            ))}
          </ol>
        </HubSection>

        {/* Movers — real once >=2 days of history; graceful note until then. */}
        <HubSection title="Biggest movers this week">
          {movers.gainers.length === 0 && movers.losers.length === 0 ? (
            <p className="text-[13px] leading-relaxed text-text-secondary">
              Weekly price movements appear here once the index has collected at least two days of
              history (currently {movers.days} day{movers.days === 1 ? '' : 's'}). Prices are captured
              daily — check back soon.
            </p>
          ) : (
            <div className="grid gap-6 pt-1 sm:grid-cols-2">
              <MoverList title="Top gainers" icon="up" moves={movers.gainers} />
              <MoverList title="Top losers" icon="down" moves={movers.losers} />
            </div>
          )}
        </HubSection>

        <div className="flex flex-wrap gap-3">
          <Link href="/steal-a-brainrot/values" className={VALUE_BTN_SECONDARY}>
            See the full value list
            <ArrowRightIcon size={15} weight="bold" aria-hidden />
          </Link>
          <Link href="/steal-a-brainrot/values/methodology" className={VALUE_BTN_SECONDARY}>
            How these values are calculated
            <ArrowRightIcon size={15} weight="bold" aria-hidden />
          </Link>
        </div>

        <ContentDisclaimer gameName="Steal a Brainrot" gameSlug="steal-a-brainrot" />
      </div>
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

function MoverList({ title, icon, moves }: { title: string; icon: 'up' | 'down'; moves: Mover[] }) {
  const Icon = icon === 'up' ? TrendUpIcon : TrendDownIcon
  const color = icon === 'up' ? 'text-success' : 'text-error'
  return (
    <div>
      <h3 className={cn('flex items-center gap-1.5 text-[13px] font-semibold', color)}>
        <Icon size={16} weight="bold" aria-hidden />
        {title}
      </h3>
      <ul className="mt-2 space-y-1.5">
        {moves.length === 0 ? (
          <li className="text-[13px] text-text-tertiary">None this week.</li>
        ) : (
          moves.map((m) => (
            <li key={m.slug} className="flex items-center justify-between gap-3">
              <Link
                href={`/steal-a-brainrot/values/${m.slug}`}
                className="min-w-0 truncate text-[13.5px] text-text-primary transition-colors hover:text-text-secondary"
              >
                {m.name}
              </Link>
              <span className={cn('shrink-0 text-[13px] font-semibold tabular-nums', color)}>
                {m.pct > 0 ? '+' : ''}
                {m.pct.toFixed(1)}%
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
