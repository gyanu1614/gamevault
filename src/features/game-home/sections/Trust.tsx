import Link from '@/components/navigation/AppLink'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/ssr'
import { SilverIcon } from '@/components/ui/silver-icon'
import { SectionHeading } from './SectionHeading'

/**
 * Why Players Buy (owner, 2026-10-23): no cards. Three floating icons over
 * ONE green glow (one hue, so the silver reads as one material), hairline
 * columns, a title and one line each (Linear FIG columns, GameBoost glossy
 * icons). The SafeDrop emblem keeps its own colour (brand art); the others
 * are silver-glass. Copy follows the site's approved trust lines.
 */
const ITEMS = [
  { icon: '/icons/safedrop-emblem.png', brand: true, title: 'SafeDrop Protection', line: 'You get exactly what you ordered, or your money back.' },
  { icon: '/icons/set/verified.svg', brand: false, title: 'Verified Sellers', line: 'Sellers verify their ID before they get paid and are rated on real orders.' },
  { icon: '/icons/set/bolt.svg', brand: false, title: 'Fast In-Game Delivery', line: 'Delivery time is shown before you pay and tracked in your order chat.' },
] as const

export function Trust({ gameName, itemNoun }: { gameName: string; itemNoun: string }) {
  return (
    <section aria-labelledby="why-buy" className="relative mt-20 sm:mt-28">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-10 mx-auto h-64 max-w-4xl rounded-full bg-[radial-gradient(ellipse_at_center,rgba(74,222,128,0.10),transparent_70%)] blur-2xl"
      />
      <SectionHeading variant="showcase" id="why-buy" title={`Why Players Buy ${gameName} ${itemNoun} on DropMarket`} sub="Every order, from checkout to delivery." />

      <ul className="relative mx-auto mt-10 grid max-w-5xl gap-8 sm:mt-14 lg:grid-cols-3 lg:gap-0 lg:divide-x lg:divide-white/[0.06]">
        {ITEMS.map((item, i) => (
          <li key={item.title} className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-5 lg:flex lg:flex-col lg:items-center lg:gap-0 lg:px-8 lg:text-center">
            <span className="relative grid h-[88px] w-[88px] place-items-center lg:h-[150px] lg:w-[150px]">
              <span aria-hidden className="absolute inset-[8%] rounded-full bg-[radial-gradient(circle,rgba(74,222,128,0.26),transparent_68%)] blur-xl" />
              <span aria-hidden className="absolute bottom-[4%] h-[9%] w-[46%] rounded-full bg-black/60 blur-md" />
              <span className="gh-float relative" style={{ ['--gh-i' as string]: i }}>
                {item.brand ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.icon} alt="" width={120} height={120} loading="lazy" decoding="async" className="h-[68px] w-[68px] object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)] lg:h-[118px] lg:w-[118px]" />
                ) : (
                  <SilverIcon src={item.icon} alt="" className="h-[68px] w-[68px] lg:h-[112px] lg:w-[112px]" />
                )}
              </span>
            </span>
            <span className="min-w-0 lg:mt-6 lg:flex lg:flex-col lg:items-center">
              <span className="block text-[18px] font-bold tracking-[-0.01em] text-text-primary lg:text-[20px]">{item.title}</span>
              <span className="mt-1.5 block text-[14.5px] leading-relaxed text-text-secondary lg:max-w-[260px] lg:text-[15px]">{item.line}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="relative mt-10 flex justify-center">
        <Link href="/safedrop" className="group inline-flex items-center gap-1.5 text-[14.5px] font-semibold text-text-secondary transition-colors hover:text-text-primary">
          How SafeDrop Protection Works
          <ArrowRightIcon size={14} weight="bold" aria-hidden className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  )
}
