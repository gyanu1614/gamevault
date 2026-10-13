'use client'

import { useState } from 'react'
import Link from '@/components/navigation/AppLink'
import { ArrowLeft, Eye } from '@phosphor-icons/react'
import type { BuilderState } from '@/lib/actions/admin-template-builder'
import { adminBtnSm } from '../../../components/kit'
import { CreateFieldForm } from './CreateFieldForm'
import { FieldSettingsSheet } from './FieldSettingsSheet'
import { FinderView } from './FinderView'
import { PreviewSheet } from './PreviewSheet'
import { useBuilder } from './useBuilder'

/**
 * Item fields builder (2026-10-12 rebuild): Finder columns. Pick a choice to
 * open what sellers fill in for it; drag ⠿ to set the order sellers and
 * buyers see; ⚙ for a field's settings; Preview shows the real seller form.
 */
export default function TemplateBuilderView({ initial }: { initial: BuilderState }) {
  const builder = useBuilder(initial)
  const [settingsFor, setSettingsFor] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const { header } = builder.state
  const settingsField = builder.state.attributes.find((a) => a.id === settingsFor) ?? null

  return (
    <div className="space-y-4">
      <header>
        <Link
          href={`/admin/games/${header.game_id}/edit`}
          className="-ml-1 inline-flex h-8 items-center gap-1.5 rounded-md px-1 text-[13px] font-medium text-text-tertiary transition-colors hover:text-text-primary"
        >
          <ArrowLeft aria-hidden weight="bold" className="h-3.5 w-3.5" />
          Back to {header.game_name}
        </Link>
        <div className="mt-1.5 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-[24px] font-bold leading-tight tracking-tight text-text-primary sm:text-[28px]">
              {header.game_name} {header.global_category_name} Fields
            </h1>
            <p className="mt-1 text-[13.5px] text-text-secondary">
              What sellers fill in, in this order. Pick a choice to set what comes after it.
            </p>
          </div>
          <button type="button" onClick={() => setPreview(true)} className={adminBtnSm.secondary}>
            <Eye aria-hidden weight="bold" className="h-3.5 w-3.5" />
            Preview
          </button>
        </div>
      </header>

      {builder.columns[0]?.field ? (
        <FinderView builder={builder} onSettings={setSettingsFor} />
      ) : (
        <section className="max-w-md rounded-lg bg-[#1D1E23] p-5">
          <p className="mb-1 text-[15px] font-semibold text-text-primary">Start With The First Field</p>
          <p className="mb-4 text-[13px] text-text-tertiary">Usually the item type, e.g. Knives, Guns, Pets.</p>
          <CreateFieldForm builder={builder} parent={null} />
        </section>
      )}

      <FieldSettingsSheet field={settingsField} builder={builder} onClose={() => setSettingsFor(null)} />
      <PreviewSheet state={builder.state} open={preview} onOpenChange={setPreview} />
    </div>
  )
}
