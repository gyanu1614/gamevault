'use client'

import { SubCard } from '../../ui/SubCard'
import { AutoGrowTextarea, FieldRow, TipBox } from '../../ui/form-fields'
import type { Step4Props } from './types'

/** The offer description (one label for every category; currency allows 1,000 characters). */
export function DescriptionSection({ p, isCurrency }: { p: Pick<Step4Props, 'description' | 'setDescription'>; isCurrency: boolean }) {
  return (
<SubCard
  title="Description"
  right={
    <span className="text-xs tabular-nums text-text-tertiary">
      {p.description.length}/{isCurrency ? 1000 : 2000}
    </span>
  }
>
  <FieldRow>
    <AutoGrowTextarea
      value={p.description}
      onChange={p.setDescription}
      placeholder="Describe Your Offer"
      maxLength={isCurrency ? 1000 : 2000}
      ariaLabel="Description"
    />
    <TipBox>
      {isCurrency
        ? 'Shown to buyers on your offer. Line breaks are allowed.'
        : 'Include condition, delivery method and any terms.'}
    </TipBox>
  </FieldRow>
</SubCard>
  )
}
