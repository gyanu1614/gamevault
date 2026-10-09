'use client'

/**
 * Content moderation on the seller detail page (2026-10-09):
 *
 *   · Profile picture — reset to the default robot (+ lock) with a reason.
 *   · Listings — Take Down / Restore, and per-image removal (thumbnails
 *     open on demand). A reason is always required; a strike is optional
 *     per action (on by default for a takedown).
 *   · Strikes — the list, Revoke, Add Strike. 2 active = restricted,
 *     3 = banned (automatic, same as the manual buttons above).
 *
 * One dialog component for every reason prompt; the page refreshes after
 * each action so the loader's numbers are the truth.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from '@/components/navigation/AppLink'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { adminBtn, adminBtnSm } from '../../components/kit'
import { getAvatarUrl } from '@/lib/utils/avatar'
import type { SellerDetail } from '@/lib/actions/admin-seller-detail'
import {
  issueStrike,
  removeListingImage,
  resetSellerAvatar,
  restoreListing,
  revokeStrike,
  takedownListing,
  unlockSellerAvatar,
  type StrikeKind,
} from '@/lib/actions/admin-moderation-tools'
import { Images } from '@phosphor-icons/react/dist/csr/Images'
import { X } from '@phosphor-icons/react/dist/csr/X'

type Prompt =
  | { kind: 'takedown'; listingId: string; title: string }
  | { kind: 'image'; listingId: string; title: string; url: string }
  | { kind: 'avatar' }
  | { kind: 'strike' }

const KIND_LABEL: Record<string, string> = {
  listing_takedown: 'Listing removed',
  image_removed: 'Image removed',
  avatar_reset: 'Picture reset',
  report_upheld: 'Report upheld',
  other: 'Other',
}

const ACTIVE_STATUSES = new Set(['active', 'paused', 'pending_approval', 'changes_requested'])

export function ModerationPanel({ detail }: { detail: SellerDetail }) {
  const router = useRouter()
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [reason, setReason] = useState('')
  const [strike, setStrike] = useState(true)
  const [openImages, setOpenImages] = useState<Record<string, boolean>>({})
  const [pending, start] = useTransition()
  const { profile, listings } = detail
  // Older fixtures / partial loads: no moderation block means a clean record.
  const moderation = detail.moderation ?? { strikes: [], activeStrikes: 0, avatarLockedAt: null, openReports: 0 }
  const uid = profile.id

  const run = (fn: () => Promise<{ success: boolean; error?: string }>, okMsg: string) => {
    start(async () => {
      const r = await fn()
      if (!r.success) {
        toast.error(r.error ?? 'Something went wrong')
        return
      }
      toast.success(okMsg)
      setPrompt(null)
      setReason('')
      router.refresh()
    })
  }

  const confirm = () => {
    if (!prompt) return
    const why = reason.trim()
    if (why.length < 3) return toast.error('Give a reason (at least 3 characters).')
    switch (prompt.kind) {
      case 'takedown':
        return run(() => takedownListing({ listingId: prompt.listingId, reason: why, strike }), 'Listing taken down')
      case 'image':
        return run(() => removeListingImage({ listingId: prompt.listingId, imageUrl: prompt.url, reason: why, strike }), 'Image removed')
      case 'avatar':
        return run(() => resetSellerAvatar({ userId: uid, reason: why, strike, lock: true }), 'Picture reset and locked')
      case 'strike':
        return run(() => issueStrike({ sellerId: uid, kind: 'other' as StrikeKind, reason: why }), 'Strike added')
    }
  }

  const open = (p: Prompt, defaultStrike: boolean) => {
    setReason('')
    setStrike(defaultStrike)
    setPrompt(p)
  }

  const activeStrikes = moderation.activeStrikes

  return (
    <section>
      <div className="mb-2.5 flex items-end justify-between gap-3 px-0.5">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold tracking-tight text-text-primary">Content Moderation</h2>
          <p className="mt-0.5 text-[12.5px] text-text-tertiary">Take down listings, remove images, reset the picture. Every action emails the seller and is logged.</p>
        </div>
        {moderation.openReports > 0 && (
          <Link href="/admin/reports" className="shrink-0 rounded-full bg-error-bg px-2.5 py-1 text-[12px] font-semibold text-error hover:brightness-110">
            {moderation.openReports} open {moderation.openReports === 1 ? 'report' : 'reports'}
          </Link>
        )}
      </div>

      <div className="rounded-lg bg-bg-raised p-4 sm:p-5">
        {/* Strikes summary */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5" aria-label={`${activeStrikes} of 3 strikes`}>
            {[1, 2, 3].map((n) => (
              <span key={n} className={cn('h-2.5 w-7 rounded-full', n <= activeStrikes ? (activeStrikes >= 3 ? 'bg-error' : 'bg-warning') : 'bg-white/[0.08]')} />
            ))}
          </div>
          <p className="text-[13px] text-text-secondary">
            <span className="font-semibold text-text-primary">{activeStrikes} of 3 strikes.</span>{' '}
            {activeStrikes === 0 ? 'Clean record.' : activeStrikes === 1 ? 'One more restricts the store.' : activeStrikes === 2 ? 'Restricted. One more bans.' : 'Banned.'}
          </p>
          <button type="button" onClick={() => open({ kind: 'strike' }, true)} disabled={pending} className={cn(adminBtnSm.secondary, 'ml-auto')}>
            Add Strike
          </button>
        </div>

        {/* Avatar */}
        <div className="mt-4 flex items-center gap-3 border-t border-white/[0.06] pt-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={getAvatarUrl(profile.avatar_url, profile.username || 'seller')} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
          <div className="min-w-0 flex-1 text-[13px]">
            <p className="font-medium text-text-primary">Profile picture</p>
            <p className="text-text-tertiary">
              {moderation.avatarLockedAt ? `Locked since ${new Date(moderation.avatarLockedAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })} — the seller cannot change it.` : profile.avatar_url ? 'Uploaded by the seller.' : 'Default robot (none uploaded).'}
            </p>
          </div>
          {moderation.avatarLockedAt ? (
            <button type="button" disabled={pending} onClick={() => run(() => unlockSellerAvatar(uid), 'Picture unlocked')} className={adminBtnSm.secondary}>
              Unlock
            </button>
          ) : (
            <button type="button" disabled={pending || !profile.avatar_url} onClick={() => open({ kind: 'avatar' }, false)} className={cn(adminBtnSm.secondary, 'text-warning')}>
              Reset &amp; Lock
            </button>
          )}
        </div>

        {/* Listings */}
        <ul className="mt-4 divide-y divide-white/[0.06] border-t border-white/[0.06]">
          {listings.recent.length === 0 && <li className="py-3 text-[13px] text-text-tertiary">No listings.</li>}
          {listings.recent.map((l) => {
            const canTakeDown = ACTIVE_STATUSES.has(l.status)
            const suspended = l.status === 'suspended'
            const images = Array.isArray(l.images) ? l.images : []
            const showImages = openImages[l.id]
            return (
              <li key={l.id} className="py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-text-primary">{l.title}</p>
                  <span className={cn('rounded-full px-2 py-0.5 text-[11.5px] font-semibold', suspended ? 'bg-error-bg text-error' : canTakeDown ? 'bg-white/[0.07] text-text-secondary' : 'bg-white/[0.05] text-text-tertiary')}>{l.status.replace('_', ' ')}</span>
                  {images.length > 0 && (
                    <button type="button" onClick={() => setOpenImages((s) => ({ ...s, [l.id]: !s[l.id] }))} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-text-secondary hover:text-text-primary">
                      <Images aria-hidden className="h-4 w-4" /> {images.length}
                    </button>
                  )}
                  {suspended ? (
                    <button type="button" disabled={pending} onClick={() => run(() => restoreListing(l.id), 'Listing restored')} className={adminBtnSm.primary}>
                      Restore
                    </button>
                  ) : canTakeDown ? (
                    <button type="button" disabled={pending} onClick={() => open({ kind: 'takedown', listingId: l.id, title: l.title }, true)} className={adminBtnSm.danger}>
                      Take Down
                    </button>
                  ) : null}
                </div>
                {suspended && l.note && <p className="mt-1 text-[12px] text-text-tertiary">{l.note}</p>}
                {showImages && (
                  <ul className="mt-2.5 flex flex-wrap gap-2">
                    {images.map((url) => (
                      <li key={url} className="group relative h-20 w-20 overflow-hidden rounded-md bg-bg-overlay">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          aria-label="Remove this image"
                          disabled={pending}
                          onClick={() => open({ kind: 'image', listingId: l.id, title: l.title, url }, false)}
                          className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-md bg-black/70 text-white opacity-0 transition-opacity hover:bg-error group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          <X weight="bold" className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>

        {/* Strike history */}
        {moderation.strikes.length > 0 && (
          <ul className="mt-4 divide-y divide-white/[0.06] border-t border-white/[0.06]">
            {moderation.strikes.map((s) => (
              <li key={s.id} className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[13px]', s.revoked_at && 'opacity-50')}>
                <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[11.5px] font-semibold text-text-secondary">{KIND_LABEL[s.kind] ?? s.kind}</span>
                <p className="min-w-0 flex-1 truncate text-text-secondary">{s.reason}</p>
                <span className="text-[12px] text-text-tertiary">{new Date(s.created_at).toLocaleDateString('en-GB', { dateStyle: 'medium' })}</span>
                {s.revoked_at ? (
                  <span className="text-[12px] text-text-tertiary">revoked</span>
                ) : (
                  <button type="button" disabled={pending} onClick={() => run(() => revokeStrike(s.id), 'Strike revoked')} className="text-[12.5px] font-semibold text-text-secondary hover:text-text-primary">
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!prompt} onOpenChange={(v) => !v && setPrompt(null)}>
        <DialogContent className="max-w-[460px] rounded-lg border-white/[0.08] bg-[#16171B] p-5 text-text-primary">
          <DialogTitle className="text-[17px] font-semibold">
            {prompt?.kind === 'takedown' && `Take down “${prompt.title}”`}
            {prompt?.kind === 'image' && `Remove an image from “${prompt.title}”`}
            {prompt?.kind === 'avatar' && 'Reset and lock the profile picture'}
            {prompt?.kind === 'strike' && 'Add a strike'}
          </DialogTitle>
          <DialogDescription className="text-[13px] text-text-secondary">The seller is emailed this reason. Keep it plain and specific.</DialogDescription>
          {prompt?.kind === 'image' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={prompt.url} alt="" className="mt-3 h-28 w-28 rounded-md object-cover" />
          )}
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 1000))}
            rows={3}
            autoFocus
            placeholder={prompt?.kind === 'strike' ? 'What they did' : 'Why it is being removed'}
            className="mt-3 w-full resize-none rounded-md border border-white/[0.08] bg-bg-well px-3 py-2 text-[13.5px] text-text-primary outline-none focus:border-white/25"
          />
          {prompt?.kind !== 'strike' && (
            <label className="mt-3 flex items-center gap-2 text-[13px] text-text-secondary">
              <input type="checkbox" checked={strike} onChange={(e) => setStrike(e.target.checked)} className="h-3.5 w-3.5 accent-white" />
              Also add a strike ({activeStrikes + 1 >= 3 ? 'this bans the store' : activeStrikes + 1 === 2 ? 'this restricts the store' : 'warning only'})
            </label>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setPrompt(null)} className={adminBtn.secondary}>Cancel</button>
            <button type="button" onClick={confirm} disabled={pending || reason.trim().length < 3} className={prompt?.kind === 'strike' ? adminBtn.primary : adminBtn.danger}>
              {pending ? 'Working…' : prompt?.kind === 'takedown' ? 'Take Down' : prompt?.kind === 'image' ? 'Remove Image' : prompt?.kind === 'avatar' ? 'Reset Picture' : 'Add Strike'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
