import Link from '@/components/navigation/AppLink'
import { IconTrendingDown, IconTrendingUp } from '@tabler/icons-react'
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'
import type { MoverRow, PriceMovesModel } from '../types'
import { SectionHeading } from './SectionHeading'
import { pictureUrl } from '@/lib/images/picture-url'

/**
 * Biggest Price Moves This Week: two lists on the marketplace fill (10px,
 * fill only), hairline rows, each linking to the item's value page; a row
 * lightens in place on hover. The full picture stays on the value list.
 */
function Row({ row, up }: { row: MoverRow; up: boolean }) {
  const Icon = up ? IconTrendingUp : IconTrendingDown
  const body = (
    <>
      <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md bg-white/[0.04]">
        {row.imageUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={pictureUrl(row.imageUrl, 'thumb')} alt="" width={36} height={36} loading="lazy" decoding="async" className="h-9 w-9 object-contain" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-text-primary" style={{ fontSize: 'var(--fs-card-title)', fontWeight: 500 }}>
          {row.name}
        </span>
        {row.label && (
          <span className="block text-text-tertiary" style={{ fontSize: 'var(--fs-meta)' }}>
            {row.label}
          </span>
        )}
      </span>
      <span className={cn('inline-flex items-center gap-1 font-semibold tabular-nums', up ? 'text-success' : 'text-error')} style={{ fontSize: 'var(--fs-card-title)' }}>
        <Icon size={16} stroke={2} aria-hidden />
        {up ? '+' : ''}
        {row.pct.toFixed(1)}%
      </span>
    </>
  )
  const cls = 'flex items-center gap-3 px-4 py-3'
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
  const Icon = up ? IconTrendingUp : IconTrendingDown
  return (
    <div className={cn('overflow-hidden rounded-lg', MARKET_CARD)}>
      <div className={cn('flex items-center gap-2 px-4 pb-2 pt-4 font-semibold', up ? 'text-success' : 'text-error')} style={{ fontSize: 'var(--fs-meta)' }}>
        <Icon size={16} stroke={2} aria-hidden />
        {title}
      </div>
      {rows.length > 0 ? (
        <ul>
          {rows.map((r) => (
            <Row key={r.slug} row={r} up={up} />
          ))}
        </ul>
      ) : (
        <p className="px-4 pb-4 pt-2 text-text-secondary" style={{ fontSize: 'var(--fs-meta)' }}>
          No big moves this week.
        </p>
      )}
    </div>
  )
}

export function PriceMoves({ model }: { model: PriceMovesModel }) {
  return (
    <section aria-labelledby="price-moves">
      <SectionHeading id="price-moves" title={model.title} sub={model.updatedLabel} action={{ href: model.listHref, label: 'Full Value List' }} />
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <List title="Rising" rows={model.rising} up />
        <List title="Falling" rows={model.falling} up={false} />
      </div>
    </section>
  )
}
