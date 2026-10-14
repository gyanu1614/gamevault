/**
 * A post's blocks → the article body, on the server (`@tiptap/static-renderer`,
 * no editor code in the page). One renderer for every post: legacy bodies are
 * converted to the same doc first (readBody → legacyToDoc).
 *
 * Layout: every block fills the reading column (up to 820px, beside the
 * right sidebar — components/blog/layout.ts); a "wide" picture just gets a
 * taller height cap (picture-size.ts).
 */
import { createElement, type ReactNode } from 'react'
import { renderToReactElement } from '@tiptap/static-renderer/pm/react'
import Link from '@/components/navigation/AppLink'
import type { RailCard } from '@/lib/buy-rails/model'
import { blogExtensions } from '@/lib/blog/doc/schema'
import type { BlogDoc } from '@/lib/blog/doc/types'
import { collectHeadings } from './outline'
import { classifyHref, gamePath } from './links'
import { pruneEmpty } from './prune'
import { safeColor } from '@/lib/blog/doc/color'
import { itemKey } from './outline'
import type { LinkedItem } from '@/lib/blog/item-catalog'
import { CalloutView, CodesView, CtaView, FaqView, FigureView, ImagePairView, ItemCardView, YouTubeView } from './nodes'

type PmNode = {
  attrs: Record<string, unknown>
  type: { name: string }
  textContent: string
  firstChild: PmNode | null
  descendants: (f: (n: PmNode) => void) => void
}
type Props = { node: PmNode; children?: ReactNode; parent?: PmNode }

const hasCellImage = (n: PmNode) => {
  let found = false
  n.descendants((c) => {
    if (c.type.name === 'cellImage') found = true
  })
  return found
}

/** Headings stop below the fixed hub nav + the phone contents bar when jumped to. */
const HEADING_ANCHOR = 'scroll-mt-[calc(var(--hub-nav-h,112px)+56px)]'

/**
 * The block grid: one column (grid items' top margins never collapse — see
 * blog-prose.css). Type, colour and spacing come from ONE stylesheet shared
 * with the editor (src/styles/blog-prose.css, `.blog-prose`).
 */
export const BLOG_PROSE_GRID = 'blog-prose blog-type grid grid-cols-[minmax(0,1fr)]'

export function BlogDocView({
  doc,
  items,
  tableItems,
  gameSlug,
}: {
  doc: BlogDoc
  items?: Map<string, RailCard>
  /** Value items named in table first columns (loadTableItems), by itemKey(name). */
  tableItems?: Map<string, LinkedItem>
  gameSlug?: string | null
}) {
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
        paragraph: ({ children }: Props) => <p>{children}</p>,
        heading: ({ node, children }: Props) => {
          const id = ids[headingAt++]
          return node.attrs.level === 3 ? <h3 id={id} className={HEADING_ANCHOR}>{children}</h3> : <h2 id={id} className={HEADING_ANCHOR}>{children}</h2>
        },
        bulletList: ({ children }: Props) => <ul>{children}</ul>,
        orderedList: ({ node, children }: Props) => <ol start={Number(node.attrs.start ?? 1)}>{children}</ol>,
        listItem: ({ children }: Props) => <li>{children}</li>,
        blockquote: ({ children }: Props) => <blockquote>{children}</blockquote>,
        horizontalRule: () => <hr />,
        hardBreak: () => <br />,
        table: ({ children }: Props) => (
          // `relative`: a scroller's absolutely-positioned children must not widen the page.
          <div className="blog-table relative">
            <table><tbody>{children}</tbody></table>
          </div>
        ),
        tableRow: ({ children }: Props) => <tr>{children}</tr>,
        tableHeader: ({ children }: Props) => <th>{children}</th>,
        tableCell: ({ node, parent, children }: Props) => {
          // A first-column item from the game's value list: its picture, linked to its value page.
          const item = parent?.firstChild === node && !hasCellImage(node) ? tableItems?.get(itemKey(node.textContent)) : undefined
          if (!item?.imageUrl) return <td>{children}</td>
          return (
            <td>
              <span className="bp-cell-item">
                <Link href={item.href} aria-hidden tabIndex={-1}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- catalogue art, fixed 40px square */}
                  <img data-cell-image="" src={item.imageUrl} alt="" width={40} height={40} loading="lazy" decoding="async" />
                </Link>
                <span>{children}</span>
              </span>
            </td>
          )
        },
        cellImage: ({ node }: Props) => (
          // eslint-disable-next-line @next/next/no-img-element -- an uploaded table picture, fixed 40px square
          <img data-cell-image="" src={String(node.attrs.src ?? '')} alt={String(node.attrs.alt ?? '')} width={40} height={40} loading="lazy" decoding="async" />
        ),
        figure: ({ node }: Props) => <FigureView attrs={node.attrs} />,
        imagePair: ({ node }: Props) => <ImagePairView attrs={node.attrs} />,
        callout: ({ node, children }: Props) => <CalloutView tone={node.attrs.tone}>{children}</CalloutView>,
        faq: ({ node }: Props) => <FaqView attrs={node.attrs} />,
        codes: ({ node }: Props) => <CodesView attrs={node.attrs} />,
        itemCard: ({ node }: Props) => (
          <ItemCardView attrs={node.attrs} card={items?.get(`${node.attrs.gameSlug}/${node.attrs.itemSlug}`)} />
        ),
        cta: ({ node }: Props) => <CtaView attrs={node.attrs} gameSlug={gameSlug} />,
        youtube: ({ node }: Props) => <YouTubeView attrs={node.attrs} />,
      },
      markMapping: {
        bold: ({ children }: { children?: ReactNode }) => <strong>{children}</strong>,
        italic: ({ children }: { children?: ReactNode }) => <em>{children}</em>,
        link: ({ mark, children }: { mark: { attrs: Record<string, unknown> }; children?: ReactNode }) => {
          const kind = classifyHref(String(mark.attrs.href ?? ''))
          if ('internal' in kind) return <Link href={gamePath(kind.internal, gameSlug)}>{children}</Link>
          if ('external' in kind)
            return createElement('a', { href: kind.external, target: '_blank', rel: 'noopener noreferrer nofollow' }, children)
          return <>{children}</>
        },
        // A picked text colour: hex only (doc/color.ts), else the text without it.
        textStyle: ({ mark, children }: { mark: { attrs: Record<string, unknown> }; children?: ReactNode }) => {
          const color = safeColor(mark.attrs.color)
          return color ? <span style={{ color }}>{children}</span> : <>{children}</>
        },
      },
    },
  })
}
