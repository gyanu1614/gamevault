import Link from 'next/link'
import Image from 'next/image'

export interface CurrencyCardProps {
  slug: string
  name: string
  game: string
  iconSrc: string
  fromPrice: number
  badges?: ('instant' | string)[]
  /** Override the default `/currency/[slug]` link — used by Top-Ups & Gift Cards row. */
  hrefBase?: string
}

/**
 * Popular Currencies card.
 * Price uses tabular figures. 'instant' badge gets success styling, others neutral.
 * CLICK: navigates to /currency/[slug] (or hrefBase/[slug] if provided)
 */
export function CurrencyCard({ slug, name, game, iconSrc, fromPrice, badges = [], hrefBase = '/currency' }: CurrencyCardProps) {
  return (
    <Link
      href={`${hrefBase}/${slug}`}
      className="disco-card snap-start flex flex-col gap-3 p-5 bg-bg-raised border border-border-subtle rounded-lg cursor-pointer transition-all duration-default ease-gv hover:-translate-y-1 hover:border-border-strong hover:bg-bg-raised-hover hover:shadow-raised"
    >
      <Image
        src={iconSrc}
        alt={game}
        width={52}
        height={52}
        className="w-[52px] h-[52px] rounded-md flex-none object-cover"
      />
      <span className="font-display font-bold text-body text-text-primary leading-tight">{name}</span>
      <span className="text-[13px] text-text-tertiary">{game}</span>

      {badges.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {badges.map((badge) =>
            badge === 'instant' ? (
              <span
                key={badge}
                className="inline-flex items-center gap-[5px] h-[22px] px-2 font-semibold text-[11px] rounded-sm bg-success-bg text-success border border-success/[0.26]"
              >
                Instant
              </span>
            ) : (
              <span
                key={badge}
                className="inline-flex items-center h-[22px] px-2 font-semibold text-[11px] rounded-sm bg-bg-overlay-2 text-text-secondary border border-border-default"
              >
                {badge}
              </span>
            )
          )}
        </div>
      )}

      <div className="flex items-baseline gap-1.5 mt-auto pt-3 border-t border-border-subtle">
        <span className="text-caption text-text-tertiary">from</span>
        <span className="font-display font-bold text-[18px] text-tabular text-text-primary">
          ${fromPrice.toFixed(2)}
        </span>
      </div>
    </Link>
  )
}
