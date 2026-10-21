import Link from '@/components/navigation/AppLink'
import { CaretRightIcon } from '@phosphor-icons/react/dist/ssr/CaretRight'
import { MutationDot } from '@/lib/sab/MutationDot'
import { mutationOrder, mutationVisual } from '@/lib/sab/mutations'
import { itemBuyHref, type ItemStock } from '@/lib/value-listings/buy-state'
import type { MutationOption } from './_ItemHero'

const usd = (v: number) =>
  v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })

const compact = (v: number) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v)

const Dash = () => (
  <span className="text-text-tertiary">
    <span aria-hidden>—</span>
    <span className="sr-only">None yet</span>
  </span>
)

/**
 * Every mutation of one brainrot, priced, in one server-rendered table — the
 * Adopt Me variants table for Steal a Brainrot. The hero's picker shows one
 * mutation at a time and only after hydration; this puts every mutation's
 * price and income in the HTML ("rainbow <name> value"), and links each one
 * to its own filtered listings when DropMarket stocks it.
 */
export function SabMutationTable({
  name,
  itemSlug,
  categorySlug,
  mutations,
  stock,
}: {
  name: string
  itemSlug: string
  categorySlug: string
  mutations: MutationOption[]
  stock: ItemStock | null
}) {
  const rows = mutations
    .filter((m) => m.marketValueUsd != null || m.calculatedIncomePerSecond != null)
    .sort((a, b) => mutationOrder(a.slug) - mutationOrder(b.slug))
  if (rows.length < 2) return null

  return (
    <section aria-labelledby="mutation-prices">
      <h2 id="mutation-prices" className="text-heading font-bold tracking-tight text-text-primary">
        {name} Mutation Prices
      </h2>
      <div className="mt-5 overflow-hidden rounded-[8px] bg-[#1D1E23]">
        {/* relative: keeps the cells' sr-only spans inside the scroller on phones. */}
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[480px] text-body-sm">
            <thead>
              <tr className="text-left text-caption text-text-tertiary">
                <th scope="col" className="px-5 py-2 font-medium sm:px-6">Mutation</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Price</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Income</th>
                <th scope="col" className="px-5 py-2 text-right font-medium sm:px-6">On DropMarket</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const variant = m.slug === 'default' ? null : m.slug
                const own = variant ? stock?.byVariant[variant] : stock && stock.total > 0 ? { minPriceUsd: stock.minPriceUsd, count: stock.total } : null
                const price = m.averageUsd ?? m.marketValueUsd
                return (
                  <tr key={m.slug} className="border-t border-white/[0.07]">
                    <th scope="row" className="px-5 py-3 text-left font-semibold text-text-primary sm:px-6">
                      <span className="flex items-center gap-2">
                        <MutationDot visual={mutationVisual(m.slug)} size={8} />
                        {m.name}
                      </span>
                    </th>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-[#54DDBE]">
                      {price != null ? usd(price) : <Dash />}
                      {price != null && m.isEstimated && <span className="ml-1 text-caption font-medium text-text-tertiary">est.</span>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-text-secondary">
                      {m.calculatedIncomePerSecond != null ? `$${compact(m.calculatedIncomePerSecond)}/s` : <Dash />}
                    </td>
                    <td className="px-5 py-3 text-right sm:px-6">
                      {own && own.count > 0 && own.minPriceUsd != null ? (
                        <Link
                          href={itemBuyHref({ gameSlug: 'steal-a-brainrot', categorySlug, itemSlug, variant })}
                          prefetch={false}
                          className="group inline-flex items-center gap-1 rounded-sm font-semibold tabular-nums text-text-primary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                        >
                          From {usd(own.minPriceUsd)}
                          <CaretRightIcon aria-hidden size={12} weight="bold" className="text-text-tertiary transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      ) : (
                        <Dash />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
