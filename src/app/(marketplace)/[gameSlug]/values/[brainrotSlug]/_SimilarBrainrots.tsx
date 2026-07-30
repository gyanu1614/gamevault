'use client'

import { useRef } from 'react'
import Link from 'next/link'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { cn } from '@/lib/utils'
import { sabCard } from '@/lib/sab/theme'
import { formatCash } from '@/lib/sab/format'

export type SimilarItem = {
  id: string
  name: string
  slug: string
  rarity: string
  imageUrl: string | null
  priceUsd: number | string | null
}

/**
 * Horizontal "Similar Brainrots" carousel — scroll-snap row with prev/next
 * arrows on desktop. Sits before the FAQ. Near-black cards matching the page.
 */
export function SimilarBrainrots({
  rarity,
  items,
}: {
  rarity: string
  items: SimilarItem[]
}) {
  const trackRef = useRef<HTMLDivElement>(null)

  if (items.length === 0) return null

  const scroll = (dir: 1 | -1) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.8, 480), behavior: 'smooth' })
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="border-t border-white/[0.07] pt-10">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-[#F1F3F1]">Similar {rarity} Brainrots</h2>
          <div className="flex items-center gap-2">
            <Link
              href="/steal-a-brainrot/values"
              className="text-sm font-semibold text-[#4FB477] hover:underline"
            >
              See all
            </Link>
            <div className="hidden items-center gap-1.5 sm:flex">
              <ArrowBtn dir={-1} onClick={() => scroll(-1)} />
              <ArrowBtn dir={1} onClick={() => scroll(1)} />
            </div>
          </div>
        </div>

        <div
          ref={trackRef}
          className="mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/steal-a-brainrot/values/${item.slug}`}
              className={cn(
                sabCard,
                'w-[200px] shrink-0 snap-start overflow-hidden transition hover:-translate-y-0.5 hover:border-[#2A3A31] sm:w-[220px]',
              )}
            >
              <div className="aspect-square bg-black/20 p-4">
                {item.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={`${item.name} Steal a Brainrot`}
                    className="h-full w-full object-contain"
                  />
                )}
              </div>
              <div className="border-t border-white/[0.06] px-4 py-3">
                <p className="truncate text-[15px] font-semibold text-[#F1F3F1]">{item.name}</p>
                <p className="mt-0.5 text-sm tabular-nums text-[#9BA8A0]">
                  {formatCash(item.priceUsd) ?? 'Price pending'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

function ArrowBtn({ dir, onClick }: { dir: 1 | -1; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === 1 ? 'Next' : 'Previous'}
      className="grid h-8 w-8 place-items-center border border-[#26332C] bg-white/[0.03] text-[#B7C0BA] transition hover:border-[#2A3A31] hover:bg-white/[0.06]"
    >
      {dir === 1 ? (
        <ChevronRightIcon sx={{ fontSize: 20 }} />
      ) : (
        <ChevronLeftIcon sx={{ fontSize: 20 }} />
      )}
    </button>
  )
}
