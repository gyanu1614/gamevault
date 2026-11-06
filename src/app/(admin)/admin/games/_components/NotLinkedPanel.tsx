'use client'

/**
 * Values tab → live listings with no item page: something the catalogue doesn't
 * have, or a title and pick that disagree. Buyers find them under More Listings.
 * Read only: the fix is adding the item (the nightly job then links them).
 */
import { useQuery } from '@tanstack/react-query'
import { Check, Warning } from '@phosphor-icons/react'
import Link from '@/components/navigation/AppLink'
import { getNotLinkedListings } from '@/lib/actions/admin-values'
import { AdminEmpty, AdminLoadingRows, PanelHead, TABLE } from '../../components/kit'

export function NotLinkedPanel({ gameSlug }: { gameSlug: string }) {
  const query = useQuery({ queryKey: ['admin-not-linked', gameSlug], queryFn: () => getNotLinkedListings(gameSlug), staleTime: 60_000 })
  const res = query.data
  const rows = res?.ok ? res.data : null

  return (
    <section className="rounded-lg bg-bg-raised p-4 sm:p-5">
      <PanelHead
        title="Listings With No Item Page"
        subtitle="Live, but not on an item page, so buyers find them under More Listings. Add the item if it's real; the nightly job links them."
      />
      <div className={`mt-4 ${TABLE.wrap}`}>
        {res && !res.ok ? (
          <AdminEmpty icon={Warning} tone="error" title="Couldn't Load Listings" hint={res.error} />
        ) : !rows ? (
          <AdminLoadingRows rows={3} />
        ) : rows.length === 0 ? (
          <AdminEmpty icon={Check} title="Nothing To Review" hint="Every live listing is on an item page." />
        ) : (
          <table className={TABLE.table}>
            <thead>
              <tr>
                <th className={TABLE.th}>Listing</th>
                <th className={TABLE.th}>Seller</th>
                <th className={TABLE.th}>Listed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={TABLE.row}>
                  <td className={TABLE.tdPrimary}>
                    {r.href ? (
                      <Link href={r.href} className="hover:underline">
                        {r.title}
                      </Link>
                    ) : (
                      r.title
                    )}
                  </td>
                  <td className={TABLE.td}>{r.seller ?? '—'}</td>
                  <td className={`${TABLE.td} tabular-nums`}>{new Date(r.listedAt).toISOString().slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
