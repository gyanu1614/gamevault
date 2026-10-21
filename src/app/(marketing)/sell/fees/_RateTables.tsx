import { InfoIcon } from '@phosphor-icons/react/dist/ssr/Info'
import Link from '@/components/navigation/AppLink'
import { ValueCallout } from '@/components/values/ValueCallout'
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'
import { IconTile, InfoTable, INFO_TONE } from '@/components/info'
import type { PublicFeeSchedule } from '@/lib/fees/public-rates'
import { titleCaseValue } from '@/lib/values/title-case'
import { categoryIcon, fmtDate, pct } from './_fees-content'

const RATE = { color: INFO_TONE.green.hue }

/**
 * Commission by category: the first <table> on the page (fee-copy.guard
 * reads it: head ['Category', 'Rate'], or 'Rate now' + 'From <date>' while a
 * dated change moves a listed rate). Cells carry text only; icons are hidden.
 */
export function CategoryTable({ s }: { s: PublicFeeSchedule }) {
  const hasNext = s.nextChange != null && s.categories.some((c) => c.nextPct != null)
  return (
    <InfoTable
      caption="Commission by category"
      columns={[
        { key: 'category', label: 'Category' },
        { key: 'rate', label: hasNext ? 'Rate now' : 'Rate', align: 'right' },
        ...(hasNext ? [{ key: 'next', label: `From ${fmtDate(s.nextChange!)}`, align: 'right' as const }] : []),
      ]}
      rows={s.categories.map((c) => ({
        key: c.type,
        cells: [
          <span key="c" className="flex items-center gap-3 font-medium">
            <IconTile icon={categoryIcon(c.type)} tone="green" size="sm" />
            {titleCaseValue(c.label)}
          </span>,
          <span key="r" className="text-body font-bold tabular-nums" style={RATE}>
            {c.pct == null ? '-' : pct(c.pct)}
          </span>,
          ...(hasNext ? [c.nextPct == null ? 'unchanged' : pct(c.nextPct)] : []),
        ],
      }))}
    />
  )
}

/**
 * Per-game rates: the second <table> (head ['Game', 'Category', 'Rate',
 * 'Type'], or with 'Rate now' + 'From <date>'). The game links to its
 * category page, where the rate applies.
 */
export function PerGameTable({ s }: { s: PublicFeeSchedule }) {
  const hasNext = s.nextChange != null && s.overrides.some((o) => o.nextPct != null)
  if (s.overrides.length === 0) {
    return <p className="text-body-sm text-text-tertiary">No per-game rates are in force right now.</p>
  }
  return (
    <InfoTable
      caption="Per-game commission rates"
      columns={[
        { key: 'game', label: 'Game' },
        { key: 'category', label: 'Category' },
        { key: 'rate', label: hasNext ? 'Rate now' : 'Rate', align: 'right' },
        ...(hasNext ? [{ key: 'next', label: `From ${fmtDate(s.nextChange!)}`, align: 'right' as const }] : []),
        // Phones: three columns fit; the promotions are listed beside the table instead.
        { key: 'type', label: 'Type', align: 'right', hideBelow: 'sm' },
      ]}
      rows={s.overrides.map((o) => ({
        key: `${o.gameSlug}/${o.categorySlug}`,
        cells: [
          <Link key="g" href={`/${o.gameSlug}/${o.categorySlug}`} className="font-medium underline-offset-4 hover:underline">
            {o.gameName}
          </Link>,
          <span key="c" className="flex items-center gap-2.5 text-text-secondary">
            <span className="hidden sm:inline-flex">
              <IconTile icon={categoryIcon(o.type)} size="sm" />
            </span>
            {o.categoryName}
          </span>,
          <span key="r" className="font-bold tabular-nums" style={RATE}>
            {pct(o.pct)}
          </span>,
          ...(hasNext ? [o.nextPct == null ? 'unchanged' : pct(o.nextPct)] : []),
          o.kind === 'promo' ? (
            <span key="t" style={{ color: INFO_TONE.amber.hue }}>
              {`Promotion until ${o.endsAt ? fmtDate(o.endsAt) : 'further notice'}`}
            </span>
          ) : (
            <span key="t" className="text-text-tertiary">
              Standard
            </span>
          ),
        ],
      }))}
    />
  )
}

/**
 * Beside the per-game table (sticky on desktop): how many games carry their
 * own rate and how many promotions are running, both counted from the
 * schedule, and the rule for everything not listed.
 */
export function PerGameAside({ s }: { s: PublicFeeSchedule }) {
  const promos = s.overrides.filter((o) => o.kind === 'promo').length
  const games = new Set(s.overrides.map((o) => o.gameSlug)).size
  return (
    <aside aria-labelledby="per-game-summary" className={cn('rounded-lg p-5 sm:p-6 lg:sticky lg:top-[calc(var(--navbar-bottom)+24px)]', MARKET_CARD)}>
      <h3 id="per-game-summary" className="text-body-lg font-semibold text-text-primary">
        At a Glance
      </h3>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-md bg-white/[0.035] p-3.5">
          <dt className="text-caption text-text-tertiary">Games With Own Rate</dt>
          <dd className="mt-1 text-heading font-bold tabular-nums" style={{ color: INFO_TONE.blue.hue }}>
            {games}
          </dd>
        </div>
        <div className="rounded-md bg-white/[0.035] p-3.5">
          <dt className="text-caption text-text-tertiary">Promotions Running</dt>
          <dd className="mt-1 text-heading font-bold tabular-nums" style={{ color: INFO_TONE.amber.hue }}>
            {promos}
          </dd>
        </div>
      </dl>
      {promos > 0 && (
        <ul className="mt-3 space-y-1.5">
          {s.overrides
            .filter((o) => o.kind === 'promo')
            .map((o) => (
              <li key={`${o.gameSlug}/${o.categorySlug}`} className="text-body-sm text-text-secondary">
                <span className="font-semibold text-text-primary">{`${o.gameName} ${o.categoryName}`}</span>
                {` at ${pct(o.pct)} until ${o.endsAt ? fmtDate(o.endsAt) : 'further notice'}`}
              </li>
            ))}
        </ul>
      )}
      <div className="mt-4">
        <ValueCallout tone="blue" icon={InfoIcon} title="Not listed?">
          Your game uses the category rate above.
        </ValueCallout>
      </div>
    </aside>
  )
}
