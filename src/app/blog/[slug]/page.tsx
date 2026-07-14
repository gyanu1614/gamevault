/**
 * V42 — Blog article page. Renders a post from the file-based blog
 * module: hero cover, meta row, comfortable reading column.
 *
 * Body entries support a light markdown subset: '## ' → section
 * heading, '- ' (newline-separated) → bullet list, [text](href) →
 * internal link. Plain entries render as paragraphs, so older posts
 * are unaffected. Article + BreadcrumbList JSON-LD is emitted
 * server-side into the initial HTML.
 */

import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getAllPosts, getPost } from '@/lib/blog/posts'
import { SITE_NAME, SITE_URL } from '@/config/site'

interface PageProps {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) return { title: 'Post Not Found' }
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `/blog/${post.slug}`,
      images: post.cover ? [post.cover] : [],
      type: 'article',
      publishedTime: post.publishedAt,
    },
  }
}

/** Inline [text](href) → Link; everything else passes through as text. */
function renderInline(text: string): ReactNode {
  return text.split(/(\[[^\]]+\]\([^)\s]+\))/g).map((part, i) => {
    const match = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)
    if (!match) return part
    return (
      <Link
        key={i}
        href={match[2]}
        className="font-semibold text-text-primary underline underline-offset-4 transition-opacity hover:opacity-80"
      >
        {match[1]}
      </Link>
    )
  })
}

function renderBlock(block: string, key: number): ReactNode {
  if (block.startsWith('## ')) {
    return (
      <h2
        key={key}
        className="pt-3 text-[21px] font-bold leading-snug tracking-tight text-text-primary sm:text-[23px]"
      >
        {block.slice(3)}
      </h2>
    )
  }
  if (block.startsWith('- ')) {
    return (
      <ul key={key} className="list-disc space-y-2.5 pl-5 marker:text-text-tertiary">
        {block.split('\n').map((item, j) => (
          <li key={j}>{renderInline(item.replace(/^- /, ''))}</li>
        ))}
      </ul>
    )
  }
  return <p key={key}>{renderInline(block)}</p>
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) notFound()

  const date = new Date(post.publishedAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const canonicalUrl = `${SITE_URL}/blog/${post.slug}`

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    author: { '@type': 'Organization', name: post.author, url: SITE_URL },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
    ...(post.cover ? { image: [`${SITE_URL}${post.cover}`] } : {}),
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: canonicalUrl },
    ],
  }

  return (
    <main className="min-h-screen pb-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <article className="mx-auto w-full max-w-3xl px-4 pt-10 sm:px-6 sm:pt-14">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-text-tertiary transition-colors hover:text-text-primary"
        >
          <ChevronLeft className="h-4 w-4" />
          All posts
        </Link>

        <h1 className="mt-6 text-[28px] font-extrabold leading-[1.15] tracking-tight text-text-primary sm:text-[38px]">
          {post.title}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-[14px] text-text-tertiary">
          <span className="font-semibold text-text-secondary">{post.author}</span>
          <span aria-hidden>·</span>
          <span>{date}</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{post.readMinutes} min read</span>
        </div>

        {post.cover && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={post.cover}
            alt=""
            className="mt-8 aspect-[2/1] w-full rounded-2xl object-cover ring-1 ring-border-subtle"
          />
        )}

        <div className="mt-9 space-y-6 text-[16.5px] leading-[1.75] text-text-secondary">
          {post.body.map((block, i) => renderBlock(block, i))}
        </div>
      </article>
    </main>
  )
}
