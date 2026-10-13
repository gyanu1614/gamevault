'use client'

/**
 * Preview: the article exactly as the public page draws it (same header,
 * cover and block renderer), at desktop or phone width, from what is in the
 * editor now — no save needed. Item cards show their name only here; live
 * prices and offers fill in on the real page.
 */
import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ArticleHeader } from '@/components/blog/ArticleHeader'
import { ArticleCover } from '@/components/blog/ArticleCover'
import { BlogDocView } from '@/lib/blog/render/BlogDocView'
import { docReadMinutes } from '@/lib/blog/render/outline'
import type { BlogDoc, StoredImage } from '@/lib/blog/doc/types'
import { cn } from '@/lib/utils'

const KIND: Record<string, string> = { value: 'Value Guide', seller: 'Selling Guide', guide: 'Guide' }

export function Preview({
  open,
  onClose,
  gameSlug,
  gameName,
  postType,
  title,
  excerpt,
  author,
  cover,
  coverUrl,
  doc,
}: {
  open: boolean
  onClose: () => void
  gameSlug: string
  gameName: string
  postType: string
  title: string
  excerpt: string
  author: string
  cover: StoredImage | null
  coverUrl: string | null
  doc: BlogDoc
}) {
  const [width, setWidth] = useState<'desktop' | 'phone'>('desktop')
  const now = new Date().toISOString()
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[92vh] max-h-[92vh] w-[min(1180px,96vw)] max-w-none flex-col gap-0 overflow-hidden bg-[#111214] p-0">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3 pr-14">
          <div>
            <DialogTitle className="text-[15px] font-semibold text-text-primary">Preview</DialogTitle>
            <DialogDescription className="text-[12.5px] text-text-tertiary">What readers see. Prices on item cards load on the live page.</DialogDescription>
          </div>
          <div className="flex rounded-md bg-white/[0.05] p-0.5" role="group" aria-label="Preview width">
            {(['desktop', 'phone'] as const).map((w) => (
              <button
                key={w}
                type="button"
                aria-pressed={width === w}
                onClick={() => setWidth(w)}
                className={cn('h-8 rounded px-3 text-[12.5px] font-medium', width === w ? 'bg-white/[0.14] text-text-primary' : 'text-text-secondary')}
              >
                {w === 'desktop' ? 'Desktop' : 'Phone'}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#0E0F11] py-8">
          <div className={cn('mx-auto px-4', width === 'phone' ? 'w-[390px] rounded-[18px] border border-white/[0.08] py-6' : 'w-full max-w-[1000px] sm:px-6')}>
            <ArticleHeader
              gameSlug={gameSlug}
              gameName={gameName}
              kindLabel={KIND[postType] ?? 'Guide'}
              title={title || 'Untitled post'}
              excerpt={excerpt}
              author={author}
              publishedAt={now}
              updatedAt={now}
              readMinutes={docReadMinutes(doc)}
            />
            <ArticleCover image={cover} url={coverUrl} alt={title} />
            <div className={cover || coverUrl ? undefined : 'mt-8'}>
              <BlogDocView doc={doc} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
