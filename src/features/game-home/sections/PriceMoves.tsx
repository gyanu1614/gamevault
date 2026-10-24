import Link from '@/components/navigation/AppLink'
import { TrendDownIcon, TrendUpIcon } from '@phosphor-icons/react/dist/ssr'
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'
import type { MoverRow, PriceMovesModel } from '../types'
import { SectionHeading } from './SectionHeading'

/**
 * Biggest Price Moves This Week (owner liked it in mockup v2): two lists, one
 * surface each with hairline rows (no nested boxes), each row linking to the
 * item's value page. A coloured glow at the top of each list says up / down
 * before the numbers do. The full picture stays on the value list.
 */
function Row({ row, up }: { row: MoverRow; up: boolean }) {
  const body = (
    <>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white/[0.04]">
        {row.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.imageUrl} alt="" width={40} height={40} loading="lazy" decoding="async" className="h-10 w-10 object-contain" />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-text-primary">{row.name}</span>
        {row.label && <span className="block text-[12.5px] text-text-tertiary">{row.label}</span>}
      </span>
      <span className={cn('inline-flex items-center gap-1 text-[15px] font-bold tabular-nums', up ? 'text-[#4ADE80]' : 'text-[#F97066]')}>
        {up ? <TrendUpIcon size={16} weight="bold" aria-hidden /> : <TrendDownIcon size={16} weight="bold" aria-hidden />}
        {up ? '+' : ''}
        {row.pct.toFixed(1)}%
      </span>
    </>
  )
  const cls = 'flex items-center gap-3.5 px-4 py-3 sm:px-5'
  return (
    <li className="border-t border-white/[0.06] first:border-t-0">
      {row.href ? (
        <Link href={row.href} className={cn(cls, 'transition-colors hover:bg-white/[0.03]')}>
          {body}
        </Link>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  )
}

function List({ title, rows, up }: { title: string; rows: MoverRow[]; up: boolean }) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]', MARKET_CARD)}>
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-24',
          up ? 'bg-[radial-gradient(ellipse_at_top,rgba(74,222,128,0.14),transparent_70%)]' : 'bg-[radial-gradient(ellipse_at_top,rgba(249,112,102,0.14),transparent_70%)]',
        )}
      />
      <div className={cn('relative flex items-center gap-2 px-4 pb-2 pt-4 text-[13px] font-bold sm:px-5', up ? 'text-[#4ADE80]' : 'text-[#F97066]')}>
        {up ? <TrendUpIcon size={16} weight="bold" aria-hidden /> : <TrendDownIcon size={16} weight="bold" aria-hidden />}
        {title}
      </div>
      {rows.length > 0 ? (
        <ul className="relative">
          {rows.map((r) => (
            <Row key={r.slug} row={r} up={up} />
          ))}
        </ul>
      ) : (
        <p className="relative px-5 pb-5 pt-2 text-[14px] text-text-secondary">No big moves this week.</p>
      )}
    </div>
  )
}

export function PriceMoves({ model }: { model: PriceMovesModel }) {
  return (
    <section aria-labelledby="price-moves" className="mt-20 sm:mt-28">
      <SectionHeading id="price-moves" title={model.title} sub={model.updatedLabel} action={{ href: model.listHref, label: 'Full Value List' }} />
      <div className="grid gap-4 md:grid-cols-2">
        <List title="Rising" rows={model.rising} up />
        <List title="Falling" rows={model.falling} up={false} />
      </div>
    </section>
  )
}
