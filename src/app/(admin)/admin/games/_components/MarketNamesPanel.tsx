'use client'

/**
 * Values tab → Eldorado names: what the match log needs a person for.
 * Automatic matches (a near-identical spelling the price job paired with an
 * item) can be confirmed or rejected; unmatched names that still have
 * listings can be linked to one of their suggested items or rejected.
 * Decisions apply from the next daily price run.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, LinkSimple, Warning, X } from '@phosphor-icons/react'
import { decideMarketNameAction, getMarketNameReview } from '@/lib/actions/admin-values'
import { slugLabel, type MarketNameDecision, type MarketNameRow } from '@/lib/values/market-names'
import { AdminEmpty, AdminLoadingRows, PanelHead, StatusBadge, TABLE, adminBtnSm } from '../../components/kit'

export function MarketNamesPanel({ gameSlug }: { gameSlug: string }) {
  const qc = useQueryClient()
  const key = ['admin-market-names', gameSlug]
  const query = useQuery({ queryKey: key, queryFn: () => getMarketNameReview(gameSlug), staleTime: 60_000 })
  const decide = useMutation({
    mutationFn: ({ marketName, decision }: { marketName: string; decision: MarketNameDecision }) => decideMarketNameAction(gameSlug, marketName, decision),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })
  const res = query.data
  const rows = res?.ok ? res.data : null
  const failed = decide.data && !decide.data.ok ? decide.data.error : null

  return (
    <section className="rounded-lg bg-bg-raised p-4 sm:p-5">
      <PanelHead
        title="Names On Eldorado"
        subtitle="Listings whose name didn't match an item exactly. Close spellings are matched for you; confirm or reject them, and link the rest. Applies from the next daily price run."
      />
      {failed && <p className="mt-3 text-[13px] text-error">{failed}</p>}
      <div className={`mt-4 ${TABLE.wrap}`}>
        {res && !res.ok ? (
          <AdminEmpty icon={Warning} tone="error" title="Couldn't Load Names" hint={res.error} />
        ) : !rows ? (
          <AdminLoadingRows rows={4} />
        ) : rows.length === 0 ? (
          <AdminEmpty icon={Check} title="Nothing To Review" hint="Every Eldorado name with listings matches an item." />
        ) : (
          <table className={TABLE.table}>
            <thead>
              <tr>
                <th className={TABLE.th}>Name On Eldorado</th>
                <th className={TABLE.th}>Listings</th>
                <th className={TABLE.th}>Our Item</th>
                <th className={TABLE.th}>
                  <span className="sr-only">Decide</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <NameRow key={r.marketName} row={r} busy={decide.isPending} onDecide={(decision) => decide.mutate({ marketName: r.marketName, decision })} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}

function NameRow({ row, busy, onDecide }: { row: MarketNameRow; busy: boolean; onDecide: (d: MarketNameDecision) => void }) {
  return (
    <tr className={TABLE.row}>
      <td className={TABLE.tdPrimary}>
        <div className="flex min-w-[12rem] items-center gap-2">
          <span className="truncate">{row.label}</span>
          {row.status === 'auto' ? <StatusBadge status="Matched For You" tone="info" /> : <StatusBadge status="No Match" tone="warning" />}
        </div>
      </td>
      <td className={`${TABLE.td} tabular-nums`}>{row.offers.toLocaleString()}</td>
      <td className={TABLE.td}>
        {row.status === 'auto' && row.itemSlug ? (
          <span>
            {slugLabel(row.itemSlug)}
            {row.score != null && <span className="ml-1.5 text-text-tertiary tabular-nums">{Math.round(row.score * 100)}%</span>}
          </span>
        ) : row.suggestions.length ? (
          <div className="flex flex-wrap gap-1.5">
            {row.suggestions.map((s) => (
              <button key={s.slug} type="button" disabled={busy} className={adminBtnSm.secondary} onClick={() => onDecide({ kind: 'link', itemSlug: s.slug })} aria-label={`Link to ${slugLabel(s.slug)}`}>
                <LinkSimple aria-hidden className="h-3.5 w-3.5" weight="bold" />
                {slugLabel(s.slug)}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-text-tertiary">No close item</span>
        )}
      </td>
      <td className={TABLE.td}>
        <div className="flex justify-end gap-1.5">
          {row.status === 'auto' && (
            <button type="button" disabled={busy} className={adminBtnSm.primary} onClick={() => onDecide({ kind: 'confirm' })}>
              <Check aria-hidden className="h-3.5 w-3.5" weight="bold" />
              Confirm
            </button>
          )}
          <button type="button" disabled={busy} className={adminBtnSm.danger} onClick={() => onDecide({ kind: 'reject' })} aria-label={`Reject ${row.label}`}>
            <X aria-hidden className="h-3.5 w-3.5" weight="bold" />
            {row.status === 'auto' ? 'Wrong Item' : 'Not An Item'}
          </button>
        </div>
      </td>
    </tr>
  )
}
