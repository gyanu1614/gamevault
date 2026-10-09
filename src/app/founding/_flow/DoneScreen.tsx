'use client'

/**
 * The finished state on the page itself (the dialog is the first-time
 * moment; this is what stays). Store identity with the logo, three reasons
 * to keep going, the house rules as a Do / Don't list, and the two doors:
 * Start Selling and an animated View Your Store.
 */
import { useReducedMotion } from 'framer-motion'
import AppLink from '@/components/navigation/AppLink'
import { ShineBorder } from '@/components/ui/shine-border'
import { PlusCircle } from '@phosphor-icons/react/dist/ssr/PlusCircle'
import { Eye } from '@phosphor-icons/react/dist/ssr/Eye'
import { ChatCircleText } from '@phosphor-icons/react/dist/ssr/ChatCircleText'
import { ShieldCheck } from '@phosphor-icons/react/dist/ssr/ShieldCheck'
import { Check } from '@phosphor-icons/react/dist/ssr/Check'
import { X } from '@phosphor-icons/react/dist/ssr/X'
import { getAvatarUrl } from '@/lib/utils/avatar'
import SellerTierBadge from '@/components/seller/tiers/SellerTierBadge'
import { NewSellerBadge } from '@/components/seller/NewSellerBadge'
import { VerifiedBadge } from '@/components/seller/VerifiedBadge'

const WHY_STAY = [
  { Icon: PlusCircle, tile: 'bg-lime-tint-bg text-lime-text', text: 'Create a listing. It takes about two minutes and buyers see it as soon as it is live.' },
  { Icon: ChatCircleText, tile: 'bg-info-bg text-info', text: 'Buyers message you here and pay before you deliver. No chasing, no haggling in DMs.' },
  { Icon: ShieldCheck, tile: 'bg-lime-tint-bg text-lime-text', text: 'SafeDrop Protection covers every order. You deliver once the purchase is made, and the sale is done.' },
]

const DOS = [
  'Be respectful to buyers and other sellers.',
  'Deliver as soon as the purchase comes in.',
  'Describe items honestly, with real screenshots.',
  'Reply to messages within a day.',
]

const DONTS = [
  'Trade or take payment outside DropMarket.',
  'Share personal or payment details in chat.',
  'List items or accounts you do not own.',
  'Run more than one seller account.',
]

/** The house rules, two short columns on wide screens and stacked on a phone. */
function HouseRules() {
  return (
    <div className="mt-6 border-t border-white/[0.05] pt-6">
      <h3 className="text-body-sm font-semibold text-text-primary">House Rules</h3>
      <p className="mt-0.5 text-caption text-text-tertiary">Keep to these and your store stays in good standing.</p>
      <div className="mt-3 grid gap-x-8 sm:grid-cols-2">
        <RuleList label="Do" Icon={Check} tone="text-lime-text" items={DOS} />
        <RuleList label="Don't" Icon={X} tone="text-error" items={DONTS} />
      </div>
    </div>
  )
}

function RuleList({
  label,
  Icon,
  tone,
  items,
}: {
  label: string
  Icon: typeof Check
  tone: string
  items: string[]
}) {
  return (
    <div className="mt-3 sm:mt-0">
      <p className={`text-caption font-semibold uppercase tracking-wide ${tone}`}>{label}</p>
      <ul className="mt-1.5">
        {items.map((text) => (
          <li key={text} className="flex items-start gap-2.5 py-1.5 text-body-sm text-text-secondary">
            <Icon aria-hidden weight="bold" className={`mt-[3px] h-4 w-4 shrink-0 ${tone}`} />
            {text}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function DoneScreen({
  shopName,
  shopSlug,
  logoUrl,
  isFounding,
  isVerified,
  tier,
}: {
  shopName: string | null
  shopSlug: string | null
  logoUrl: string | null
  isFounding: boolean
  isVerified: boolean
  tier: string | null
}) {
  const reduce = useReducedMotion()
  const name = shopName ?? 'Your store'

  return (
    <section aria-labelledby="founding-done-title">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- the seller's own logo / generated robot */}
        <img src={getAvatarUrl(logoUrl, name)} alt="" width={64} height={64} className="h-16 w-16 shrink-0 rounded-full bg-bg-overlay object-cover ring-2 ring-white/[0.08]" />
        <div className="min-w-0">
          <p className="text-caption font-medium uppercase tracking-wide text-text-tertiary">You&apos;re a Seller at DropMarket</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h2 id="founding-done-title" className="truncate text-heading leading-none text-lime-text">{name}</h2>
            <span className="inline-flex items-center gap-1.5" aria-label={`${tier ?? 'bronze'} tier, ${isVerified ? 'verified' : 'new seller'}`}>
              <SellerTierBadge tier={tier ?? 'bronze'} size={24} float={false} />
              {isVerified ? <VerifiedBadge size={18} /> : <NewSellerBadge size={18} />}
            </span>
          </div>
          <p className="mt-1.5 text-body-sm text-text-secondary">
            Your store is open.
            {isFounding && <> <span className="font-semibold text-text-primary">Founding Seller</span>, half-price fees for year one.</>}
          </p>
        </div>
      </div>

      <ul className="mt-6">
        {WHY_STAY.map(({ Icon, tile, text }, i) => (
          <li key={text} className={`flex items-center gap-3.5 py-3.5 text-body-sm text-text-secondary ${i > 0 ? 'border-t border-white/[0.05]' : ''}`}>
            <span aria-hidden className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${tile}`}>
              <Icon weight="duotone" className="h-5 w-5" />
            </span>
            {text}
          </li>
        ))}
      </ul>

      <HouseRules />

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
        <AppLink href="/sell/new" className="inline-flex h-11 items-center justify-center rounded-md bg-white px-5 text-body-sm font-semibold text-black transition-[background-color,transform] hover:bg-white/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring sm:h-10">
          Start Selling
        </AppLink>
        {shopSlug && (
          <AppLink
            href={`/shop/${shopSlug}`}
            className="relative inline-flex h-11 items-center justify-center overflow-hidden rounded-md border border-lime-tint-border bg-lime-tint-bg px-5 text-body-sm font-semibold text-lime-text transition-colors hover:bg-[rgba(86,184,127,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring sm:h-10"
          >
            {!reduce && <ShineBorder duration={4} borderWidth={1} shineColor="rgba(163,230,53,0.9)" />}
            View Your Store
          </AppLink>
        )}
      </div>
    </section>
  )
}
