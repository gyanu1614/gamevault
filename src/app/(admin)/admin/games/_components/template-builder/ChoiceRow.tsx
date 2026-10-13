'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CaretRight, CircleNotch, DotsSixVertical, Image as ImageIcon, PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { deleteOption, updateOption, uploadOptionIcon, type BuilderOption } from '@/lib/actions/admin-template-builder'
import { imageTooLargeMessage, readFileAsDataUrl, uploadErrorMessage } from '@/lib/uploads/image-upload'
import { useFilePicker } from '../../../components/useFilePicker'
import type { Builder } from './useBuilder'
import { iconBtnCls, iconBtnDangerCls } from './styles'

/**
 * One choice in a column: one 38px line (owner, 2026-10-12: no slug line, no
 * box-in-box). The row opens what this choice shows ("Gun Name 13 ›"); the ⠿
 * handle (on hover; always on touch) drags it; the pencil renames it in
 * place. The stored value shows only while renaming — it keys listings.
 */
export function ChoiceRow({
  option,
  withIcon,
  selected,
  meta,
  onOpen,
  builder,
}: {
  option: BuilderOption
  withIcon: boolean
  selected: boolean
  meta: { label: string; count: number; fields: number } | null
  onOpen: () => void
  builder: Builder
}) {
  const sortable = useSortable({ id: option.id })
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(option.label)
  const [uploading, setUploading] = useState(false)

  const save = async () => {
    setEditing(false)
    const next = label.trim()
    if (!next || next === option.label) return setLabel(option.label)
    await builder.run(() => updateOption({ id: option.id, label: next }))
  }

  const remove = async () => {
    if (!confirm(`Delete “${option.label}”? Anything shown only for it stays, but sellers can no longer pick it.`)) return
    await builder.run(() => deleteOption(option.id), 'Choice deleted')
  }

  const icon = useFilePicker(async (file: File) => {
    const tooLarge = imageTooLargeMessage(file, 1_048_576, 'Icon')
    if (tooLarge) return void toast.error(tooLarge)
    setUploading(true)
    try {
      const base64 = await readFileAsDataUrl(file)
      await builder.run(() => uploadOptionIcon(option.id, { name: file.name, type: file.type, size: file.size, base64 }))
    } catch (e) {
      toast.error(uploadErrorMessage(e))
    } finally {
      setUploading(false)
    }
  }, 'image/png,image/jpeg,image/jpg,image/svg+xml,image/webp')

  return (
    <li
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}
      className={cn(
        'group relative flex h-[38px] items-center rounded-[7px] pr-1 transition-colors',
        selected ? 'bg-white/[0.07]' : 'hover:bg-white/[0.035]',
        sortable.isDragging && 'z-10 bg-[#2A2B31] shadow-[0_12px_30px_-12px_rgba(0,0,0,0.8)]',
      )}
    >
      <button
        type="button"
        ref={sortable.setActivatorNodeRef}
        {...sortable.attributes}
        {...sortable.listeners}
        aria-label={`Drag ${option.label} to reorder`}
        className={cn(
          'grid h-[38px] w-6 shrink-0 cursor-grab touch-none place-items-center rounded text-[#62656E] hover:text-text-primary active:cursor-grabbing',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
          !selected && 'lg:text-transparent lg:group-hover:text-[#62656E] lg:focus-visible:text-[#62656E]',
        )}
      >
        <DotsSixVertical aria-hidden weight="bold" className="h-4 w-4" />
      </button>

      {withIcon && (
        <button
          type="button"
          onClick={icon.open}
          disabled={uploading}
          aria-label={option.icon_url ? `Replace picture for ${option.label}` : `Add picture for ${option.label}`}
          className="relative mr-1.5 grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-md bg-white/[0.06] hover:bg-white/[0.1]"
        >
          {option.icon_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={option.icon_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon aria-hidden weight="bold" className="h-3.5 w-3.5 text-text-tertiary" />
          )}
          {uploading && (
            <span className="absolute inset-0 grid place-items-center bg-black/55">
              <CircleNotch aria-hidden weight="bold" className="h-3.5 w-3.5 animate-spin" />
            </span>
          )}
        </button>
      )}
      {withIcon && icon.input}

      {editing ? (
        <span className="flex min-w-0 flex-1 items-center gap-2">
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              setLabel(option.label)
              setEditing(false)
            }
          }}
          aria-label="Choice name"
          className="h-[30px] min-w-0 flex-1 rounded-md border border-white/[0.16] bg-bg-overlay px-2 text-base text-text-primary outline-none sm:text-[13.5px]"
        />
        <span className="max-w-[40%] shrink-0 truncate font-mono text-[11px] text-text-tertiary" title="Stored value">{option.value}</span>
        </span>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          aria-current={selected || undefined}
          className="flex h-[38px] min-w-0 flex-1 items-center gap-2 rounded-[7px] px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <span className={cn('min-w-0 flex-1 truncate text-[13.5px]', selected ? 'font-medium text-text-primary' : 'text-[#D7D9DE]')}>
            {option.label}
          </span>
          {meta ? (
            <span className={cn('flex min-w-0 shrink items-center gap-1 text-[12px]', selected ? 'text-text-secondary' : 'text-text-tertiary')}>
              <span className="truncate">{meta.fields > 1 ? `${meta.fields} fields` : meta.label}</span>
              {meta.fields === 1 && meta.count > 0 && <span className="shrink-0 tabular-nums">{meta.count}</span>}
              <CaretRight aria-hidden weight="bold" className="h-3 w-3 shrink-0" />
            </span>
          ) : (
            <span className="flex shrink-0 items-center gap-1 text-[12px] text-text-tertiary opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
              <Plus aria-hidden weight="bold" className="h-3 w-3" />
              Field
            </span>
          )}
        </button>
      )}

      {/* Rename / delete: on hover (desktop), always on touch. Hidden, they
          take no width, so the label and "opens" text never truncate. */}
      <div className="flex shrink-0 lg:hidden lg:group-hover:flex lg:group-focus-within:flex">
        <button type="button" onClick={() => setEditing(true)} aria-label={`Rename ${option.label}`} className={cn(iconBtnCls, 'h-8 w-8')}>
          <PencilSimple aria-hidden weight="bold" className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={remove} aria-label={`Delete ${option.label}`} className={cn(iconBtnDangerCls, 'h-8 w-8')}>
          <Trash aria-hidden weight="bold" className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  )
}
