'use client'

/**
 * Seller account status (restricted / banned / active), on the account card
 * system. The history no longer names the admin behind a restriction (it fell
 * back to the admin's email address); the full list opens in the shared
 * compact dialog instead of a hand-rolled 2xl modal.
 */

import { useState } from 'react'
import { AlertCircle, Ban, CheckCircle, Clock, Mail, ShieldAlert } from 'lucide-react'
import AccountPageHeader from '@/components/account/AccountPageHeader'
import { AccountPage, SettingsCard, accountBtn } from '@/components/account/AccountSurface'
import { RevealGroup, RevealItem } from '@/components/account/Reveal'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface Restriction {
  id: string
  restriction_type: 'restricted' | 'banned' | 'unrestricted' | string
  reason?: string | null
  created_at: string
}

export interface Strike {
  id: string
  kind: string
  reason: string
  created_at: string
  revoked_at: string | null
}

const STRIKE_LABEL: Record<string, string> = {
  listing_takedown: 'Listing removed',
  image_removed: 'Image removed',
  avatar_reset: 'Profile picture reset',
  report_upheld: 'Buyer report upheld',
  other: 'Rule broken',
}

interface RestrictionStatusProps {
  strikes?: Strike[]
  profile: {
    seller_status?: string | null
    seller_restriction_reason?: string | null
    seller_restricted_at?: string | null
  }
  restrictions: Restriction[]
}

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function TypeIcon({ type, className }: { type: string; className?: string }) {
  if (type === 'banned') return <Ban className={cn('text-error', className)} aria-hidden />
  if (type === 'unrestricted') return <CheckCircle className={cn('text-success', className)} aria-hidden />
  return <ShieldAlert className={cn('text-warning', className)} aria-hidden />
}

function HistoryItem({ restriction, full = false }: { restriction: Restriction; full?: boolean }) {
  return (
    <li className="rounded-md bg-bg-overlay px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium capitalize text-text-primary">
          <TypeIcon type={restriction.restriction_type} className="h-4 w-4" />
          {restriction.restriction_type}
        </span>
        <span className="shrink-0 text-[12px] text-text-tertiary">
          {full
            ? fmtDateTime(restriction.created_at)
            : new Date(restriction.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>
      {restriction.reason && <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">{restriction.reason}</p>}
    </li>
  )
}

const MEANING: Record<'active' | 'restricted' | 'banned', { ok: boolean; text: string }[]> = {
  active: [
    { ok: true, text: 'Create and publish new listings' },
    { ok: true, text: 'Manage existing listings' },
    { ok: true, text: 'Full seller dashboard access' },
  ],
  restricted: [
    { ok: false, text: 'Cannot create new listings' },
    { ok: false, text: 'Cannot publish listings' },
    { ok: true, text: 'View existing listings (read-only)' },
  ],
  banned: [
    { ok: false, text: 'No seller feature access' },
    { ok: false, text: 'Cannot manage listings' },
    { ok: false, text: 'Listings hidden from buyers' },
  ],
}

export default function RestrictionStatus({ profile, restrictions, strikes = [] }: RestrictionStatusProps) {
  const activeStrikes = strikes.filter((s) => !s.revoked_at).length
  const [showAll, setShowAll] = useState(false)
  const state: 'active' | 'restricted' | 'banned' =
    profile.seller_status === 'banned' ? 'banned' : profile.seller_status === 'restricted' ? 'restricted' : 'active'

  const tone = {
    active: { bg: 'bg-success-bg', text: 'text-success', Icon: CheckCircle, title: 'Account Active', body: 'Your seller account is in good standing.' },
    restricted: { bg: 'bg-warning-bg', text: 'text-warning', Icon: ShieldAlert, title: 'Account Restricted', body: 'You cannot create or publish new listings.' },
    banned: { bg: 'bg-error-bg', text: 'text-error', Icon: Ban, title: 'Account Banned', body: 'You no longer have access to seller features.' },
  }[state]

  return (
    <AccountPage>
      <AccountPageHeader title="Account Status" subtitle="View and manage your seller restriction information" />

      <RevealGroup className="mt-6 space-y-4">
        <RevealItem>
          {/* Strikes: 1 warning · 2 restricted · 3 banned. */}
          <section className="rounded-lg bg-bg-raised p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5" aria-label={`${activeStrikes} of 3 strikes`}>
                {[1, 2, 3].map((n) => (
                  <span key={n} className={cn('h-2.5 w-8 rounded-full', n <= activeStrikes ? (activeStrikes >= 3 ? 'bg-error' : 'bg-warning') : 'bg-white/[0.08]')} />
                ))}
              </div>
              <p className="text-[14px] text-text-secondary">
                <span className="font-semibold text-text-primary">{activeStrikes} of 3 strikes.</span>{' '}
                {activeStrikes === 0 ? 'Keep to the house rules and it stays that way.' : activeStrikes === 1 ? 'One more restricts your store.' : activeStrikes === 2 ? 'One more bans your store.' : 'Your store is banned.'}
              </p>
            </div>
            {strikes.length > 0 && (
              <ul className="mt-4 divide-y divide-white/[0.06]">
                {strikes.map((s) => (
                  <li key={s.id} className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[13px]', s.revoked_at && 'opacity-50')}>
                    <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[11.5px] font-semibold text-text-secondary">{STRIKE_LABEL[s.kind] ?? s.kind}</span>
                    <p className="min-w-0 flex-1 text-text-secondary">{s.reason}</p>
                    <span className="text-[12px] text-text-tertiary">{fmtDateTime(s.created_at)}{s.revoked_at ? ' · withdrawn' : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </RevealItem>
        <RevealItem>
          <section className={cn('rounded-lg p-5 sm:p-6', tone.bg)}>
            <div className="flex flex-col items-start gap-4 sm:flex-row">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black/20">
                <tone.Icon className={cn('h-6 w-6', tone.text)} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className={cn('text-lg font-bold', tone.text)}>{tone.title}</h2>
                <p className="mt-1 text-sm text-text-secondary">{tone.body}</p>

                {state !== 'active' && profile.seller_restriction_reason && (
                  <div className="mt-3 rounded-md bg-black/25 px-3.5 py-3">
                    <p className={cn('text-[12px] font-semibold', tone.text)}>Reason</p>
                    <p className="mt-0.5 text-[13px] text-text-secondary">{profile.seller_restriction_reason}</p>
                  </div>
                )}

                {state !== 'active' && profile.seller_restricted_at && (
                  <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-text-secondary">
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    {state === 'banned' ? 'Banned on ' : 'Restricted on '}
                    {fmtDateTime(profile.seller_restricted_at)}
                  </p>
                )}

                {state !== 'active' && (
                  <div className="mt-4 flex flex-col gap-3 rounded-md bg-black/25 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" aria-hidden />
                      <div>
                        <p className="text-[13px] font-semibold text-text-primary">Need Help?</p>
                        <p className="text-[12.5px] text-text-secondary">Contact support to appeal this restriction.</p>
                      </div>
                    </div>
                    <a href="mailto:support@dropmarket.gg" className={cn(accountBtn.secondary, 'shrink-0')}>
                      <Mail className="h-4 w-4" aria-hidden />
                      support@dropmarket.gg
                    </a>
                  </div>
                )}
              </div>
            </div>
          </section>
        </RevealItem>

        <div className="grid gap-4 lg:grid-cols-2">
          <RevealItem>
            <SettingsCard title="What This Means" className="h-full">
              <ul className="space-y-2.5">
                {MEANING[state].map((m) => (
                  <li key={m.text} className="flex items-start gap-2.5 text-[13.5px] text-text-secondary">
                    {m.ok ? (
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                    ) : (
                      <Ban className="mt-0.5 h-4 w-4 shrink-0 text-error" aria-hidden />
                    )}
                    {m.text}
                  </li>
                ))}
              </ul>
            </SettingsCard>
          </RevealItem>

          {restrictions.length > 0 && (
            <RevealItem>
              <SettingsCard
                title="Restriction History"
                className="h-full"
                aside={
                  restrictions.length > 2 ? (
                    <button
                      type="button"
                      onClick={() => setShowAll(true)}
                      className="text-[13px] font-semibold text-text-secondary transition-colors hover:text-text-primary"
                    >
                      View All ({restrictions.length})
                    </button>
                  ) : null
                }
              >
                <ul className="space-y-2">
                  {restrictions.slice(0, 2).map((r) => (
                    <HistoryItem key={r.id} restriction={r} />
                  ))}
                </ul>
              </SettingsCard>
            </RevealItem>
          )}
        </div>
      </RevealGroup>

      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent className="max-w-[480px] gap-0 p-5 sm:p-6">
          <DialogTitle className="pr-8 text-base font-semibold text-text-primary">Restriction History</DialogTitle>
          <DialogDescription className="mt-1 text-[13px] text-text-secondary">
            Every change to your seller status, newest first.
          </DialogDescription>
          <ul className="mt-4 max-h-[60dvh] space-y-2 overflow-y-auto overscroll-contain">
            {restrictions.map((r) => (
              <HistoryItem key={r.id} restriction={r} full />
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </AccountPage>
  )
}
