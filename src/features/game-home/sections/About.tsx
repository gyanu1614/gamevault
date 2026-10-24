import Link from '@/components/navigation/AppLink'
import { ArrowRightIcon, PackageIcon } from '@phosphor-icons/react/dist/ssr'
import { cn } from '@/lib/utils'
import type { AboutModel, AboutRow } from '../types'

/**
 * About {Game} (owner, 2026-10-23): Eldorado keeps its keyword copy at the
 * bottom as one wall of text; ours is three readable rows (text left with an
 * item collage, art left with the categories, then a centred close), each an
 * H2 with short paragraphs at a reading width. Copy comes from real numbers
 * (model/about.ts). Text slides in from its own side as the row enters.
 */
const COLLAGE = [
  'left-[38%] top-[26%] h-[132px] w-[132px] sm:h-[150px] sm:w-[150px]',
  'left-[8%] top-[10%] h-[92px] w-[92px]',
  'right-[8%] top-[14%] h-[96px] w-[96px]',
  'left-[14%] bottom-[8%] h-[88px] w-[88px]',
  'right-[12%] bottom-[8%] h-[86px] w-[86px]',
] as const

function Copy({ row, from }: { row: AboutRow; from: 'left' | 'right' | 'centre' }) {
  return (
    <div className={cn(from === 'left' ? 'gh-slide-l' : from === 'right' ? 'gh-slide-r' : 'gh-reveal-self', from === 'centre' && 'mx-auto max-w-2xl text-center')}>
      <h2 className="text-balance text-[26px] font-extrabold leading-[1.12] tracking-[-0.025em] text-text-primary sm:text-[34px]">{row.heading}</h2>
      {row.paragraphs.map((p) => (
        <p key={p.slice(0, 24)} className={cn('mt-4 text-[15.5px] leading-7 text-text-secondary sm:text-[16px]', from !== 'centre' && 'max-w-[560px]')}>
          {p}
        </p>
      ))}
      {row.link && (
        <Link href={row.link.href} className="group mt-5 inline-flex items-center gap-1.5 text-[15px] font-semibold text-text-primary underline-offset-4 hover:underline">
          {row.link.label}
          <ArrowRightIcon size={14} weight="bold" aria-hidden className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  )
}

function Collage({ art }: { art: string[] }) {
  return (
    <div aria-hidden className="relative mx-auto h-[300px] w-full max-w-[520px] sm:h-[360px]">
      <span className="absolute inset-[6%] rounded-full bg-[radial-gradient(circle,rgba(182,227,106,0.16),transparent_66%)]" />
      <span className="absolute inset-[14%] rounded-full border border-dashed border-white/[0.08]" />
      {art.map((src, i) => (
        <span key={src} className={cn('gh-float absolute', COLLAGE[i])} style={{ ['--gh-i' as string]: i }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.6)]" />
        </span>
      ))}
    </div>
  )
}

function Categories({ model }: { model: AboutModel }) {
  return (
    <div className="relative mx-auto flex w-full max-w-[460px] flex-col items-center gap-6 py-6">
      <span aria-hidden className="absolute inset-x-[10%] top-0 h-56 rounded-full bg-[radial-gradient(circle,rgba(125,180,255,0.16),transparent_66%)]" />
      {model.gameImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={model.gameImageUrl}
          alt={`${model.gameName} logo`}
          width={136}
          height={136}
          loading="lazy"
          decoding="async"
          className="gh-float relative h-[120px] w-[120px] rounded-[28px] object-cover shadow-[0_28px_50px_-18px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.08)] sm:h-[136px] sm:w-[136px]"
        />
      ) : (
        <span className="relative grid h-[120px] w-[120px] place-items-center rounded-[28px] bg-white/[0.06]">
          <PackageIcon size={40} weight="duotone" className="text-text-secondary" aria-hidden />
        </span>
      )}
      {model.categories.length > 0 && (
        <nav aria-label={`${model.gameName} categories`} className="relative flex flex-wrap justify-center gap-2.5">
          {model.categories.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1D1E23] px-4 text-[14px] font-semibold text-text-primary shadow-[0_14px_28px_-16px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.06)] transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-[#24252B]"
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
  return (
    <section aria-label={`About ${model.gameName}`} className="mt-24 flex flex-col gap-20 sm:mt-32 sm:gap-28">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Copy row={buy} from="left" />
        {model.art.length > 0 ? <Collage art={model.art} /> : <Categories model={model} />}
      </div>

      {model.art.length > 0 ? (
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="order-2 lg:order-1">
            <Categories model={model} />
          </div>
          <div className="order-1 lg:order-2">
            <Copy row={what} from="right" />
          </div>
        </div>
      ) : (
        // No item pictures: the categories already sit beside row one, so this row reads alone.
        <Copy row={what} from="centre" />
      )}

      <div className="relative py-6">
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-48 max-w-3xl rounded-full bg-[radial-gradient(ellipse_at_center,rgba(245,196,81,0.12),transparent_70%)] blur-xl" />
        <div className="relative">
          <Copy row={why} from="centre" />
        </div>
      </div>
    </section>
  )
}
