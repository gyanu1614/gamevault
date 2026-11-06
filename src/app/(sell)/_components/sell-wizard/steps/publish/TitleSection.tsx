'use client'

import { useState } from 'react'

import { inputCls } from '../../styles'
import { SubCard } from '../../ui/SubCard'
import { FieldError, FieldRow, TipBox } from '../../ui/form-fields'
import type { Step4Props } from './types'
import { titleExample } from './title-example'

/** Offer title (not asked for currency: the server names it). */
export function TitleSection({ p }: { p: Pick<Step4Props, 'title' | 'setTitle' | 'gameSlug' | 'gameName' | 'onBackToSearch'> }) {
  // The error shows once the field has been left empty, not on first render.
  const [touched, setTouched] = useState(false)
  const titleInvalid = touched && !p.title.trim()
  return (
<SubCard
  title="Title"
  right={
    p.onBackToSearch ? (
      <button type="button" onClick={p.onBackToSearch} className="shrink-0 text-[14px] font-medium text-text-secondary underline underline-offset-[3px] transition-colors hover:text-text-primary">
        Back To Search
      </button>
    ) : null
  }
>
  <FieldRow>
    <input
      value={p.title}
      onChange={(e) => p.setTitle(e.target.value)}
      onBlur={() => setTouched(true)}
      // Generic on purpose: the old example was a Steal a Brainrot
      // item, which read as wrong on every other game.
      placeholder="Enter Offer Title"
      maxLength={100}
      aria-invalid={titleInvalid || undefined}
      aria-required
      className={inputCls}
    />
    {titleInvalid && <FieldError>Offer title is required.</FieldError>}
    <TipBox>
      Give your item a descriptive title. What would buyers search for to find it? Example: {titleExample(p.gameSlug, p.gameName)}
    </TipBox>
  </FieldRow>
</SubCard>
  )
}
