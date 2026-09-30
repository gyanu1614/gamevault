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
import { Eye, EyeSlash, PencilSimple, Plus, PushPin, Trash, X } from '@phosphor-icons/react'
import { StatStrip, accountInputCls } from '@/components/account/AccountSurface'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { PageHeader, AdminPanel, PanelHead, SectionLabel, adminBtn } from '../components/kit'
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
  const [confirmDelete, setConfirmDelete] = useState<FoundingNotice | null>(null)

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

  // Confirmed in the Delete Notice dialog below.
  function remove(n: FoundingNotice) {
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
    <div className="space-y-5">
      <PageHeader
        title="Founding Notices"
        description="Post updates for founding sellers. Published notices appear on the Founding Seller HQ."
        className="mb-0 sm:mb-0"
        actions={
          <a href="/founding" target="_blank" rel="noopener noreferrer" className={adminBtn.secondary}>
            <Eye aria-hidden weight="bold" className="h-4 w-4" /> Preview HQ
          </a>
        }
      />

      <StatStrip
        stats={[
          { label: 'Total Notices', value: notices.length },
          { label: 'Published', value: publishedCount },
          { label: 'Pinned', value: pinnedCount },
        ]}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_0.9fr]">
        {/* ── Composer ── */}
        <AdminPanel>
          <PanelHead
            title={editing ? 'Edit Notice' : 'New Notice'}
            aside={
              editing ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-1 text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary"
                >
                  <X aria-hidden weight="bold" className="h-3.5 w-3.5" /> Cancel Edit
                </button>
              ) : undefined
            }
          />

          <div className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <label htmlFor="notice-title" className="text-[13px] font-medium text-text-secondary">
                  Title
                </label>
                <span className="text-[12px] tabular-nums text-text-tertiary">
                  {draft.title.length}/{TITLE_MAX}
                </span>
              </div>
              <input
                id="notice-title"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value.slice(0, TITLE_MAX) })}
                placeholder="You get paid even if the buyer bails"
                className={accountInputCls}
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <label htmlFor="notice-body" className="text-[13px] font-medium text-text-secondary">
                  Body <span className="text-text-tertiary">(Optional)</span>
                </label>
                <span className="text-[12px] tabular-nums text-text-tertiary">
                  {draft.body.length}/{BODY_MAX}
                </span>
              </div>
              <textarea
                id="notice-body"
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value.slice(0, BODY_MAX) })}
                placeholder="SafeDrop holds their money until you've delivered. No going first, no getting burned."
                rows={4}
                className={cn(accountInputCls, 'resize-y leading-relaxed')}
              />
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <label className="inline-flex cursor-pointer items-center gap-2.5 text-[13.5px] text-text-secondary">
                <Switch checked={draft.pinned} onCheckedChange={(c) => setDraft({ ...draft, pinned: c })} aria-label="Pin to top" />
                Pin to Top
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2.5 text-[13.5px] text-text-secondary">
                <Switch checked={draft.published} onCheckedChange={(c) => setDraft({ ...draft, published: c })} aria-label="Publish now" />
                Publish Now
              </label>
            </div>

            <button type="button" onClick={submit} disabled={pending} className={adminBtn.primary}>
              {editing ? (
                <PencilSimple aria-hidden weight="bold" className="h-4 w-4" />
              ) : (
                <Plus aria-hidden weight="bold" className="h-4 w-4" />
              )}
              {pending ? 'Saving…' : editing ? 'Save Changes' : 'Post Notice'}
            </button>
          </div>
        </AdminPanel>

        {/* ── Live preview + list ── */}
        <div className="min-w-0">
          <SectionLabel>How It Looks on HQ</SectionLabel>
          <NoticePreview title={draft.title} body={draft.body} pinned={draft.pinned} />

          <SectionLabel className="mt-6">All Notices</SectionLabel>
          <div className="overflow-hidden rounded-lg bg-bg-raised">
            {notices.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13.5px] text-text-tertiary">No notices yet. Post your first one.</p>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                <AnimatePresence initial={false}>
                  {notices.map((n) => (
                    <motion.li
                      key={n.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="flex items-start gap-3 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {n.pinned && <PushPin aria-label="Pinned" weight="fill" className="h-3.5 w-3.5 shrink-0 text-text-primary" />}
                          <span className="truncate text-[13.5px] font-semibold text-text-primary">{n.title}</span>
                          {!n.published && (
                            <span className="shrink-0 rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] font-semibold text-text-tertiary">
                              Draft
                            </span>
                          )}
                        </div>
                        {n.body && <p className="mt-0.5 line-clamp-2 text-[12.5px] text-text-tertiary">{n.body}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <IconBtn label={n.pinned ? 'Unpin' : 'Pin'} onClick={() => togglePin(n)} active={n.pinned}>
                          <PushPin aria-hidden weight={n.pinned ? 'fill' : 'bold'} className="h-4 w-4" />
                        </IconBtn>
                        <IconBtn label={n.published ? 'Unpublish' : 'Publish'} onClick={() => togglePublish(n)}>
                          {n.published ? (
                            <Eye aria-hidden weight="bold" className="h-4 w-4" />
                          ) : (
                            <EyeSlash aria-hidden weight="bold" className="h-4 w-4" />
                          )}
                        </IconBtn>
                        <IconBtn label="Edit" onClick={() => startEdit(n)}>
                          <PencilSimple aria-hidden weight="bold" className="h-4 w-4" />
                        </IconBtn>
                        <IconBtn label="Delete" onClick={() => setConfirmDelete(n)} danger>
                          <Trash aria-hidden weight="bold" className="h-4 w-4" />
                        </IconBtn>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </div>
      </div>

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-[420px] border-0 p-5 sm:p-6">
          <div className="pr-8">
            <DialogTitle className="text-[18px] font-bold">Delete Notice?</DialogTitle>
            <DialogDescription className="mt-1.5">
              “{confirmDelete?.title}” is removed from the Founding HQ. This can’t be undone.
            </DialogDescription>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" onClick={() => setConfirmDelete(null)} className={cn(adminBtn.secondary, 'sm:flex-1')}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const n = confirmDelete
                setConfirmDelete(null)
                if (n) remove(n)
              }}
              className={cn(adminBtn.danger, 'sm:flex-1')}
            >
              <Trash aria-hidden weight="bold" className="h-4 w-4" />
              Delete
            </button>
          </div>
        </DialogContent>
      </Dialog>
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
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'grid h-8 w-8 place-items-center rounded-md transition-colors',
        active
          ? 'text-text-primary hover:bg-white/[0.06]'
          : danger
            ? 'text-text-tertiary hover:bg-error-bg hover:text-error'
            : 'text-text-tertiary hover:bg-white/[0.06] hover:text-text-primary',
      )}
    >
      {children}
    </button>
  )
}

/** Mirror of the HQ stream item so the admin sees the real thing while writing. */
function NoticePreview({ title, body, pinned }: { title: string; body: string; pinned: boolean }) {
  const hasContent = title.trim().length > 0
  return (
    // The HQ stream is a light surface; the preview mirrors it exactly.
    <div className="rounded-lg p-4" style={{ background: '#FAFAF7' }}>
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
            {pinned && <PushPin aria-hidden weight="fill" className="h-3 w-3" />}
            <span>just now</span>
            {pinned && <span>· Pinned</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
