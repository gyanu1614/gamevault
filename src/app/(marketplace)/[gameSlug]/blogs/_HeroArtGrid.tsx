/**
 * A 2×2 grid of top-valued item renders for the hub hero — the immersive
 * "side image" treatment. Each render floats on a dark tile with a soft radial
 * glow behind it, art always `object-contain` (never cropped).
 *
 * Self-hides when fewer than four items have art, so a game we haven't added
 * renders (Adopt Me today) simply shows the text hero with no empty grid.
 */

import Link from 'next/link'

export interface HeroArtItem {
  name: string
  slug: string
  imageUrl: string
  priceLabel: string
}

export function HeroArtGrid({
  gameSlug,
  items,
}: {
  gameSlug: string
  items: HeroArtItem[]
}) {
  const withArt = items.filter((i) => i.imageUrl)
  if (withArt.length < 4) return null
  const tiles = withArt.slice(0, 4)

  return (
    <div className="hidden w-full max-w-[420px] grid-cols-2 gap-px overflow-hidden border border-[#1E2723] bg-[#1E2723] lg:grid">
      {tiles.map((item) => (
        <Link
          key={item.slug}
          href={`/${gameSlug}/values/${item.slug}`}
          className="group relative flex aspect-square flex-col items-center justify-center bg-[#0B0F0C] p-5 transition-colors hover:bg-[#101710]"
        >
          {/* Soft radial glow behind the render. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(60% 60% at 50% 42%, rgba(63,163,92,0.10), transparent 72%)',
            }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element -- remote item art */}
          <img
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            className="relative z-10 h-[62%] w-full object-contain transition-transform duration-500 group-hover:scale-105"
          />
          <span className="relative z-10 mt-3 flex w-full items-center justify-between gap-2">
            <span className="truncate text-[12px] font-semibold text-[#D7DED4]">
              {item.name}
            </span>
            <span className="shrink-0 font-mono text-[12px] font-bold tabular-nums text-[#8FBF9C]">
              {item.priceLabel}
            </span>
          </span>
        </Link>
      ))}
    </div>
  )
}
