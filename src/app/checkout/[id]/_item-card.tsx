/**
 * The checkout item card (owner 2026-10-27, Eldorado-style reference): the
 * item — thumbnail, title, game · category, a "|"-separated detail line — then a hairline and
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
  subtitle,
  details,
  deliveryMethod,
  seller,
}: {
  title: string
  imageSrc: string
  /** "Roblox · Items" under the title. */
  subtitle: string
  /** "Delivery Time: 1–24 Hours", "Quantity: 1", … in display order. */
  details: string[]
  deliveryMethod: { label: string; description: string } | null
  seller: { name: string; verified: boolean; online: boolean; pills: SellerPill[] }
}) {
  return (
    <section aria-label="Your Order" className={cn(PANEL_CLASS, 'p-4 sm:p-5')} style={CARD_STYLE}>
      {/* Phones: a 48px thumb beside the title, the detail line full width
          under both (owner 2026-10-27: the stacked phone card "doesn't look
          good"). sm+: the 64px thumb spans the title and the details. */}
      <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-x-3 sm:grid-cols-[64px_minmax(0,1fr)] sm:gap-x-4">
        <Image
          src={imageSrc}
          alt={title}
          width={64}
          height={64}
          unoptimized
          className="h-12 w-12 rounded-md bg-[#191A1F] object-cover sm:row-span-2 sm:h-16 sm:w-16"
        />
        <div className="min-w-0 self-center sm:self-start">
          <h2 className="line-clamp-2 text-[15px] font-semibold leading-snug text-[#E9EDF2] sm:text-[16px]">{title}</h2>
          {subtitle && <p className="mt-0.5 truncate text-[13px] text-[#9AA6B3]">{subtitle}</p>}
        </div>
        {/* "|" between details: each detail carries a left hairline and the
            line is pulled left by its width under a clip, so a wrapped line
            never starts or ends on a stray divider. */}
        <div className="col-span-2 mt-3 overflow-hidden sm:col-span-1 sm:col-start-2 sm:mt-1">
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
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md bg-[rgba(106,168,255,0.12)] px-2 py-1.5 text-[12px] font-semibold leading-none text-[#E9EDF2] sm:px-2.5 sm:text-[12.5px]',
                      // Phones: the blue check beside the name already says it,
                      // so the record fits one row.
                      p.kind === 'verified' && seller.verified && seller.pills.length > 1 && 'max-sm:hidden',
                    )}
                  >
                    <Icon aria-hidden size={14} weight="fill" color={TRUST_BLUE} />
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
