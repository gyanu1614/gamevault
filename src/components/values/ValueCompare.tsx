import Link from '@/components/navigation/AppLink'
import { CaretRightIcon } from '@phosphor-icons/react/dist/ssr/CaretRight'
import { usd, vsRows, vsVerdict, worthSameSentence, type CompareItem } from '@/lib/values/compare'

/**
 * "How <Item> Compares" — the same section on every value item page (MM2,
 * Adopt Me, Steal a Brainrot): the item against its closest same-tier rival
 * (price, trade value, facts, one verdict line), and the items worth about
 * the same from any tier. Server-rendered: every number and link is in the
 * HTML, and each one points at another value page (internal links).
 * Renders nothing when there is neither a rival nor a near-value pick.
 */
export function ValueCompare({
  item,
  rival,
  worthSame,
  tradeLabel,
  priceLabel,
}: {
  item: CompareItem
  /** The closest same-tier item, or null. */
  rival: CompareItem | null
  /** Up to four items worth about the same, any tier. */
  worthSame: CompareItem[]
  /** How a trade value reads ("28"), for games with trade points. */
  tradeLabel?: (points: number) => string
  /** The price row's label ("Fly Ride Price" on Adopt Me); "Price" by default. */
  priceLabel?: string
}) {
  if (!rival && worthSame.length === 0) return null
  const rows = rival ? vsRows(item, rival, tradeLabel, priceLabel) : []
  const verdict = rival ? vsVerdict(item, rival) : null
  const sentence = worthSameSentence(item.name, worthSame)

  return (
    <section aria-labelledby="compare-title">
      <h2 id="compare-title" className="text-heading font-bold tracking-tight text-text-primary">
        How {item.name} Compares
      </h2>
      <div className={rival && worthSame.length ? 'mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]' : 'mt-5'}>
        {rival && (
          <div className="overflow-hidden rounded-[8px] bg-[#1D1E23]">
            <table className="w-full table-fixed text-body-sm">
              <caption className="sr-only">
                {item.name} vs {rival.name}
              </caption>
              <thead>
                <tr className="text-left text-caption text-text-tertiary">
                  <th scope="col" className="w-[30%] px-5 py-3 font-medium">
                    <span className="sr-only">Fact</span>
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold text-text-primary">
                    <span className="block truncate">{item.name}</span>
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">
                    <Link
                      href={rival.href}
                      className="group inline-flex max-w-full items-center justify-end gap-1 rounded-sm text-text-primary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    >
                      <span className="truncate">{rival.name}</span>
                      <CaretRightIcon aria-hidden size={12} weight="bold" className="shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-t border-white/[0.07]">
                    <th scope="row" className="px-5 py-2.5 text-left font-normal text-text-secondary">
                      {r.label}
                    </th>
                    <td className="truncate px-3 py-2.5 text-right font-semibold tabular-nums text-text-primary">{r.a}</td>
                    <td className="truncate px-5 py-2.5 text-right tabular-nums text-text-secondary">{r.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {verdict && <p className="border-t border-white/[0.07] px-5 py-3 text-body-sm leading-6 text-text-secondary">{verdict}</p>}
          </div>
        )}

        {worthSame.length > 0 && (
          <div className="rounded-[8px] bg-[#1D1E23] p-5">
            <h3 className="text-[16px] font-semibold text-text-primary">Worth About the Same</h3>
            {sentence && <p className="mt-1.5 text-body-sm leading-6 text-text-secondary">{sentence}</p>}
            <ul className="mt-3">
              {worthSame.map((w) => (
                <li key={w.key} className="border-t border-white/[0.07] first:border-t-0">
                  <Link
                    href={w.href}
                    className="group flex items-center gap-3 rounded-sm py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white/[0.04]">
                      {w.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element -- catalogue art, served as-is
                        <img src={w.imageUrl} alt="" loading="lazy" decoding="async" className="h-7 w-7 object-contain" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-body-sm font-medium text-text-primary group-hover:text-white">{w.name}</span>
                    <span className="shrink-0 text-right text-body-sm font-semibold tabular-nums text-[#54DDBE]">
                      {w.priceUsd != null ? usd(w.priceUsd) : '—'}
                    </span>
                    <CaretRightIcon aria-hidden size={12} weight="bold" className="shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
