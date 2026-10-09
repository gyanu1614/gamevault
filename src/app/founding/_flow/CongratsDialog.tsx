'use client'

/**
 * The moment the account becomes a seller: a centred dialog with confetti,
 * the store's logo + name, and the two doors — Start Selling (the listing
 * wizard) and View Your Store (an animated outline, no glow). Under them,
 * the three things that happen next, so nobody has to ask how to sell.
 * Opens once, right after the agreement is signed; a return visit sees the
 * flat done card instead. Reduced motion: no confetti, no shine.
 */
import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { Check } from '@phosphor-icons/react/dist/ssr/Check'
import AppLink from '@/components/navigation/AppLink'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ShineBorder } from '@/components/ui/shine-border'
import { getAvatarUrl } from '@/lib/utils/avatar'

const NEXT = [
  'Create your first listing. It takes about two minutes.',
  'Buyers find it, message you here, and pay before you deliver.',
  'Deliver once the purchase is made, and the sale is done. SafeDrop Protection covers every order.',
]

export function CongratsDialog({
  open,
  onOpenChange,
  shopName,
  shopSlug,
  logoUrl,
  isFounding,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  shopName: string | null
  shopSlug: string | null
  logoUrl: string | null
  isFounding: boolean
}) {
  const reduce = useReducedMotion()
  const fired = useRef(false)

  useEffect(() => {
    if (!open || fired.current || reduce) return
    fired.current = true
    const colors = ['#56B87F', '#A3E635', '#F5C451', '#E9EDF2']
    const burst = (x: number, angle: number) =>
      confetti({ particleCount: 70, spread: 60, startVelocity: 42, angle, origin: { x, y: 0.6 }, colors, ticks: 220, scalar: 0.9, disableForReducedMotion: true })
    const t1 = setTimeout(() => { burst(0.2, 60); burst(0.8, 120) }, 120)
    const t2 = setTimeout(() => confetti({ particleCount: 90, spread: 100, startVelocity: 30, origin: { x: 0.5, y: 0.45 }, colors, ticks: 240, scalar: 0.8, disableForReducedMotion: true }), 520)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [open, reduce])

  const name = shopName ?? 'Your store'
  const avatar = getAvatarUrl(logoUrl, name)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-32px)] max-w-[520px] rounded-lg border-0 bg-bg-raised p-6 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <motion.span
            initial={reduce ? false : { scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 18, delay: 0.05 }}
            className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-lime-tint-bg text-lime-text"
            aria-hidden
          >
            <Check weight="bold" className="h-7 w-7" />
          </motion.span>
          <DialogTitle className="mt-4 text-heading text-text-primary">Congratulations, You&apos;re a Seller</DialogTitle>
          <DialogDescription className="mt-1.5 text-body text-text-secondary">
            Your store is open on DropMarket. Here is where to go next.
          </DialogDescription>
        </div>

        {/* Store identity */}
        <div className="mt-6 flex items-center gap-3.5 border-t border-white/[0.07] pt-5">
          {/* eslint-disable-next-line @next/next/no-img-element -- the seller's own logo / generated robot */}
          <img src={avatar} alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-full bg-bg-overlay object-cover" />
          <div className="min-w-0">
            <p className="text-caption font-normal text-text-tertiary">Store Name</p>
            <p className="truncate text-body font-semibold text-text-primary">{name}</p>
          </div>
          {isFounding && (
            <p className="ml-auto shrink-0 text-right text-caption font-normal text-text-tertiary">
              <span className="font-semibold text-lime-text">Founding Seller</span>
              <br />
              Half-price fees, year one
            </p>
          )}
        </div>

        {/* What happens next */}
        <ol className="mt-5 border-t border-white/[0.07]">
          {NEXT.map((line, i) => (
            <li key={line} className="flex items-start gap-3 border-b border-white/[0.07] py-3 text-body-sm text-text-secondary last:border-b-0">
              <span aria-hidden className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-bg-overlay text-caption font-semibold tabular-nums text-text-primary">{i + 1}</span>
              <span>{line}</span>
            </li>
          ))}
        </ol>

        {/* Doors */}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
          <AppLink
            href="/sell/new"
            className="inline-flex h-11 flex-1 items-center justify-center rounded-md bg-white px-5 text-body-sm font-semibold text-black transition-[background-color,transform] hover:bg-white/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            Start Selling
          </AppLink>
          {shopSlug && (
            <AppLink
              href={`/shop/${shopSlug}`}
              className="relative inline-flex h-11 flex-1 items-center justify-center overflow-hidden rounded-md border border-lime-tint-border bg-lime-tint-bg px-5 text-body-sm font-semibold text-lime-text transition-colors hover:bg-[rgba(86,184,127,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {!reduce && <ShineBorder duration={4} borderWidth={1} shineColor="rgba(163,230,53,0.9)" />}
              View Your Store
            </AppLink>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
