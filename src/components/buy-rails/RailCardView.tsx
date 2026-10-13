'use client'

import { useState, type ComponentType, type CSSProperties, type ReactNode } from 'react'
import LocalOfferRounded from '@mui/icons-material/LocalOfferRounded'
import ScheduleRounded from '@mui/icons-material/ScheduleRounded'
import StorefrontRounded from '@mui/icons-material/StorefrontRounded'
import VerifiedUserRounded from '@mui/icons-material/VerifiedUserRounded'
import { gameCtaSources } from '@/lib/content/game-cta-art'
import type { RailCard, RailPosition, RailSurface } from '@/lib/buy-rails/model'
import { cn } from '@/lib/utils'
import { RailButton } from './RailButton'
import { useRailTracking } from './useRailTracking'
import { useSellHref } from './useSellHref'

/**
 * One desktop rail card (≥1280px): a tall banner, GameBoost-style (owner,
 * 2026-10-11: "too small, no height"). The game's CTA art fills the card under
 * a dark scrim; the heading sits on top, the currency icon or item thumbnail
 * in the middle, the live numbers as icon lines and one white button at the
 * bottom. Flat #1D1E23 surface (one step up from the #16171B hub ground), no
 * glow, no stars, no emoji.
 * No offers → the same card asks to sell ("Have a Frost Fury?").
 */
type Icon = ComponentType<{ style?: CSSProperties; 'aria-hidden'?: boolean; className?: string }>

export function RailCardView({
  card,
  surface,
  position,
  size = 'tall',
  className,
}: {
  card: RailCard
  surface: RailSurface
  position: RailPosition
  /** 'short' under the blog's "On This Page" list, so the stack fits the screen. */
  size?: 'tall' | 'short'
  className?: string
}) {
  const { ref, onClick } = useRailTracking<HTMLDivElement>({
    surface,
    position,
    game: card.game,
    item: card.item,
    variant: card.variant,
  })
  const sell = useSellHref(card, `rail-${surface}`)
  const href = card.variant === 'sell' ? sell : card.href

  const lines: Array<{ icon: Icon; text: ReactNode }> = card.lines.map((text, i) => ({
    icon: card.kind === 'currency' && i === 1 ? LocalOfferRounded : StorefrontRounded,
    text,
  }))
  if (card.meta) lines.push({ icon: ScheduleRounded, text: <>Typical Delivery {card.meta}</> })
  if (card.variant === 'buy') lines.push({ icon: VerifiedUserRounded, text: 'SafeDrop Protection' })

  return (
    <div
      ref={ref}
      className={cn(
        'relative isolate flex flex-col overflow-hidden rounded-[8px] bg-[#1D1E23]',
        // Tall: 460px (owner-approved height); the rail centres it under the nav.
        size === 'tall' ? 'min-h-[460px]' : 'min-h-[360px]',
        className,
      )}
    >
      {card.kind === 'currency' ? (
        card.image && <CoinBackdrop src={card.image.src} />
      ) : (
        card.art && <ArtLayer game={card.game} src={card.art} dim={card.kind === 'item' && !!card.image} />
      )}

      <div className="relative flex flex-1 flex-col p-4">
        <p className="text-balance text-subheading font-bold leading-[1.15] tracking-[-0.01em] text-white">{card.title}</p>

        <div className="flex flex-1 items-center justify-center py-4">
          <RailMedia card={card} />
        </div>

        <ul className="space-y-1.5">
          {lines.map(({ icon: LineIcon, text }, i) => (
            <li key={i} className={cn('flex items-center gap-2 text-body-sm tabular-nums', i === 0 ? 'font-medium text-white' : 'text-[#C9CBD1]')}>
              <LineIcon aria-hidden style={{ fontSize: 16 }} className="shrink-0 text-[#9A9DA6]" />
              <span className="min-w-0">{text}</span>
            </li>
          ))}
        </ul>

        <RailButton href={href} onClick={onClick} className="mt-4 h-11 w-full text-body-sm">
          {card.buyLabel}
        </RailButton>
      </div>
    </div>
  )
}

/** The currency icon or the item's thumbnail, large, over the art. Items cards let the art speak. */
function RailMedia({ card }: { card: RailCard }) {
  if (card.kind === 'items' && card.art) return null
  if (!card.image) {
    return (
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#24252B]">
        <StorefrontRounded aria-hidden style={{ fontSize: 32 }} className="text-[#9A9DA6]" />
      </span>
    )
  }
  const big = card.kind === 'item'
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={card.image.src}
      alt={card.image.alt}
      width={big ? 132 : 96}
      height={big ? 132 : 96}
      loading="lazy"
      decoding="async"
      className={cn('object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)]', big ? 'h-[132px] w-[132px]' : 'h-24 w-24')}
    />
  )
}

/**
 * Currency cards: the hub currency card's own treatment (CurrencyBuyCard,
 * owner-approved 2026-10-06) — the icon large, tilted and cut off by the
 * card's edge at low opacity, fading toward the copy. No blur, no glow.
 */
function CoinBackdrop({ src }: { src: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden
      width={300}
      height={300}
      loading="lazy"
      decoding="async"
      className="pointer-events-none absolute -right-24 top-[34%] -z-10 h-[300px] w-[300px] -rotate-[16deg] select-none object-contain opacity-[0.14] [mask-image:linear-gradient(105deg,transparent_10%,#000_60%)]"
    />
  )
}

/** The game's CTA banner art (admin upload → static art) under a dark scrim; plain surface when none loads. */
function ArtLayer({ game, src, dim }: { game: string; src: string; dim: boolean }) {
  const sources = gameCtaSources(game, src)
  const [i, setI] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const current = sources[i]
  if (!current) return null
  return (
    <div aria-hidden className="absolute inset-0 -z-10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={current}
        alt=""
        width={220}
        height={460}
        loading="lazy"
        decoding="async"
        // A server-rendered image can finish before hydration attaches onLoad.
        ref={(el) => {
          if (el?.complete && el.naturalWidth > 0) setLoaded(true)
        }}
        onLoad={() => setLoaded(true)}
        onError={() => setI((n) => n + 1)}
        // Hidden until it loads, so a missing file never shows a broken-image glyph.
        className={cn('h-full w-full object-cover transition-opacity duration-300', loaded ? 'opacity-100' : 'opacity-0')}
      />
      {/* Dimmed (owner, 2026-10-11); dimmer still behind an item thumbnail so the item leads. */}
      <div
        className={cn(
          'absolute inset-0',
          dim
            ? 'bg-[linear-gradient(180deg,rgba(29,30,35,0.96)_0%,rgba(29,30,35,0.86)_30%,rgba(29,30,35,0.88)_52%,rgba(29,30,35,0.98)_76%,#1D1E23_100%)]'
            : 'bg-[linear-gradient(180deg,rgba(29,30,35,0.96)_0%,rgba(29,30,35,0.62)_30%,rgba(29,30,35,0.68)_52%,rgba(29,30,35,0.98)_76%,#1D1E23_100%)]',
        )}
      />
    </div>
  )
}
