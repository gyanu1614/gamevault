/**
 * The checkout item card (owner 2026-10-27, Eldorado-style reference): the
 * item — thumbnail, title, a "|"-separated detail line — then a hairline and
 * the seller: name, verified mark, an Online dot when the heartbeat is fresh,
 * and real-data pills (src/lib/seller/stat-line.ts `sellerPills`). The money
 * lives in the buy box below it, never here.
 */
import Image from 'next/image'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { ThumbsUp } from '@phosphor-icons/react/dist/ssr/ThumbsUp'
import { Star } from '@phosphor-icons/react/dist/ssr/Star'
import { SealCheck } from '@phosphor-icons/react/dist/ssr/SealCheck'
import { Package } from '@phosphor-icons/react/dist/ssr/Package'
import { CalendarCheck } from '@phosphor-icons/react/dist/ssr/CalendarCheck'
import { UserCircle } from '@phosphor-icons/react/dist/ssr/UserCircle'

import { VerifiedBadge } from '@/components/seller/VerifiedBadge'
import { DeliveryMethodInfo } from '@/components/marketplace/DeliveryMethodInfo'
import type { SellerPill } from '@/lib/seller/stat-line'
import { cn } from '@/lib/utils'
import { PANEL_CLASS, PANEL_STYLE, TRUST_BLUE } from './_surfaces'

const PILL_ICON: Record<SellerPill['kind'], PhosphorIcon> = {
  positive: ThumbsUp,
  reviews: Star,
  sold: Package,
  new: UserCircle,
  verified: SealCheck,
  since: CalendarCheck,
}

/** One item-detail: a hairline divider on its left (clipped at a line start). */
const DETAIL = 'border-l border-white/20 pl-2.5'

/** The panel fill plus the faint hairline the payment rows carry. */
const CARD_STYLE = { ...PANEL_STYLE, boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.07), ${PANEL_STYLE.boxShadow}` }

export function ItemCard({
  title,
  imageSrc,
  details,
  deliveryMethod,
  seller,
}: {
  title: string
  imageSrc: string
  /** "Roblox · Items", "Delivery Time: 1–24 Hours", … in display order. */
  details: string[]
  deliveryMethod: { label: string; description: string } | null
  seller: { name: string; verified: boolean; online: boolean; pills: SellerPill[] }
}) {
  return (
    <section aria-label="Your Order" className={cn(PANEL_CLASS, 'p-4 sm:p-5')} style={CARD_STYLE}>
      <div className="flex items-start gap-4">
        <Image
          src={imageSrc}
          alt={title}
          width={64}
          height={64}
          unoptimized
          className="h-16 w-16 shrink-0 rounded-md bg-[#191A1F] object-cover"
        />
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 text-[16px] font-semibold leading-snug text-[#E9EDF2]">{title}</h2>
          {/* "|" between details: each detail carries a left hairline and the
              line is pulled left by its width under a clip, so a wrapped line
              never starts or ends on a stray divider. */}
          <div className="mt-1.5 overflow-hidden">
            <p className="-ml-[11px] flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] leading-snug text-[#9AA6B3]">
              {details.map((d) => (
                <span key={d} className={DETAIL}>
                  {d}
                </span>
              ))}
              {deliveryMethod && (
                <span className={cn(DETAIL, 'inline-flex items-center gap-0.5')}>
                  Delivery Method: {deliveryMethod.label}
                  <DeliveryMethodInfo label={deliveryMethod.label} description={deliveryMethod.description} />
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-white/[0.08] pt-3.5">
        <p className="text-[12.5px] text-[#9AA6B3]">Seller</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
          <span className="flex min-w-0 items-center gap-1.5 text-[15px] font-bold text-[#E9EDF2]">
            <span className="truncate">{seller.name}</span>
            {seller.verified && <VerifiedBadge size={16} />}
            {seller.online && (
              <span className="ml-1.5 inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium">
                <span aria-hidden className="h-2 w-2 rounded-full bg-[#3FD986]" />
                Online
              </span>
            )}
          </span>
          {seller.pills.length > 0 && (
            <ul aria-label="Seller Record" className="flex flex-wrap gap-2">
              {seller.pills.map((p) => {
                const Icon = PILL_ICON[p.kind]
                return (
                  <li
                    key={p.kind}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[rgba(106,168,255,0.12)] px-2.5 py-1.5 text-[12.5px] font-semibold leading-none text-[#E9EDF2]"
                  >
                    <Icon aria-hidden size={15} weight="fill" color={TRUST_BLUE} />
                    {p.label}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
