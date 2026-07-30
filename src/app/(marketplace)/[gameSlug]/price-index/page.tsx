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

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sabCard } from '@/lib/sab/theme'
import { createClient } from '@/lib/supabase/server'
import { formatCash } from '@/lib/sab/format'
import { JsonLd, breadcrumbList } from '@/lib/seo/jsonld'
import { ContentDisclaimer } from '@/components/content/ContentDisclaimer'
import { SabHeroBackdrop } from '../values/_SabHeroBackdrop'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { getHubNavData, HUB_NAV_CLEAR } from '@/lib/content/hubNav'

export const revalidate = 3600

type TopValue = { slug: string; name: string; rarity: string; priceUsd: number }
type Mover = { slug: string; name: string; from: number; to: number; pct: number }

async function getTopValues(): Promise<TopValue[]> {
  const supabase = await createClient()
  const { data } = await (supabase as any)
    .from('sab_public_price_catalog')
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
  const supabase = await createClient()
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
  if (gameSlug !== 'steal-a-brainrot') return { title: 'Not Found' }
  const monthYear = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const title = `Steal a Brainrot Price Index (${monthYear}) — Top Values & Movers`
  return {
    title,
    description: `The Steal a Brainrot Price Index for ${monthYear}: the most valuable Brainrots and the biggest price movers this week, from live DropMarket marketplace data, updated daily.`,
    alternates: { canonical: '/steal-a-brainrot/price-index' },
    openGraph: { title, type: 'article', url: '/steal-a-brainrot/price-index' },
  }
}

export default async function PriceIndexPage({
  params,
}: {
  params: Promise<{ gameSlug: string }>
}) {
  const { gameSlug } = await params
  if (gameSlug !== 'steal-a-brainrot') notFound()

  const [topValues, movers, hubNav] = await Promise.all([
    getTopValues(),
    getMovers(),
    getHubNavData(gameSlug),
  ])
  const monthYear = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <main className="relative min-h-screen bg-[#0C0F0E]">
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: 'Steal a Brainrot', path: '/steal-a-brainrot' },
          { name: 'Price Index', path: '/steal-a-brainrot/price-index' },
        ])}
      />
      <SabHeroBackdrop>
        <HubNav data={hubNav} />
        {/* pt clears the fixed HubNav. */}
        <div className={`mx-auto w-full max-w-4xl px-4 pb-6 sm:px-6 lg:px-8 ${HUB_NAV_CLEAR}`}>
          <p className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#4FB477]">
            DropMarket value database
          </p>
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-[#F1F3F1] sm:text-[32px]">
            Steal a Brainrot Price Index — {monthYear}
          </h1>
          {/* Answer-first, dated, quotable lead (citation bait). */}
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#C6CEC9]">
            The most valuable Steal a Brainrot pets and the biggest price movers this week, compiled
            from live DropMarket marketplace data as of {today}. As of {today}, the most valuable
            Brainrot is{' '}
            <strong className="font-semibold text-[#F1F3F1]">
              {topValues[0]?.name ?? '—'}
            </strong>{' '}
            at{' '}
            <strong className="font-semibold text-[#F1F3F1]">
              {topValues[0] ? formatCash(topValues[0].priceUsd) : '—'}
            </strong>
            .
          </p>
        </div>
      </SabHeroBackdrop>

      <div className="relative z-10 mx-auto w-full max-w-4xl space-y-6 px-4 sm:px-6 lg:px-8">
        {/* Top values ranking. */}
        <section className={cn(sabCard, 'p-5 sm:p-6')}>
          <h2 className="text-lg font-semibold text-[#F1F3F1]">Most valuable Brainrots</h2>
          <ol className="mt-4 divide-y divide-white/[0.06] border-y border-white/[0.06]">
            {topValues.map((v, i) => (
              <li key={v.slug} className="flex items-center gap-3 py-2.5">
                <span className="w-6 shrink-0 text-[13px] font-bold tabular-nums text-[#6D7A72]">
                  {i + 1}
                </span>
                <Link
                  href={`/steal-a-brainrot/values/${v.slug}`}
                  className="min-w-0 flex-1 truncate text-[14px] font-medium text-[#F1F3F1] hover:text-[#4FB477]"
                >
                  {v.name}
                </Link>
                <span className="shrink-0 text-[11px] uppercase tracking-wide text-[#6D7A72]">
                  {v.rarity}
                </span>
                <span className="shrink-0 font-mono text-[14px] font-semibold tabular-nums text-[#4FB477]">
                  {formatCash(v.priceUsd)}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* Movers — real once >=2 days of history; graceful note until then. */}
        <section className={cn(sabCard, 'p-5 sm:p-6')}>
          <h2 className="text-lg font-semibold text-[#F1F3F1]">Biggest movers this week</h2>
          {movers.gainers.length === 0 && movers.losers.length === 0 ? (
            <p className="mt-2 text-[13px] leading-relaxed text-[#9BA8A0]">
              Weekly price movements appear here once the index has collected at least two days of
              history (currently {movers.days} day{movers.days === 1 ? '' : 's'}). Prices are captured
              daily — check back soon.
            </p>
          ) : (
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <MoverList title="Top gainers" icon="up" moves={movers.gainers} />
              <MoverList title="Top losers" icon="down" moves={movers.losers} />
            </div>
          )}
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/steal-a-brainrot/values"
            className="inline-flex items-center gap-2 bg-[#1B6B3F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1f7a48]"
          >
            See the full value list
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/steal-a-brainrot/values/methodology"
            className="inline-flex items-center gap-2 border border-[#26332C] bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-[#F1F3F1] transition hover:border-[#2A3A31] hover:bg-white/[0.06]"
          >
            How these values are calculated
            <ArrowRight className="h-4 w-4" />
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
  const Icon = icon === 'up' ? TrendingUp : TrendingDown
  const color = icon === 'up' ? 'text-[#4FB477]' : 'text-[#E06B6B]'
  return (
    <div>
      <h3 className={cn('flex items-center gap-1.5 text-[13px] font-semibold', color)}>
        <Icon className="h-4 w-4" />
        {title}
      </h3>
      <ul className="mt-2 space-y-1.5">
        {moves.length === 0 ? (
          <li className="text-[13px] text-[#6D7A72]">None this week.</li>
        ) : (
          moves.map((m) => (
            <li key={m.slug} className="flex items-center justify-between gap-3">
              <Link
                href={`/steal-a-brainrot/values/${m.slug}`}
                className="min-w-0 truncate text-[13.5px] text-[#F1F3F1] hover:text-[#4FB477]"
              >
                {m.name}
              </Link>
              <span className={cn('shrink-0 font-mono text-[13px] font-semibold tabular-nums', color)}>
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
