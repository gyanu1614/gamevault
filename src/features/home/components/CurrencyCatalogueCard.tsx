'use client'

/**
 * CurrencyCatalogueCard — one featured currency.
 *
 * No image zone: currency has nothing to photograph, so the amount is the
 * hero and the icon sits beside it as a unit marker rather than as art.
 *
 * Price reads "From $4.80 / 1K" — per-unit pricing is how currency is
 * actually bought, and a bare "$0.0048" tells a buyer nothing useful.
 */

import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { getGameGlow } from '../lib/game-icons'
import { GameMark } from './GameMark'
import type { FeaturedCatalogueItem } from '../lib/featured-catalogue'

/** 1000 -> "1K", 1000000 -> "1M". The per-unit denominator in the price. */
function unitSuffix(size: number) {
  if (size >= 1_000_000) return `${size / 1_000_000}M`
  if (size >= 1_000) return `${size / 1_000}K`
  return String(size)
}

export function CurrencyCatalogueCard({ item }: { item: FeaturedCatalogueItem }) {
  const reduceMotion = useReducedMotion()
  const [iconFailed, setIconFailed] = useState(false)
  const glow = getGameGlow(item.gameSlug)

  // Price is per single unit; buyers shop per 1K (or 1M), so scale it.
  const perUnit =
    item.price !== null && item.unitSize ? item.price * item.unitSize : null

  return (
    <Link
      href={item.href}
      className="group block focus-visible:outline-none"
      // A game with no live listing is real but not purchasable — shown
      // quieter rather than hidden, and never with an invented price.
      style={{ containerType: 'inline-size', opacity: item.price === null ? 0.6 : 1 }}
    >
      <motion.div
        whileTap={reduceMotion ? undefined : { scale: 0.985 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }}
        className="relative flex aspect-[1/1.1] flex-col overflow-hidden border border-border-subtle px-6 pb-5 pt-4 transition-colors duration-fast group-hover:border-border-default"
        style={{
          borderRadius: 'var(--radius-lg)',
          isolation: 'isolate',
          backgroundColor: 'var(--color-bg-well, #181D25)',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.30)',
        }}
      >
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px"
          style={{ background: 'rgba(255,255,255,0.045)' }}
        />

        {/* Top row — game name left, mark right. */}
        <div className="relative flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-bold uppercase tracking-[0.08em] text-text-primary">
            {item.gameName}
          </span>
          <GameMark slug={item.gameSlug} name={item.gameName} size={24} />
        </div>

        {/* Hero — icon + amount, unit label beneath. */}
        <div className="relative my-auto flex flex-col items-start">
          <span className="flex items-center gap-2">
            {item.imagePath && !iconFailed && (
              <Image
                src={item.imagePath}
                alt=""
                aria-hidden
                width={28}
                height={28}
                className="h-7 w-7 shrink-0 object-contain"
                onError={() => setIconFailed(true)}
              />
            )}
            <span className="text-[32px] font-semibold leading-none tabular-nums text-text-primary">
              {item.unitSize?.toLocaleString('en-US')}
            </span>
          </span>
          <span className="mt-2 text-[13px] text-text-secondary">{item.unitLabel}</span>
        </div>

        {/* Price — per unit, or an honest absence. */}
        <p className="relative mt-auto flex items-baseline gap-1.5">
          {perUnit === null ? (
            <span className="text-[13px] text-text-tertiary">Not listed yet</span>
          ) : (
            <>
              <span className="text-[12px] text-text-tertiary">From</span>
              <span className="text-[19px] font-semibold leading-none tabular-nums text-text-primary">
                ${perUnit.toFixed(2)}
              </span>
              <span className="text-[12px] text-text-tertiary">
                / {unitSuffix(item.unitSize!)}
              </span>
            </>
          )}
        </p>

        {/* Glow — unchanged from the listing card. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-1/4"
          style={{
            background: `radial-gradient(ellipse 55% 42% at 50% 100%, ${glow}2E 0%, transparent 100%)`,
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
          style={{
            background: `linear-gradient(90deg, transparent 30%, ${glow}B3 50%, transparent 70%)`,
          }}
        />
      </motion.div>
    </Link>
  )
}
