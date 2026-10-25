'use client'

/**
 * One row per listing: its title, what the seller picked, what the title
 * says, and one button to switch the pick. "Fix All Clear Cases" switches
 * every row (each one names exactly one variant; unclear titles never show).
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from '@/components/navigation/AppLink'
import { ArrowsLeftRight } from '@phosphor-icons/react/dist/ssr/ArrowsLeftRight'
import { AdminEmpty, AdminPagination, PageHeader, adminBtnSm } from '../../components/kit'
import { fixAllVariantMismatches, fixVariantMismatch, type VariantMismatchView } from '@/lib/actions/admin-variant-mismatches'

interface Props {
  rows: VariantMismatchView[]
  total: number
  page: number
  pageSize: number
  error: string | null
}

const fixedNote = (n: number) => `Fixed ${n} listing${n === 1 ? '' : 's'}`

export default function VariantMismatchesClient({ rows, total, page, pageSize, error }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const fixOne = (id: string) => {
    setBusy(id)
    start(async () => {
      const r = await fixVariantMismatch(id)
      setBusy(null)
      if (!r.success) return void toast.error(r.error)
      toast.success(r.data.fixed > 0 ? fixedNote(r.data.fixed) : 'Already changed. Nothing to fix.')
      router.refresh()
    })
  }

  const fixAll = () => {
    if (!confirm(`Switch the Trait pick on all ${total} listings to what their titles say?`)) return
    setBusy('all')
    start(async () => {
      const r = await fixAllVariantMismatches()
      setBusy(null)
      if (!r.success) return void toast.error(r.error)
      toast.success(r.data.remaining > 0 ? `${fixedNote(r.data.fixed)}. ${r.data.remaining} left, press again.` : fixedNote(r.data.fixed))
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Variant Mismatches"
        description="Adopt Me listings whose title names a different variant than the seller picked. The site shows the pick until you switch it."
        actions={
          total > 0 && (
            <button type="button" onClick={fixAll} disabled={pending} className={adminBtnSm.primary}>
              {busy === 'all' ? 'Fixing…' : `Fix All Clear Cases (${total})`}
            </button>
          )
        }
      />
      {error && <p className="text-[13px] text-error">{error}</p>}
      {rows.length === 0 ? (
        !error && <AdminEmpty icon={ArrowsLeftRight} title="No mismatches" hint="Every Adopt Me listing's Trait pick agrees with its title." />
      ) : (
        <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-lg border border-white/[0.06] bg-bg-raised">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                {r.sellerId ? (
                  <Link href={`/admin/active-sellers/${r.sellerId}`} className="block truncate text-[14px] font-semibold text-text-primary hover:underline">
                    {r.title}
                  </Link>
                ) : (
                  <p className="truncate text-[14px] font-semibold text-text-primary">{r.title}</p>
                )}
                <p className="mt-0.5 text-[12.5px] text-text-tertiary">
                  Picked <span className="font-medium text-text-secondary">{r.pickedLabel ?? 'a removed choice'}</span> · title says{' '}
                  <span className="font-medium text-warning">{r.titleSays}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => fixOne(r.id)}
                disabled={pending}
                className={`${adminBtnSm.secondary} shrink-0 self-start sm:self-auto`}
              >
                {busy === r.id ? 'Switching…' : `Switch to ${r.switchTo.label}`}
              </button>
            </li>
          ))}
        </ul>
      )}
      <AdminPagination
        page={page}
        totalPages={Math.ceil(total / pageSize)}
        total={total}
        limit={pageSize}
        noun="listings"
        onPage={(n) => router.push(n > 1 ? `/admin/variant-mismatches?page=${n}` : '/admin/variant-mismatches')}
      />
    </div>
  )
}
