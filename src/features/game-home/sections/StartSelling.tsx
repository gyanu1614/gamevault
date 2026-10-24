import Link from '@/components/navigation/AppLink'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/ssr'
import { SilverIcon } from '@/components/ui/silver-icon'
import { formatStatPrice } from '@/lib/seo/page-stats-format'
import type { StartSellingModel } from '../types'

/**
 * Start Selling (owner, 2026-10-23: "better CTA"). A split band with no frame
 * around it: the pitch and one strong button on the left; on the right, our
 * own highest-priced live offers float over a warm glow with their real
 * listed prices, so a seller sees what these items go for here. With no
 * offers yet it becomes the "be the first seller" ask. References: Eldorado
 * /become-seller (one CTA + proof row), GameBoost floating price pills.
 *
 * Server component; the float is CSS (game-home.css), off under reduced motion.
 */
const POSITIONS = [
  'left-[4%] top-[6%] sm:left-[6%]',
  'right-[2%] top-[34%] sm:right-[4%]',
  'left-[14%] bottom-[4%] sm:left-[20%]',
] as const

function proof(firstSeller: boolean) {
  return [
    { icon: '/icons/set/store.svg', text: 'Free to List' },
    { icon: '/icons/set/wallet.svg', text: 'Get Paid When It Sells' },
    firstSeller ? { icon: '/icons/set/crown.svg', text: 'Your Offer Shows First' } : { icon: '/icons/set/bolt.svg', text: 'Buyers Already Shop Here' },
  ]
}

export function StartSelling({ model }: { model: StartSellingModel }) {
  const { gameSlug, gameName, itemNoun, examples, firstSeller } = model
  const title = firstSeller ? `Be the First to Sell ${gameName} ${itemNoun}` : `Got ${gameName} ${itemNoun}? Sell Them for Real Money`
  const lead = firstSeller
    ? `No one has listed ${gameName} yet. List first and every buyer who lands here sees your offer.`
    : `List for free in minutes. ${gameName} buyers already shop on DropMarket, and you get paid when it sells.`

  return (
    <section aria-labelledby="start-selling" className="relative mt-20 overflow-hidden sm:mt-28">
      {/* Warm glow behind the art; the band itself has no box. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-24 top-1/2 h-[480px] w-[640px] -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(245,196,81,0.20),rgba(245,196,81,0.06)_55%,transparent)] blur-2xl"
      />

      <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14">
        <div>
          <h2 id="start-selling" className="text-balance text-[28px] font-extrabold leading-[1.1] tracking-[-0.025em] text-text-primary sm:text-[38px]">
            {title}
          </h2>
          <p className="mt-4 max-w-xl text-[15.5px] leading-relaxed text-[#C9CDC6] sm:text-[17px]">{lead}</p>

          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
            {proof(firstSeller).map((p) => (
              <li key={p.text} className="flex items-center gap-2.5 text-[14px] font-medium text-text-primary">
                <SilverIcon src={p.icon} alt="" className="h-7 w-7" />
                {p.text}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link
              href={`/${gameSlug}/sell`}
              className="group inline-flex h-[52px] items-center gap-2.5 rounded-lg bg-[#F5C451] px-7 text-[16px] font-extrabold text-[#141414] shadow-[0_18px_40px_-16px_rgba(245,196,81,0.65)] transition-[background-color,transform,box-shadow] hover:-translate-y-0.5 hover:bg-[#F8CF6A] active:translate-y-0"
            >
              {firstSeller ? `Sell ${gameName} First` : 'Start Selling'}
              <ArrowRightIcon size={18} weight="bold" aria-hidden className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/sell/fees" className="text-[14.5px] font-semibold text-text-secondary underline-offset-4 transition-colors hover:text-text-primary hover:underline">
              See Seller Fees
            </Link>
          </div>
        </div>

        <div aria-hidden className="relative mx-auto h-[260px] w-full max-w-[520px] sm:h-[320px]">
          {examples.length > 0 ? (
            examples.map((ex, i) => (
              <div
                key={ex.imageUrl}
                className={`gh-float absolute ${POSITIONS[i]} flex items-center gap-3 rounded-2xl bg-[#1E1F25]/95 py-2.5 pl-2.5 pr-4 shadow-[0_24px_48px_-20px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur`}
                style={{ ['--gh-i' as string]: i }}
              >
                <span className="grid h-14 w-14 place-items-center rounded-xl bg-white/[0.05] sm:h-16 sm:w-16">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ex.imageUrl} alt="" width={56} height={56} loading="lazy" decoding="async" className="h-12 w-12 object-contain sm:h-14 sm:w-14" />
                </span>
                <span className="flex flex-col">
                  <span className="max-w-[150px] truncate text-[14px] font-semibold text-text-primary">{ex.name}</span>
                  <span className="text-[13px] text-text-secondary">
                    Listed at <b className="font-bold tabular-nums text-[#4ADE80]">${formatStatPrice(ex.priceUsd)}</b>
                  </span>
                </span>
              </div>
            ))
          ) : (
            <div className="gh-float absolute inset-0 grid place-items-center">
              <SilverIcon src="/icons/set/coins.svg" alt="" className="h-40 w-40 sm:h-48 sm:w-48" />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
