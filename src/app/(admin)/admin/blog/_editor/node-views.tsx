'use client'

/**
 * How each custom block looks and is edited INSIDE the editor. The stored
 * attrs are the same the public renderer reads (src/lib/blog/doc/schema.ts),
 * so what you fill in here is what readers get.
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { searchBlogItems, type BlogItemHit } from '@/lib/actions/admin-blog-items'
import type { StoredImage } from '@/lib/blog/doc/types'
import { uploadImage } from './upload'

/** The post's game, for the item card search. */
export const EditorGameContext = createContext<string | null>(null)

export const fieldCls =
  'h-9 w-full rounded-md border border-white/[0.08] bg-[#141518] px-2.5 text-base text-text-primary outline-none placeholder:text-text-tertiary focus:border-white/25 sm:text-[13px]'
const chip = (on: boolean) =>
  cn('h-7 rounded-md px-2.5 text-[12px] font-medium transition-colors', on ? 'bg-white/[0.14] text-text-primary' : 'bg-white/[0.05] text-text-secondary hover:text-text-primary')

function Block({ label, selected, children, onRemove }: { label: string; selected: boolean; children: ReactNode; onRemove: () => void }) {
  return (
    <NodeViewWrapper
      contentEditable={false}
      className={cn('my-4 rounded-[10px] border bg-[#1D1E23] p-3', selected ? 'border-white/30' : 'border-white/[0.07]')}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11.5px] font-semibold text-text-tertiary">{label}</span>
        <button type="button" onClick={onRemove} className="text-[12px] text-text-tertiary hover:text-error">Remove</button>
      </div>
      {children}
    </NodeViewWrapper>
  )
}

function useUploader(onDone: (img: StoredImage) => void) {
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const pick = () => input.current?.click()
  const el = (
    <input
      ref={input}
      type="file"
      accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
      hidden
      onChange={async (e) => {
        const f = e.target.files?.[0]
        e.target.value = ''
        if (!f) return
        setBusy(true)
        const r = await uploadImage(f)
        setBusy(false)
        if (r.ok) onDone(r.image)
        else toast.error(r.error)
      }}
    />
  )
  return { busy, pick, el }
}

export function FigureNV({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const a = node.attrs as Record<string, any>
  const up = useUploader((img) => updateAttributes({ ...img }))
  return (
    <Block label="Image" selected={selected} onRemove={deleteNode}>
      {a.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.src} alt={a.alt} className={cn('mx-auto block h-auto rounded-md', a.layout === 'wide' ? 'w-full' : 'w-full max-w-[560px]')} />
      ) : (
        <button type="button" onClick={up.pick} className="grid h-32 w-full place-items-center rounded-md border border-dashed border-white/15 text-[13px] text-text-secondary">
          {up.busy ? 'Uploading…' : 'Choose an image'}
        </button>
      )}
      {up.el}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <button type="button" className={chip(a.layout !== 'wide')} onClick={() => updateAttributes({ layout: 'column' })}>Column</button>
        <button type="button" className={chip(a.layout === 'wide')} onClick={() => updateAttributes({ layout: 'wide' })}>Wide</button>
        {a.src && <button type="button" className={chip(false)} onClick={up.pick}>{up.busy ? 'Uploading…' : 'Replace'}</button>}
        {a.width && <span className="ml-auto text-[11.5px] text-text-tertiary">{a.width}×{a.height}</span>}
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <input className={fieldCls} value={a.caption ?? ''} onChange={(e) => updateAttributes({ caption: e.target.value })} placeholder="Caption (optional)" />
        <input
          className={cn(fieldCls, !String(a.alt ?? '').trim() && a.src && 'border-[#E0B155]/60')}
          value={a.alt ?? ''}
          onChange={(e) => updateAttributes({ alt: e.target.value })}
          placeholder="Alt text: what the image shows (required)"
        />
      </div>
    </Block>
  )
}

export function ImagePairNV({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const side = (key: 'a' | 'b') => {
    const v = (node.attrs[key] as { image?: StoredImage; alt?: string; caption?: string } | null) ?? {}
    return { v, set: (patch: Record<string, unknown>) => updateAttributes({ [key]: { ...v, ...patch } }) }
  }
  return (
    <Block label="Two Images" selected={selected} onRemove={deleteNode}>
      <div className="grid gap-3 sm:grid-cols-2">
        {(['a', 'b'] as const).map((k) => <PairSide key={k} {...side(k)} />)}
      </div>
    </Block>
  )
}

function PairSide({ v, set }: { v: { image?: StoredImage; alt?: string; caption?: string }; set: (p: Record<string, unknown>) => void }) {
  const up = useUploader((img) => set({ image: img }))
  return (
    <div className="space-y-2">
      {v.image?.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={v.image.src} alt={v.alt ?? ''} className="h-auto w-full rounded-md" />
      ) : (
        <button type="button" onClick={up.pick} className="grid h-24 w-full place-items-center rounded-md border border-dashed border-white/15 text-[13px] text-text-secondary">
          {up.busy ? 'Uploading…' : 'Choose an image'}
        </button>
      )}
      {up.el}
      <input className={fieldCls} value={v.alt ?? ''} onChange={(e) => set({ alt: e.target.value })} placeholder="Alt text (required)" />
      <input className={fieldCls} value={v.caption ?? ''} onChange={(e) => set({ caption: e.target.value })} placeholder="Caption (optional)" />
    </div>
  )
}

const TONES = [
  ['tip', 'Tip'],
  ['warning', 'Warning'],
  ['note', 'Note'],
  ['takeaways', 'Key Takeaways'],
] as const

export function CalloutNV({ node, updateAttributes }: NodeViewProps) {
  return (
    <NodeViewWrapper className="my-4 rounded-[10px] border border-white/[0.1] bg-white/[0.03] px-4 py-3">
      <div contentEditable={false} className="mb-1.5 flex gap-1.5">
        {TONES.map(([v, l]) => (
          <button key={v} type="button" className={chip(node.attrs.tone === v)} onClick={() => updateAttributes({ tone: v })}>{l}</button>
        ))}
      </div>
      <NodeViewContent className="[&_p]:my-1" />
    </NodeViewWrapper>
  )
}

export function FaqNV({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const items = (node.attrs.items as Array<{ q: string; a: string }>) ?? []
  const set = (next: Array<{ q: string; a: string }>) => updateAttributes({ items: next })
  return (
    <Block label="FAQ" selected={selected} onRemove={deleteNode}>
      <div className="space-y-3">
        {items.map((it, i) => (
          <div key={i} className="space-y-1.5">
            <input className={fieldCls} value={it.q} placeholder="Question" onChange={(e) => set(items.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
            <textarea className={cn(fieldCls, 'h-20 py-2')} value={it.a} placeholder="Answer" onChange={(e) => set(items.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
            {items.length > 1 && <button type="button" className="text-[12px] text-text-tertiary hover:text-error" onClick={() => set(items.filter((_, j) => j !== i))}>Remove question</button>}
          </div>
        ))}
      </div>
      <button type="button" className={cn(chip(false), 'mt-2')} onClick={() => set([...items, { q: '', a: '' }])}>+ Add Question</button>
    </Block>
  )
}

type CodeRow = { code: string; reward: string; isNew?: boolean; expired?: boolean }
export function CodesNV({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const rows = (node.attrs.rows as CodeRow[]) ?? []
  const set = (next: CodeRow[]) => updateAttributes({ rows: next })
  const patch = (i: number, p: Partial<CodeRow>) => set(rows.map((r, j) => (j === i ? { ...r, ...p } : r)))
  return (
    <Block label="Codes" selected={selected} onRemove={deleteNode}>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] items-center gap-2">
            <input className={cn(fieldCls, 'font-mono')} value={r.code} placeholder="CODE" onChange={(e) => patch(i, { code: e.target.value })} />
            <input className={fieldCls} value={r.reward} placeholder="Reward" onChange={(e) => patch(i, { reward: e.target.value })} />
            <div className="flex gap-1">
              <button type="button" className={chip(!!r.isNew)} onClick={() => patch(i, { isNew: !r.isNew })}>New</button>
              <button type="button" className={chip(!!r.expired)} onClick={() => patch(i, { expired: !r.expired })}>Expired</button>
              <button type="button" aria-label="Remove code" className="px-1.5 text-text-tertiary hover:text-error" onClick={() => set(rows.filter((_, j) => j !== i))}>×</button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button type="button" className={chip(false)} onClick={() => set([...rows, { code: '', reward: '', isNew: true }])}>+ Add Code</button>
        <label className="ml-auto flex items-center gap-2 text-[12px] text-text-tertiary">
          Last checked
          <input type="date" className={cn(fieldCls, 'h-8 w-auto')} value={String(node.attrs.checkedAt ?? '')} onChange={(e) => updateAttributes({ checkedAt: e.target.value })} />
        </label>
      </div>
    </Block>
  )
}

export function ItemCardNV({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const game = useContext(EditorGameContext)
  const a = node.attrs as { gameSlug: string; itemSlug: string; name: string; imageUrl: string }
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<BlogItemHit[]>([])
  useEffect(() => {
    if (!game || a.itemSlug) return
    const t = setTimeout(() => void searchBlogItems(game, q).then(setHits).catch(() => setHits([])), 250)
    return () => clearTimeout(t)
  }, [q, game, a.itemSlug])
  return (
    <Block label="Item Card" selected={selected} onRemove={deleteNode}>
      {a.itemSlug ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {a.imageUrl && <img src={a.imageUrl} alt="" className="h-12 w-12 object-contain" />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-text-primary">{a.name}</p>
            <p className="text-[12px] text-text-tertiary">Live value and offers show on the page</p>
          </div>
          <button type="button" className={chip(false)} onClick={() => updateAttributes({ itemSlug: '', name: '', imageUrl: '' })}>Change</button>
        </div>
      ) : !game ? (
        <p className="text-[13px] text-text-secondary">Pick the post&rsquo;s game first (right panel).</p>
      ) : (
        <>
          <input className={fieldCls} autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search an item, e.g. Bat Dragon" />
          <div className="mt-2 max-h-56 overflow-y-auto">
            {hits.map((h) => (
              <button
                key={h.slug}
                type="button"
                onClick={() => updateAttributes({ gameSlug: game, itemSlug: h.slug, name: h.name, imageUrl: h.imageUrl ?? '' })}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] text-text-secondary hover:bg-white/[0.05] hover:text-text-primary"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {h.imageUrl && <img src={h.imageUrl} alt="" className="h-7 w-7 object-contain" />}
                {h.name}
              </button>
            ))}
          </div>
        </>
      )}
    </Block>
  )
}

export function CtaNV({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  return (
    <Block label="Button" selected={selected} onRemove={deleteNode}>
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={fieldCls} value={node.attrs.label} onChange={(e) => updateAttributes({ label: e.target.value })} placeholder="Button text, e.g. Shop MM2 Knives" />
        <input className={fieldCls} value={node.attrs.href} onChange={(e) => updateAttributes({ href: e.target.value })} placeholder="/murder-mystery-2/buy-items" />
      </div>
    </Block>
  )
}

const ytId = (s: string) => s.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{6,20})/)?.[1] ?? (/^[\w-]{6,20}$/.test(s) ? s : '')
export function YouTubeNV({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const id = String(node.attrs.id ?? '')
  return (
    <Block label="YouTube" selected={selected} onRemove={deleteNode}>
      <input className={fieldCls} defaultValue={id ? `https://youtu.be/${id}` : ''} onChange={(e) => updateAttributes({ id: ytId(e.target.value.trim()) })} placeholder="Paste a YouTube link" />
      {id && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" className="mt-2 aspect-video w-full rounded-md object-cover" />
      )}
      <input className={cn(fieldCls, 'mt-2')} value={node.attrs.title ?? ''} onChange={(e) => updateAttributes({ title: e.target.value })} placeholder="Video title (for screen readers)" />
    </Block>
  )
}
