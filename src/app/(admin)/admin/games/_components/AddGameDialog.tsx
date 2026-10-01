'use client'

/**
 * V17y — Minimal "Add game" dialog.
 *
 * Replaces the old `/admin/games/new` wizard route. Captures just the
 * identity bits needed to create a game row (name, slug, emoji) and
 * persists via the existing `saveGameIdentity` server action. After
 * save, the dialog closes and the admin lands back on the games list
 * where the new row appears. Per-category settings (Currency / Items
 * / Accounts / Boosting) are edited on the game's detail page —
 * matches the "create then drill in" flow.
 *
 * Why this is a Dialog instead of a route:
 *   • The form is tiny (3 fields); a full-page wizard for that was
 *     overkill and broke the list flow.
 *   • Closing returns to the list with no navigation history clutter.
 *   • Mobile-friendly: Radix Dialog handles focus + scroll lock.
 */

import { slugify } from '@/lib/utils'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CircleNotch, Plus } from '@phosphor-icons/react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { accountInputCls } from '@/components/account/AccountSurface'
import { cn } from '@/lib/utils'
import { adminBtn } from '../../components/kit'
import { saveGameIdentity } from '@/lib/actions/admin-game-wizard'

const LABEL = 'mb-1.5 block text-[13px] font-medium text-text-secondary'

export function AddGameDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugDirty, setSlugDirty] = useState(false)
  const [emoji, setEmoji] = useState('')
  const router = useRouter()
  const qc = useQueryClient()

  const onNameChange = (v: string) => {
    setName(v)
    if (!slugDirty) setSlug(slugify(v))
  }

  const reset = () => {
    setName('')
    setSlug('')
    setSlugDirty(false)
    setEmoji('')
  }

  const createMutation = useMutation({
    mutationFn: () =>
      saveGameIdentity({
        name: name.trim(),
        slug: slug.trim(),
        emoji: emoji.trim() || null,
        sort_order: 100, // arrives at end of list; admin can re-order later
        is_active: true,
      }),
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success('Game created')
      qc.invalidateQueries({ queryKey: ['admin-games'] })
      setOpen(false)
      reset()
      // Drop into the detail page so the admin can configure
      // Currency / Items / Accounts / Boosting right away.
      router.push(`/admin/games/${res.data.id}/edit`)
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to create game'),
  })

  const canSubmit = name.trim().length >= 2 && /^[a-z0-9-]+$/.test(slug)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <button type="button" onClick={() => setOpen(true)} className={adminBtn.primary}>
        <Plus aria-hidden weight="bold" className="h-4 w-4" />
        Add Game
      </button>
      <DialogContent className="max-w-[460px] border-0 p-5 sm:p-6">
        <div className="pr-8">
          <DialogTitle className="text-[18px] font-bold leading-tight">Add Game</DialogTitle>
          <DialogDescription className="mt-1.5 leading-relaxed">
            Start with the basics. You&apos;ll set categories, branding, and pricing on the next screen.
          </DialogDescription>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!canSubmit || createMutation.isPending) return
            createMutation.mutate()
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="add-game-name" className={LABEL}>Name</label>
            <input
              id="add-game-name"
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g. Honkai Star Rail"
              autoFocus
              autoComplete="off"
              className={accountInputCls}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_84px]">
            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="add-game-slug" className={LABEL}>Slug</label>
                <span className="text-[12px] text-text-tertiary">Used in URLs</span>
              </div>
              <input
                id="add-game-slug"
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlugDirty(true)
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                }}
                placeholder="honkai-star-rail"
                autoComplete="off"
                className={cn(accountInputCls, 'font-mono')}
              />
            </div>
            <div>
              <label htmlFor="add-game-emoji" className={LABEL}>Emoji</label>
              <input
                id="add-game-emoji"
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
                placeholder="🎮"
                maxLength={2}
                autoComplete="off"
                className={cn(accountInputCls, 'text-center text-lg sm:text-lg')}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setOpen(false)} className={adminBtn.secondary}>
              Cancel
            </button>
            <button type="submit" disabled={!canSubmit || createMutation.isPending} className={adminBtn.primary}>
              {createMutation.isPending && <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />}
              Create &amp; Configure
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
