'use client'

/**
 * Phase B placeholder — game wizard (add). Linked from /admin/games-v2.
 * Real wizard lands in the next commit. Until then, this page tells the
 * user where to add games today (the classic admin) so they're never stuck.
 */

import Link from 'next/link'
import { ArrowLeft, Sparkles, Plus } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'

export default function NewGameWizardPlaceholder() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/admin/games-v2"
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to games
      </Link>

      <GlassCard intensity="light" rounded="2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/15">
            <Sparkles className="h-4 w-4 text-violet-300" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-white">New game — wizard coming next</h1>
            <p className="mt-1 text-sm text-gray-400">
              The redesigned add-game wizard (identity → branding → categories → SEO) is the next
              piece to land. For now, create the game in the classic admin and it will appear here
              automatically.
            </p>
            <div className="mt-4 flex gap-2">
              <Link
                href="/admin/games"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-semibold text-black transition-colors hover:bg-white/90"
              >
                <Plus className="h-4 w-4" />
                Add game in classic admin
              </Link>
              <Link
                href="/admin/games-v2"
                className="inline-flex h-9 items-center rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-gray-200 transition-colors hover:bg-white/[0.08]"
              >
                Cancel
              </Link>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
