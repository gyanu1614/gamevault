'use client'

import { useCallback, useMemo, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from '@phosphor-icons/react'
import type { Attribute, AttributeTemplateFull } from '@/lib/actions/new-schema'
import type { BuilderAttribute, BuilderState } from '@/lib/actions/admin-template-builder'
import { buildChildIndex } from '@/app/(sell)/_components/sell-wizard/attribute-tree'
import { Step3Details } from '@/app/(sell)/_components/sell-wizard/steps/Step3Details'
import { iconBtnCls } from './styles'

/** The builder's fields in the seller form's shape (same order, same rules). */
function toSellerAttributes(attrs: BuilderAttribute[]): Attribute[] {
  return attrs.map((a) => ({
    ...a,
    parent_attribute_id: null,
    seo_title: null,
    seo_description: null,
    options: [...a.options]
      .sort((x, y) => x.sort_order - y.sort_order)
      .map((o) => ({ ...o, metadata: o.metadata as Record<string, any>, seo_title: null, seo_description: null })),
    conditional_rules: a.rules,
  }))
}

/**
 * Preview: the REAL seller fields (Step3Details + FieldInput), fed the
 * builder's state, so admin sees exactly what sellers see, in the same order.
 */
export function PreviewSheet({ state, open, onOpenChange }: { state: BuilderState; open: boolean; onOpenChange: (o: boolean) => void }) {
  const attributes = useMemo(() => toSellerAttributes(state.attributes), [state.attributes])
  const template = useMemo<AttributeTemplateFull | null>(
    () => (state.template ? { ...state.template, game_category_id: state.header.game_category_id, attributes } as unknown as AttributeTemplateFull : null),
    [state.template, state.header.game_category_id, attributes],
  )
  const { topLevel, childrenOf } = useMemo(() => buildChildIndex(attributes), [attributes])
  const [values, setValues] = useState<Record<string, unknown>>({})
  const onChange = useCallback((id: string, v: unknown) => setValues((p) => ({ ...p, [id]: v })), [])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col rounded-t-2xl bg-bg-base pb-[env(safe-area-inset-bottom)] outline-none lg:inset-y-0 lg:left-auto lg:right-0 lg:max-h-none lg:w-[560px] lg:rounded-none lg:rounded-l-xl">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <Dialog.Title className="text-[17px] font-semibold text-text-primary">Seller Preview</Dialog.Title>
            <Dialog.Description className="sr-only">The item fields as sellers see them on the listing form.</Dialog.Description>
            <Dialog.Close aria-label="Close" className={iconBtnCls}>
              <X aria-hidden weight="bold" className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {topLevel.length === 0 ? (
              <p className="text-[13px] text-text-tertiary">No fields yet.</p>
            ) : (
              <Step3Details templateLoading={false} template={template} topLevel={topLevel} childrenOf={childrenOf} values={values} onChange={onChange} />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
