import Link from '@/components/navigation/AppLink'

const DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const fmt = (iso: string) => {
  const d = new Date(iso)
  return Number.isFinite(d.getTime()) ? DATE.format(d) : null
}

/**
 * Article header (2026-10-12 revamp), in reading order: a breadcrumb back to
 * the game's guides, the post type, the H1, a one- or two-line answer, then
 * one byline — author · Updated <date> · N min read. The date is the real
 * last edit (dateModified), never bumped for freshness.
 */
export function ArticleHeader({
  gameSlug,
  gameName,
  kindLabel,
  title,
  excerpt,
  author,
  publishedAt,
  updatedAt,
  readMinutes,
  note,
}: {
  gameSlug: string
  gameName: string
  kindLabel: string
  title: string
  excerpt: string
  author: string
  publishedAt: string
  updatedAt: string
  readMinutes: number
  /** Codes posts: the freshness note ("2 new codes"), shown with the update date. */
  note?: string | null
}) {
  const edited = !!updatedAt && updatedAt > publishedAt
  const date = fmt(edited ? updatedAt : publishedAt)
  return (
    <header className="mx-auto w-full max-w-[700px]">
      <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 text-[13px] text-text-tertiary">
        <Link href={`/${gameSlug}/blog`} className="hover:text-text-primary">{gameName} Guides</Link>
        <span aria-hidden>›</span>
        <span className="text-[color:var(--ct-accent-text,#C9CCD2)]">{kindLabel}</span>
      </nav>
      <h1 className="text-balance text-[28px] font-bold leading-[1.12] tracking-[-0.025em] text-text-primary sm:text-[36px] lg:text-[40px]">
        {title}
      </h1>
      {excerpt && <p className="mt-4 text-pretty text-[16.5px] leading-[1.6] text-text-secondary sm:text-[18px]">{excerpt}</p>}
      <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-text-tertiary">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-mark-white.avif" alt="" aria-hidden width={22} height={22} className="h-[22px] w-[22px] object-contain" />
        <span className="font-semibold text-text-primary">{author}</span>
        {date && (
          <>
            <span aria-hidden>·</span>
            <time dateTime={edited ? updatedAt : publishedAt}>{edited ? 'Updated' : 'Published'} {date}</time>
          </>
        )}
        <span aria-hidden>·</span>
        <span>{readMinutes} min read</span>
      </div>
      {note && (
        <p className="mt-3 text-[14px] font-semibold text-lime-text">
          Updated {fmt(updatedAt || publishedAt)} · {note}
        </p>
      )}
    </header>
  )
}
