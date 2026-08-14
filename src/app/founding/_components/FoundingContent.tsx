'use client'

/**
 * FoundingContent — the ivory right pane of the Founding Seller HQ. Holds, top to
 * bottom: the primary "start selling" action, the auto-scrolling game marquee,
 * the admin-controlled announcements stream ("What's happening"), and a permanent
 * Discord card pinned to the bottom.
 *
 * Lives in the seller application's "Forest Ledger" world (light ivory ground,
 * white cards, ink text, forest primary, lime as a hairline accent only) so HQ
 * and the application match. Background washes mirror the seller-app right pane.
 */

import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { ArrowRight, Pin, ShieldCheck, Lock, Sparkles, ListChecks } from 'lucide-react'
import { PALETTE } from '@/app/account/become-seller/_redesign/theme'
import GameMarquee, { type MarqueeGame } from './GameMarquee'
import SellerJourneyTracker from './SellerJourneyTracker'
import HqProfileChip from './HqProfileChip'
import type { FoundingNoticePublic } from '@/lib/actions/founding-notices'
import type { SellerJourney, HqUser } from '@/lib/founding/hq-data'

const PANE_BG = [
  'radial-gradient(56% 42% at 98% -6%, rgba(27,94,58,0.07), transparent 62%)',
  'radial-gradient(48% 40% at -8% 108%, rgba(163,230,53,0.08), transparent 60%)',
  'linear-gradient(180deg,#FBFBF8 0%, #FAFAF7 40%, #F6F7F0 100%)',
].join(', ')

interface FoundingContentProps {
  applyHref: string
  discordUrl: string
  hasDiscord: boolean
  games: MarqueeGame[]
  notices: FoundingNoticePublic[]
  /** Per-founder status tracker; null in generic mode (no personal data). */
  journey: SellerJourney | null
  /** Signed-in viewer for the profile chip; null when logged out. */
  user: HqUser | null
}

function relative(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true })
  } catch {
    return ''
  }
}

export default function FoundingContent({
  applyHref,
  discordUrl,
  hasDiscord,
  games,
  notices,
  journey,
  user,
}: FoundingContentProps) {
  const isSeller = Boolean(user?.isSeller)
  return (
    <div
      className="relative flex min-h-screen flex-col px-6 py-8 sm:px-10 lg:h-screen lg:min-h-0 lg:overflow-hidden lg:px-14 lg:py-10"
      style={{ background: PANE_BG }}
    >
      {/* Profile chip — top-right, the way back into the account (no navbar here) */}
      {user && (
        <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-5 lg:right-8">
          <HqProfileChip user={user} />
        </div>
      )}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto flex w-full max-w-lg flex-1 flex-col lg:min-h-0"
      >
        {/* ═══ ZONE 1 (fixed): games bar + start-selling block ═══ */}
        <div className="shrink-0">
          {games.length > 0 && (
            <div className="mb-7">
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: PALETTE.ink2 }}>
                Sell across every big Roblox game
              </p>
              <GameMarquee games={games} />
            </div>
          )}

          <h2 className="text-[19px] font-semibold tracking-tight" style={{ color: PALETTE.ink }}>
            {isSeller ? 'You’re a seller — go make a sale' : 'Start selling in about 10 minutes'}
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: PALETTE.ink2 }}>
            {isSeller
              ? 'You’re all set up. List an item off live DropMarket Values and get paid the moment you deliver.'
              : 'Set up your account, list your first item, and get paid the moment you deliver — even if the buyer ghosts.'}
          </p>
          <a
            href={isSeller ? '/sell/new' : applyHref}
            className="group mt-4 flex items-center justify-center gap-2.5 rounded-xl px-5 py-3.5 text-[15px] font-semibold text-white transition-transform active:scale-[0.99]"
            style={{ backgroundColor: PALETTE.forest, boxShadow: '0 10px 24px -12px rgba(20,67,42,0.55)' }}
          >
            {isSeller ? 'Make Your First Sale' : 'Set Up Your Account & Start Selling'}
            <ArrowRight
              className="h-[18px] w-[18px] transition-transform group-hover:translate-x-1"
              style={{ color: PALETTE.lime }}
              strokeWidth={2.5}
            />
          </a>
          <div className="mt-3 flex items-center justify-center gap-4 text-[11.5px]" style={{ color: PALETTE.ink2 }}>
            {isSeller ? (
              <>
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" style={{ color: PALETTE.forest2 }} /> 2% founder discount applied</span>
                <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" style={{ color: PALETTE.forest2 }} /> Escrow-protected payouts</span>
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" style={{ color: PALETTE.forest2 }} /> Encrypted</span>
                <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" style={{ color: PALETTE.forest2 }} /> Verify only at payout</span>
              </>
            )}
          </div>
        </div>

        {/* ═══ ZONE 2 (single internal scroll region: tracker + announcements) ═══ */}
        <div className="mt-6 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pr-0.5">
          {/* Your progress — per-founder tracker */}
          {journey && (
            <div className="shrink-0">
              <div className="mb-3 flex items-center gap-2">
                <ListChecks className="h-4 w-4" style={{ color: PALETTE.forest2 }} strokeWidth={2} />
                <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em]" style={{ color: PALETTE.ink2 }}>
                  Your progress
                </h3>
              </div>
              <SellerJourneyTracker journey={journey} />
            </div>
          )}

          {/* Announcements */}
          <div className="shrink-0">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4" style={{ color: PALETTE.forest2 }} strokeWidth={2} />
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em]" style={{ color: PALETTE.ink2 }}>
                What&rsquo;s happening
              </h3>
            </div>

          {notices.length > 0 ? (
            <div
              className="rounded-2xl border bg-white p-5"
              style={{ borderColor: PALETTE.line, boxShadow: '0 2px 8px rgba(20,67,42,0.04)' }}
            >
              <ul>
                {notices.map((n, i) => {
                  const isLast = i === notices.length - 1
                  return (
                    <li
                      key={n.id}
                      className="relative flex gap-4"
                      style={{ paddingBottom: isLast ? 0 : 18, marginBottom: isLast ? 0 : 18 }}
                    >
                      {!isLast && <span aria-hidden className="absolute left-[5px] top-4 bottom-0 w-px" style={{ backgroundColor: '#EAEBE3' }} />}
                      <span className="relative z-10 mt-[5px] shrink-0">
                        <span
                          className="block h-[11px] w-[11px] rounded-full ring-4"
                          style={{
                            backgroundColor: n.pinned ? PALETTE.lime : '#D2D6C8',
                            // @ts-expect-error CSS var for ring color
                            '--tw-ring-color': n.pinned ? 'rgba(163,230,53,0.18)' : '#FFFFFF',
                          }}
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-semibold leading-snug" style={{ color: n.pinned ? PALETTE.forest : PALETTE.ink }}>
                          {n.title}
                        </div>
                        {n.body && (
                          <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed" style={{ color: PALETTE.ink2 }}>
                            {n.body}
                          </p>
                        )}
                        <div className="mt-1.5 flex items-center gap-1.5 text-[11px]" style={{ color: '#9a9f92' }}>
                          {n.pinned && <Pin className="h-3 w-3" strokeWidth={2} />}
                          <span>{relative(n.created_at)}</span>
                          {n.pinned && <span>· Pinned</span>}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : (
            <div
              className="flex flex-col items-center rounded-2xl border bg-white px-6 py-8 text-center"
              style={{ borderColor: PALETTE.line }}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: '#F2F4EC' }}>
                <Sparkles className="h-5 w-5" style={{ color: PALETTE.forest2 }} strokeWidth={2} />
              </span>
              <p className="mt-3 text-[13.5px] font-semibold" style={{ color: PALETTE.ink }}>
                You&rsquo;re early — nothing to report yet
              </p>
              <p className="mt-1 max-w-xs text-[12.5px] leading-relaxed" style={{ color: PALETTE.ink2 }}>
                Founding-seller updates, price news, and first-access drops will show up right here.
              </p>
            </div>
          )}
          </div>
        </div>

        {/* ═══ ZONE 3 (fixed): Discord anchored at bottom ═══ */}
        <div className="mt-5 shrink-0">
          <div
            className="flex items-center gap-3.5 rounded-2xl border bg-white p-3.5"
            style={{ borderColor: PALETTE.line, boxShadow: '0 2px 8px rgba(20,67,42,0.04)' }}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: '#5865F2' }}>
              <DiscordGlyph />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold" style={{ color: PALETTE.ink }}>
                {hasDiscord ? 'You’re in the founding Discord' : 'Join the founding sellers on Discord'}
              </div>
              <div className="mt-0.5 text-[12px]" style={{ color: PALETTE.ink2 }}>
                Get help, price tips, and first word on everything.
              </div>
            </div>
            <a
              href={discordUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 whitespace-nowrap rounded-[10px] border px-4 py-2.5 text-[12.5px] font-semibold transition-colors hover:brightness-95"
              style={{ borderColor: '#DDE0D3', backgroundColor: '#F2F4EC', color: PALETTE.forest }}
            >
              {hasDiscord ? 'Open →' : 'Join →'}
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

/** Inline Discord mark (drawn, not an emoji/unicode stand-in). */
function DiscordGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
      <path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.445.865-.608 1.249a18.27 18.27 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.249.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.028ZM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.42 2.157-2.42 1.211 0 2.176 1.096 2.157 2.42 0 1.333-.955 2.419-2.157 2.419Zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.42 2.157-2.42 1.211 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.419-2.157 2.419Z" />
    </svg>
  )
}
