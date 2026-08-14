'use client'

/**
 * Founding-seller notices composer. Left: the write form (title + body + pin +
 * publish) with a live preview of how the notice renders on the Founding HQ
 * stream. Right/below: every existing notice with quick pin/publish toggles,
 * edit, and delete. Uses the admin design kit so it matches the rest of /admin.
 */

import { useMemo, useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Megaphone, Pin, Trash2, Pencil, Eye, EyeOff, Plus, X } from 'lucide-react'
import { PageHeader, AdminPanel, StatCard, SectionLabel } from '../components/kit'
import {
  createFoundingNotice,
  updateFoundingNotice,
  deleteFoundingNotice,
  type FoundingNotice,
} from '@/lib/actions/founding-notices'

const TITLE_MAX = 120
const BODY_MAX = 600

interface Props {
  initialNotices: FoundingNotice[]
}

type Draft = {
  id: string | null
  title: string
  body: string
  pinned: boolean
  published: boolean
}

const EMPTY: Draft = { id: null, title: '', body: '', pinned: false, published: true }

export default function FoundingNoticesClient({ initialNotices }: Props) {
  const [notices, setNotices] = useState<FoundingNotice[]>(initialNotices)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [pending, startTransition] = useTransition()

  const editing = draft.id !== null
  const publishedCount = useMemo(() => notices.filter((n) => n.published).length, [notices])
  const pinnedCount = useMemo(() => notices.filter((n) => n.pinned).length, [notices])

  function resetForm() {
    setDraft(EMPTY)
  }

  function refresh(next: FoundingNotice[]) {
    // Keep the same order the HQ feed uses: pinned → newest.
    const sorted = [...next].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    setNotices(sorted)
  }

  function submit() {
    if (!draft.title.trim()) {
      toast.error('Give the notice a title.')
      return
    }
    startTransition(() => {
      void (async () => {
      const payload = {
        title: draft.title,
        body: draft.body,
        pinned: draft.pinned,
        published: draft.published,
      }
      const res = draft.id
        ? await updateFoundingNotice(draft.id, payload)
        : await createFoundingNotice(payload)

      if (!res.ok) {
        toast.error(res.error ?? 'Something went wrong.')
        return
      }
      toast.success(draft.id ? 'Notice updated.' : 'Notice posted.')

      // Optimistic local update (server also revalidates /founding).
      if (draft.id) {
        refresh(
          notices.map((n) =>
            n.id === draft.id
              ? { ...n, title: draft.title.trim(), body: draft.body.trim() || null, pinned: draft.pinned, published: draft.published }
              : n,
          ),
        )
      } else {
        const optimistic: FoundingNotice = {
          id: `tmp-${Date.now()}`,
          title: draft.title.trim(),
          body: draft.body.trim() || null,
          pinned: draft.pinned,
          priority: 0,
          published: draft.published,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        refresh([optimistic, ...notices])
      }
      resetForm()
      })()
    })
  }

  function startEdit(n: FoundingNotice) {
    setDraft({ id: n.id, title: n.title, body: n.body ?? '', pinned: n.pinned, published: n.published })
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function togglePin(n: FoundingNotice) {
    startTransition(() => {
      void (async () => {
        const res = await updateFoundingNotice(n.id, {
          title: n.title,
          body: n.body ?? '',
          pinned: !n.pinned,
          published: n.published,
        })
        if (!res.ok) {
          toast.error(res.error ?? 'Could not update.')
          return
        }
        refresh(notices.map((x) => (x.id === n.id ? { ...x, pinned: !x.pinned } : x)))
      })()
    })
  }

  function togglePublish(n: FoundingNotice) {
    startTransition(() => {
      void (async () => {
        const res = await updateFoundingNotice(n.id, {
          title: n.title,
          body: n.body ?? '',
          pinned: n.pinned,
          published: !n.published,
        })
        if (!res.ok) {
          toast.error(res.error ?? 'Could not update.')
          return
        }
        refresh(notices.map((x) => (x.id === n.id ? { ...x, published: !x.published } : x)))
        toast.success(n.published ? 'Moved to draft.' : 'Published.')
      })()
    })
  }

  function remove(n: FoundingNotice) {
    if (!confirm(`Delete "${n.title}"? This can't be undone.`)) return
    startTransition(() => {
      void (async () => {
        const res = await deleteFoundingNotice(n.id)
        if (!res.ok) {
          toast.error(res.error ?? 'Could not delete.')
          return
        }
        refresh(notices.filter((x) => x.id !== n.id))
        if (draft.id === n.id) resetForm()
        toast.success('Notice deleted.')
      })()
    })
  }

  return (
    <div>
      <PageHeader
        title="Founding Notices"
        description="Post updates for founding sellers. Published notices appear on the Founding Seller HQ."
        actions={
          <a
            href="/founding"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-2 text-[13px] font-semibold text-text-secondary hover:bg-bg-overlay"
          >
            <Eye className="h-4 w-4" /> Preview HQ
          </a>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Total notices" value={notices.length} icon={Megaphone} tone="lime" />
        <StatCard label="Published" value={publishedCount} icon={Eye} tone="success" />
        <StatCard label="Pinned" value={pinnedCount} icon={Pin} tone="info" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_0.9fr]">
        {/* ── Composer ─────────────────────────────────────────── */}
        <AdminPanel>
          <div className="mb-4 flex items-center justify-between">
            <SectionLabel>{editing ? 'Edit notice' : 'New notice'}</SectionLabel>
            {editing && (
              <button
                onClick={resetForm}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-text-tertiary hover:text-text-secondary"
              >
                <X className="h-3.5 w-3.5" /> Cancel edit
              </button>
            )}
          </div>

          <label className="mb-1.5 block text-[12.5px] font-medium text-text-secondary">Title</label>
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value.slice(0, TITLE_MAX) })}
            placeholder="You get paid even if the buyer bails"
            className="mb-1 w-full rounded-lg border border-border-default bg-bg-overlay px-3.5 py-2.5 text-[14px] text-text-primary outline-none focus:border-lime"
          />
          <div className="mb-4 text-right text-[11px] text-text-tertiary">{draft.title.length}/{TITLE_MAX}</div>

          <label className="mb-1.5 block text-[12.5px] font-medium text-text-secondary">Body <span className="text-text-tertiary">(optional)</span></label>
          <textarea
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value.slice(0, BODY_MAX) })}
            placeholder="SafeDrop holds their money until you've delivered. No going first, no getting burned."
            rows={4}
            className="mb-1 w-full resize-y rounded-lg border border-border-default bg-bg-overlay px-3.5 py-2.5 text-[14px] leading-relaxed text-text-primary outline-none focus:border-lime"
          />
          <div className="mb-4 text-right text-[11px] text-text-tertiary">{draft.body.length}/{BODY_MAX}</div>

          <div className="mb-5 flex flex-wrap gap-4">
            <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-text-secondary">
              <input type="checkbox" checked={draft.pinned} onChange={(e) => setDraft({ ...draft, pinned: e.target.checked })} className="h-4 w-4 accent-lime" />
              <Pin className="h-3.5 w-3.5" /> Pin to top
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-text-secondary">
              <input type="checkbox" checked={draft.published} onChange={(e) => setDraft({ ...draft, published: e.target.checked })} className="h-4 w-4 accent-lime" />
              {draft.published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />} Publish now
            </label>
          </div>

          <button
            onClick={submit}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg bg-lime px-4 py-2.5 text-[13.5px] font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {editing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {pending ? 'Saving…' : editing ? 'Save changes' : 'Post notice'}
          </button>
        </AdminPanel>

        {/* ── Live preview + list ──────────────────────────────── */}
        <div>
          <SectionLabel className="mb-3">How it looks on HQ</SectionLabel>
          <NoticePreview title={draft.title} body={draft.body} pinned={draft.pinned} />

          <SectionLabel className="mb-3 mt-6">All notices</SectionLabel>
          <div className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {notices.length === 0 && (
                <p className="rounded-lg border border-dashed border-border-default px-4 py-6 text-center text-[13px] text-text-tertiary">
                  No notices yet. Post your first above.
                </p>
              )}
              {notices.map((n) => (
                <motion.div
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="flex items-start gap-3 rounded-lg border border-border-default bg-bg-raised p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {n.pinned && <Pin className="h-3 w-3 shrink-0 text-lime-text" />}
                      <span className="truncate text-[13.5px] font-semibold text-text-primary">{n.title}</span>
                      {!n.published && <span className="shrink-0 rounded bg-bg-overlay px-1.5 py-0.5 text-[10px] font-semibold uppercase text-text-tertiary">Draft</span>}
                    </div>
                    {n.body && <p className="mt-0.5 line-clamp-2 text-[12px] text-text-secondary">{n.body}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <IconBtn label={n.pinned ? 'Unpin' : 'Pin'} onClick={() => togglePin(n)} active={n.pinned}><Pin className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn label={n.published ? 'Unpublish' : 'Publish'} onClick={() => togglePublish(n)}>{n.published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}</IconBtn>
                    <IconBtn label="Edit" onClick={() => startEdit(n)}><Pencil className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn label="Delete" onClick={() => remove(n)} danger><Trash2 className="h-3.5 w-3.5" /></IconBtn>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}

function IconBtn({
  children,
  label,
  onClick,
  active,
  danger,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  active?: boolean
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle transition-colors hover:bg-bg-overlay ${
        active ? 'text-lime-text' : danger ? 'text-text-tertiary hover:text-error' : 'text-text-secondary'
      }`}
    >
      {children}
    </button>
  )
}

/** Mirror of the HQ stream item so the admin sees the real thing while writing. */
function NoticePreview({ title, body, pinned }: { title: string; body: string; pinned: boolean }) {
  const hasContent = title.trim().length > 0
  return (
    <div className="rounded-xl border border-border-default p-4" style={{ background: '#FAFAF7' }}>
      <div className="mb-3 text-[13px] font-semibold" style={{ color: '#1A1D19' }}>What&rsquo;s happening</div>
      <div className="flex gap-3.5">
        <span className="mt-[6px] block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: pinned ? '#A3E635' : '#D2D6C8', boxShadow: pinned ? '0 0 0 4px rgba(163,230,53,0.18)' : 'none' }} />
        <div>
          <div className="text-[13.5px] font-semibold leading-snug" style={{ color: pinned ? '#14432A' : '#1A1D19' }}>
            {hasContent ? title : 'Your notice title'}
          </div>
          {(body || !hasContent) && (
            <p className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed" style={{ color: '#5B6157' }}>
              {body || 'Supporting line shows here.'}
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px]" style={{ color: '#9a9f92' }}>
            {pinned && <Pin className="h-3 w-3" />}
            <span>just now</span>
            {pinned && <span>· Pinned</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
