import Link from '@/components/navigation/AppLink'
import { CaretRightIcon } from '@phosphor-icons/react/dist/ssr/CaretRight'
import { formatTradeValue } from '@/lib/values/trade-points'
import { formatUsd } from './valueListItemCopy'

export interface FormRow {
  key: string
  /** "Standard" / "Chroma". */
  label: string
  name: string
  href: string
  color: string
  current: boolean
  cheapestUsd: number | null
  marketUsd: number | null
  tradePoints: number | null
  offers: number
}

const Dash = () => (
  <span className="text-text-tertiary">
    <span aria-hidden>—</span>
    <span className="sr-only">None yet</span>
  </span>
)

/**
 * Every form of a value-list item side by side (MM2: Standard and Chroma,
 * each its own page and price) — the Adopt Me variants table for one price
 * per form. Server-rendered: every number is in the HTML, and each row links
 * to that form's page.
 */
export function ValueListFormTable({ name, rows }: { name: string; rows: FormRow[] }) {
  return (
    <section aria-labelledby="item-forms">
      <h2 id="item-forms" className="text-heading font-bold tracking-tight text-text-primary">
        {name}: Standard vs Chroma
      </h2>
      <div className="mt-5 overflow-hidden rounded-[8px] bg-[#1D1E23]">
        {/* relative: keeps the cells' sr-only spans inside the scroller on phones. */}
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[520px] text-body-sm">
            <thead>
              <tr className="text-left text-caption text-text-tertiary">
                <th scope="col" className="px-5 py-2 font-medium sm:px-6">Form</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Cheapest</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Market</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Trade Value</th>
                <th scope="col" className="hidden px-5 py-2 text-right font-medium sm:table-cell sm:px-6">Offers Tracked</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.key}
                  className="border-t border-white/[0.07]"
                  style={r.current ? { backgroundColor: `color-mix(in srgb, ${r.color} 10%, transparent)` } : undefined}
                >
                  <td className="px-5 py-3 sm:px-6">
                    {r.current ? (
                      <span className="flex items-center gap-2 font-semibold text-text-primary" aria-current="page">
                        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
                        {r.label}
                        <span className="sr-only">: {r.name} (this page)</span>
                      </span>
                    ) : (
                      <Link
                        href={r.href}
                        className="group inline-flex items-center gap-2 rounded-sm font-semibold text-text-primary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                      >
                        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
                        {r.label}
                        <span className="sr-only">: {r.name}</span>
                        <CaretRightIcon aria-hidden size={12} weight="bold" className="text-text-tertiary transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-[#54DDBE]">
                    {r.cheapestUsd != null ? formatUsd(r.cheapestUsd) : <Dash />}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-text-primary">{r.marketUsd != null ? formatUsd(r.marketUsd) : <Dash />}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-text-primary">
                    {r.tradePoints != null ? formatTradeValue(r.tradePoints) : <Dash />}
                  </td>
                  <td className="hidden px-5 py-3 text-right tabular-nums text-text-secondary sm:table-cell sm:px-6">{r.offers > 0 ? r.offers : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
