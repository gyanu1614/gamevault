'use client'

import { useId, useMemo, useState } from 'react'
import {
  DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MagnifyingGlass, Plus } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { reorderAttributes, reorderOptions, type BuilderAttribute } from '@/lib/actions/admin-template-builder'
import { AddChoiceRow, ColumnMenu, PastePanel } from './ColumnTools'
import { ChoiceRow } from './ChoiceRow'
import { CreateFieldForm } from './CreateFieldForm'
import { choiceMeta, moveId, type Column } from './builder-model'
import type { Builder } from './useBuilder'
import { TYPE_META, iconBtnCls } from './styles'

const SEARCH_FROM = 12

function useDnd() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
}

/**
 * One Finder column: the field (tabs when a choice shows several), its
 * settings ⚙, the add bar, and its choices in admin order — drag the ⠿ to
 * reorder; the order saves at once and is what sellers and buyers see.
 */
export function FieldColumn({
  column,
  index,
  builder,
  parentLabel,
  onSettings,
}: {
  column: Column
  index: number
  builder: Builder
  parentLabel: string | null
  onSettings: (fieldId: string) => void
}) {
  const sensors = useDnd()
  // Stable ids: dnd-kit's own counter differs between server and browser.
  const dndId = useId()
  const [adding, setAdding] = useState(false)
  const [pasting, setPasting] = useState(false)
  const [query, setQuery] = useState('')
  const { field, siblings, parent } = column
  // Optimistic order while the save + refresh runs.
  const [order, setOrder] = useState<string[] | null>(null)
  const options = useMemo(() => {
    const list = field?.options ?? []
    if (!order) return list
    const byId = new Map(list.map((o) => [o.id, o]))
    return order.map((id) => byId.get(id)).filter((o): o is NonNullable<typeof o> => !!o)
  }, [field, order])
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options
  }, [options, query])

  if (!field || adding) {
    return (
      <ColumnShell>
        <div className="space-y-3 p-3">
          <p className="text-[14px] font-semibold text-text-primary">{field ? 'New Field' : `Nothing shown for ${parentLabel ?? 'this'} yet`}</p>
          {!field && <p className="text-[12.5px] leading-relaxed text-text-tertiary">Add the field sellers fill in after picking it, e.g. a name list.</p>}
          <CreateFieldForm
            builder={builder}
            parent={parent}
            parentLabel={parentLabel ?? undefined}
            onCreated={() => setAdding(false)}
            onCancel={field ? () => setAdding(false) : undefined}
          />
        </div>
      </ColumnShell>
    )
  }

  const meta = TYPE_META[field.type]
  const onChoiceDrag = async (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const next = moveId(options.map((o) => o.id), String(e.active.id), String(e.over.id))
    setOrder(next)
    await builder.run(async () => {
      const r = await reorderOptions(next)
      return r.success ? { success: true } : r
    })
    setOrder(null)
  }
  const onTabDrag = async (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const next = moveId(siblings.map((s) => s.id), String(e.active.id), String(e.over.id))
    await builder.run(async () => {
      const r = await reorderAttributes(next)
      return r.success ? { success: true } : r
    })
  }

  return (
    <ColumnShell>
      {/* One line: the field (tabs when a choice shows several), what opened it,
          then + (another field here) and ⋯ (settings, paste, sort, delete). */}
      <header className="px-3 pb-2.5 pt-3">
        <div className="flex items-center gap-1">
          <DndContext id={`${dndId}-tabs`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onTabDrag}>
            <SortableContext items={siblings.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
              <div role="tablist" aria-label="Fields" className="flex min-w-0 items-baseline gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {siblings.map((s) => (
                  <FieldTab key={s.id} field={s} active={s.id === field.id} onClick={() => builder.show(index, s.id)} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          {parentLabel && <span className="ml-1.5 shrink truncate text-[12px] text-text-tertiary">for {parentLabel}</span>}
          <span className="flex-1" />
          <button type="button" onClick={() => setAdding(true)} aria-label="Add another field here" title="Add another field here" className={cn(iconBtnCls, 'h-7 w-7')}>
            <Plus aria-hidden weight="bold" className="h-4 w-4" />
          </button>
          <ColumnMenu field={field} builder={builder} onSettings={() => onSettings(field.id)} onPaste={() => setPasting(true)} />
        </div>
        <p className="mt-1 text-[12px] text-text-tertiary">
          {meta.label}
          {field.is_required && ' · Required'}
          {meta.supportsOptions && ` · ${options.length} ${options.length === 1 ? 'choice' : 'choices'}`}
        </p>
      </header>

      {!meta.supportsOptions ? (
        <p className="p-4 text-[13px] leading-relaxed text-text-tertiary">Sellers type this in. It has no choices; open ⚙ for its limits and hint.</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <AddChoiceRow field={field} builder={builder} />
          {pasting && <PastePanel field={field} builder={builder} onClose={() => setPasting(false)} />}
          {options.length >= SEARCH_FROM && (
            <label className="mx-2 mb-1.5 flex h-8 items-center gap-2 rounded-[7px] border border-white/[0.06] px-2.5">
              <MagnifyingGlass aria-hidden weight="bold" className="h-3.5 w-3.5 text-text-tertiary" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${options.length} choices`}
                aria-label={`Search ${field.name} choices`}
                className="min-w-0 flex-1 bg-transparent text-base text-text-primary outline-none placeholder:text-text-tertiary sm:text-[13px]"
              />
            </label>
          )}
          {options.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-text-tertiary">No choices yet. Add one, or paste a list from ⋯.</p>
          ) : (
            <DndContext id={`${dndId}-choices`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onChoiceDrag}>
              <SortableContext items={shown.map((o) => o.id)} strategy={verticalListSortingStrategy}>
                <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-2">
                  {shown.map((o) => (
                    <ChoiceRow
                      key={o.id}
                      option={o}
                      withIcon={field.type === 'image_select'}
                      selected={column.value === o.value}
                      meta={choiceMeta(builder.state.attributes, field.id, o.value)}
                      onOpen={() => builder.pick(index, o.value)}
                      builder={builder}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}
    </ColumnShell>
  )
}

function ColumnShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[10px] bg-[#1D1E23] lg:w-[300px] lg:shrink-0">
      {children}
    </section>
  )
}

function FieldTab({ field, active, onClick }: { field: BuilderAttribute; active: boolean; onClick: () => void }) {
  const s = useSortable({ id: field.id })
  return (
    <button
      ref={s.setNodeRef}
      style={{ transform: CSS.Transform.toString(s.transform), transition: s.transition }}
      {...s.attributes}
      {...s.listeners}
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'shrink-0 touch-none truncate rounded text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        active ? 'font-semibold text-text-primary' : 'font-medium text-text-tertiary hover:text-text-secondary',
      )}
    >
      {field.name}
    </button>
  )
}
