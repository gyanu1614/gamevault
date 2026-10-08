'use client'

import { forwardRef, type CSSProperties } from 'react'
import { rarityMeta } from '@/lib/values/rarity'
import { fmtUsd, type InventoryLine, type InventoryTotals } from '@/lib/values/inventory'

/**
 * The share images, drawn as plain DOM (inline px styles, no Tailwind
 * breakpoints) and captured to PNG in the browser by modern-screenshot, so a
 * share costs no server CPU. Two layouts from the same data:
 *
 *   og       1200×630  — the link-preview shape: brand, "My MM2 Inventory",
 *                         the total, the top items with art, the URL.
 *   discord  1080 wide — a vertical list for a Discord trade post: the total
 *                         over the ten most valuable lines; as tall as its
 *                         rows (≤ 1350, the 4:5 Discord shows uncropped).
 *
 * Item art comes from Supabase storage, which answers `Access-Control-Allow-
 * Origin: *`; `crossOrigin="anonymous"` keeps the canvas untainted.
 */

export type CardLayout = 'og' | 'discord'

/** Fixed sizes; the Discord card's height follows its rows (capture measures it). */
export const CARD_SIZE: Record<CardLayout, { width: number; height: number | null }> = {
  og: { width: 1200, height: 630 },
  discord: { width: 1080, height: null },
}

const FONT = 'var(--font-inter), Inter, ui-sans-serif, system-ui, sans-serif'
const INK = '#F2F3F5'
const MUTED = '#A1A4AD'
const GREEN = '#3FD986'

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

export interface ShareCardProps {
  layout: CardLayout
  gameSlug: string
  shortName: string
  /** "dropmarket.gg/murder-mystery-2/inventory" */
  displayUrl: string
  lines: InventoryLine[]
  top: InventoryLine[]
  totals: InventoryTotals
}

function Art({ src, alt, size, rgb }: { src: string | null; alt: string; size: number; rgb: string }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `radial-gradient(closest-side, rgba(${rgb},0.34), rgba(${rgb},0.08) 70%, rgba(255,255,255,0.03))`,
      }}
    >
      {src && (
        // eslint-disable-next-line @next/next/no-img-element -- captured to PNG, must be a plain CORS image
        <img
          src={src}
          alt={alt}
          aria-hidden
          crossOrigin="anonymous"
          width={Math.round(size * 0.82)}
          height={Math.round(size * 0.82)}
          style={{ width: Math.round(size * 0.82), height: Math.round(size * 0.82), objectFit: 'contain' }}
        />
      )}
    </div>
  )
}

function Brand({ size }: { size: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- captured to PNG */}
      <img src="/brand/logo-mark-lime.png" alt="DropMarket logo" aria-hidden width={size} height={size} style={{ width: size, height: size }} />
      <span style={{ fontSize: size * 0.62, fontWeight: 800, letterSpacing: '-0.02em', color: INK }}>DropMarket</span>
    </div>
  )
}

export const InventoryShareCard = forwardRef<HTMLDivElement, ShareCardProps>(function InventoryShareCard(
  { layout, gameSlug, shortName, displayUrl, lines, top, totals },
  ref,
) {
  const { width, height } = CARD_SIZE[layout]
  const lead = top[0] ? hexToRgb(rarityMeta(gameSlug, top[0].item.rarity).color) : '122,182,255'
  const root: CSSProperties = {
    width,
    height: height ?? 'auto',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: FONT,
    color: INK,
    background: `radial-gradient(70% 80% at 100% 0%, rgba(${lead},0.22) 0%, rgba(${lead},0.06) 45%, transparent 75%), radial-gradient(50% 60% at 0% 100%, rgba(63,217,134,0.10) 0%, transparent 70%), linear-gradient(180deg, #1A1B20 0%, #121317 100%)`,
  }
  const itemsLine = `${totals.count.toLocaleString('en-US')} ${totals.count === 1 ? 'item' : 'items'} · Market value ${fmtUsd(totals.marketUsd)}`

  if (layout === 'og') {
    return (
      <div ref={ref} style={{ ...root, padding: '52px 64px' }}>
        <Brand size={44} />
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 56, marginTop: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 30, fontWeight: 600, color: MUTED }}>My {shortName} Inventory</span>
            <span style={{ fontSize: totals.cheapestUsd >= 100_000 ? 84 : 100, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05, marginTop: 10, fontVariantNumeric: 'tabular-nums' }}>
              {fmtUsd(totals.cheapestUsd)}
            </span>
            <span style={{ fontSize: 24, fontWeight: 500, color: MUTED, marginTop: 16 }}>{itemsLine}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', width: 470, flexShrink: 0 }}>
            {top.slice(0, 3).map((l, i) => {
              const r = rarityMeta(gameSlug, l.item.rarity)
              return (
                <div
                  key={l.item.slug}
                  style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '14px 0', borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.08)' }}
                >
                  <Art src={l.item.imageUrl} alt={l.item.name} size={84} rgb={hexToRgb(r.color)} />
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 24, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {l.item.name}
                      {l.qty > 1 ? ` ×${l.qty}` : ''}
                    </span>
                    <span style={{ fontSize: 18, fontWeight: 600, color: r.color, marginTop: 2 }}>{r.label || 'Item'}</span>
                  </div>
                  <span style={{ fontSize: 24, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(l.item.cheapestUsd)}</span>
                </div>
              )
            })}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 20, color: MUTED }}>
          <span style={{ fontWeight: 600, color: INK }}>{displayUrl}</span>
          <span>Live USD prices from professional sellers</span>
        </div>
      </div>
    )
  }

  // Discord: the ten most valuable lines, vertical.
  const shown = [...lines].sort((a, b) => b.lineUsd - a.lineUsd).slice(0, 10)
  const rest = lines.length - shown.length
  return (
    <div ref={ref} style={{ ...root, padding: '60px 64px' }}>
      <Brand size={48} />
      <span style={{ fontSize: 34, fontWeight: 600, color: MUTED, marginTop: 44 }}>My {shortName} Inventory</span>
      <span style={{ fontSize: 108, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>
        {fmtUsd(totals.cheapestUsd)}
      </span>
      <span style={{ fontSize: 26, fontWeight: 500, color: MUTED, marginTop: 14 }}>{itemsLine}</span>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 36, borderTop: '1px solid rgba(255,255,255,0.10)' }}>
        {shown.map((l) => {
          const r = rarityMeta(gameSlug, l.item.rarity)
          return (
            <div key={l.item.slug} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <Art src={l.item.imageUrl} alt={l.item.name} size={60} rgb={hexToRgb(r.color)} />
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 26, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {l.item.name}
                  {l.qty > 1 ? <span style={{ color: MUTED, fontWeight: 600 }}>{` ×${l.qty}`}</span> : null}
                </span>
                <span style={{ fontSize: 18, fontWeight: 600, color: r.color }}>{r.label || 'Item'}</span>
              </div>
              <span style={{ fontSize: 28, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(l.lineUsd)}</span>
            </div>
          )
        })}
      </div>
      {rest > 0 && (
        <span style={{ fontSize: 24, fontWeight: 600, color: MUTED, marginTop: 16 }}>
          + {rest} more {rest === 1 ? 'item' : 'items'}
        </span>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 22, color: MUTED, marginTop: 48 }}>
        <span style={{ fontWeight: 600, color: INK }}>{displayUrl}</span>
        <span style={{ color: GREEN, fontWeight: 600 }}>Live USD Prices</span>
      </div>
    </div>
  )
})
