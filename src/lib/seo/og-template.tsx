/**
 * og-template — shared card builder for dynamic Open Graph images.
 *
 * Rendered through next/og ImageResponse (Satori), so styling is
 * intentionally constrained: flexbox only (every multi-child element
 * declares display:flex), no CSS grid, no custom font files — the
 * default bundled font keeps the route bundle small.
 *
 * Design: 1200×630, dark slate (#0c0e14) with a lime (#C6FF3D) accent
 * bar + corner glyph, DropMarket wordmark (Drop white / Market lime),
 * big title, optional live-data sub-line, and a SafeDrop Buyer
 * Protection badge chip (outcome language only).
 */

/* eslint-disable @next/next/no-img-element */

export const OG_SIZE = { width: 1200, height: 630 }

// ─── Palette ───────────────────────────────────────────────────────────────

const BG = '#0c0e14'
const BG_LIFT = '#12151f'
const LIME = '#C6FF3D'
const WHITE = '#f8fafc'
const SLATE = '#94a3b8'

// ─── Data helpers (edge/runtime-safe: plain fetch against Supabase REST) ───

interface RestResult<T> {
  rows: T[]
  /** Exact total from Content-Range when `count: true`, else null. */
  total: number | null
}

/**
 * Minimal Supabase REST fetch for OG routes. Never throws — any
 * failure (missing env, network, non-2xx, bad JSON) returns null so
 * the card renders without live data.
 */
export async function ogRestFetch<T>(
  pathWithQuery: string,
  opts?: { count?: boolean }
): Promise<RestResult<T> | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!base || !key) return null
  try {
    const res = await fetch(`${base}/rest/v1/${pathWithQuery}`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        ...(opts?.count ? { Prefer: 'count=exact' } : {}),
      },
      next: { revalidate: 86400 },
    })
    if (!res.ok) return null
    const rows = (await res.json()) as T[]
    if (!Array.isArray(rows)) return null
    let total: number | null = null
    if (opts?.count) {
      const match = res.headers.get('content-range')?.match(/\/(\d+)\s*$/)
      if (match) total = parseInt(match[1], 10)
    }
    return { rows, total }
  } catch {
    return null
  }
}

/** "steal-a-brainrot" → "Steal A Brainrot" (fallback when fetch fails). */
export function slugToTitle(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/** Format a price-ish value as USD, or null when unusable. */
export function formatUsd(value: unknown): string | null {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  const opts =
    n % 1 === 0
      ? { maximumFractionDigits: 0 }
      : { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  return `$${n.toLocaleString('en-US', opts)}`
}

/** Hard cap so Satori never overflows the card. */
function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

// ─── Card ──────────────────────────────────────────────────────────────────

export interface OgCardProps {
  /** Small uppercase line above the title (e.g. game name). */
  eyebrow?: string
  /** Big headline. */
  title: string
  /** Sub-line — live data (price, offer count) when available. */
  subtitle?: string
  /** Optional price tag rendered large in the bottom-right corner. */
  price?: string
}

export function OgCard({ eyebrow, title, subtitle, price }: OgCardProps) {
  const safeTitle = truncate(title, 90)
  const titleSize = safeTitle.length > 56 ? 54 : safeTitle.length > 32 ? 64 : 76

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: BG,
        backgroundImage: `linear-gradient(135deg, ${BG} 0%, ${BG_LIFT} 55%, ${BG} 100%)`,
        position: 'relative',
        fontFamily: 'sans-serif',
      }}
    >
      {/* Lime accent bar */}
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: 10,
          backgroundColor: LIME,
        }}
      />

      {/* Subtle corner glyph — big faded lime diamond */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          right: -140,
          top: 110,
          width: 420,
          height: 420,
          backgroundColor: LIME,
          opacity: 0.05,
          transform: 'rotate(45deg)',
          borderRadius: 64,
        }}
      />
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          right: 40,
          top: 290,
          width: 180,
          height: 180,
          border: `2px solid ${LIME}`,
          opacity: 0.14,
          transform: 'rotate(45deg)',
          borderRadius: 32,
        }}
      />

      {/* Content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flexGrow: 1,
          padding: '56px 72px 60px',
        }}
      >
        {/* Wordmark */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              width: 22,
              height: 22,
              backgroundColor: LIME,
              transform: 'rotate(45deg)',
              borderRadius: 5,
              marginRight: 18,
            }}
          />
          <div style={{ display: 'flex', fontSize: 42, fontWeight: 700 }}>
            <span style={{ color: WHITE }}>Drop</span>
            <span style={{ color: LIME }}>Market</span>
          </div>
        </div>

        {/* Title block */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            maxWidth: 980,
          }}
        >
          {eyebrow ? (
            <div
              style={{
                display: 'flex',
                fontSize: 26,
                fontWeight: 600,
                color: LIME,
                textTransform: 'uppercase',
                letterSpacing: 4,
                marginBottom: 18,
              }}
            >
              {truncate(eyebrow, 60)}
            </div>
          ) : null}
          <div
            style={{
              display: 'flex',
              fontSize: titleSize,
              fontWeight: 700,
              color: WHITE,
              lineHeight: 1.12,
            }}
          >
            {safeTitle}
          </div>
          {subtitle ? (
            <div
              style={{
                display: 'flex',
                fontSize: 30,
                color: SLATE,
                marginTop: 22,
              }}
            >
              {truncate(subtitle, 80)}
            </div>
          ) : null}
        </div>

        {/* Footer: SafeDrop badge chip + optional price tag */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '16px 30px',
              borderRadius: 999,
              backgroundColor: 'rgba(198, 255, 61, 0.10)',
              border: '1px solid rgba(198, 255, 61, 0.35)',
            }}
          >
            <div
              style={{
                display: 'flex',
                width: 12,
                height: 12,
                borderRadius: 999,
                backgroundColor: LIME,
                marginRight: 14,
              }}
            />
            <div
              style={{
                display: 'flex',
                fontSize: 26,
                fontWeight: 600,
                color: WHITE,
              }}
            >
              SafeDrop Buyer Protection
            </div>
          </div>
          {price ? (
            <div
              style={{
                display: 'flex',
                fontSize: 58,
                fontWeight: 700,
                color: LIME,
              }}
            >
              {price}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
