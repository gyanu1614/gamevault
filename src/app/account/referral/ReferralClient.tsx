'use client'

import { SITE_URL } from '@/config/site'
import { useState } from 'react'
import { toast } from 'sonner'
import { Check, Copy, Share2 } from 'lucide-react'
import RedeemRounded from '@mui/icons-material/RedeemRounded'
import TrendingUpRounded from '@mui/icons-material/TrendingUpRounded'
import CardGiftcardRounded from '@mui/icons-material/CardGiftcardRounded'
import AccountPageHeader from '@/components/account/AccountPageHeader'
import { AccountPage, SettingsCard, StatStrip, accountBtn } from '@/components/account/AccountSurface'
import { RevealGroup, RevealItem } from '@/components/account/Reveal'
import type { ReferralStats } from '@/lib/actions/referral'
import type { ReferralEarning } from '@/types/database'
import { cn } from '@/lib/utils'

interface ReferralClientProps {
  stats: ReferralStats
}

const usd = (n: number) => `$${n.toFixed(2)}`

const STEPS = [
  'Share your unique link or code with friends',
  'They sign up using your code',
  'You earn 10% of the platform fee on every purchase they make',
  'Commissions are credited once orders complete',
]

function EarningRow({ earning }: { earning: ReferralEarning }) {
  const isPaid = earning.status === 'paid'
  const isCancelled = earning.status === 'cancelled'
  const isBonus = earning.type === 'signup_bonus'
  const Icon = isBonus ? CardGiftcardRounded : TrendingUpRounded

  return (
    <li className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-bg-overlay text-text-secondary">
          <Icon style={{ fontSize: 18 }} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text-primary">
            {isBonus ? 'Signup Bonus' : 'Purchase Commission'}
          </p>
          <p className="text-[12px] text-text-tertiary">
            {new Date(earning.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className={cn('text-sm font-semibold tabular-nums', isCancelled ? 'text-text-tertiary line-through' : 'text-text-primary')}>
          +{usd(earning.amount)}
        </span>
        <span
          className={cn(
            'inline-flex h-6 w-[76px] items-center justify-center rounded-full text-[12px] font-semibold',
            isPaid ? 'bg-success-bg text-success' : isCancelled ? 'bg-white/[0.06] text-text-secondary' : 'bg-warning-bg text-warning',
          )}
        >
          {isPaid ? 'Paid' : isCancelled ? 'Cancelled' : 'Pending'}
        </span>
      </div>
    </li>
  )
}

export default function ReferralClient({ stats }: ReferralClientProps) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const referralUrl = `${SITE_URL}/signup?ref=${stats.referralCode}`

  const copy = (what: 'code' | 'link') => {
    const value = what === 'code' ? stats.referralCode : referralUrl
    navigator.clipboard.writeText(value).then(
      () => {
        setCopied(what)
        toast.success(what === 'code' ? 'Referral code copied' : 'Referral link copied')
        setTimeout(() => setCopied((c) => (c === what ? null : c)), 2000)
      },
      () => toast.error('Couldn’t copy. Select it and copy it manually.'),
    )
  }

  const share = () => {
    if (navigator.share) {
      navigator
        .share({
          title: 'Join DropMarket',
          text: `Use my referral code ${stats.referralCode} to sign up on DropMarket, the lowest-fee gaming marketplace!`,
          url: referralUrl,
        })
        .catch(() => { /* user cancelled */ })
    } else {
      copy('link')
    }
  }

  return (
    <AccountPage>
      <AccountPageHeader
        title="Refer & Earn"
        subtitle="Share your link. Earn 10% commission on platform fees from every purchase your referrals make."
      />

      <RevealGroup className="mt-6 space-y-4">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          {/* Invite: code, link, share */}
          <RevealItem>
            <section className="h-full rounded-lg bg-bg-raised bg-gradient-to-b from-[rgba(86,184,127,0.10)] to-[rgba(86,184,127,0.02)] p-5 sm:p-6">
              <div className="flex items-center gap-2 text-lime-text">
                <RedeemRounded style={{ fontSize: 18 }} aria-hidden />
                <h2 className="text-[15px] font-semibold text-text-primary">Your Referral Code</h2>
              </div>

              <div className="mt-5 flex items-stretch gap-2">
                <div translate="no" className="flex min-w-0 flex-1 items-center justify-center rounded-md bg-black/30 px-4 py-3 font-mono text-[22px] font-bold tracking-[0.3em] text-text-primary sm:text-2xl">
                  {stats.referralCode}
                </div>
                <button type="button" onClick={() => copy('code')} className={cn(accountBtn.primary, 'h-auto min-w-[96px]')}>
                  {copied === 'code' ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                  {copied === 'code' ? 'Copied' : 'Copy'}
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2 rounded-md bg-black/25 py-1 pl-3.5 pr-1">
                <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-text-secondary">{referralUrl}</span>
                <button
                  type="button"
                  onClick={() => copy('link')}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-semibold text-text-primary transition-colors hover:bg-white/[0.08]"
                >
                  {copied === 'link' ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                  {copied === 'link' ? 'Copied' : 'Copy Link'}
                </button>
              </div>

              <button type="button" onClick={share} className={cn(accountBtn.secondary, 'mt-4 w-full')}>
                <Share2 className="h-4 w-4" aria-hidden />
                Share Your Link
              </button>
            </section>
          </RevealItem>

          <RevealItem>
            <SettingsCard title="How It Works" className="h-full">
              <ol className="space-y-3.5">
                {STEPS.map((text, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bg-overlay text-[12px] font-bold tabular-nums text-text-primary">
                      {i + 1}
                    </span>
                    <p className="pt-0.5 text-[13.5px] leading-snug text-text-secondary">{text}</p>
                  </li>
                ))}
              </ol>
            </SettingsCard>
          </RevealItem>
        </div>

        <RevealItem>
          <StatStrip
            stats={[
              { label: 'Total Referrals', value: String(stats.totalReferrals), hint: 'Signed up with your code' },
              { label: 'Total Earned', value: usd(stats.totalEarned), hint: 'Lifetime paid commissions' },
              { label: 'Pending', value: usd(stats.pendingEarnings), hint: 'Awaiting order completion' },
              { label: 'This Month', value: usd(stats.thisMonthEarned), hint: 'Paid this calendar month' },
            ]}
          />
        </RevealItem>

        <RevealItem>
          <SettingsCard
            title="Earnings History"
            aside={
              stats.recentEarnings.length > 0 ? (
                <span className="text-[12.5px] tabular-nums text-text-tertiary">
                  {stats.recentEarnings.length} {stats.recentEarnings.length === 1 ? 'record' : 'records'}
                </span>
              ) : null
            }
          >
            {stats.recentEarnings.length === 0 ? (
              <div className="flex flex-col items-center rounded-md bg-bg-overlay px-6 py-10 text-center">
                <CardGiftcardRounded style={{ fontSize: 32 }} className="text-text-tertiary" aria-hidden />
                <p className="mt-2 text-sm font-medium text-text-primary">No Earnings Yet</p>
                <p className="mt-1 max-w-xs text-[13px] text-text-secondary">
                  Start sharing your referral link. You’ll earn commissions once your referrals make purchases.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.07]">
                {stats.recentEarnings.map((earning) => (
                  <EarningRow key={earning.id} earning={earning} />
                ))}
              </ul>
            )}
          </SettingsCard>
        </RevealItem>
      </RevealGroup>
    </AccountPage>
  )
}
