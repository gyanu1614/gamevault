'use client'

/**
 * A seller's ID check: the Settings card and the withdrawal page's block. The
 * check runs on the provider's page in a new tab. Coming back to this tab re-reads
 * the result, so nothing here needs a manual refresh.
 *
 * Mention verifying only in Settings, the card after a store opens, and withdrawal
 * pages: owner rule, 2026-11-04. Never in the banner, /founding or the listing flow.
 *
 * Colour carries meaning: trust blue for the badge and the check itself, green for
 * money and good news, lime for the action, amber when something needs the seller.
 */
import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Icon as TileIcon } from '@phosphor-icons/react'
import { HourglassMediumIcon } from '@phosphor-icons/react/dist/csr/HourglassMedium'
import { LightningIcon } from '@phosphor-icons/react/dist/csr/Lightning'
import { SealCheckIcon } from '@phosphor-icons/react/dist/csr/SealCheck'
import { WalletIcon } from '@phosphor-icons/react/dist/csr/Wallet'
import { WarningCircleIcon } from '@phosphor-icons/react/dist/csr/WarningCircle'
import { toast } from 'sonner'
import { SettingsCard, accountBtn } from '@/components/account/AccountSurface'
import { VerifiedBadge } from '@/components/seller/VerifiedBadge'
import { startIdentityCheck } from '@/lib/actions/identity-check'
import type { IdentityState } from '@/lib/identity/state'
import { cn } from '@/lib/utils'

const QUERY_KEY = ['identity-check'] as const

/** The promises' blue (BuyPromises, checkout): the fill icon on a 12% tile. */
const TILE = {
  trust: 'bg-[rgba(106,168,255,0.12)] text-[#6AA8FF]',
  money: 'bg-success-bg text-success',
  speed: 'bg-lime-tint-bg text-lime-text',
  attention: 'bg-warning-bg text-warning',
} as const

const PILL: Record<IdentityState, { label: string; cls: string }> = {
  not_started: { label: 'Not Started', cls: 'bg-white/[0.07] text-text-secondary' },
  in_review: { label: 'In Review', cls: 'bg-info-bg text-info' },
  verified: { label: 'Verified', cls: 'bg-success-bg text-success' },
  needs_attention: { label: 'Needs Attention', cls: 'bg-warning-bg text-warning' },
}

/** A plain request, not a server action: it can wait on the provider, and actions run one at a time. */
async function fetchIdentityStatus(): Promise<{ state: IdentityState; available: boolean }> {
  const res = await fetch('/api/account/identity-check', { cache: 'no-store' })
  if (!res.ok) throw new Error(`identity status ${res.status}`)
  return res.json()
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

function Tile({ icon: Icon, tone }: { icon: TileIcon; tone: keyof typeof TILE }) {
  return (
    <span aria-hidden className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-md', TILE[tone])}>
      <Icon size={22} weight="duotone" />
    </span>
  )
}

function FactRow({ icon, tone, title, children }: {
  icon: TileIcon
  tone: keyof typeof TILE
  title: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Tile icon={icon} tone={tone} />
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
  const { state, available, loading, starting, start } = useIdentityCheck()
  const canStart = available && (state === 'not_started' || state === 'needs_attention')
  const pill = state ? PILL[state] : null

  return (
    <SettingsCard
      title="ID Verification"
      description={state === 'verified' ? 'Your ID has been checked.' : 'Needed before your first withdrawal.'}
      aside={
        pill ? (
          <span className={cn('inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold', pill.cls)}>{pill.label}</span>
        ) : (
          <span className="skeleton block h-6 w-20 rounded-full" aria-hidden />
        )
      }
      footerHint={canStart ? 'Have your ID ready. The check opens in a new tab.' : undefined}
      footerAction={
        canStart ? (
          <button type="button" onClick={() => void start()} disabled={starting} className={accountBtn.primary}>
            <SealCheckIcon size={18} weight="duotone" aria-hidden />
            {buttonLabel(state, starting)}
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
          Your store shows the blue badge, and you can withdraw your balance.
        </FactRow>
      ) : state === 'in_review' ? (
        <FactRow icon={HourglassMediumIcon} tone="trust" title="We’re Checking Your Details">
          We’ll let you know the result.
        </FactRow>
      ) : !available ? (
        <FactRow icon={HourglassMediumIcon} tone="attention" title="ID Checks Are Not Open Right Now">
          Your balance stays in your wallet.
        </FactRow>
      ) : state === 'needs_attention' ? (
        <FactRow icon={WarningCircleIcon} tone="attention" title="The Check Did Not Pass">
          Try again with a clear photo of your ID, or contact support@dropmarket.gg.
        </FactRow>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <FactRow icon={SealCheckIcon} tone="trust" title={<StoreName shopName={shopName} />}>
            Blue badge on your store and listings
          </FactRow>
          <FactRow icon={WalletIcon} tone="money" title="Withdraw Your Balance">
            Cash out what you earn
          </FactRow>
          <FactRow icon={LightningIcon} tone="speed" title="Listings Over $100">
            No extra price review
          </FactRow>
        </div>
      )}
    </SettingsCard>
  )
}

/** Withdrawal page: what the seller needs to do next, with the button right there. */
export function IdentityCheckPanel({ message, onVerified }: { message: string; onVerified?: () => void }) {
  const { state, available, starting, start } = useIdentityCheck()
  // Back from a passed check in another tab: the page's own gate is out of date.
  useEffect(() => {
    if (state === 'verified') onVerified?.()
  }, [state, onVerified])
  if (state === 'verified') return null
  const inReview = state === 'in_review'
  const failed = state === 'needs_attention'
  const canStart = available && !!state && !inReview

  return (
    <div className={cn('mt-3 rounded-md p-3', failed ? 'bg-warning-bg' : 'bg-[rgba(106,168,255,0.10)]')}>
      <div className="flex items-start gap-2.5">
        <span aria-hidden className={cn('mt-0.5 shrink-0', failed ? 'text-warning' : 'text-[#6AA8FF]')}>
          {failed ? <WarningCircleIcon size={20} weight="duotone" /> : inReview ? <HourglassMediumIcon size={20} weight="duotone" /> : <SealCheckIcon size={20} weight="duotone" />}
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-text-primary">
            {failed ? 'The Check Did Not Pass' : inReview ? 'We’re Checking Your Details' : 'Verify To Withdraw'}
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-text-secondary">
            {failed ? 'Try again with a clear photo of your ID, or contact support@dropmarket.gg.' : inReview ? 'We’ll let you know the result.' : message}
          </p>
        </div>
      </div>
      {canStart && (
        <button type="button" onClick={() => void start()} disabled={starting} className={cn(accountBtn.primary, 'mt-3 w-full')}>
          <SealCheckIcon size={18} weight="duotone" aria-hidden />
          {buttonLabel(state, starting)}
        </button>
      )}
    </div>
  )
}
