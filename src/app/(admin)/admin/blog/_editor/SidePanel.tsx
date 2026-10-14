'use client'

/**
 * The editor's side panel, top to bottom: what the post still needs, where it
 * lives (game, type, URL, author), its cover, and how it shows on Google.
 */
import { useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded'
import RadioButtonUncheckedRounded from '@mui/icons-material/RadioButtonUncheckedRounded'
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded'
import { FrameCropDialog } from '@/components/ui/frame-crop-dialog'
import type { CheckItem } from '@/lib/blog/editor/checklist'
import { slugify } from '@/lib/blog/editor/checklist'
import type { StoredImage } from '@/lib/blog/doc/types'
import { cn } from '@/lib/utils'
import { SITE_URL } from '@/config/site'
import { fieldCls } from './node-views'
import { uploadImage } from './upload'

export type PostType = 'guide' | 'value' | 'seller' | 'codes'
export interface Meta {
  gameSlug: string
  postType: PostType
  slug: string
  author: string
  seoTitle: string
  seoDescription: string
  /** Codes posts: the update note shown with the date ("2 new codes"). */
  note: string
}

const TYPES: Array<[PostType, string]> = [
  ['guide', 'Guide'],
  ['value', 'Value Guide'],
  ['seller', 'Selling Guide'],
  ['codes', 'Codes (one per game)'],
]

const card = 'rounded-[10px] bg-[#1D1E23] p-4'
const head = 'mb-3 text-[13px] font-semibold text-text-primary'
const lbl = 'mb-1.5 block text-[12.5px] font-medium text-text-secondary'
const select = cn(fieldCls, 'cursor-pointer')

function Count({ n, max }: { n: number; max: number }) {
  return <span className={cn('tabular-nums', n > max ? 'text-[#E0B155]' : 'text-text-tertiary')}>{n}/{max}</span>
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={card}>
      <h2 className={head}>{title}</h2>
      {children}
    </section>
  )
}

export function Checklist({ items }: { items: CheckItem[] }) {
  return (
    <Section title="Before You Publish">
      <ul className="space-y-1.5">
        {items.map((i) => (
          <li key={i.id} className="flex items-start gap-2 text-[13px] leading-5">
            {i.ok ? (
              <CheckCircleRounded aria-hidden sx={{ fontSize: 17 }} className="mt-px shrink-0 text-text-secondary" />
            ) : i.blocking ? (
              <ErrorOutlineRounded aria-hidden sx={{ fontSize: 17 }} className="mt-px shrink-0 text-[#E0B155]" />
            ) : (
              <RadioButtonUncheckedRounded aria-hidden sx={{ fontSize: 17 }} className="mt-px shrink-0 text-text-tertiary" />
            )}
            <span className={i.ok ? 'text-text-secondary' : 'text-text-primary'}>
              {i.label}
              {!i.ok && i.blocking && <span className="text-text-tertiary"> · needed to publish</span>}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  )
}

export function PostSettings({
  meta,
  set,
  games,
  slugLocked,
  onSlugEdit,
}: {
  meta: Meta
  set: (patch: Partial<Meta>) => void
  games: Array<{ slug: string; name: string }>
  slugLocked: boolean
  onSlugEdit: () => void
}) {
  return (
    <Section title="Post">
      <div className="space-y-3">
        <div>
          <label htmlFor="post-game" className={lbl}>Game</label>
          <select id="post-game" className={select} value={meta.gameSlug} onChange={(e) => set({ gameSlug: e.target.value })}>
            <option value="">Choose a game</option>
            {games.map((g) => <option key={g.slug} value={g.slug}>{g.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="post-type" className={lbl}>Type</label>
          <select id="post-type" className={select} value={meta.postType} onChange={(e) => set({ postType: e.target.value as PostType })}>
            {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="post-slug" className={lbl}>URL</label>
          <input
            id="post-slug"
            className={cn(fieldCls, 'font-mono')}
            value={meta.slug}
            onChange={(e) => {
              onSlugEdit()
              set({ slug: slugify(e.target.value) })
            }}
            placeholder="halloween-event-guide"
          />
          <p className="mt-1.5 truncate font-mono text-[11.5px] text-text-tertiary">
            /{meta.gameSlug || 'game'}/blog/{meta.slug || '…'}
          </p>
          {slugLocked && <p className="mt-1 text-[11.5px] text-text-tertiary">Changing a live URL is fine: the old one sends visitors to the new one.</p>}
        </div>
        <div>
          <label htmlFor="post-author" className={lbl}>Author</label>
          <input id="post-author" className={fieldCls} value={meta.author} onChange={(e) => set({ author: e.target.value })} />
        </div>
        {meta.postType === 'codes' && (
          <div>
            <label htmlFor="post-note" className={cn(lbl, 'flex justify-between')}>
              <span>Update Note</span>
              <Count n={meta.note.length} max={80} />
            </label>
            <input
              id="post-note"
              className={fieldCls}
              value={meta.note}
              onChange={(e) => set({ note: e.target.value })}
              placeholder="2 new codes"
            />
            <p className="mt-1.5 text-[11.5px] text-text-tertiary">Shown with the date under the title: Updated Oct 13 · 2 new codes.</p>
          </div>
        )}
        {meta.postType === 'codes' && (
          <p className="text-[11.5px] text-text-tertiary">This post becomes the game&rsquo;s codes page at /{meta.gameSlug || 'game'}/codes.</p>
        )}
      </div>
    </Section>
  )
}

export function CoverPicker({ cover, coverUrl, onChange }: { cover: StoredImage | null; coverUrl: string | null; onChange: (img: StoredImage | null) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const src = cover?.src ?? coverUrl
  return (
    <Section title="Cover">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="aspect-video w-full rounded-md object-cover" />
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="grid aspect-video w-full place-items-center rounded-md border border-dashed border-white/15 text-[13px] text-text-secondary hover:text-text-primary"
        >
          Add a Cover
        </button>
      )}
      <p className="mt-2 text-[12px] text-text-tertiary">16:9. 1200px wide or more looks sharpest (800px is the least). Shown on the post, the guide cards and when shared.</p>
      {src && (
        <div className="mt-2.5 flex gap-1.5">
          <button type="button" onClick={() => input.current?.click()} className="h-8 rounded-md bg-white/[0.06] px-3 text-[12.5px] font-medium text-text-primary hover:bg-white/[0.1]">
            Replace
          </button>
          <button type="button" onClick={() => onChange(null)} className="h-8 rounded-md px-3 text-[12.5px] font-medium text-text-tertiary hover:text-error">
            Remove
          </button>
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) setFile(f)
        }}
      />
      <FrameCropDialog
        file={file}
        aspect={16 / 9}
        title="Cover Image"
        hint="Drag and zoom to frame it. The whole frame shows on the post."
        fit="contain"
        minWidth={800}
        idealWidth={1200}
        busy={busy}
        saveLabel="Use This Cover"
        onCancel={() => setFile(null)}
        onConfirm={async ({ rect }) => {
          if (!file) return
          setBusy(true)
          const r = await uploadImage(file, 'cover', rect)
          setBusy(false)
          if (!r.ok) return void toast.error(r.error)
          onChange(r.image)
          setFile(null)
        }}
      />
    </Section>
  )
}

export function SearchPreview({ meta, set, title, excerpt }: { meta: Meta; set: (patch: Partial<Meta>) => void; title: string; excerpt: string }) {
  const shownTitle = meta.seoTitle || title || 'Post title'
  const shownDesc = meta.seoDescription || excerpt || 'The summary under the title shows here.'
  const host = SITE_URL.replace(/^https?:\/\//, '')
  return (
    <Section title="Google">
      <div className="rounded-md bg-[#141518] p-3">
        <p className="truncate text-[12px] text-text-tertiary">{host} › {meta.gameSlug || 'game'} › blog</p>
        <p className="mt-0.5 line-clamp-1 text-[16px] leading-snug text-[#9DB8FF]">{shownTitle} | DropMarket</p>
        <p className="mt-1 line-clamp-2 text-[12.5px] leading-[1.45] text-text-secondary">{shownDesc}</p>
      </div>
      <div className="mt-3 space-y-3">
        <div>
          <label htmlFor="seo-title" className={cn(lbl, 'flex justify-between')}>
            <span>Search Title</span>
            <Count n={(meta.seoTitle || title).length} max={60} />
          </label>
          <input id="seo-title" className={fieldCls} value={meta.seoTitle} onChange={(e) => set({ seoTitle: e.target.value })} placeholder="Uses the post title" />
        </div>
        <div>
          <label htmlFor="seo-desc" className={cn(lbl, 'flex justify-between')}>
            <span>Search Summary</span>
            <Count n={(meta.seoDescription || excerpt).length} max={155} />
          </label>
          <textarea
            id="seo-desc"
            rows={3}
            className={cn(fieldCls, 'h-auto resize-none py-2 leading-5')}
            value={meta.seoDescription}
            onChange={(e) => set({ seoDescription: e.target.value })}
            placeholder="Uses the summary under the title"
          />
        </div>
      </div>
    </Section>
  )
}
