'use client'

/**
 * A seller's ID check: the Settings card, the withdrawal page's block, and the
 * hook the signup prompt shares. The check runs in its own tab (/kyc/start), and
 * coming back to this one re-reads the result, so nothing needs a manual refresh.
 *
 * Mention verifying only in Settings, the small prompt after a store opens, and
 * withdrawal pages (owner, 2026-11-04 and 2026-11-05). Never in the banner, the
 * signup steps or the listing flow.
 *
 * Colour carries meaning (ICON_TILE): trust blue for the badge and the check, green
 * for money and good news, lime for speed, amber when something needs the seller.
 */
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Icon as TileIcon } from '@phosphor-icons/react'
import { HourglassMediumIcon } from '@phosphor-icons/react/dist/csr/HourglassMedium'
import { LightningIcon } from '@phosphor-icons/react/dist/csr/Lightning'
import { SealCheckIcon } from '@phosphor-icons/react/dist/csr/SealCheck'
import { WalletIcon } from '@phosphor-icons/react/dist/csr/Wallet'
import { WarningCircleIcon } from '@phosphor-icons/react/dist/csr/WarningCircle'
import { IconTile, SettingsCard, StatusPill, accountBtn, type IconTileTone } from '@/components/account/AccountSurface'
import { VerifiedBadge } from '@/components/seller/VerifiedBadge'
import type { IdentityState } from '@/lib/identity/state'
import { cn } from '@/lib/utils'

const QUERY_KEY = ['identity-check'] as const

const PILL: Record<IdentityState, { label: string; tone: IconTileTone }> = {
  not_started: { label: 'Not Started', tone: 'neutral' },
  in_review: { label: 'In Review', tone: 'trust' },
  verified: { label: 'Verified', tone: 'money' },
  needs_attention: { label: 'Needs Attention', tone: 'attention' },
}

/** A plain request, not a server action: it can wait on the provider, and actions run one at a time. */
async function fetchIdentityStatus(): Promise<{ state: IdentityState; available: boolean }> {
  const res = await fetch('/api/account/identity-check', { cache: 'no-store' })
  if (!res.ok) throw new Error(`identity status ${res.status}`)
  return res.json()
}

/**
 * Opened at the click, so it is never blocked as a pop-up. The tab starts the check
 * and explains any failure itself, and it can close itself when the check is done
 * because a script opened it.
 */
export function openIdentityCheck() {
  const tab = window.open('/kyc/start', '_blank')
  if (!tab) window.location.href = '/kyc/start'
}

export function useIdentityCheck() {
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchIdentityStatus,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  })
  return { state: data?.state ?? null, available: data?.available ?? false, loading: isLoading }
}

function buttonLabel(state: IdentityState | null): string {
  return state === 'needs_attention' ? 'Try Again' : 'Verify Identity'
}

function FactRow({ icon: Icon, tone, title, children }: {
  icon: TileIcon
  tone: IconTileTone
  title: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <IconTile tone={tone}>
        <Icon size={22} weight="duotone" />
      </IconTile>
      <div className="min-w-0">
        <p className="flex min-w-0 items-center gap-1.5 text-[14px] font-semibold leading-snug text-text-primary">{title}</p>
        <p className="mt-0.5 text-[12.5px] leading-snug text-text-secondary">{children}</p>
      </div>
    </div>
  )
}

function StoreName({ shopName }: { shopName?: string | null }) {
  return (
    <>
      <span className="truncate">{shopName || 'Your Store'}</span>
      <VerifiedBadge size={16} titled={false} />
    </>
  )
}

/** Settings → Seller: its own card, right under Store Availability. */
export function IdentityCheckCard({ shopName }: { shopName?: string | null }) {
  const { state, available, loading } = useIdentityCheck()
  const canStart = available && (state === 'not_started' || state === 'needs_attention')
  const pill = state ? PILL[state] : null

  return (
    <SettingsCard
      title="Identity Verification"
      description={state === 'verified' ? 'Your identity has been verified.' : 'Required before your first withdrawal.'}
      aside={pill ? <StatusPill tone={pill.tone}>{pill.label}</StatusPill> : <span className="skeleton block h-6 w-20 rounded-full" aria-hidden />}
      footerHint={canStart ? 'Have your ID ready. Verification opens in a new tab.' : undefined}
      footerAction={
        canStart ? (
          <button type="button" onClick={openIdentityCheck} className={accountBtn.primary}>
            <SealCheckIcon size={18} weight="duotone" aria-hidden />
            {buttonLabel(state)}
          </button>
        ) : undefined
      }
    >
      {loading || !state ? (
        <div className="grid gap-4 sm:grid-cols-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="skeleton block h-10 w-10 shrink-0 rounded-md" />
              <span className="skeleton block h-9 w-full rounded-md" />
            </div>
          ))}
        </div>
      ) : state === 'verified' ? (
        <FactRow icon={SealCheckIcon} tone="trust" title={<StoreName shopName={shopName} />}>
          Your store shows the verified badge, and you can withdraw your balance.
        </FactRow>
      ) : state === 'in_review' ? (
        <FactRow icon={HourglassMediumIcon} tone="trust" title="Verification In Progress">
          We’ll notify you when it’s complete.
        </FactRow>
      ) : !available ? (
        <FactRow icon={HourglassMediumIcon} tone="attention" title="Verification Is Currently Unavailable">
          Please try again later.
        </FactRow>
      ) : state === 'needs_attention' ? (
        <FactRow icon={WarningCircleIcon} tone="attention" title="Verification Failed">
          Try again with a clear photo of your ID, or contact support@dropmarket.gg.
        </FactRow>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <FactRow icon={SealCheckIcon} tone="trust" title={<StoreName shopName={shopName} />}>
            Verified badge on your store and listings
          </FactRow>
          <FactRow icon={WalletIcon} tone="money" title="Withdrawals">
            Withdraw your earnings
          </FactRow>
          <FactRow icon={LightningIcon} tone="speed" title="Listings Over $100">
            No additional price review
          </FactRow>
        </div>
      )}
    </SettingsCard>
  )
}

/** Withdrawal page: one slim row above the form, the reason with the button beside it. */
export function IdentityCheckPanel({ message, onVerified }: { message: string; onVerified?: () => void }) {
  const { state, available } = useIdentityCheck()
  // Back from a passed check in another tab: the page's own gate is out of date.
  useEffect(() => {
    if (state === 'verified') onVerified?.()
  }, [state, onVerified])
  if (state === 'verified') return null
  const inReview = state === 'in_review'
  const failed = state === 'needs_attention'
  const canStart = available && !!state && !inReview
  const Icon = failed ? WarningCircleIcon : inReview ? HourglassMediumIcon : SealCheckIcon

  return (
    <div className={cn('flex flex-col gap-3 rounded-lg p-4 sm:flex-row sm:items-center sm:justify-between', failed ? 'bg-warning-bg' : 'bg-[rgba(106,168,255,0.10)]')}>
      <div className="flex min-w-0 items-center gap-3">
        <IconTile tone={failed ? 'attention' : 'trust'}>
          <Icon size={22} weight="duotone" />
        </IconTile>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-text-primary">
            {failed ? 'Verification Failed' : inReview ? 'Verification In Progress' : 'Identity Verification Required'}
          </p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-text-secondary">
            {failed ? 'Try again with a clear photo of your ID, or contact support@dropmarket.gg.' : inReview ? 'We’ll notify you when it’s complete.' : message}
          </p>
        </div>
      </div>
      {canStart && (
        <button type="button" onClick={openIdentityCheck} className={cn(accountBtn.primary, 'w-full shrink-0 sm:w-auto')}>
          <SealCheckIcon size={18} weight="duotone" aria-hidden />
          {buttonLabel(state)}
        </button>
      )}
    </div>
  )
}
