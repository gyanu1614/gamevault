/** GameWizard step 4: read-only summary before Save Game. */

import { Info } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { PanelHead } from '../../components/kit'
import type { CategoryDraft } from './game-wizard-model'

export function ReviewStep({
  name,
  slug,
  displayName,
  emoji,
  sortOrder,
  contentTier,
  ecosystem,
  isActive,
  logoUrl,
  coverUrl,
  enabledCount,
  categories,
}: {
  name: string
  slug: string
  displayName: string
  emoji: string
  sortOrder: number
  contentTier: string
  ecosystem: string
  isActive: boolean
  logoUrl: string | null
  coverUrl: string | null
  enabledCount: number
  categories: CategoryDraft[]
}) {
  return (
    <div className="space-y-4">
      <PanelHead title="Review" className="mb-0" />
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <ReviewRow label="Name" value={name} />
        <ReviewRow label="Slug" value={slug} mono />
        <ReviewRow label="Display Name" value={displayName || '—'} />
        <ReviewRow label="Emoji" value={emoji || '—'} />
        <ReviewRow label="Sort Order" value={String(sortOrder)} />
        <ReviewRow label="Content Tier" value={contentTier} />
        <ReviewRow label="Platform" value={ecosystem || '— not set —'} />
        <ReviewRow label="Status" value={isActive ? 'Active' : 'Paused'} />
        <ReviewRow label="Logo" value={logoUrl ? 'Uploaded' : 'Emoji fallback'} />
        <ReviewRow label="Cover Art" value={coverUrl ? 'Uploaded' : 'None yet'} />
        <ReviewRow label="Categories Enabled" value={`${enabledCount} of ${categories.length}`} />
      </dl>

      <div className="flex gap-2.5 rounded-md bg-info-bg px-3.5 py-2.5 text-[13px] leading-relaxed text-text-secondary">
        <Info aria-hidden weight="bold" className="mt-0.5 h-4 w-4 shrink-0 text-info" />
        <p>
          Identity and logo are saved as you go. Hitting <span className="font-semibold text-text-primary">Save Game</span> persists the
          per-category toggles and returns to the games list.
        </p>
      </div>
    </div>
  )
}

function ReviewRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-bg-overlay px-3.5 py-2.5">
      <dt className="shrink-0 text-[12.5px] text-text-tertiary">{label}</dt>
      <dd
        className={cn(
          'min-w-0 truncate text-right text-[13.5px] font-medium text-text-primary',
          mono && 'font-mono text-[12.5px]'
        )}
        title={value}
      >
        {value}
      </dd>
    </div>
  )
}
