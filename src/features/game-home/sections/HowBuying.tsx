import { SilverIcon } from '@/components/ui/silver-icon'
import { SectionHeading } from './SectionHeading'

/**
 * How Buying Works (owner, 2026-10-23): no cards. Four big silver-glass 3D
 * icons with centred text under each, a connector line that draws itself as
 * the row scrolls into view, and each step rising in turn (Linear "FIG" /
 * Aceternity timeline references, docs/superpowers/specs/…-references.md).
 * Phones: a vertical timeline, icon left, text right.
 *
 * Server component. The motion is CSS scroll-driven (game-home.css), so the
 * steps are visible without JavaScript and static under reduced motion. Copy
 * is the approved HowItWorksBand copy.
 */
const STEPS = [
  { icon: '/icons/set/search.svg', title: (item: string) => `Choose Your ${item}`, body: 'Compare offers by price, delivery time and seller rating.' },
  { icon: '/icons/set/card.svg', title: () => 'Pay at Checkout', body: 'Pay in seconds. Your order is covered from the start.' },
  { icon: '/icons/set/package.svg', title: () => 'Get Your Delivery', body: 'Your seller delivers in-game. Track it in your order chat.' },
  { icon: '/icons/set/shield-check.svg', title: () => 'Confirm Your Order', body: "Got it? Confirm and you're done. Not received? You get a full refund." },
] as const

export function HowBuying({ gameName, itemNoun, itemNounSingular }: { gameName: string; itemNoun: string; itemNounSingular: string }) {
  return (
    <section aria-labelledby="how-buying" className="relative mt-20 sm:mt-28">
      <SectionHeading
        variant="showcase"
        id="how-buying"
        title={`How to Buy ${gameName} ${itemNoun} Safely`}
        sub="SafeDrop Protection covers every order, from checkout to delivery."
      />

      <ol className="gh-steps relative mx-auto mt-10 grid max-w-6xl gap-7 sm:mt-14 lg:grid-cols-4 lg:gap-6">
        {/* Desktop connector at icon-centre height: a faint track and a drawn line. */}
        <svg
          aria-hidden
          className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-[64px] hidden h-[2px] w-[75%] overflow-visible lg:block"
          viewBox="0 0 100 2"
          preserveAspectRatio="none"
        >
          <line x1="0" y1="1" x2="100" y2="1" stroke="rgba(255,255,255,0.08)" strokeWidth="2" strokeDasharray="1.2 1.6" vectorEffect="non-scaling-stroke" />
          <line className="gh-draw" x1="0" y1="1" x2="100" y2="1" pathLength={1} stroke="url(#gh-steps-line)" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <defs>
            <linearGradient id="gh-steps-line" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="rgba(255,255,255,0.55)" />
              <stop offset="1" stopColor="#4ADE80" />
            </linearGradient>
          </defs>
        </svg>
        {/* Phone timeline: one vertical hairline through the icon column. */}
        <span aria-hidden className="gh-draw-y pointer-events-none absolute bottom-9 left-[35px] top-9 w-px bg-gradient-to-b from-white/30 to-[#4ADE80]/60 lg:hidden" />

        {STEPS.map((step, i) => (
          <li
            key={step.icon}
            className="gh-step relative grid grid-cols-[72px_minmax(0,1fr)] items-center gap-4 lg:flex lg:flex-col lg:items-center lg:gap-0 lg:text-center"
            style={{ ['--gh-i' as string]: i }}
          >
            <span className="gh-step-icon relative grid h-[72px] w-[72px] place-items-center lg:h-32 lg:w-32">
              <span aria-hidden className="absolute inset-[-18%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.11),transparent_62%)]" />
              <span aria-hidden className="absolute inset-x-[18%] bottom-[2%] h-[10%] rounded-full bg-black/60 blur-md" />
              <SilverIcon src={step.icon} alt="" className="relative h-[60px] w-[60px] lg:h-[104px] lg:w-[104px]" />
            </span>
            <span className="min-w-0 lg:mt-5 lg:flex lg:flex-col lg:items-center">
              <span className="block font-mono text-[11.5px] font-medium tracking-[0.18em] text-white/35">{String(i + 1).padStart(2, '0')}</span>
              <span className="mt-1 block text-[17px] font-semibold tracking-[-0.01em] text-text-primary lg:text-[18px]">
                {step.title(itemNounSingular)}
              </span>
              <span className="mt-1.5 block text-[14px] leading-relaxed text-text-secondary lg:max-w-[240px] lg:text-[14.5px]">{step.body}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
