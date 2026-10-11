'use client'

import { useState } from 'react'

import { inputCls } from '../../styles'
import { SubCard } from '../../ui/SubCard'
import { FieldError, FieldRow, TipBox } from '../../ui/form-fields'
import type { Step4Props } from './types'

/** Offer title (not asked for currency: the server names it). */
export function TitleSection({ p }: { p: Pick<Step4Props, 'title' | 'setTitle'> }) {
  // The error shows once the field has been left empty, not on first render.
  const [touched, setTouched] = useState(false)
  const titleInvalid = touched && !p.title.trim()
  return (
<SubCard title="Title">
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
    <TipBox>Lead with the words buyers search for. Max 100 characters.</TipBox>
  </FieldRow>
</SubCard>
  )
}
