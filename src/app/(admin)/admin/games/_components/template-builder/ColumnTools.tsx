'use client'

import { useState } from 'react'
import { ClipboardText, DotsThree, GearSix, Plus, SortAscending, Trash } from '@phosphor-icons/react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import {
  bulkCreateOptions, bulkDeleteOptions, createOption, reorderOptions, type BuilderAttribute,
} from '@/lib/actions/admin-template-builder'
import { adminBtnSm } from '../../../components/kit'
import type { Builder } from './useBuilder'
import { iconBtnCls, textareaCls } from './styles'

const ok = (r: { success: boolean; error?: string }) =>
  (r.success ? { success: true } : { success: false, error: r.error ?? 'Failed' }) as { success: true } | { success: false; error: string }

/**
 * "+ Add choice": a slim row that becomes an input in place; Enter adds and
 * keeps it open for the next one, Esc closes (owner, 2026-10-12: no big input
 * + green button taking the top of every column).
 */
export function AddChoiceRow({ field, builder }: { field: BuilderAttribute; builder: Builder }) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-2 mb-1.5 flex h-[34px] w-[calc(100%-16px)] items-center gap-2 rounded-[7px] bg-white/[0.035] px-2.5 text-[13px] text-text-tertiary transition-colors hover:bg-white/[0.06] hover:text-text-secondary"
      >
        <Plus aria-hidden weight="bold" className="h-3.5 w-3.5" />
        Add choice
      </button>
    )
  }
  const add = async () => {
    const v = label.trim()
    if (!v) return setOpen(false)
    if (await builder.run(() => createOption({ attribute_id: field.id, label: v }).then(ok))) setLabel('')
  }
  return (
    <div className="mx-2 mb-1.5 flex h-[34px] items-center gap-2 rounded-[7px] border border-white/[0.14] px-2.5">
      <input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); void add() }
          if (e.key === 'Escape') { setLabel(''); setOpen(false) }
        }}
        onBlur={() => { if (!label.trim()) setOpen(false) }}
        placeholder={`New ${field.name} choice`}
        aria-label={`New choice for ${field.name}`}
        className="min-w-0 flex-1 bg-transparent text-base text-text-primary outline-none placeholder:text-text-tertiary sm:text-[13px]"
      />
      <span className="shrink-0 text-[11px] text-text-tertiary">{builder.busy ? 'Saving…' : 'Enter to add'}</span>
    </div>
  )
}

/** ⋯ — the list actions that used to be three buttons on every column. */
export function ColumnMenu({
  field, builder, onSettings, onPaste,
}: {
  field: BuilderAttribute
  builder: Builder
  onSettings: () => void
  onPaste: () => void
}) {
  const n = field.options.length
  const sortAZ = async () => {
    if (!confirm(`Sort all ${n} choices of ${field.name} A–Z? This replaces the current order.`)) return
    const ids = [...field.options].sort((a, b) => a.label.localeCompare(b.label)).map((o) => o.id)
    await builder.run(() => reorderOptions(ids).then(ok), 'Sorted A–Z')
  }
  const deleteAll = async () => {
    if (!confirm(`Delete all ${n} choices of ${field.name}? This can't be undone.`)) return
    await builder.run(() => bulkDeleteOptions({ attribute_id: field.id }).then(ok), 'All choices deleted')
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={`${field.name} options`} className={cn(iconBtnCls, 'h-7 w-7 data-[state=open]:bg-white/[0.08]')}>
        <DotsThree aria-hidden weight="bold" className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={onSettings}>
          <GearSix aria-hidden weight="bold" className="mr-2 h-4 w-4" />
          Field Settings
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onPaste}>
          <ClipboardText aria-hidden weight="bold" className="mr-2 h-4 w-4" />
          Paste List
        </DropdownMenuItem>
        {n > 1 && (
          <DropdownMenuItem onSelect={sortAZ}>
            <SortAscending aria-hidden weight="bold" className="mr-2 h-4 w-4" />
            Sort A–Z
          </DropdownMenuItem>
        )}
        {n > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={deleteAll} className="text-error focus:text-error">
              <Trash aria-hidden weight="bold" className="mr-2 h-4 w-4" />
              Delete All Choices
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Paste List: many choices at once, kept in the pasted order. */
export function PastePanel({ field, builder, onClose }: { field: BuilderAttribute; builder: Builder; onClose: () => void }) {
  const [text, setText] = useState('')
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  const add = async () => {
    if (lines.length === 0) return
    if (await builder.run(() => bulkCreateOptions({ attribute_id: field.id, labels: lines }).then(ok), `${lines.length} added`)) onClose()
  }
  return (
    <div className="mx-2 mb-2 space-y-2 rounded-[7px] bg-white/[0.03] p-2">
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder={'One per line, in the order sellers should see them'}
        aria-label={`Choices to add to ${field.name}, one per line`}
        className={textareaCls}
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={adminBtnSm.secondary}>Cancel</button>
        <button type="button" onClick={add} disabled={builder.busy || lines.length === 0} className={adminBtnSm.primary}>
          Add {lines.length || ''} {lines.length === 1 ? 'Choice' : 'Choices'}
        </button>
      </div>
    </div>
  )
}
