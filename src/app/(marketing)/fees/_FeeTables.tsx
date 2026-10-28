import { CaretDownIcon } from '@phosphor-icons/react/dist/ssr/CaretDown'
import { InfoTable } from '@/components/info'
import type { BuyerFeeOverview, MethodFeeExample } from '@/lib/fees/buyer-fee-overview'
import { groupByRegion, pickExampleMethods } from '@/lib/fees/buyer-fee-groups'
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'
import { money, moneyShort } from './_fees-content'

/**
 * The two /fees tables (research 2026-10-23): a worked example (eBay shows
 * the same item as line items) and every method grouped by region, closed
 * by default except the first, with the fee on the same sample item so
 * methods compare at a glance (G2G, Stripe local methods). Each method's
 * terms in words sit under its name: the "how it's worked out" a UK price
 * page must still publish. Server components, no JS.
 */

export function WorkedExample({ o }: { o: BuyerFeeOverview }) {
  const rows = pickExampleMethods(o.methods.filter((m) => m.sample))
  return (
    <InfoTable
      caption={`A ${money(o.subtotalMinor)} item paid three ways`}
      columns={[
        { key: 'method', label: 'Paid with' },
        { key: 'mkt', label: 'Marketplace', align: 'right', hideBelow: 'sm' },
        { key: 'proc', label: 'Processing', align: 'right', hideBelow: 'sm' },
        { key: 'fee', label: 'Service fee', align: 'right' },
        { key: 'total', label: 'You pay', align: 'right' },
      ]}
      rows={rows.map((m) => ({
        key: m.method,
        cells: [
          m.name,
          money(m.sample!.marketplaceMinor),
          money(m.sample!.processingMinor),
          money(m.sample!.serviceFeeMinor),
          <span key="t" className="font-semibold">
            {money(m.sample!.totalMinor)}
          </span>,
        ],
      }))}
      className="max-w-4xl"
    />
  )
}

function MethodCell({ m }: { m: MethodFeeExample }) {
  return (
    <div className="min-w-[12rem]">
      <p className="font-medium text-text-primary">{m.name}</p>
      <p className="mt-0.5 text-caption leading-5 text-text-tertiary">{m.terms}</p>
    </div>
  )
}

export function MethodsByRegion({ o }: { o: BuyerFeeOverview }) {
  const groups = groupByRegion(o.methods)
  return (
    <div className="space-y-3">
      {groups.map((g, i) => (
        <details key={g.id} open={i === 0} className={cn('group rounded-lg', MARKET_CARD)}>
          <summary className="flex min-h-[56px] cursor-pointer list-none items-center gap-3 px-4 text-body font-semibold text-text-primary sm:px-5 [&::-webkit-details-marker]:hidden">
            {g.label}
            <span className="text-body-sm font-normal text-text-tertiary">
              {g.methods.length} {g.methods.length === 1 ? 'method' : 'methods'}
            </span>
            <CaretDownIcon
              size={16}
              weight="bold"
              aria-hidden
              className="ml-auto text-text-tertiary transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <div className="border-t border-white/[0.07]">
            <InfoTable
              caption={`Payment methods in ${g.label}, with the service fee on a ${money(o.subtotalMinor)} item`}
              columns={[
                { key: 'method', label: 'Method' },
                { key: 'where', label: 'Where', hideBelow: 'md' },
                { key: 'fee', label: `Fee on ${moneyShort(o.subtotalMinor)}`, align: 'right' },
                { key: 'refund', label: 'Refund to method', align: 'right', hideBelow: 'sm' },
              ]}
              rows={g.methods.map((m) => ({
                key: m.method,
                cells: [
                  <MethodCell key="m" m={m} />,
                  <span key="w" className="text-text-secondary">
                    {m.coverage ?? 'Worldwide'}
                  </span>,
                  m.sample ? money(m.sample.serviceFeeMinor) : <span key="f" className="text-text-tertiary">Over its limit</span>,
                  <span key="r" className={m.refundable ? 'text-text-primary' : 'text-text-tertiary'}>
                    {m.refundable ? 'Yes' : 'Store credit only'}
                  </span>,
                ],
              }))}
              className="rounded-none bg-none shadow-none"
            />
          </div>
        </details>
      ))}
    </div>
  )
}
