import Link from '@/components/navigation/AppLink'
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded'
import { ContentDisclaimer } from '@/components/content/ContentDisclaimer'
import { postHref } from '@/lib/blog/post-url'
import { SabSellerCta } from '../../_SabSellerCta'
import { BLOG_CARD } from '@/lib/blog/render/surface'
import { Calculator } from '@phosphor-icons/react/dist/ssr/Calculator'
import { ListMagnifyingGlass } from '@phosphor-icons/react/dist/ssr/ListMagnifyingGlass'
import { Tag } from '@phosphor-icons/react/dist/ssr/Tag'

const DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export interface RelatedTool {
  /** Which tool: picks the faded picture in the card's corner. */
  kind: 'values' | 'calculator' | 'sell'
  label: string
  desc: string
  href: string
}

export interface RelatedGuide {
  slug: string
  title: string
  kind: string
  primaryGameSlug: string | null
  postType?: string | null
  publishedAt: string
  updatedAt: string
}

/** Each tool's picture, drawn big, tilted and faded in its card's corner (owner, 2026-10-13). */
const TOOL_MARK = { values: ListMagnifyingGlass, calculator: Calculator, sell: Tag } as const
const MARK =
  'pointer-events-none absolute -bottom-6 right-10 -rotate-[14deg] text-white opacity-[0.06] transition-[transform,opacity] duration-300 ' +
  'group-hover:-rotate-[8deg] group-hover:opacity-[0.09] motion-reduce:transition-none'

/**
 * The end of an article: the money pages that match its intent, the seller
 * band, the game's other guides (with their real last-edit date), and the
 * disclaimer. Solid blog cards (BLOG_CARD), full reading-column width.
 */
export function ArticleEnd({
  gameSlug,
  gameName,
  slug,
  tools,
  related,
  includeValueNote,
}: {
  gameSlug: string
  gameName: string
  slug: string
  tools: RelatedTool[]
  related: RelatedGuide[]
  includeValueNote: boolean
}) {
  return (
    <div className="w-full">
      {tools.length > 0 && (
        <section className="mt-12" aria-labelledby="related-tools">
          <h2 id="related-tools" className="mb-4 text-[18px] font-bold text-text-primary">Tools For This Guide</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {tools.map((t) => {
              const Mark = TOOL_MARK[t.kind]
              return (
                <Link key={t.href} href={t.href} className={`group relative flex items-start justify-between gap-3 overflow-hidden p-4 transition-colors hover:border-white/[0.14] ${BLOG_CARD}`}>
                  <Mark aria-hidden data-tool-mark={t.kind} size={92} weight="duotone" className={MARK} />
                  <span className="relative">
                    <span className="block text-[15px] font-semibold text-text-primary">{t.label}</span>
                    <span className="mt-1 block text-[13.5px] leading-5 text-text-secondary">{t.desc}</span>
                  </span>
                  <ArrowForwardRounded aria-hidden sx={{ fontSize: 18 }} className="relative mt-0.5 shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5" />
                </Link>
              )
            })}
          </div>
        </section>
      )}

      <SabSellerCta gameSlug={gameSlug} gameName={gameName} src={`${gameSlug}-blog-${slug}`} />

      {related.length > 0 && (
        <section className="mt-14" aria-labelledby="related-guides">
          <h2 id="related-guides" className="mb-4 text-[22px] font-bold tracking-tight text-text-primary">More {gameName} Guides</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {related.map((r) => {
              const edited = r.updatedAt > r.publishedAt
              const d = new Date(edited ? r.updatedAt : r.publishedAt)
              return (
                <Link key={r.slug} href={postHref(r)} className={`flex flex-col gap-2 p-4 transition-colors hover:border-white/[0.14] ${BLOG_CARD}`}>
                  <span className="text-[12px] font-medium text-text-tertiary">{r.kind}</span>
                  <span className="text-[15px] font-semibold leading-snug text-text-primary">{r.title}</span>
                  {Number.isFinite(d.getTime()) && (
                    <span className="mt-auto text-[12px] text-text-tertiary">{edited ? 'Updated' : 'Published'} {DATE.format(d)}</span>
                  )}
                </Link>
              )
            })}
          </div>
        </section>
      )}

      <ContentDisclaimer gameName={gameName} gameSlug={gameSlug} includeValueNote={includeValueNote} />
    </div>
  )
}
