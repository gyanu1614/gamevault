/**
 * V42 — Blog article page. Renders a post from the file-based blog
 * module: hero cover, meta row, comfortable reading column.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getAllPosts, getPost } from '@/lib/blog/posts'

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
    title: `${post.title} | DropMarket Blog`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: post.cover ? [post.cover] : [],
      type: 'article',
    },
  }
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

  return (
    <main className="min-h-screen pb-24">
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
          {post.body.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </article>
    </main>
  )
}
