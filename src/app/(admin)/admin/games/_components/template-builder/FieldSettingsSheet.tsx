'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { CircleNotch, Trash, X } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { deleteAttribute, updateAttribute, type AttrType, type BuilderAttribute } from '@/lib/actions/admin-template-builder'
import { adminBtn } from '../../../components/kit'
import { RulesEditor } from './RulesEditor'
import type { Builder } from './useBuilder'
import { TYPE_META, TYPE_ORDER, iconBtnCls, inputCls, selectCls, textareaCls } from './styles'

/**
 * A field's settings (⚙): a side sheet on desktop, a bottom sheet on phones.
 * Name / Type / Required up top; hint, limits and the stored slug below;
 * the raw show-rules last; Delete Field at the foot.
 */
export function FieldSettingsSheet({
  field,
  builder,
  onClose,
}: {
  field: BuilderAttribute | null
  builder: Builder
  onClose: () => void
}) {
  return (
    <Dialog.Root open={!!field} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            'fixed z-50 flex flex-col bg-[#1D1E23] text-text-primary outline-none',
            'inset-x-0 bottom-0 max-h-[88dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]',
            'lg:inset-y-0 lg:left-auto lg:right-0 lg:max-h-none lg:w-[440px] lg:rounded-none lg:rounded-l-xl',
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom lg:data-[state=open]:slide-in-from-right',
          )}
        >
          {field && <Body key={field.id} field={field} builder={builder} onClose={onClose} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Body({ field, builder, onClose }: { field: BuilderAttribute; builder: Builder; onClose: () => void }) {
  const [name, setName] = useState(field.name)
  const [type, setType] = useState<AttrType>(field.type)
  const [required, setRequired] = useState(field.is_required)
  const [placeholder, setPlaceholder] = useState(field.placeholder ?? '')
  const [help, setHelp] = useState(field.help_text ?? '')
  const [slug, setSlug] = useState(field.slug)
  const [min, setMin] = useState(field.min_value?.toString() ?? '')
  const [max, setMax] = useState(field.max_value?.toString() ?? '')
  const [maxLen, setMaxLen] = useState(field.max_length?.toString() ?? '')
  const others = builder.state.attributes.filter((a) => a.id !== field.id)

  const save = async () => {
    const ok = await builder.run(async () => {
      const r = await updateAttribute({
        id: field.id,
        name: name.trim() || field.name,
        type,
        is_required: required,
        placeholder: placeholder || null,
        help_text: help || null,
        slug,
        min_value: min === '' ? null : parseFloat(min),
        max_value: max === '' ? null : parseFloat(max),
        max_length: maxLen === '' ? null : parseInt(maxLen, 10),
      })
      return r.success ? { success: true } : r
    }, 'Field saved')
    if (ok) onClose()
  }
  const remove = async () => {
    if (!confirm(`Delete ${field.name}? Its choices and every field shown under them are deleted too.`)) return
    if (await builder.run(async () => {
      const r = await deleteAttribute(field.id)
      return r.success ? { success: true } : r
    }, 'Field deleted')) onClose()
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
        <Dialog.Title className="truncate text-[17px] font-semibold">{field.name} Settings</Dialog.Title>
        <Dialog.Description className="sr-only">Name, type, required, hint and show rules for this field.</Dialog.Description>
        <Dialog.Close aria-label="Close" className={iconBtnCls}>
          <X aria-hidden weight="bold" className="h-4 w-4" />
        </Dialog.Close>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <Labeled label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Labeled>
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Type">
            <select value={type} onChange={(e) => setType(e.target.value as AttrType)} className={selectCls}>
              {TYPE_ORDER.map((t) => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
            </select>
          </Labeled>
          <label className="flex cursor-pointer items-center justify-between gap-3 self-end rounded-md bg-bg-overlay px-3.5 py-2.5">
            <span className="text-[13px] font-medium">Required</span>
            <Switch checked={required} onCheckedChange={setRequired} aria-label="Required" />
          </label>
        </div>
        <Labeled label="Placeholder" hint="Grey text inside the empty field">
          <input value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} placeholder={`Choose ${field.name}`} className={inputCls} />
        </Labeled>
        <Labeled label="Help Text" hint="Shown under the field">
          <textarea value={help} onChange={(e) => setHelp(e.target.value)} rows={2} className={textareaCls} />
        </Labeled>
        {type === 'number' && (
          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Min"><input type="number" value={min} onChange={(e) => setMin(e.target.value)} className={inputCls} /></Labeled>
            <Labeled label="Max"><input type="number" value={max} onChange={(e) => setMax(e.target.value)} className={inputCls} /></Labeled>
          </div>
        )}
        {(type === 'text' || type === 'textarea') && (
          <Labeled label="Max Length"><input type="number" value={maxLen} onChange={(e) => setMaxLen(e.target.value)} className={inputCls} /></Labeled>
        )}
        <Labeled label="Slug" hint="Stored key; changing it affects saved listings">
          <input value={slug} onChange={(e) => setSlug(e.target.value)} className={cn(inputCls, 'font-mono sm:text-[13px]')} />
        </Labeled>
        <RulesEditor attribute={field} siblings={others} onChange={builder.refresh} />
        <button type="button" onClick={remove} className={cn(adminBtn.secondary, 'w-full text-error hover:text-error')}>
          <Trash aria-hidden weight="bold" className="h-4 w-4" />
          Delete Field
        </button>
      </div>
      <div className="flex justify-end gap-2 border-t border-white/[0.06] px-5 py-3">
        <Dialog.Close className={adminBtn.secondary}>Cancel</Dialog.Close>
        <button type="button" onClick={save} disabled={builder.busy} className={adminBtn.primary}>
          {builder.busy && <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />}
          Save
        </button>
      </div>
    </>
  )
}

function Labeled({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-text-secondary">{label}</span>
        {hint && <span className="text-[12px] text-text-tertiary">{hint}</span>}
      </span>
      {children}
    </label>
  )
}
