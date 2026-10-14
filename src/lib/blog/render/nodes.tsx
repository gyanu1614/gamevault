/**
 * The blog's block components (server-safe: no hooks). One look for every
 * post: images with real sizes and AVIF/WebP sources, one callout style, FAQ
 * as <details>, codes with copy buttons, live item cards, one white button.
 */
import type { CSSProperties, ReactNode } from 'react'
import Link from '@/components/navigation/AppLink'
import { cn } from '@/lib/utils'
import type { RailCard } from '@/lib/buy-rails/model'
import type { CalloutTone, SrcItem, StoredImage } from '@/lib/blog/doc/types'
import { CopyCode, YouTubeLite } from './client-nodes'
import { FaqCards } from '@/components/marketplace/FaqCards'
import { classifyHref, gamePath } from './links'
import { PAIR_BOX, pictureFit } from './picture-size'
import { BLOG_CARD } from './surface'
import { ListChecks } from '@phosphor-icons/react/dist/ssr/ListChecks'
import { Lightbulb } from '@phosphor-icons/react/dist/ssr/Lightbulb'
import { Info } from '@phosphor-icons/react/dist/ssr/Info'
import { WarningCircle } from '@phosphor-icons/react/dist/ssr/WarningCircle'
import type { Icon } from '@phosphor-icons/react'

export const BTN_WHITE =
  'inline-flex h-11 items-center justify-center gap-1.5 rounded-[8px] bg-[#F2F3F5] px-5 text-[14px] font-semibold text-[#111214] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring'
const BTN_QUIET =
  'inline-flex h-11 items-center justify-center rounded-[8px] bg-white/[0.06] px-4 text-[14px] font-semibold text-text-primary transition-colors hover:bg-white/[0.1]'

const srcSet = (list: SrcItem[]) => list.map((s) => `${s.url} ${s.w}w`).join(', ')
const SIZES = {
  column: '(min-width: 768px) 700px, calc(100vw - 32px)',
  wide: '(min-width: 1024px) 960px, calc(100vw - 32px)',
  half: '(min-width: 768px) 350px, calc(100vw - 32px)',
} as const

/** <picture> with AVIF + WebP widths; width/height always set when known (no layout jump). */
export function Picture({
  image,
  alt,
  sizes,
  eager = false,
  className = '',
  style,
  placeholder = true,
}: {
  image: Partial<StoredImage> & { src: string }
  alt: string
  sizes: string
  eager?: boolean
  className?: string
  /** Size from the picture size system (picture-size.ts); the cover fills its frame instead. */
  style?: CSSProperties
  /** Blur behind the picture while it loads — never behind a see-through cut-out. */
  placeholder?: boolean
}) {
  const avif = image.sources?.avif ?? []
  const webp = image.sources?.webp ?? []
  return (
    // `contents`: the <img> lays out as the parent's own child, so size rules
    // (centring, a pair's box height, the cover's frame) apply to it directly.
    <picture className="contents">
      {avif.length > 0 && <source type="image/avif" srcSet={srcSet(avif)} sizes={sizes} />}
      {webp.length > 0 && <source type="image/webp" srcSet={srcSet(webp)} sizes={sizes} />}
      {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized at upload, served from storage */}
      <img
        src={image.src}
        alt={alt}
        width={image.width ?? undefined}
        height={image.height ?? undefined}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : undefined}
        decoding="async"
        className={cn('block h-auto w-full bg-cover', placeholder && 'bg-white/[0.03]', className)}
        style={{ ...(placeholder && image.blur ? { backgroundImage: `url(${image.blur})` } : {}), ...style }}
      />
    </picture>
  )
}

export function FigureView({ attrs }: { attrs: Record<string, unknown> }) {
  const layout = attrs.layout === 'wide' ? 'wide' : 'column'
  const src = String(attrs.src ?? '')
  if (!src) return null
  const caption = String(attrs.caption ?? '').trim()
  const image = { src, width: attrs.width as number, height: attrs.height as number, blur: attrs.blur as string | null, sources: attrs.sources as StoredImage['sources'], alpha: attrs.alpha === true }
  // One size system: photos fill the column (height capped), small pictures and cut-outs share one height.
  const fit = pictureFit(image, layout)
  return (
    <figure className={`mt-7 ${layout === 'wide' ? 'blog-wide' : ''}`}>
      <Picture
        image={image}
        alt={String(attrs.alt || caption || '')}
        sizes={SIZES[layout]}
        className={cn('mx-auto w-auto max-w-full', fit.rounded && 'rounded-[20px]')}
        style={fit.style}
        placeholder={fit.placeholder}
      />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}

type PairSide = { image: StoredImage; alt?: string; caption?: string } | null
export function ImagePairView({ attrs }: { attrs: Record<string, unknown> }) {
  const sides = [attrs.a as PairSide, attrs.b as PairSide].filter((s): s is NonNullable<PairSide> => !!s?.image?.src)
  if (sides.length === 0) return null
  return (
    <div className="mt-7 grid gap-4 sm:grid-cols-2">
      {sides.map((s, i) => (
        <figure key={i}>
          {/* Both sides share one box height, so a big and a small picture still line up. */}
          <div className={PAIR_BOX}>
            <Picture
              image={s.image}
              alt={s.alt || s.caption || ''}
              sizes={SIZES.half}
              className={cn('h-auto max-h-full w-auto max-w-full object-contain', s.image.alpha !== true && 'rounded-[16px]')}
              placeholder={s.image.alpha !== true}
            />
          </div>
          {s.caption && <figcaption>{s.caption}</figcaption>}
        </figure>
      ))}
    </div>
  )
}

/**
 * One clearly different hue per box (the value pages' callout hues: blue for
 * a fact, yellow for a tip), so a reader tells them apart at a glance; the
 * summary keeps the blog highlight colour (Blog v2).
 */
export const CALLOUT_TONES: Record<CalloutTone, { label: string; color: string; Icon: Icon }> = {
  takeaways: { label: 'Key Takeaways', color: 'var(--color-accent-text)', Icon: ListChecks },
  tip: { label: 'Tip', color: '#FACC15', Icon: Lightbulb },
  note: { label: 'Note', color: '#8BBDFB', Icon: Info },
  warning: { label: 'Warning', color: 'var(--color-error)', Icon: WarningCircle },
}

export function CalloutView({ tone, children }: { tone: unknown; children: ReactNode }) {
  const t = CALLOUT_TONES[(tone as CalloutTone) in CALLOUT_TONES ? (tone as CalloutTone) : 'note']
  return (
    // The solid blog card; the tone lives in the icon tile and the label.
    <aside className={`${BLOG_CARD} mt-7 px-5 py-4 sm:px-6 sm:py-5 [&>p+p]:mt-3 [&>p]:mt-0 [&>ul]:mt-1 [&>ol]:mt-1`}>
      <CalloutHead tone={t} />
      {children}
    </aside>
  )
}

/** Icon tile + label in the tone's colour (shared with the editor's box). */
export function CalloutHead({ tone, className = 'mb-2.5' }: { tone: (typeof CALLOUT_TONES)[CalloutTone]; className?: string }) {
  const { Icon, color, label } = tone
  return (
    <div data-tone-color={color} className={`${className} flex items-center gap-2.5 text-[14px] font-bold`} style={{ color }}>
      <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
        <Icon size={17} weight="duotone" />
      </span>
      {label}
    </div>
  )
}

export function FaqView({ attrs }: { attrs: Record<string, unknown> }) {
  const items = ((attrs.items as Array<{ q: string; a: string }> | null) ?? []).filter((i) => i.q?.trim())
  if (items.length === 0) return null
  // The same accordion as the value pages' FAQ (answers stay in the HTML for search).
  return (
    <div className="bp-ui mt-6">
      <FaqCards items={items} defaultOpen={0} square className="mt-0 max-w-none" />
    </div>
  )
}

const CHECKED = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export function CodesView({ attrs }: { attrs: Record<string, unknown> }) {
  const rows = (attrs.rows as Array<{ code: string; reward: string; isNew?: boolean; expired?: boolean }> | null) ?? []
  const active = rows.filter((r) => r.code?.trim() && !r.expired)
  const expired = rows.filter((r) => r.code?.trim() && r.expired)
  const checked = attrs.checkedAt ? new Date(String(attrs.checkedAt)) : null
  return (
    <div className="bp-ui mt-7">
      {active.length === 0 ? (
        <p className={`${BLOG_CARD} px-5 py-4 text-[15px] text-text-secondary`}>No working codes right now.</p>
      ) : (
        <ul className={`${BLOG_CARD} divide-y divide-white/[0.06]`}>
          {active.map((r, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-mono text-[15px] font-semibold text-text-primary">
                  {r.code}
                  {r.isNew && <span className="rounded-[5px] bg-[#4FB477]/15 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-[#7DD39B]">New</span>}
                </p>
                {r.reward && <p className="mt-0.5 text-[14px] text-text-secondary">{r.reward}</p>}
              </div>
              <CopyCode code={r.code} />
            </li>
          ))}
        </ul>
      )}
      {checked && Number.isFinite(checked.getTime()) && <p className="mt-2 text-[13px] text-text-tertiary">Last checked {CHECKED.format(checked)}</p>}
      {expired.length > 0 && (
        <details className={`${BLOG_CARD} mt-3 px-4 [&_summary::-webkit-details-marker]:hidden`}>
          <summary className="flex min-h-[44px] cursor-pointer items-center text-[14px] font-medium text-text-secondary">Expired Codes ({expired.length})</summary>
          <ul className="pb-3 text-[14px] text-text-tertiary">
            {expired.map((r, i) => (
              <li key={i} className="py-1"><span className="font-mono">{r.code}</span>{r.reward ? ` · ${r.reward}` : ''}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

export function ItemCardView({ attrs, card }: { attrs: Record<string, unknown>; card: RailCard | undefined }) {
  const gameSlug = String(attrs.gameSlug ?? '')
  const itemSlug = String(attrs.itemSlug ?? '')
  if (!gameSlug || !itemSlug) return null
  const name = String(attrs.name || card?.name || itemSlug)
  const image = String(attrs.imageUrl || card?.image?.src || '')
  return (
    <div className={`bp-ui ${BLOG_CARD} mt-7 flex flex-col gap-4 p-4 sm:flex-row sm:items-center`}>
      <div className="flex min-w-0 flex-1 items-center gap-4">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={name} width={64} height={64} loading="lazy" className="h-16 w-16 shrink-0 object-contain" />
        )}
        <div className="min-w-0">
          <p className="truncate text-[16px] font-semibold text-text-primary">{name}</p>
          {card && card.lines.length > 0 && <p className="mt-0.5 text-[14px] text-text-secondary">{card.lines.join(' · ')}</p>}
        </div>
      </div>
      <div className="flex gap-2">
        <Link href={`/${gameSlug}/values/${itemSlug}`} className={BTN_QUIET}>See Value</Link>
        {card && <Link href={card.href} className={BTN_WHITE}>{card.buyLabel}</Link>}
      </div>
    </div>
  )
}

export function CtaView({ attrs, gameSlug }: { attrs: Record<string, unknown>; gameSlug?: string | null }) {
  const kind = classifyHref(String(attrs.href ?? ''))
  if (!('internal' in kind)) return null
  const href = gamePath(kind.internal, gameSlug)
  return (
    <div className="bp-ui mt-8 flex justify-center">
      <Link href={href} className={BTN_WHITE}>{String(attrs.label || 'Shop Now')}</Link>
    </div>
  )
}

export function YouTubeView({ attrs }: { attrs: Record<string, unknown> }) {
  const id = String(attrs.id ?? '')
  if (!/^[\w-]{6,20}$/.test(id)) return null
  return (
    <div className="bp-ui mt-8">
      <YouTubeLite id={id} title={String(attrs.title ?? '')} />
    </div>
  )
}
