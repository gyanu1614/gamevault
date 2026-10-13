'use client'

import { useState } from 'react'
import { Plus } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { createAttribute, createSubAttribute, type AttrType } from '@/lib/actions/admin-template-builder'
import { adminBtnSm } from '../../../components/kit'
import type { Builder } from './useBuilder'
import { TYPE_META, TYPE_ORDER, inputCls, selectCls } from './styles'

/**
 * New field: for a choice ("shown when Rarity is Uncommon") or on its own at
 * the top. Dropdown is the default type — most item fields are a list.
 */
export function CreateFieldForm({
  builder,
  parent,
  parentLabel,
  onCreated,
  onCancel,
}: {
  builder: Builder
  parent: { fieldId: string; value: string } | null
  parentLabel?: string
  onCreated?: () => void
  onCancel?: () => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<AttrType>('select')
  const templateId = builder.state.template?.id

  const create = async () => {
    const n = name.trim()
    if (!n || !templateId) return
    const ok = await builder.run(async () => {
      const r = parent
        ? await createSubAttribute({ template_id: templateId, name: n, type, trigger_attribute_id: parent.fieldId, trigger_value: parent.value })
        : await createAttribute({ template_id: templateId, name: n, type })
      return r.success ? { success: true } : r
    }, 'Field added')
    if (ok) {
      setName('')
      onCreated?.()
    }
  }

  return (
    <form
      className="space-y-2.5"
      onSubmit={(e) => {
        e.preventDefault()
        void create()
      }}
    >
      {parentLabel && <p className="text-[12.5px] text-text-tertiary">Shown when {parentLabel} is picked</p>}
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Field name, e.g. Knife Name"
        aria-label="New field name"
        className={inputCls}
      />
      <select value={type} onChange={(e) => setType(e.target.value as AttrType)} aria-label="Field type" className={selectCls}>
        {TYPE_ORDER.map((t) => (
          <option key={t} value={t}>{TYPE_META[t].label}</option>
        ))}
      </select>
      <div className="flex justify-end gap-2">
        {onCancel && <button type="button" onClick={onCancel} className={adminBtnSm.secondary}>Cancel</button>}
        <button type="submit" disabled={builder.busy || !name.trim()} className={cn(adminBtnSm.primary)}>
          <Plus aria-hidden weight="bold" className="h-3.5 w-3.5" />
          Create Field
        </button>
      </div>
    </form>
  )
}
