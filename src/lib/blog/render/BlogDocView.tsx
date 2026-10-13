/**
 * A post's blocks → the article body, on the server (`@tiptap/static-renderer`,
 * no editor code in the page). One renderer for every post: legacy bodies are
 * converted to the same doc first (readBody → legacyToDoc).
 *
 * Layout is a breakout grid: every block sits in a 700px reading column; a
 * "wide" figure spans the whole cell up to 960px — never past the cell, so it
 * can't slide under the contents list or the buy rails beside it.
 */
import { createElement, type ReactNode } from 'react'
import { renderToReactElement } from '@tiptap/static-renderer/pm/react'
import Link from '@/components/navigation/AppLink'
import type { RailCard } from '@/lib/buy-rails/model'
import { blogExtensions } from '@/lib/blog/doc/schema'
import type { BlogDoc } from '@/lib/blog/doc/types'
import { collectHeadings } from './outline'
import { classifyHref } from './links'
import { pruneEmpty } from './prune'
import { CalloutView, CodesView, CtaView, FaqView, FigureView, ImagePairView, ItemCardView, YouTubeView } from './nodes'

type PmNode = { attrs: Record<string, unknown>; type: { name: string } }
type Props = { node: PmNode; children?: ReactNode }

const P = 'mt-5 text-[16.5px] leading-[1.7] text-text-secondary sm:text-[17px]'
const LIST = 'mt-5 space-y-2 pl-6 text-[16.5px] leading-[1.7] text-text-secondary marker:text-text-tertiary sm:text-[17px]'
const LINK = 'font-medium text-[color:var(--ct-accent-text,#E6E8EB)] underline decoration-white/25 underline-offset-[3px] hover:decoration-current'

export const BLOG_PROSE_GRID =
  // Top margins only: grid items' margins never collapse, so my-* doubled every gap.
  'blog-prose grid [&>*:first-child]:mt-0 [&>h2+*]:mt-4 [&>h3+*]:mt-3 grid-cols-[minmax(0,1fr)_minmax(0,700px)_minmax(0,1fr)] [&>*]:col-start-2 [&>.blog-wide]:col-[1/-1] [&>.blog-wide]:w-full [&>.blog-wide]:max-w-[960px] [&>.blog-wide]:justify-self-center'

export function BlogDocView({ doc, items }: { doc: BlogDoc; items?: Map<string, RailCard> }) {
  // Heading ids in render order, from the same walk the contents list uses
  // (pruning never drops a heading, so the ids match the page's contents list).
  const ids = collectHeadings(doc).map((h) => h.id)
  let headingAt = 0

  return renderToReactElement({
    extensions: blogExtensions(),
    content: pruneEmpty(doc),
    options: {
      nodeMapping: {
        doc: ({ children }: Props) => <div className={BLOG_PROSE_GRID}>{children}</div>,
        paragraph: ({ children }: Props) => <p className={P}>{children}</p>,
        heading: ({ node, children }: Props) => {
          const id = ids[headingAt++]
          return node.attrs.level === 3 ? (
            <h3 id={id} className="mt-9 scroll-mt-[calc(var(--hub-nav-h,112px)+56px)] text-[19px] font-semibold leading-snug text-text-primary sm:text-[20px]">{children}</h3>
          ) : (
            <h2 id={id} className="mt-12 scroll-mt-[calc(var(--hub-nav-h,112px)+56px)] text-[22px] font-bold leading-tight tracking-[-0.01em] text-text-primary sm:text-[26px]">{children}</h2>
          )
        },
        bulletList: ({ children }: Props) => <ul className={`${LIST} list-disc`}>{children}</ul>,
        orderedList: ({ node, children }: Props) => (
          <ol start={Number(node.attrs.start ?? 1)} className={`${LIST} list-decimal`}>{children}</ol>
        ),
        listItem: ({ children }: Props) => <li className="pl-1 [&>p]:my-0">{children}</li>,
        blockquote: ({ children }: Props) => (
          <blockquote className="mt-7 border-l-2 border-white/15 pl-5 [&>p]:text-text-primary">{children}</blockquote>
        ),
        horizontalRule: () => <hr className="mt-10 mb-5 border-white/[0.08]" />,
        hardBreak: () => <br />,
        table: ({ children }: Props) => (
          // `relative`: a scroller's absolutely-positioned children must not widen the page.
          <div className="relative mt-7 overflow-x-auto rounded-[10px] border border-white/[0.07]">
            <table className="w-full border-collapse text-left text-[15px]"><tbody>{children}</tbody></table>
          </div>
        ),
        tableRow: ({ children }: Props) => <tr className="border-b border-white/[0.06] last:border-0">{children}</tr>,
        tableHeader: ({ children }: Props) => (
          <th className="whitespace-nowrap bg-white/[0.03] px-4 py-2.5 text-[13px] font-semibold text-text-primary [&>p]:my-0 [&>p]:text-[13px]">{children}</th>
        ),
        tableCell: ({ children }: Props) => (
          <td className="px-4 py-2.5 align-top text-text-secondary [&>p]:my-0 [&>p]:text-[15px] [&>p]:leading-6">{children}</td>
        ),
        figure: ({ node }: Props) => <FigureView attrs={node.attrs} />,
        imagePair: ({ node }: Props) => <ImagePairView attrs={node.attrs} />,
        callout: ({ node, children }: Props) => <CalloutView tone={node.attrs.tone}>{children}</CalloutView>,
        faq: ({ node }: Props) => <FaqView attrs={node.attrs} />,
        codes: ({ node }: Props) => <CodesView attrs={node.attrs} />,
        itemCard: ({ node }: Props) => (
          <ItemCardView attrs={node.attrs} card={items?.get(`${node.attrs.gameSlug}/${node.attrs.itemSlug}`)} />
        ),
        cta: ({ node }: Props) => <CtaView attrs={node.attrs} />,
        youtube: ({ node }: Props) => <YouTubeView attrs={node.attrs} />,
      },
      markMapping: {
        bold: ({ children }: { children?: ReactNode }) => <strong className="font-semibold text-text-primary">{children}</strong>,
        italic: ({ children }: { children?: ReactNode }) => <em>{children}</em>,
        link: ({ mark, children }: { mark: { attrs: Record<string, unknown> }; children?: ReactNode }) => {
          const kind = classifyHref(String(mark.attrs.href ?? ''))
          if ('internal' in kind) return <Link href={kind.internal} className={LINK}>{children}</Link>
          if ('external' in kind)
            return createElement('a', { href: kind.external, className: LINK, target: '_blank', rel: 'noopener noreferrer nofollow' }, children)
          return <>{children}</>
        },
      },
    },
  })
}
