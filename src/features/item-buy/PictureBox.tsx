import { MARKET_CARD } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'

/**
 * The pet's picture: a compact square tile beside its name (owner,
 * 2026-10-27: the big box blew the 128px catalogue art up until it blurred).
 * The tile caps the art near its real size; the picked trait's shorthand sits
 * in the corner, as on an inventory slot. Plain card surface, no glow.
 */
export function PictureBox({ imageUrl, name, badge, className }: { imageUrl: string | null; name: string; badge?: string | null; className?: string }) {
  return (
    <div className={cn('relative grid aspect-square shrink-0 place-items-center overflow-hidden rounded-lg', MARKET_CARD, className)}>
      {imageUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element -- catalogue art from storage, same as the value pages */
        <img
          src={imageUrl}
          alt={name}
          width={192}
          height={192}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="h-[76%] w-[76%] max-w-[192px] object-contain drop-shadow-[0_14px_22px_rgba(0,0,0,0.5)]"
        />
      ) : (
        <span className="font-medium uppercase tracking-wider text-text-tertiary" style={{ fontSize: 'var(--fs-micro)' }}>
          No Image Yet
        </span>
      )}
      {badge ? (
        <span className="absolute left-2 top-2 inline-flex h-6 items-center rounded bg-black/45 px-2 text-[11.5px] font-bold tracking-wide text-text-primary backdrop-blur-sm">
          {badge}
        </span>
      ) : null}
    </div>
  )
}
