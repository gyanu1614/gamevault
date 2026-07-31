/**
 * "Similar pets" grid for Adopt Me — a tidy responsive grid (2/3/4/6-up) of
 * frosted cards showing the pet art + name + FR cash. The set is small and
 * fits, so a grid reads better than a scroll carousel. Neutral chrome matching
 * the value-list cards; links stay on the Adopt Me hub.
 */

import Link from 'next/link'

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export interface AdoptMeSimilarItem {
  slug: string
  name: string
  imageUrl: string | null
  frCashUsd: number | null
}

export function AdoptMeSimilar({
  rarityLabel,
  items,
}: {
  rarityLabel: string
  items: AdoptMeSimilarItem[]
}) {
  if (items.length === 0) return null

  return (
    <section>
      <div className="border-t border-white/[0.07] pt-10">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-[#F1F3F1]">Similar {rarityLabel} pets</h2>
          <Link href="/adopt-me/values" className="text-sm font-semibold text-[#8FBF9C] hover:underline">
            See all
          </Link>
        </div>

        {/* Responsive GRID (not a carousel) — the set is small and fits, so a
            tidy 2/3/4/6-up grid of well-proportioned cards reads far better
            than a cramped scroll row. Frosted surface matches the value list. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {items.map((item) => (
            <Link
              key={item.slug}
              href={`/adopt-me/values/${item.slug}`}
              className="overflow-hidden border border-[#1E2723] bg-white/[0.04] transition hover:-translate-y-0.5 hover:bg-white/[0.06]"
            >
              <div className="aspect-square bg-black/20 p-3">
                {item.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- remote pet art
                  <img src={item.imageUrl} alt={`${item.name} — Adopt Me`} className="h-full w-full object-contain" />
                )}
              </div>
              <div className="border-t border-white/[0.06] px-3 py-2.5">
                <p className="truncate text-[13px] font-semibold text-[#F1F3F1]">{item.name}</p>
                <p className="mt-0.5 text-[12px] tabular-nums text-[#9BA8A0]">
                  {item.frCashUsd != null ? `${USD.format(item.frCashUsd)} FR` : 'Price pending'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
