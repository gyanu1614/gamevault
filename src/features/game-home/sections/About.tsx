import Link from '@/components/navigation/AppLink'
import { ArrowRight, Gamepad2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AboutModel, AboutRow } from '../types'
import { pictureUrl } from '@/lib/images/picture-url'

/**
 * About {Game}: the search copy Eldorado keeps at the bottom of its game
 * pages, as three readable rows instead of one wall of text: copy left with
 * the game's item art, the categories left with copy right, then a centred
 * close. Each row an H2 with short paragraphs at a reading width. Copy comes
 * from the game's real numbers (model/about.ts). House shapes only: real art,
 * 10px corners, fill-only links that lighten in place.
 */
function Copy({ row, centred = false }: { row: AboutRow; centred?: boolean }) {
  return (
    <div className={cn(centred && 'mx-auto max-w-2xl text-center')}>
      <h2 className="text-balance text-[24px] font-bold leading-[1.15] tracking-[-0.02em] text-text-primary sm:text-[30px]">{row.heading}</h2>
      {row.paragraphs.map((p) => (
        <p key={p.slice(0, 24)} className={cn('mt-4 text-[15.5px] leading-7 text-text-secondary', !centred && 'max-w-[560px]')}>
          {p}
        </p>
      ))}
      {row.link && (
        <Link href={row.link.href} className="mt-5 inline-flex items-center gap-1.5 text-[15px] font-semibold text-text-primary underline-offset-4 hover:underline">
          {row.link.label}
          <ArrowRight aria-hidden className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  )
}

/** The game's items, as plain art: a 3 + 2 cluster, no frame, no glow. */
function Art({ art }: { art: string[] }) {
  return (
    <div aria-hidden className="mx-auto grid w-full max-w-[460px] grid-cols-6 items-center gap-2">
      {art.map((src, i) => (
        <span key={src} className={cn('col-span-2 grid aspect-square place-items-center', i === 3 && 'col-start-2')}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pictureUrl(src, 'big')} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.5)]" />
        </span>
      ))}
    </div>
  )
}

/** The game logo and its categories as the house category buttons (fill only, lighten on hover). */
function Categories({ model }: { model: AboutModel }) {
  return (
    <div className="flex flex-col items-center gap-6">
      {model.gameImageUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={pictureUrl(model.gameImageUrl, 'card')} alt={`${model.gameName} logo`} width={120} height={120} loading="lazy" decoding="async" className="h-[104px] w-[104px] rounded-lg object-cover sm:h-[120px] sm:w-[120px]" />
      ) : (
        <span aria-hidden className="flex h-[104px] w-[104px] items-center justify-center rounded-lg bg-bg-overlay text-lime-text sm:h-[120px] sm:w-[120px]">
          <Gamepad2 className="h-8 w-8" />
        </span>
      )}
      {model.categories.length > 0 && (
        <nav aria-label={`${model.gameName} categories`} className="flex flex-wrap justify-center gap-2.5">
          {model.categories.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="inline-flex h-11 items-center gap-2 rounded-md bg-[#1D1E23] px-4 text-[14px] font-semibold text-text-primary transition-colors hover:bg-[#24252B]"
            >
              {c.name}
              {c.count > 0 && <span className="text-[12.5px] font-medium tabular-nums text-text-tertiary">{c.count.toLocaleString('en-US')}</span>}
            </Link>
          ))}
        </nav>
      )}
    </div>
  )
}

export function About({ model }: { model: AboutModel }) {
  const [buy, what, why] = model.rows
  const hasArt = model.art.length > 0
  return (
    <section aria-label={`About ${model.gameName}`} className="flex flex-col gap-16 sm:gap-24">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Copy row={buy} />
        {hasArt ? <Art art={model.art} /> : <Categories model={model} />}
      </div>

      {hasArt ? (
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="order-2 lg:order-1">
            <Categories model={model} />
          </div>
          <div className="order-1 lg:order-2">
            <Copy row={what} />
          </div>
        </div>
      ) : (
        <Copy row={what} centred />
      )}

      <Copy row={why} centred />
    </section>
  )
}
