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

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Plus } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveGameIdentity } from '@/lib/actions/admin-game-wizard'

function slugify(raw: string) {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-lime px-4 text-sm font-semibold text-text-inverse shadow-sm transition-colors hover:bg-lime-hover"
      >
        <Plus className="h-4 w-4" />
        Add game
      </button>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Add game</DialogTitle>
          <DialogDescription>
            Start with the basics. You'll set categories, branding, and pricing on the next screen.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!canSubmit || createMutation.isPending) return
            createMutation.mutate()
          }}
          className="space-y-4 py-2"
        >
          <div className="space-y-1.5">
            <Label htmlFor="add-game-name">Name</Label>
            <Input
              id="add-game-name"
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g. Honkai Star Rail"
              autoFocus
              autoComplete="off"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_84px]">
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="add-game-slug">Slug</Label>
                <span className="text-[11px] text-text-tertiary">
                  used in URLs
                </span>
              </div>
              <Input
                id="add-game-slug"
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlugDirty(true)
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                }}
                placeholder="honkai-star-rail"
                autoComplete="off"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-game-emoji">Emoji</Label>
              <Input
                id="add-game-emoji"
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
                placeholder="🎮"
                maxLength={2}
                autoComplete="off"
                className="text-center text-lg"
              />
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-border-default bg-bg-raised px-4 py-2 text-[13px] font-semibold text-text-primary transition-colors hover:bg-bg-raised-hover"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || createMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-lime px-4 py-2 text-[13px] font-semibold text-text-inverse transition-colors hover:bg-lime-hover disabled:opacity-60"
            >
              {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create & configure
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
