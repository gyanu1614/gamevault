'use client'

/**
 * Privacy & Data and INFORM Disclosure as Settings tabs (owner, 2026-09-28:
 * they left the account sidebar and live in Settings with Profile, Seller,
 * Payouts, Notifications and Security). Each loads its data through the same
 * server action its old page used and renders the same screen, embedded.
 */

import { useQuery } from '@tanstack/react-query'
import { getMyGdprRequests } from '@/lib/actions/gdpr'
import { getMyInformStatus } from '@/lib/actions/inform-act'
import PrivacyClient from '../privacy/PrivacyClient'
import InformDisclosureClient from '../inform-disclosure/InformDisclosureClient'

function TabSkeleton() {
  return (
    <div className="space-y-4" aria-busy>
      {[0, 1].map((i) => (
        <div key={i} className="overflow-hidden rounded-lg bg-bg-raised">
          <div className="p-5 sm:p-6">
            <div className="skeleton h-4 w-36 rounded" />
            <div className="skeleton mt-2 h-3.5 w-80 max-w-full rounded" />
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] bg-black/[0.14] px-5 py-3 sm:px-6">
            <div className="skeleton h-3.5 w-56 max-w-[55%] rounded" />
            <div className="skeleton h-10 w-32 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function PrivacyTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'gdpr-requests'],
    queryFn: () => getMyGdprRequests(),
  })
  if (isLoading) return <TabSkeleton />
  return <PrivacyClient embedded requests={data?.success ? data.requests ?? [] : []} />
}

export function InformTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'inform-status'],
    queryFn: () => getMyInformStatus(),
  })
  if (isLoading) return <TabSkeleton />
  return (
    <InformDisclosureClient
      embedded
      status={data?.status ?? 'not_required'}
      disclosure={data?.disclosure ?? null}
      required={data?.required ?? false}
      salesThreshold={data?.salesThreshold ?? 200}
      revenueThreshold={data?.revenueThreshold ?? 5000}
    />
  )
}
