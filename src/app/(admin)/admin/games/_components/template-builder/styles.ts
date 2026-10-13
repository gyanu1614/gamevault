import {
  CaretCircleDown, CheckSquare, Hash, Image as ImageIcon, TextAlignLeft, TextT, ToggleLeft,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { accountInputCls } from '@/components/account/AccountSurface'
import type { AdminIcon } from '../../../components/kit'
import type { AttrType } from '@/lib/actions/admin-template-builder'

export const TYPE_META: Record<AttrType, { label: string; icon: AdminIcon; supportsOptions: boolean }> = {
  select:       { label: 'Dropdown',     icon: CaretCircleDown,          supportsOptions: true },
  multiselect:  { label: 'Multi-Select', icon: CheckSquare,   supportsOptions: true },
  image_select: { label: 'Image Picker', icon: ImageIcon,     supportsOptions: true },
  text:         { label: 'Short Text',   icon: TextT,         supportsOptions: false },
  textarea:     { label: 'Long Text',    icon: TextAlignLeft, supportsOptions: false },
  number:       { label: 'Number',       icon: Hash,          supportsOptions: false },
  boolean:      { label: 'Yes/No',       icon: ToggleLeft,    supportsOptions: false },
}

export const TYPE_ORDER: AttrType[] = ['select', 'multiselect', 'image_select', 'text', 'textarea', 'number', 'boolean']

/** 40px card input; 16px text on touch so iOS never zooms. */
export const inputCls = cn(accountInputCls, 'h-10 py-0')
export const selectCls = cn(accountInputCls, 'h-10 cursor-pointer py-0 [&>option]:bg-bg-raised')
export const textareaCls = cn(accountInputCls, 'resize-none')

export const iconBtnCls =
  'grid h-9 w-9 shrink-0 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-white/[0.08] hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50'
export const iconBtnDangerCls =
  'grid h-9 w-9 shrink-0 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-[color-mix(in_srgb,var(--color-error)_14%,transparent)] hover:text-error'

/** Selectable chip (rule values). */
export const chipCls = (on: boolean) =>
  cn(
    'h-8 max-w-full truncate rounded-full px-3 text-[12.5px] font-medium transition-colors',
    on ? 'bg-white/[0.14] text-text-primary' : 'bg-white/[0.05] text-text-secondary hover:bg-white/[0.08] hover:text-text-primary',
  )
