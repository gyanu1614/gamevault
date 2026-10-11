'use client'

import Link from '@/components/navigation/AppLink'
import { ArrowRight } from 'lucide-react'
import { Combobox } from '@/components/ui/combobox'

import { SubCard } from '../../ui/SubCard'
import { TipBox } from '../../ui/form-fields'
import type { Step4Props } from './types'

/** Fixed-bundle currency: which bundle this offer sells, with an early "you already list this" notice. */
export function BundleSection({ p }: { p: Pick<Step4Props, 'bundles' | 'bundleId' | 'onBundleId' | 'existingBundleListingId'> }) {
  return (
<SubCard title="Bundle">
  {/* V19/P24/P6 — Eager dup banner. When the seller already
      has a listing for the picked bundle+region, surface it
      now so they can edit instead of filling the whole form
      and failing at publish. */}
  {p.existingBundleListingId && (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-[color-mix(in_srgb,var(--color-warning)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-warning-bg)_30%,transparent)] px-4 py-3">
      <p className="text-[12.5px] text-text-secondary">
        <span className="font-semibold text-text-primary">
          You already list this bundle.
        </span>{' '}
        Update the existing listing instead of creating a duplicate.
      </p>
      <Link
        href={`/sell/edit/${p.existingBundleListingId}`}
        className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg border border-lime-tint-border bg-lime-tint-bg px-3 py-1.5 text-[12.5px] font-semibold text-lime-text transition-colors hover:bg-[rgba(86,184,127,0.10)] sm:min-h-0"
      >
        Update Listing
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )}
  {/* Dropdown with the admin's bundle art beside each name — the
      same control as the game picker. The tile grid showed every
      bundle at once, which on a game with a dozen bundles pushed
      the rest of the form a screen down. `unsorted` keeps the
      admin's sort_order: an A→Z sort would put "1000 V-Bucks"
      before "200 V-Bucks". */}
  <Combobox
    value={p.bundleId ?? ''}
    onChange={(id) => p.onBundleId(id)}
    options={[...(p.bundles ?? [])]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((b) => ({
        value: b.id,
        label: b.name || '(unnamed bundle)',
        icon_url: b.icon_url ?? null,
      }))}
    unsorted
    placeholder="Choose Bundle"
    emptyText="No bundles match that search."
    ariaLabel="Choose a bundle"
    tone="neutral"
    iconInTrigger
    size="lg"
    sheetOnTouch
  />
  <TipBox>Buyers see your listing under this exact bundle.</TipBox>
</SubCard>
  )
}
