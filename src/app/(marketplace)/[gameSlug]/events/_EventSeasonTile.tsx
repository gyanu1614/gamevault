'use client'

import type { ComponentType } from 'react'
import type { IconProps } from '@phosphor-icons/react'
import { GhostIcon } from '@phosphor-icons/react/dist/csr/Ghost'
import { SnowflakeIcon } from '@phosphor-icons/react/dist/csr/Snowflake'
import { EggIcon } from '@phosphor-icons/react/dist/csr/Egg'
import { HeartIcon } from '@phosphor-icons/react/dist/csr/Heart'
import { SunIcon } from '@phosphor-icons/react/dist/csr/Sun'
import { CakeIcon } from '@phosphor-icons/react/dist/csr/Cake'
import { HandshakeIcon } from '@phosphor-icons/react/dist/csr/Handshake'
import { LeafIcon } from '@phosphor-icons/react/dist/csr/Leaf'
import { EVENT_SEASONS, hexRgb, type EventSeason } from '@/lib/values/events-model'

export const SEASON_ICON: Record<EventSeason, ComponentType<IconProps>> = {
  halloween: GhostIcon,
  christmas: SnowflakeIcon,
  easter: EggIcon,
  valentines: HeartIcon,
  summer: SunIcon,
  anniversary: CakeIcon,
  collab: HandshakeIcon,
  other: LeafIcon,
}

/**
 * The season's duotone icon in its tinted tile (6px corners) — the one
 * season mark on the hub rows, the featured row and the event page. Client
 * module only because the Phosphor CSR icons are; it renders on the server
 * like any other component.
 */
export function EventSeasonTile({
  season,
  size = 40,
  className = '',
}: {
  season: EventSeason
  /** Tile edge in px; the icon is ~48% of it. */
  size?: number
  className?: string
}) {
  const Icon = SEASON_ICON[season]
  const rgb = hexRgb(EVENT_SEASONS[season].color)
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-md ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(closest-side, rgba(${rgb},0.26), rgba(${rgb},0.12))`,
        color: EVENT_SEASONS[season].color,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 0 24px -8px rgba(${rgb},0.55)`,
      }}
    >
      <Icon size={Math.round(size * 0.48)} weight="duotone" />
    </span>
  )
}
