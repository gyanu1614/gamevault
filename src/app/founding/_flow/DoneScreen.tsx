'use client'

/**
 * The finished state on the page itself (the dialog is the first-time
 * moment; this is what stays). Store identity with the logo, the three
 * next steps with their own icons, and the two doors: Start Selling and an
 * animated View Your Store.
 */
import { useReducedMotion } from 'framer-motion'
import AppLink from '@/components/navigation/AppLink'
import { ShineBorder } from '@/components/ui/shine-border'
import { PlusCircle } from '@phosphor-icons/react/dist/ssr/PlusCircle'
import { Eye } from '@phosphor-icons/react/dist/ssr/Eye'
import { IdentificationCard } from '@phosphor-icons/react/dist/ssr/IdentificationCard'
import { SealCheck } from '@phosphor-icons/react/dist/ssr/SealCheck'
import { getAvatarUrl } from '@/lib/utils/avatar'

export function DoneScreen({
  shopName,
  shopSlug,
  logoUrl,
  isVerified,
  isFounding,
}: {
  shopName: string | null
  shopSlug: string | null
  logoUrl: string | null
  isVerified: boolean
  isFounding: boolean
}) {
  const reduce = useReducedMotion()
  const name = shopName ?? 'Your store'
  const steps = [
    { Icon: PlusCircle, tile: 'bg-lime-tint-bg text-lime-text', text: 'Create a listing. It takes about two minutes and buyers see it as soon as it is live.' },
    { Icon: Eye, tile: 'bg-info-bg text-info', text: 'Listings over $100 get a quick check by our team first while you are new.' },
    isVerified
      ? { Icon: SealCheck, tile: 'bg-lime-tint-bg text-lime-text', text: 'You are verified: withdraw whenever your balance clears.' }
      : { Icon: IdentificationCard, tile: 'bg-warning-bg text-warning', text: 'Verify your identity when you make your first withdrawal.' },
  ]

  return (
    <section aria-labelledby="founding-done-title">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- the seller's own logo / generated robot */}
        <img src={getAvatarUrl(logoUrl, name)} alt="" width={56} height={56} className="h-14 w-14 shrink-0 rounded-full bg-bg-overlay object-cover" />
        <div className="min-w-0">
          <h2 id="founding-done-title" className="text-subheading text-text-primary">You&apos;re a Seller at DropMarket</h2>
          <p className="mt-0.5 truncate text-body-sm text-text-secondary">
            Store <span className="font-semibold text-text-primary">{name}</span> is open.
            {isFounding && <> <span className="font-semibold text-lime-text">Founding Seller</span>, half-price fees for year one.</>}
          </p>
        </div>
      </div>

      <ul className="mt-5">
        {steps.map(({ Icon, tile, text }, i) => (
          <li key={text} className={`flex items-center gap-3.5 py-3 text-body-sm text-text-secondary ${i > 0 ? 'border-t border-white/[0.07]' : ''}`}>
            <span aria-hidden className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${tile}`}>
              <Icon weight="duotone" className="h-5 w-5" />
            </span>
            {text}
          </li>
        ))}
      </ul>

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
