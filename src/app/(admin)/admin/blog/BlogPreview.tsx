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
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { SegmentedTabs } from '@/components/account/SegmentedTabs'
import { GuideCard } from '../../../(marketplace)/[gameSlug]/blog/_ArticleGrid'
import { ArticleBody } from '../../../(marketplace)/[gameSlug]/blog/[slug]/_articleBody'

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
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] max-w-4xl gap-0 overflow-y-auto border-0 p-0">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-4 py-3 pr-12 sm:px-5">
          <DialogTitle className="sr-only">Post Preview</DialogTitle>
          <SegmentedTabs
            tabs={[
              { id: 'card', label: 'Card' },
              { id: 'article', label: 'Article' },
            ]}
            value={tab}
            onChange={setTab}
            layoutId="blog-preview-tabs"
            ariaLabel="Preview"
          />
          <span className="text-[12px] text-text-tertiary">Live preview · unsaved</span>
        </div>

        {/* Body */}
        <div className="bg-bg-base p-5 sm:p-8">
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
      </DialogContent>
    </Dialog>
  )
}
