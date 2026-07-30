'use client'

/**
 * Live preview drawer for the blog editor.
 *
 * Renders the post exactly as the public site will, from the editor's current
 * (unsaved) state — the same `GuideCard` the guides carousel uses and the same
 * `ArticleBody` renderer the article page uses, so what you see here can't
 * drift from production.
 *
 * Two tabs: "Card" (how it appears in the guides carousel) and "Article"
 * (headline, byline and body — a quick glance, not the full page chrome).
 */

import { useState } from 'react'
import { GuideCard } from '../../../(marketplace)/[gameSlug]/blogs/_ArticleGrid'
import { ArticleBody } from '../../../(marketplace)/[gameSlug]/blogs/[slug]/_articleBody'

const CARD_DATE = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

const POST_TYPE_LABEL: Record<string, string> = {
  value: 'Values',
  seller: 'Selling',
  guide: 'Guide',
}

export function BlogPreview({
  open,
  onClose,
  gameSlug,
  slug,
  title,
  excerpt,
  author,
  readMinutes,
  postType,
  coverUrl,
  body,
}: {
  open: boolean
  onClose: () => void
  gameSlug: string | null
  slug: string
  title: string
  excerpt: string
  author: string
  readMinutes: number
  postType: string
  coverUrl: string
  body: string
}) {
  const [tab, setTab] = useState<'card' | 'article'>('card')
  if (!open) return null

  const category = POST_TYPE_LABEL[postType] ?? 'Guide'
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm sm:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-4xl border border-[#263026] bg-[#0B0F0C]">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-[#1A211A] px-5 py-4">
          <div className="flex items-center gap-2">
            {(['card', 'article'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-3.5 py-2 text-[13px] font-semibold transition ${
                  tab === t
                    ? 'bg-[#3FA35C] text-[#08110B]'
                    : 'border border-[#263026] text-[#9BA8A0] hover:text-[#F1F3F1]'
                }`}
              >
                {t === 'card' ? 'Card' : 'Article'}
              </button>
            ))}
            <span className="ml-2 font-mono text-[11px] uppercase tracking-[0.1em] text-[#5E685E]">
              Live preview · unsaved
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="flex h-8 w-8 items-center justify-center border border-[#263026] text-[#9BA8A0] transition hover:text-[#F1F3F1]"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-8">
          {tab === 'card' ? (
            <div className="flex justify-center">
              <GuideCard
                gameSlug={gameSlug ?? 'preview'}
                post={{
                  slug: slug || 'preview',
                  title: title || 'Untitled guide',
                  excerpt,
                  category,
                  date: CARD_DATE.format(new Date()),
                  cover: coverUrl || null,
                  readMinutes: readMinutes || 5,
                }}
              />
            </div>
          ) : (
            <article className="mx-auto max-w-[720px]">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[#4FB477]">
                {category}
              </p>
              <h1 className="text-balance text-[30px] font-bold leading-[1.08] tracking-[-0.03em] text-[#F1F3F1]">
                {title || 'Untitled guide'}
              </h1>
              {excerpt && (
                <p className="mt-4 text-pretty text-[15px] leading-7 text-[#B7C0B8]">
                  {excerpt}
                </p>
              )}
              <div className="mt-6 flex flex-wrap items-center gap-3.5 border-t border-[#191F19] pt-5">
                <span className="flex h-9 w-9 items-center justify-center border border-[#23331F] bg-[#0D140E] font-mono text-[11px] font-bold text-[#8FBF9C]">
                  DM
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-[13px] font-semibold text-[#D7DED4]">
                    {author || 'DropMarket Team'}
                  </span>
                  <span className="font-mono text-[11px] text-[#5E685E]">
                    {readMinutes || 5} MIN READ
                  </span>
                </span>
              </div>
              {coverUrl && (
                <div className="mt-8 overflow-hidden border border-[#1E2723]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverUrl} alt="" className="w-full object-cover" />
                </div>
              )}
              <div className="mt-8">
                {paragraphs.length > 0 ? (
                  <ArticleBody body={paragraphs} />
                ) : (
                  <p className="font-mono text-[12px] text-[#5E685E]">
                    Nothing written yet — the body will render here.
                  </p>
                )}
              </div>
            </article>
          )}
        </div>
      </div>
    </div>
  )
}
