'use client'

/**
 * Phase B placeholder — game wizard (edit). Linked from /admin/games-v2.
 * Real wizard lands in the next commit.
 */

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Sparkles, Pencil } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'

export default function EditGameWizardPlaceholder() {
  const params = useParams<{ id: string }>()
  const gameId = params?.id ?? ''

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
            <h1 className="text-lg font-semibold text-white">Edit game — wizard coming next</h1>
            <p className="mt-1 text-sm text-gray-400">
              Editing for game{' '}
              <span className="font-mono text-xs text-gray-300">{gameId}</span>{' '}
              lands in the next commit (identity, branding, per-category toggles, SEO).
              For now, edit it in the classic admin and changes will appear here.
            </p>
            <div className="mt-4 flex gap-2">
              <Link
                href="/admin/games"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-semibold text-black transition-colors hover:bg-white/90"
              >
                <Pencil className="h-4 w-4" />
                Edit in classic admin
              </Link>
              <Link
                href="/admin/games-v2"
                className="inline-flex h-9 items-center rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-gray-200 transition-colors hover:bg-white/[0.08]"
              >
                Back
              </Link>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
