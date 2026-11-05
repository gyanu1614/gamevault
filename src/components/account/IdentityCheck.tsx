'use client'

/**
 * A seller's ID check: the Settings card and the withdrawal page's button. The
 * check runs on the provider's page in a new tab. Coming back to this tab re-reads
 * the result, so nothing here needs a manual refresh.
 *
 * Mention verifying only in Settings, the card after a store opens, and withdrawal
 * pages: owner rule, 2026-11-04. Never in the banner, /founding or the listing flow.
 */
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { SettingsCard, accountBtn } from '@/components/account/AccountSurface'
import { VerifiedBadge } from '@/components/seller/VerifiedBadge'
import { startIdentityCheck } from '@/lib/actions/identity-check'
import type { IdentityState } from '@/lib/identity/state'

const QUERY_KEY = ['identity-check'] as const

/** A plain request, not a server action: it can wait on the provider, and actions run one at a time. */
async function fetchIdentityStatus(): Promise<{ state: IdentityState; available: boolean }> {
  const res = await fetch('/api/account/identity-check', { cache: 'no-store' })
  if (!res.ok) throw new Error(`identity status ${res.status}`)
  return res.json()
}

const COPY: Record<IdentityState, { label: string; text: string }> = {
  not_started: { label: 'Not Started', text: 'Have your ID ready. The check opens in a new tab.' },
  in_review: { label: 'In Review', text: 'Your details are being checked. We will let you know the result.' },
  verified: { label: 'Verified', text: 'You can withdraw your balance, and your store shows the blue check.' },
  needs_attention: { label: 'Needs Attention', text: 'The check did not pass. Try again, or contact support@dropmarket.gg.' },
}

function useIdentityCheck() {
  const queryClient = useQueryClient()
  const [starting, setStarting] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchIdentityStatus,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  })

  const start = async () => {
    // Opened at the click: a tab opened after an await is blocked as a pop-up.
    const tab = window.open('', '_blank')
    setStarting(true)
    try {
      const result = await startIdentityCheck()
      if (result.ok) {
        if (tab) tab.location.href = result.url
        else window.location.href = result.url
      } else {
        tab?.close()
        toast.error(result.error)
      }
    } catch {
      tab?.close()
      toast.error('Could not start the check. Try again in a moment.')
    } finally {
      setStarting(false)
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    }
  }

  return { state: data?.state ?? null, available: data?.available ?? false, loading: isLoading, starting, start }
}

function buttonLabel(state: IdentityState | null, starting: boolean): string {
  if (starting) return 'Opening…'
  return state === 'needs_attention' ? 'Try Again' : 'Verify Identity'
}

/** Settings → Seller. */
export function IdentityCheckCard() {
  const { state, available, loading, starting, start } = useIdentityCheck()
  const canStart = available && (state === 'not_started' || state === 'needs_attention')
  return (
    <SettingsCard
      title="Identity Check"
      description="Needed before your first withdrawal."
      footerAction={
        canStart ? (
          <button type="button" onClick={() => void start()} disabled={starting} className={accountBtn.primary}>
            {buttonLabel(state, starting)}
          </button>
        ) : undefined
      }
    >
      {loading || !state ? (
        <div className="skeleton h-11 w-full rounded-md" aria-hidden />
      ) : (
        <div>
          <p className="flex items-center gap-1.5 text-[14px] font-semibold text-text-primary">
            {COPY[state].label}
            {state === 'verified' && <VerifiedBadge size={16} titled={false} />}
          </p>
          <p className="mt-1 text-[13px] text-text-secondary">
            {available || state === 'verified' ? COPY[state].text : 'Identity checks are not open right now. Your balance stays in your wallet.'}
          </p>
        </div>
      )}
    </SettingsCard>
  )
}

/** Withdrawal page, under the message that says the check is needed. */
export function IdentityCheckButton() {
  const { state, available, starting, start } = useIdentityCheck()
  if (!available || !state || state === 'verified') return null
  if (state === 'in_review') {
    return <p className="mt-2 text-[12px] text-text-secondary">{COPY.in_review.text}</p>
  }
  return (
    <button type="button" onClick={() => void start()} disabled={starting} className={`${accountBtn.primary} mt-2 w-full`}>
      {buttonLabel(state, starting)}
    </button>
  )
}
