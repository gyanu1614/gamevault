import { Package } from '@phosphor-icons/react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

export function SellerAvatar({ seller, className }: { seller: any; className?: string }) {
  const name = seller?.shop_name || seller?.username || 'Seller'
  if (seller?.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={seller.avatar_url} alt="" className={cn('h-10 w-10 shrink-0 rounded-md object-cover', className)} />
    )
  }
  return (
    <span
      aria-hidden
      className={cn(
        'grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white/[0.06] text-[14px] font-bold text-text-secondary',
        className,
      )}
    >
      {(name.trim()[0] || 'S').toUpperCase()}
    </span>
  )
}

export function ListingThumb({ listing }: { listing: any }) {
  return (
    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-white/[0.05]">
      {listing.images?.[0] ? (
        <Image src={listing.images[0]} alt="" fill sizes="44px" className="object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Package aria-hidden weight="bold" className="h-5 w-5 text-text-disabled" />
        </div>
      )}
    </div>
  )
}
