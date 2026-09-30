'use client'

/**
 * TemplateBuilder — attribute template UI for the redesigned admin.
 *
 * Layout: left tree of attributes, right detail editor with options +
 * conditional rules sub-editors, bottom live preview. All edits go
 * through the admin-template-builder.ts actions; UI keeps a local
 * mirror for snappy interactions, then refetches on save.
 *
 * Drag-to-reorder is deferred (uses up/down buttons here). When dnd-kit
 * is added, only the left tree changes; everything else stays.
 */

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft, Plus, PencilSimple, Trash, CircleNotch,
  Sparkle, GitBranch, Hash, TextT, ToggleLeft, List, TextAlignLeft, Image as ImageIcon,
  CheckSquare, WarningCircle, FloppyDisk, X, DotsSixVertical, CaretRight, CaretDown,
  ClipboardText,
} from '@phosphor-icons/react'
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { accountInputCls } from '@/components/account/AccountSurface'
import { Switch } from '@/components/ui/switch'
import { AdminEmpty, PanelHead, adminBtn, adminBtnSm, type AdminIcon } from '../../components/kit'
import {
  createAttribute, updateAttribute, deleteAttribute,
  createOption, updateOption, deleteOption, uploadOptionIcon, reorderOptions,
  bulkCreateOptions, bulkDeleteOptions,
  saveRule, deleteRule, createSubAttribute,
  type AttrType,
  type BuilderAttribute,
  type BuilderOption,
  type BuilderRule,
  type BuilderState,
} from '@/lib/actions/admin-template-builder'

// ─── Icons per attribute type ────────────────────────────────────────────────

const TYPE_META: Record<AttrType, { label: string; icon: AdminIcon; supportsOptions: boolean }> = {
  text:         { label: 'Short Text',   icon: TextT,         supportsOptions: false },
  number:       { label: 'Number',       icon: Hash,          supportsOptions: false },
  textarea:     { label: 'Long Text',    icon: TextAlignLeft, supportsOptions: false },
  select:       { label: 'Dropdown',     icon: List,          supportsOptions: true },
  multiselect:  { label: 'Multi-Select', icon: CheckSquare,   supportsOptions: true },
  boolean:      { label: 'Yes/No',       icon: ToggleLeft,    supportsOptions: false },
  image_select: { label: 'Image Picker', icon: ImageIcon,     supportsOptions: true },
}

const TYPE_ORDER: AttrType[] = ['text', 'number', 'textarea', 'select', 'multiselect', 'image_select', 'boolean']

// ─── Component ───────────────────────────────────────────────────────────────

export default function TemplateBuilder({ initial }: { initial: BuilderState }) {
  const router = useRouter()
  const [state, setState] = useState<BuilderState>(initial)
  const [selectedId, setSelectedId] = useState<string | null>(initial.attributes[0]?.id ?? null)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [, startTransition] = useTransition()

  // Refetch helper — reuses server action via Next router refresh
  const refresh = () => {
    startTransition(() => router.refresh())
  }

  // Keep local state in sync if Next refreshes us (loader re-runs)
  useEffect(() => { setState(initial) }, [initial])

  const selected = useMemo(
    () => state.attributes.find((a) => a.id === selectedId) ?? null,
    [state.attributes, selectedId]
  )

  // ── Attribute add ─────────────────────────────────────────────────────────
  const [draftName, setDraftName] = useState('')
  const [draftType, setDraftType] = useState<AttrType>('select')

  const handleAddAttribute = async () => {
    if (!state.template) return
    if (!draftName.trim()) { toast.error('Name is required'); return }
    setBusy(true)
    const res = await createAttribute({
      template_id: state.template.id,
      name: draftName,
      type: draftType,
      sort_order: state.attributes.length,
    })
    setBusy(false)
    if (!res.success) { toast.error(res.error); return }
    setSelectedId(res.data.id)
    setDraftName('')
    setAdding(false)
    toast.success('Field added')
    refresh()
  }

  // ── Delete attribute ──────────────────────────────────────────────────────
  const handleDeleteAttribute = async (id: string) => {
    if (!confirm('Delete this field? All its choices and sub-fields will be removed too.')) return
    setBusy(true)
    const res = await deleteAttribute(id)
    setBusy(false)
    if (!res.success) { toast.error(res.error); return }
    setSelectedId((cur) => (cur === id ? null : cur))
    toast.success('Field deleted')
    refresh()
  }

  return (
    <div className="space-y-5">
      {/* ── Breadcrumb / header ── */}
      <header>
        <Link
          href={`/admin/games/${state.header.game_id}/edit`}
          className="-ml-1 inline-flex h-8 items-center gap-1.5 rounded-md px-1 text-[13px] font-medium text-text-tertiary transition-colors hover:text-text-primary"
        >
          <ArrowLeft aria-hidden weight="bold" className="h-3.5 w-3.5" />
          Back to {state.header.game_name}
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <h1 className="min-w-0 break-words text-[24px] font-bold leading-tight tracking-tight text-text-primary sm:text-[28px]">
                {state.header.game_name} <span className="text-text-tertiary">·</span>{' '}
                <span className="text-text-secondary">{state.header.global_category_name}</span>
              </h1>
              <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-lime-tint-bg px-2 py-0.5 text-[11.5px] font-semibold text-lime-text">
                <Sparkle aria-hidden weight="bold" className="h-3 w-3" />
                Attribute Template
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-text-secondary">
              Define the fields sellers fill in when listing in this category.
              Sub-fields appear only when another field has a specific value.
            </p>
          </div>
          {state.template && (
            <div className="text-[12.5px] tabular-nums text-text-tertiary">
              Version {state.template.version} · {state.attributes.length} attributes
            </div>
          )}
        </div>
      </header>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* ── Left: field tree ── */}
        <FieldTree
          state={state}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDelete={handleDeleteAttribute}
          onAddTopLevel={() => setAdding((v) => !v)}
          addingTopLevel={adding}
          draftName={draftName}
          setDraftName={setDraftName}
          draftType={draftType}
          setDraftType={setDraftType}
          onCreateTopLevel={handleAddAttribute}
          onCancelTopLevel={() => { setAdding(false); setDraftName('') }}
          busy={busy}
          onRefresh={refresh}
        />
        {/* Keep the dnd handlers alive even though FieldTree owns its own dnd for top-level.
            Top-level reordering still routes through here via FieldTree's sensors. */}

        {/* ── Right: detail / options / rules ── */}
        {selected ? (
          <AttributeDetail
            key={selected.id}
            attribute={selected}
            siblings={state.attributes.filter((a) => a.id !== selected.id)}
            onChange={refresh}
          />
        ) : (
          <AdminEmpty
            icon={PencilSimple}
            title="No Field Selected"
            hint="Pick a field on the left to edit it, or add a new one."
            className="py-16 lg:py-20"
          />
        )}
      </div>

      {/* ── Live preview ── */}
      <LivePreview attributes={state.attributes} />
    </div>
  )
}

// ─── Field tree — explanatory left pane with multi-level sub-fields ──────────

/**
 * Build the parent→children index. A "child" of an attribute is another
 * attribute that has a conditional rule pointing at the parent. The trigger
 * value tells us which option / boolean state the child is associated with.
 *
 * Result shape: Map<parentAttributeId, Map<triggerValue, childAttributeId[]>>
 *
 * "Top-level" attributes are those with no conditional rules at all (so they
 * always show on the seller form and have no parent in this tree).
 */
function buildTreeIndex(attrs: BuilderAttribute[]): {
  topLevel: BuilderAttribute[]
  childrenOf: Map<string, Map<string, BuilderAttribute[]>>
} {
  const childrenOf = new Map<string, Map<string, BuilderAttribute[]>>()
  const childIds = new Set<string>()

  for (const a of attrs) {
    if (a.rules.length === 0) continue
    childIds.add(a.id)
    // We treat the FIRST rule as the canonical parent for tree layout.
    // (Multi-rule attributes still work at runtime — they just appear under
    // their first trigger here. Rare in practice; admins can use the rules
    // panel on the right to add extra triggers.)
    const rule = a.rules[0]
    const triggerVal = rule.trigger_values[0] ?? ''
    const inner = childrenOf.get(rule.trigger_attribute_id) ?? new Map<string, BuilderAttribute[]>()
    const list = inner.get(triggerVal) ?? []
    list.push(a)
    inner.set(triggerVal, list)
    childrenOf.set(rule.trigger_attribute_id, inner)
  }

  // Sort siblings in each bucket by sort_order
  childrenOf.forEach((inner) => {
    inner.forEach((list) => list.sort((a, b) => a.sort_order - b.sort_order))
  })

  const topLevel = attrs
    .filter((a) => !childIds.has(a.id))
    .sort((a, b) => a.sort_order - b.sort_order)

  return { topLevel, childrenOf }
}

interface FieldTreeProps {
  state: BuilderState
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onAddTopLevel: () => void
  addingTopLevel: boolean
  draftName: string
  setDraftName: (s: string) => void
  draftType: AttrType
  setDraftType: (t: AttrType) => void
  onCreateTopLevel: () => void
  onCancelTopLevel: () => void
  busy: boolean
  onRefresh: () => void
}

function FieldTree(props: FieldTreeProps) {
  const { topLevel, childrenOf } = useMemo(
    () => buildTreeIndex(props.state.attributes),
    [props.state.attributes]
  )

  return (
    <section className="min-w-0 rounded-lg bg-bg-raised p-4 sm:p-5">
      {/* Header + explainer */}
      <PanelHead
        title="Fields"
        className="mb-1.5 items-center"
        aside={
          <button
            type="button"
            onClick={props.onAddTopLevel}
            aria-expanded={props.addingTopLevel}
            className={adminBtnSm.primary}
          >
            <Plus aria-hidden weight="bold" className="h-3.5 w-3.5" />
            Add Field
          </button>
        }
      />
      <p className="text-[12.5px] leading-relaxed text-text-tertiary">
        Fields are what sellers fill in. Add a top-level field, then for choice-type fields
        you can add <span className="text-text-secondary">sub-fields</span> that only appear when a
        specific choice is picked.
      </p>

      {/* Inline "add top-level" form */}
      {props.addingTopLevel && (
        <div className="mt-4 space-y-3 rounded-md bg-bg-overlay p-3">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-text-secondary">Field Name</span>
            <input
              value={props.draftName}
              onChange={(e) => props.setDraftName(e.target.value)}
              placeholder="e.g. Item Type"
              autoFocus
              className={cn(accountInputCls, 'h-10 bg-bg-overlay-2 py-0')}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-text-secondary">Field Type</span>
            <select
              value={props.draftType}
              onChange={(e) => props.setDraftType(e.target.value as AttrType)}
              className={cn(accountInputCls, 'h-10 cursor-pointer bg-bg-overlay-2 py-0 [&>option]:bg-bg-raised')}
            >
              {TYPE_ORDER.map((t) => (
                <option key={t} value={t}>{TYPE_META[t].label}</option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={props.onCreateTopLevel}
              disabled={props.busy || !props.draftName.trim()}
              className={cn(adminBtn.primary, 'flex-1 px-3')}
            >
              {props.busy
                ? <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
                : <Plus aria-hidden weight="bold" className="h-4 w-4" />}
              Create Field
            </button>
            <button
              type="button"
              onClick={props.onCancelTopLevel}
              aria-label="Cancel"
              title="Cancel"
              className={cn(adminBtn.secondary, 'w-10 px-0')}
            >
              <X aria-hidden weight="bold" className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="-mx-1.5 mt-3 max-h-[70vh] overflow-y-auto px-1.5">
        {topLevel.length === 0 && !props.addingTopLevel ? (
          <div className="rounded-md bg-bg-overlay px-4 py-8 text-center text-[13px] leading-relaxed text-text-tertiary">
            No fields yet. Click <span className="font-semibold text-text-secondary">Add Field</span> to start —
            e.g. a <em>Dropdown</em> called &quot;Item Type&quot;.
          </div>
        ) : (
          <ul className="space-y-0.5">
            {topLevel.map((attr) => (
              <FieldNode
                key={attr.id}
                attribute={attr}
                depth={0}
                childrenOf={childrenOf}
                selectedId={props.selectedId}
                onSelect={props.onSelect}
                onDelete={props.onDelete}
                templateId={props.state.template?.id ?? ''}
                onRefresh={props.onRefresh}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

interface FieldNodeProps {
  attribute: BuilderAttribute
  depth: number
  childrenOf: Map<string, Map<string, BuilderAttribute[]>>
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  templateId: string
  onRefresh: () => void
}

function FieldNode({ attribute, depth, childrenOf, selectedId, onSelect, onDelete, templateId, onRefresh }: FieldNodeProps) {
  const Icon = TYPE_META[attribute.type].icon
  const selected = selectedId === attribute.id
  const inner = childrenOf.get(attribute.id) ?? new Map<string, BuilderAttribute[]>()
  const hasChoices = TYPE_META[attribute.type].supportsOptions || attribute.type === 'boolean'

  // Build the list of "buckets" (one per option / boolean state), so we can
  // render a sub-tree under each and the "add sub-field" button per choice.
  const buckets: Array<{ key: string; label: string; iconUrl?: string | null }> = []
  if (attribute.type === 'boolean') {
    buckets.push({ key: 'true',  label: 'when Yes' })
    buckets.push({ key: 'false', label: 'when No' })
  } else if (hasChoices) {
    for (const opt of attribute.options) {
      buckets.push({ key: opt.value, label: `when ${opt.label}`, iconUrl: opt.icon_url })
    }
  }

  // V17n — Collapse state for the whole sub-tree under this field. Big
  // dropdowns (Brainrot has 12 options × N sub-fields each) make the
  // sidebar unmanageable; admin can fold a parent away to focus on the
  // rest of the schema. Defaults to expanded so first-time edits aren't
  // surprising.
  const [collapsed, setCollapsed] = useState(false)
  const hasSubtree = buckets.length > 0

  // padding-left per depth (12 px each)
  const indentPx = depth * 14

  return (
    <li>
      <div
        className={cn(
          'group flex min-h-9 items-center gap-1 rounded-md pr-1 transition-colors',
          selected ? 'bg-white/[0.08] text-text-primary' : 'text-text-secondary hover:bg-white/[0.04] hover:text-text-primary'
        )}
        style={{ paddingLeft: 6 + indentPx }}
      >
        {/* Collapse chevron. Renders even when there's no sub-tree so
            every row has the same left-edge alignment. Disabled +
            invisible icon for leaf nodes. */}
        {hasSubtree ? (
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-white/[0.08] hover:text-text-primary"
            title={collapsed ? 'Expand sub-fields' : 'Collapse sub-fields'}
            aria-label={collapsed ? 'Expand sub-fields' : 'Collapse sub-fields'}
            aria-expanded={!collapsed}
          >
            {collapsed
              ? <CaretRight aria-hidden weight="bold" className="h-3.5 w-3.5" />
              : <CaretDown aria-hidden weight="bold" className="h-3.5 w-3.5" />
            }
          </button>
        ) : (
          <span className="inline-block h-8 w-8 shrink-0" aria-hidden />
        )}
        <Icon aria-hidden weight="bold" className="h-4 w-4 shrink-0 text-text-tertiary" />
        <button
          type="button"
          onClick={() => onSelect(attribute.id)}
          aria-current={selected ? 'true' : undefined}
          className="min-w-0 flex-1 self-stretch truncate py-2 pl-1 text-left text-[13.5px]"
        >
          <span className="font-medium">{attribute.name}</span>
          <span className="ml-2 text-[11.5px] text-text-tertiary">
            {TYPE_META[attribute.type].label}
            {attribute.is_required && <span className="ml-1 text-error">*</span>}
          </span>
        </button>
        <button
          type="button"
          onClick={() => onDelete(attribute.id)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-text-tertiary transition-[opacity,background-color,color] hover:bg-[color-mix(in_srgb,var(--color-error)_14%,transparent)] hover:text-error focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
          title="Delete field"
          aria-label={`Delete field ${attribute.name}`}
        >
          <Trash aria-hidden weight="bold" className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Sub-tree per choice — hidden when this node is collapsed. */}
      {!collapsed && buckets.length > 0 && (
        <ul className="space-y-0.5">
          {buckets.map((b) => {
            const children = inner.get(b.key) ?? []
            return (
              <li key={b.key}>
                <div
                  className="flex min-w-0 items-center gap-1.5 pb-0.5 pt-1.5 text-[12px] font-medium text-text-tertiary"
                  style={{ paddingLeft: 12 + indentPx + 14 }}
                >
                  {b.iconUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={b.iconUrl} alt="" className="h-3.5 w-3.5 shrink-0 rounded-sm object-cover" />
                  ) : (
                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-white/[0.18]" />
                  )}
                  <span className="truncate">{b.label}</span>
                </div>
                <ul className="space-y-0.5">
                  {children.map((child) => (
                    <FieldNode
                      key={child.id}
                      attribute={child}
                      depth={depth + 1}
                      childrenOf={childrenOf}
                      selectedId={selectedId}
                      onSelect={onSelect}
                      onDelete={onDelete}
                      templateId={templateId}
                      onRefresh={onRefresh}
                    />
                  ))}
                  <AddSubFieldRow
                    parentAttributeId={attribute.id}
                    triggerValue={b.key}
                    triggerLabel={b.label.replace(/^when\s+/i, '')}
                    templateId={templateId}
                    indentPx={indentPx + 14}
                    onCreated={(newId) => { onRefresh(); onSelect(newId) }}
                  />
                </ul>
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}

/** Inline "+ Add sub-field shown when X is chosen" row beneath each choice. */
function AddSubFieldRow({
  parentAttributeId,
  triggerValue,
  triggerLabel,
  templateId,
  indentPx,
  onCreated,
}: {
  parentAttributeId: string
  triggerValue: string
  triggerLabel: string
  templateId: string
  indentPx: number
  onCreated: (newId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<AttrType>('select')
  const [busy, setBusy] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Name is required'); return }
    if (!templateId) { toast.error('No template loaded'); return }
    setBusy(true)
    const res = await createSubAttribute({
      template_id: templateId,
      name,
      type,
      trigger_attribute_id: parentAttributeId,
      trigger_value: triggerValue,
    })
    setBusy(false)
    if (!res.success) { toast.error(res.error); return }
    toast.success('Sub-field added')
    setName('')
    setOpen(false)
    onCreated(res.data.id)
  }

  if (!open) {
    return (
      <li>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group inline-flex max-w-full items-start gap-1.5 rounded-md py-1.5 pr-2 text-left text-[12.5px] leading-snug text-text-tertiary transition-colors hover:text-text-primary"
          style={{ paddingLeft: 12 + indentPx + 14 }}
        >
          <Plus aria-hidden weight="bold" className="mt-px h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0">Add sub-field shown when {triggerLabel} is chosen</span>
        </button>
      </li>
    )
  }

  return (
    <li>
      <div
        className="my-1 rounded-md bg-bg-overlay p-3"
        style={{ marginLeft: 12 + indentPx + 14, marginRight: 8 }}
      >
        <div className="mb-2.5 text-[12.5px] leading-snug text-text-tertiary">
          <span className="font-semibold text-text-primary">New Sub-Field</span> — appears when “{triggerLabel}” is chosen
        </div>
        <div className="space-y-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Rarity"
            aria-label="Sub-field name"
            className={cn(accountInputCls, 'h-10 bg-bg-overlay-2 py-0')}
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AttrType)}
            aria-label="Sub-field type"
            className={cn(accountInputCls, 'h-10 cursor-pointer bg-bg-overlay-2 py-0 [&>option]:bg-bg-raised')}
          >
            {TYPE_ORDER.map((t) => (
              <option key={t} value={t}>{TYPE_META[t].label}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={busy || !name.trim()}
              className={cn(adminBtn.primary, 'min-w-0 flex-1 px-3')}
            >
              {busy
                ? <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
                : <Plus aria-hidden weight="bold" className="h-4 w-4" />}
              Create Sub-Field
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setName('') }}
              aria-label="Cancel"
              title="Cancel"
              className={cn(adminBtn.secondary, 'w-10 shrink-0 px-0')}
            >
              <X aria-hidden weight="bold" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </li>
  )
}

// ─── Attribute detail (right pane) ────────────────────────────────────────────

function AttributeDetail({
  attribute,
  siblings,
  onChange,
}: {
  attribute: BuilderAttribute
  siblings: BuilderAttribute[]
  onChange: () => void
}) {
  const [name, setName] = useState(attribute.name)
  const [slug, setSlug] = useState(attribute.slug)
  const [description, setDescription] = useState(attribute.description ?? '')
  const [type, setType] = useState<AttrType>(attribute.type)
  const [isRequired, setIsRequired] = useState(attribute.is_required)
  const [placeholder, setPlaceholder] = useState(attribute.placeholder ?? '')
  const [helpText, setHelpText] = useState(attribute.help_text ?? '')
  const [minValue, setMinValue] = useState<string>(attribute.min_value?.toString() ?? '')
  const [maxValue, setMaxValue] = useState<string>(attribute.max_value?.toString() ?? '')
  const [maxLength, setMaxLength] = useState<string>(attribute.max_length?.toString() ?? '')
  const [facetIndexed, setFacetIndexed] = useState(attribute.facet_indexed)
  const [saving, setSaving] = useState(false)

  const supportsOptions = TYPE_META[type].supportsOptions
  const isNumeric = type === 'number'
  const isTextish = type === 'text' || type === 'textarea'

  const dirty =
    name !== attribute.name ||
    slug !== attribute.slug ||
    (description || '') !== (attribute.description ?? '') ||
    type !== attribute.type ||
    isRequired !== attribute.is_required ||
    (placeholder || '') !== (attribute.placeholder ?? '') ||
    (helpText || '') !== (attribute.help_text ?? '') ||
    (minValue || '') !== (attribute.min_value?.toString() ?? '') ||
    (maxValue || '') !== (attribute.max_value?.toString() ?? '') ||
    (maxLength || '') !== (attribute.max_length?.toString() ?? '') ||
    facetIndexed !== attribute.facet_indexed

  const handleSave = async () => {
    setSaving(true)
    const res = await updateAttribute({
      id: attribute.id,
      name,
      slug,
      description,
      type,
      is_required: isRequired,
      placeholder,
      help_text: helpText,
      min_value: minValue === '' ? null : parseFloat(minValue),
      max_value: maxValue === '' ? null : parseFloat(maxValue),
      max_length: maxLength === '' ? null : parseInt(maxLength, 10),
      facet_indexed: facetIndexed,
    })
    setSaving(false)
    if (!res.success) { toast.error(res.error); return }
    toast.success('Field saved')
    onChange()
  }

  return (
    <div className="min-w-0 space-y-4">
      {/* ── Step-by-step explainer ── */}
      <section className="rounded-lg bg-bg-raised p-4 sm:p-5">
        <h2 className="mb-2 text-[14px] font-semibold text-text-primary">
          Editing a Field
        </h2>
        <ol className="space-y-1.5 text-[13px] leading-relaxed text-text-secondary">
          <li><span className="font-semibold text-text-primary">1.</span> Set a <span className="text-text-primary">Name</span> and pick a <span className="text-text-primary">Type</span>.</li>
          {supportsOptions && (
            <li><span className="font-semibold text-text-primary">2.</span> Add the <span className="text-text-primary">Choices</span> below (e.g. Pet, Egg, Cash).</li>
          )}
          <li>
            <span className="font-semibold text-text-primary">{supportsOptions ? '3.' : '2.'}</span>{' '}
            {supportsOptions
              ? <>Optional — back in the tree, click &quot;+ Add sub-field shown when <em>X</em> is chosen&quot; to add a field that only appears for that choice.</>
              : <>Use <span className="text-text-primary">Advanced</span> below for placeholder, help text, and validation.</>}
          </li>
        </ol>
      </section>

      {/* ── Essentials ── */}
      <section className="rounded-lg bg-bg-raised p-4 sm:p-5">
        <PanelHead
          title="Field"
          className="items-center"
          aside={
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving}
              className={dirty ? adminBtnSm.primary : adminBtnSm.secondary}
            >
              {saving
                ? <CircleNotch aria-hidden weight="bold" className="h-3.5 w-3.5 animate-spin" />
                : <FloppyDisk aria-hidden weight="bold" className="h-3.5 w-3.5" />}
              {dirty ? 'Save' : 'Saved'}
            </button>
          }
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name" required className="sm:col-span-2">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Type">
            <select value={type} onChange={(e) => setType(e.target.value as AttrType)} className={selectCls}>
              {TYPE_ORDER.map((t) => (
                <option key={t} value={t}>{TYPE_META[t].label}</option>
              ))}
            </select>
          </Field>
          <ToggleField label="Required" hint="Seller must fill in" value={isRequired} onChange={setIsRequired} />

          {isNumeric && (
            <>
              <Field label="Min Value">
                <input type="number" value={minValue} onChange={(e) => setMinValue(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Max Value">
                <input type="number" value={maxValue} onChange={(e) => setMaxValue(e.target.value)} className={inputCls} />
              </Field>
            </>
          )}
          {isTextish && (
            <Field label="Max Length" className="sm:col-span-2">
              <input type="number" value={maxLength} onChange={(e) => setMaxLength(e.target.value)} className={inputCls} />
            </Field>
          )}
        </div>
      </section>

      {/* ── Choices (visible right under Type, before Advanced) ── */}
      {supportsOptions && (
        <OptionsEditor attribute={attribute} onChange={onChange} />
      )}

      {/* ── Advanced (collapsed by default) ── */}
      <AdvancedFieldSettings
        slug={slug} setSlug={setSlug}
        placeholder={placeholder} setPlaceholder={setPlaceholder}
        helpText={helpText} setHelpText={setHelpText}
        description={description} setDescription={setDescription}
        facetIndexed={facetIndexed} setFacetIndexed={setFacetIndexed}
      />

      <RulesEditor attribute={attribute} siblings={siblings} onChange={onChange} />
    </div>
  )
}

// ─── Advanced settings (collapsed by default) ────────────────────────────────

function AdvancedFieldSettings({
  slug, setSlug,
  placeholder, setPlaceholder,
  helpText, setHelpText,
  description, setDescription,
  facetIndexed, setFacetIndexed,
}: {
  slug: string;            setSlug: (s: string) => void
  placeholder: string;     setPlaceholder: (s: string) => void
  helpText: string;        setHelpText: (s: string) => void
  description: string;     setDescription: (s: string) => void
  facetIndexed: boolean;   setFacetIndexed: (v: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <section className="rounded-lg bg-bg-raised">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center justify-between gap-3 rounded-lg p-4 text-left transition-colors hover:bg-white/[0.02] sm:px-5',
          open && 'rounded-b-none',
        )}
      >
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-text-primary">Advanced</div>
          <div className="mt-0.5 text-[12.5px] leading-relaxed text-text-tertiary">
            Slug, placeholder, help text, description, search
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-text-secondary">
          {open ? 'Hide' : 'Show'}
          <CaretDown
            aria-hidden
            weight="bold"
            className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')}
          />
        </span>
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-4 border-t border-white/[0.06] p-4 sm:grid-cols-2 sm:p-5">
          <Field label="Slug" hint="Used in URLs · lowercase, dashes only" className="sm:col-span-2">
            <input value={slug} onChange={(e) => setSlug(e.target.value)} className={cn(inputCls, 'font-mono sm:text-[13px]')} />
          </Field>
          <Field label="Placeholder" hint="Grey hint inside the input" className="sm:col-span-2">
            <input value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Help Text" hint="Small explainer next to the field label" className="sm:col-span-2">
            <textarea value={helpText} onChange={(e) => setHelpText(e.target.value)} rows={2} className={textareaCls} />
          </Field>
          <Field label="Description" hint="Admin-only note · sellers don't see this" className="sm:col-span-2">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={textareaCls} />
          </Field>
          <ToggleField
            label="Facet Indexed"
            hint="Future · include this field in search filters"
            value={facetIndexed}
            onChange={setFacetIndexed}
          />
        </div>
      )}
    </section>
  )
}

// ─── Options editor ──────────────────────────────────────────────────────────

function OptionsEditor({ attribute, onChange }: { attribute: BuilderAttribute; onChange: () => void }) {
  const [newLabel, setNewLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [localOptions, setLocalOptions] = useState<BuilderOption[]>(attribute.options)
  // V15 — Bulk-add state.
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)
  // V15b — Bulk-delete state.
  const [purging, setPurging] = useState(false)

  // Sync local copy when the server data changes (refresh after mutation)
  useEffect(() => { setLocalOptions(attribute.options) }, [attribute.options])

  const handleAdd = async () => {
    if (!newLabel.trim()) return
    setBusy(true)
    const res = await createOption({
      attribute_id: attribute.id,
      label: newLabel,
      sort_order: attribute.options.length,
    })
    setBusy(false)
    if (!res.success) { toast.error(res.error); return }
    setNewLabel('')
    onChange()
  }

  // V15 — Submit the pasted list to the bulk action. Closes the dialog
  // on success, surfaces created/skipped counts via toast.
  const handleBulk = async () => {
    if (!bulkText.trim()) return
    setBulkBusy(true)
    const res = await bulkCreateOptions({
      attribute_id: attribute.id,
      labels: bulkText,
      skipDuplicates: true,
    })
    setBulkBusy(false)
    if (!res.success) { toast.error(res.error); return }
    const { created, skipped } = res.data
    if (created === 0 && skipped === 0) {
      toast.message('No valid choices found in the pasted text')
    } else {
      toast.success(
        `Added ${created} choice${created === 1 ? '' : 's'}${skipped > 0 ? ` · ${skipped} duplicate${skipped === 1 ? '' : 's'} skipped` : ''}`,
      )
    }
    setBulkText('')
    setBulkOpen(false)
    onChange()
  }

  // V15b — Wipe every choice on this attribute. Confirms first to avoid
  // catastrophic clicks; used to recover from a wrong-attribute paste.
  const handleDeleteAll = async () => {
    if (localOptions.length === 0) return
    const ok = window.confirm(
      `Delete all ${localOptions.length} choices on "${attribute.name || attribute.slug}"?\n\nThis can't be undone.`,
    )
    if (!ok) return
    setPurging(true)
    const res = await bulkDeleteOptions({ attribute_id: attribute.id })
    setPurging(false)
    if (!res.success) { toast.error(res.error); return }
    toast.success(`Removed ${res.data.deleted} choice${res.data.deleted === 1 ? '' : 's'}`)
    onChange()
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = localOptions.findIndex((o) => o.id === active.id)
    const newIdx = localOptions.findIndex((o) => o.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const next = arrayMove(localOptions, oldIdx, newIdx)
    setLocalOptions(next)
    const res = await reorderOptions(next.map((o) => o.id))
    if (!res.success) toast.error(res.error)
    onChange()
  }

  return (
    <section className="rounded-lg bg-bg-raised p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-text-primary">
          Choices{' '}
          <span className="ml-0.5 text-[13px] font-medium tabular-nums text-text-tertiary">{localOptions.length}</span>
        </h2>
        {/* V15 — Bulk add. Opens an inline panel below where the admin
            pastes a newline- or comma-separated list. Idempotent — pasting
            again only adds new rows. Designed for onboarding large
            taxonomies (Steal-a-Brainrot secrets, etc). */}
        <div className="flex items-center gap-1.5">
          {localOptions.length > 0 && (
            <button
              type="button"
              onClick={handleDeleteAll}
              disabled={purging}
              title="Remove every choice on this attribute"
              className={adminBtnSm.danger}
            >
              {purging
                ? <CircleNotch aria-hidden weight="bold" className="h-3.5 w-3.5 animate-spin" />
                : <Trash aria-hidden weight="bold" className="h-3.5 w-3.5" />}
              Delete All
            </button>
          )}
          <button
            type="button"
            onClick={() => setBulkOpen((v) => !v)}
            aria-expanded={bulkOpen}
            className={cn(adminBtnSm.secondary, bulkOpen && 'bg-white/[0.12]')}
          >
            <ClipboardText aria-hidden weight="bold" className="h-3.5 w-3.5" />
            {bulkOpen ? 'Close Bulk Add' : 'Bulk Add'}
          </button>
        </div>
      </div>

      {/* Bulk-add panel */}
      {bulkOpen && (
        <div className="mb-4 space-y-3 rounded-md bg-bg-overlay p-3 sm:p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <label className="text-[13px] font-medium text-text-secondary">
              Paste Choices — one per line or comma-separated
            </label>
            <span className="text-[12px] tabular-nums text-text-tertiary">
              {bulkText.split(/[\n,]+/g).filter((s) => s.trim()).length} detected
            </span>
          </div>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={'Garama and Madundung\nLa Vacca Saturno Saturnita\nTralalero Tralala\n…'}
            rows={8}
            aria-label="Paste choices"
            className={cn(accountInputCls, 'resize-y bg-bg-overlay-2')}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[12px] leading-relaxed text-text-tertiary">
              Duplicates and wiki noise (File:/User:/Category:/(Disambiguation)) are skipped automatically.
            </span>
            <div className="flex shrink-0 items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setBulkText('')}
                disabled={bulkBusy}
                className={adminBtn.secondary}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleBulk}
                disabled={bulkBusy || !bulkText.trim()}
                className={adminBtn.primary}
              >
                {bulkBusy
                  ? <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
                  : <Plus aria-hidden weight="bold" className="h-4 w-4" />}
                Add All
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {localOptions.length === 0 ? (
          <p className="rounded-md bg-bg-overlay px-3.5 py-4 text-center text-[13px] text-text-tertiary">
            No choices yet — add one below.
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={localOptions.map((o) => o.id)} strategy={verticalListSortingStrategy}>
              {localOptions.map((opt) => (
                <SortableOptionRow
                  key={opt.id}
                  option={opt}
                  parentType={attribute.type}
                  onChange={onChange}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}

        <div className="flex gap-2 pt-2">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Add a choice (e.g. Pet, Egg, Cash)…"
            aria-label="New choice"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
            className={cn(inputCls, 'min-w-0 flex-1')}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={busy || !newLabel.trim()}
            className={cn(adminBtn.primary, 'shrink-0 px-3.5')}
          >
            {busy
              ? <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
              : <Plus aria-hidden weight="bold" className="h-4 w-4" />}
            Add Choice
          </button>
        </div>
      </div>
    </section>
  )
}

function SortableOptionRow({
  option, parentType, onChange,
}: {
  option: BuilderOption
  parentType: AttrType
  onChange: () => void
}) {
  const { attributes: dragAttrs, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: option.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('flex items-stretch gap-1', isDragging && 'relative z-10 opacity-60')}
    >
      <button
        type="button"
        {...dragAttrs}
        {...listeners}
        aria-label="Drag to reorder"
        className="grid w-8 shrink-0 cursor-grab touch-none place-items-center rounded-md text-text-tertiary transition-colors hover:bg-white/[0.06] hover:text-text-primary active:cursor-grabbing"
      >
        <DotsSixVertical aria-hidden weight="bold" className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <OptionRow option={option} parentType={parentType} onChange={onChange} />
      </div>
    </div>
  )
}

function OptionRow({
  option,
  parentType,
  onChange,
}: {
  option: BuilderOption
  parentType: AttrType
  onChange: () => void
}) {
  const [label, setLabel] = useState(option.label)
  const [value, setValue] = useState(option.value)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const dirty = label !== option.label || value !== option.value
  const showIcon = parentType === 'image_select'

  const handleSave = async () => {
    setSaving(true)
    const res = await updateOption({ id: option.id, label, value })
    setSaving(false)
    if (!res.success) { toast.error(res.error); return }
    onChange()
  }

  const handleDelete = async () => {
    if (!confirm('Delete this choice?')) return
    const res = await deleteOption(option.id)
    if (!res.success) { toast.error(res.error); return }
    onChange()
  }

  const handleIconUpload = async (file: File) => {
    if (file.size > 1_048_576) { toast.error('Icon must be 1 MB or smaller'); return }
    setUploading(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload  = () => resolve(reader.result as string)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
      const res = await uploadOptionIcon(option.id, {
        name: file.name, type: file.type, size: file.size, base64,
      })
      if (!res.success) { toast.error(res.error); return }
      onChange()
    } finally {
      setUploading(false)
    }
  }

  const handleIconClear = async () => {
    setUploading(true)
    const res = await updateOption({ id: option.id, icon_url: null as any })
    setUploading(false)
    if (!res.success) { toast.error(res.error); return }
    onChange()
  }

  return (
    <div className={cn(
      'grid items-center gap-2 rounded-md bg-bg-overlay p-2',
      showIcon
        ? 'grid-cols-[36px_minmax(0,1fr)_auto] sm:grid-cols-[36px_minmax(0,1fr)_140px_116px]'
        : 'grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_140px_76px]'
    )}>
      {showIcon && (
        <label
          title="Upload icon"
          className="relative grid h-9 w-9 cursor-pointer place-items-center overflow-hidden rounded-md bg-bg-overlay-2 transition-colors hover:bg-white/[0.10]"
        >
          {option.icon_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={option.icon_url} alt="" className="h-full w-full object-cover" />
          ) : uploading ? (
            <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin text-text-secondary" />
          ) : (
            <ImageIcon aria-hidden weight="bold" className="h-4 w-4 text-text-tertiary" />
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleIconUpload(f); e.currentTarget.value = '' }}
            disabled={uploading}
            className="hidden"
          />
        </label>
      )}
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        aria-label="Choice label"
        className={cn(rowInputCls, 'col-span-2 sm:col-span-1')}
      />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="stored value"
        aria-label="Stored value"
        className={cn(rowInputCls, 'font-mono text-text-secondary sm:text-[12.5px]', showIcon && 'col-span-2 sm:col-span-1')}
      />
      <div className="flex justify-end gap-1">
        {dirty && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-lime text-text-inverse transition-colors hover:bg-lime-hover disabled:opacity-50"
            title="Save"
            aria-label="Save choice"
          >
            {saving
              ? <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
              : <FloppyDisk aria-hidden weight="bold" className="h-4 w-4" />}
          </button>
        )}
        {showIcon && option.icon_url && (
          <button
            type="button"
            onClick={handleIconClear}
            disabled={uploading}
            className={iconBtnCls}
            title="Clear icon"
            aria-label="Clear icon"
          >
            <X aria-hidden weight="bold" className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={handleDelete}
          className={iconBtnDangerCls}
          title="Delete choice"
          aria-label="Delete choice"
        >
          <Trash aria-hidden weight="bold" className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Rules editor ────────────────────────────────────────────────────────────

function RulesEditor({
  attribute,
  siblings,
  onChange,
}: {
  attribute: BuilderAttribute
  siblings: BuilderAttribute[]
  onChange: () => void
}) {
  const triggerableSiblings = siblings.filter((s) => TYPE_META[s.type].supportsOptions || s.type === 'boolean')

  const [adding, setAdding] = useState(false)
  const [triggerId, setTriggerId] = useState<string>(triggerableSiblings[0]?.id ?? '')
  const [op, setOp] = useState<'equals' | 'not_equals' | 'in' | 'not_in'>('equals')
  const [vals, setVals] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const triggerAttr = useMemo(() => siblings.find((s) => s.id === triggerId) ?? null, [siblings, triggerId])

  const handleAdd = async () => {
    if (!triggerAttr) { toast.error('Pick an attribute to watch'); return }
    if (vals.length === 0) { toast.error('Pick at least one value'); return }
    setBusy(true)
    const res = await saveRule({
      attribute_id: attribute.id,
      trigger_attribute_id: triggerAttr.id,
      operator: op,
      trigger_values: vals,
    })
    setBusy(false)
    if (!res.success) { toast.error(res.error); return }
    setVals([])
    setAdding(false)
    onChange()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this sub-field rule?')) return
    const res = await deleteRule(id)
    if (!res.success) { toast.error(res.error); return }
    onChange()
  }

  return (
    <section className="rounded-lg bg-bg-raised p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <GitBranch aria-hidden weight="bold" className="h-4 w-4 shrink-0 text-text-tertiary" />
          <h2 className="text-[15px] font-semibold text-text-primary">When This Field Is Shown</h2>
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11.5px] font-semibold text-text-secondary">
            Advanced
          </span>
        </div>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          disabled={triggerableSiblings.length === 0}
          aria-expanded={adding}
          className={adminBtnSm.secondary}
          title={triggerableSiblings.length === 0 ? 'Need at least one dropdown / yes-no field above to drive a rule' : ''}
        >
          <Plus aria-hidden weight="bold" className="h-3.5 w-3.5" />
          Add Rule
        </button>
      </div>
      <div className="space-y-2">
        {attribute.rules.length === 0 && !adding ? (
          <p className="rounded-md bg-bg-overlay px-3.5 py-4 text-center text-[13px] leading-relaxed text-text-tertiary">
            This field is always shown. Tip: easier way to make a sub-field is via the
            &quot;+ Add sub-field shown when X is chosen&quot; link in the tree on the left.
          </p>
        ) : (
          attribute.rules.map((r) => {
            const trig = siblings.find((s) => s.id === r.trigger_attribute_id)
            return (
              <div key={r.id} className="flex items-start justify-between gap-2 rounded-md bg-bg-overlay py-1.5 pl-3.5 pr-1.5 text-[13px]">
                <div className="min-w-0 break-words py-1.5 leading-relaxed text-text-secondary">
                  Show when{' '}
                  <span className="font-semibold text-text-primary">{trig?.name ?? '?'}</span>{' '}
                  <span className="font-mono text-[12px] text-text-tertiary">{r.operator}</span>{' '}
                  {r.trigger_values.map((v, i) => {
                    const label = trig?.options.find((o) => o.value === v)?.label ?? v
                    return (
                      <span key={i} className="ml-1 inline-flex rounded-full bg-white/[0.08] px-2 py-0.5 text-[11.5px] font-semibold text-text-primary">
                        {label}
                      </span>
                    )
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(r.id)}
                  className={iconBtnDangerCls}
                  title="Delete rule"
                  aria-label="Delete rule"
                >
                  <Trash aria-hidden weight="bold" className="h-4 w-4" />
                </button>
              </div>
            )
          })
        )}

        {adding && (
          <div className="space-y-3 rounded-md bg-bg-overlay p-3 sm:p-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_150px]">
              <select
                value={triggerId}
                onChange={(e) => { setTriggerId(e.target.value); setVals([]) }}
                aria-label="Field to watch"
                className={cn(selectCls, 'bg-bg-overlay-2')}
              >
                {triggerableSiblings.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({TYPE_META[s.type].label})</option>
                ))}
              </select>
              <select value={op} onChange={(e) => setOp(e.target.value as any)} aria-label="Operator" className={cn(selectCls, 'bg-bg-overlay-2')}>
                <option value="equals">Equals</option>
                <option value="not_equals">Not Equals</option>
                <option value="in">In</option>
                <option value="not_in">Not In</option>
              </select>
            </div>

            {/* Value picker */}
            <div className="space-y-1.5">
              <div className="text-[12px] font-medium text-text-tertiary">Values</div>
              {triggerAttr?.type === 'boolean' ? (
                <div className="flex gap-1.5">
                  {['true', 'false'].map((v) => {
                    const on = vals.includes(v)
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setVals((cur) => on ? cur.filter((x) => x !== v) : [...cur, v])}
                        aria-pressed={on}
                        className={chipCls(on)}
                      >
                        {v}
                      </button>
                    )
                  })}
                </div>
              ) : (triggerAttr?.options ?? []).length === 0 ? (
                <p className="flex items-start gap-2 rounded-md bg-warning-bg px-3.5 py-2.5 text-[13px] text-text-secondary">
                  <WarningCircle aria-hidden weight="bold" className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  This attribute has no options yet — add some first.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {triggerAttr!.options.map((opt) => {
                    const on = vals.includes(opt.value)
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setVals((cur) => on ? cur.filter((x) => x !== opt.value) : [...cur, opt.value])}
                        aria-pressed={on}
                        className={chipCls(on)}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => { setAdding(false); setVals([]) }}
                className={adminBtn.secondary}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={busy || vals.length === 0}
                className={adminBtn.primary}
              >
                {busy
                  ? <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
                  : <Plus aria-hidden weight="bold" className="h-4 w-4" />}
                Save Rule
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

// ─── Live preview ────────────────────────────────────────────────────────────

function LivePreview({ attributes }: { attributes: BuilderAttribute[] }) {
  const [values, setValues] = useState<Record<string, unknown>>({})

  // V15c — Build a child→parent index once per render so visibility
  // checks (and cascade resets) walk the rule tree without quadratic
  // searches. `byId` resolves trigger ids to attribute objects.
  const byId = useMemo(() => {
    const m = new Map<string, BuilderAttribute>()
    for (const a of attributes) m.set(a.id, a)
    return m
  }, [attributes])

  // Pure visibility check — mirrors isAttributeVisible in new-schema.ts.
  // V15c — Walks the full chain: an attribute is only visible if EVERY
  // ancestor is visible AND the local rule passes. Stops a stale value
  // on a now-hidden ancestor from keeping a descendant on screen.
  const isVisible = (attr: BuilderAttribute, seen = new Set<string>()): boolean => {
    if (seen.has(attr.id)) return true // cycle guard — treat as visible
    seen.add(attr.id)
    if (attr.rules.length === 0) return true
    for (const r of attr.rules) {
      const parent = byId.get(r.trigger_attribute_id)
      // If a parent doesn't exist or isn't itself visible, this attr can't be.
      if (parent && !isVisible(parent, seen)) return false
      const cur = values[r.trigger_attribute_id]
      const trig = r.trigger_values
      let pass = false
      switch (r.operator) {
        case 'equals':     pass = trig.length > 0 && cur === trig[0]; break
        case 'not_equals': pass = trig.length > 0 && cur !== trig[0]; break
        case 'in':         pass = trig.includes(cur as string); break
        case 'not_in':     pass = !trig.includes(cur as string); break
      }
      if (!pass) return false
    }
    return true
  }

  // V15c — When a parent value changes, wipe every descendant's stored
  // value so the next time the user flips back they start from a clean
  // slate (no stale "Antonio" lurking under a hidden Rarity).
  const collectDescendants = (parentId: string): Set<string> => {
    const out = new Set<string>()
    let frontier = new Set<string>([parentId])
    let safety = 0
    while (frontier.size > 0 && safety++ < 32) {
      const next = new Set<string>()
      for (const a of attributes) {
        if (out.has(a.id)) continue
        for (const r of a.rules) {
          if (frontier.has(r.trigger_attribute_id)) {
            out.add(a.id)
            next.add(a.id)
            break
          }
        }
      }
      frontier = next
    }
    return out
  }

  const set = (id: string, v: unknown) =>
    setValues((p) => {
      const next: Record<string, unknown> = { ...p, [id]: v }
      // Cascade-reset descendants. Safe to clear even if they happen to
      // pass the new rule — the user re-picks intentionally.
      collectDescendants(id).forEach((childId) => {
        delete next[childId]
      })
      return next
    })

  return (
    <section className="rounded-lg bg-bg-raised p-4 sm:p-5">
      <PanelHead
        title="Live Preview"
        subtitle="Try selecting values to see conditional fields appear"
      />

      <div className="space-y-4">
        {attributes.length === 0 ? (
          <p className="rounded-md bg-bg-overlay px-3.5 py-6 text-center text-[13px] text-text-tertiary">No attributes yet.</p>
        ) : (
          attributes.map((a) => {
            if (!isVisible(a)) return null
            return (
              <div key={a.id} className="min-w-0">
                <label className="mb-1.5 block text-[13px] font-medium text-text-secondary">
                  {a.name}
                  {a.is_required && <span className="ml-1 text-error">*</span>}
                  {a.help_text && (
                    <span className="ml-2 text-[12px] font-normal text-text-tertiary">{a.help_text}</span>
                  )}
                </label>
                {a.type === 'text' && (
                  <input
                    value={(values[a.id] as string) ?? ''}
                    onChange={(e) => set(a.id, e.target.value)}
                    placeholder={a.placeholder ?? ''}
                    className={inputCls}
                  />
                )}
                {a.type === 'number' && (
                  <input
                    type="number"
                    value={(values[a.id] as string) ?? ''}
                    onChange={(e) => set(a.id, e.target.value)}
                    placeholder={a.placeholder ?? ''}
                    min={a.min_value ?? undefined}
                    max={a.max_value ?? undefined}
                    className={inputCls}
                  />
                )}
                {a.type === 'textarea' && (
                  <textarea
                    value={(values[a.id] as string) ?? ''}
                    onChange={(e) => set(a.id, e.target.value)}
                    placeholder={a.placeholder ?? ''}
                    rows={3}
                    className={textareaCls}
                  />
                )}
                {a.type === 'boolean' && (
                  <button
                    type="button"
                    onClick={() => set(a.id, values[a.id] === 'true' ? 'false' : 'true')}
                    aria-pressed={values[a.id] === 'true'}
                    className={cn(
                      'inline-flex h-10 min-w-[72px] items-center justify-center gap-2 rounded-md px-4 text-[13px] font-semibold transition-colors',
                      values[a.id] === 'true' ? 'bg-success-bg text-success' : 'bg-bg-overlay text-text-secondary hover:text-text-primary'
                    )}
                  >
                    {values[a.id] === 'true' ? 'Yes' : 'No'}
                  </button>
                )}
                {a.type === 'select' && (
                  <select
                    value={(values[a.id] as string) ?? ''}
                    onChange={(e) => set(a.id, e.target.value)}
                    className={selectCls}
                  >
                    <option value="">Select…</option>
                    {a.options.map((o) => (
                      <option key={o.id} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                )}
                {a.type === 'image_select' && (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {a.options.length === 0 ? (
                      <p className="col-span-full text-[12.5px] text-text-tertiary">No options yet.</p>
                    ) : a.options.map((o) => {
                      const on = values[a.id] === o.value
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => set(a.id, on ? '' : o.value)}
                          aria-pressed={on}
                          className={cn(
                            'flex min-w-0 flex-col items-center gap-1 rounded-md p-1.5 text-[11.5px] font-medium transition-colors sm:p-2',
                            on
                              ? 'bg-lime-tint-bg text-lime-text'
                              : 'bg-bg-overlay text-text-secondary hover:bg-bg-overlay-2 hover:text-text-primary'
                          )}
                        >
                          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md bg-white/[0.05]">
                            {o.icon_url ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={o.icon_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <ImageIcon aria-hidden weight="bold" className="h-4 w-4 text-text-disabled" />
                            )}
                          </div>
                          <span className="line-clamp-1 max-w-full break-all">{o.label}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
                {a.type === 'multiselect' && (
                  <div className="flex flex-wrap gap-1.5">
                    {a.options.map((o) => {
                      const arr = Array.isArray(values[a.id]) ? (values[a.id] as string[]) : []
                      const on = arr.includes(o.value)
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => set(a.id, on ? arr.filter((x) => x !== o.value) : [...arr, o.value])}
                          aria-pressed={on}
                          className={chipCls(on)}
                        >
                          {o.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}

// ─── Small field primitives ──────────────────────────────────────────────────

/** Text / number input on a card (40px, flat, 16px on phones). */
const inputCls = cn(accountInputCls, 'h-10 py-0')
/** Native select on a card. */
const selectCls = cn(accountInputCls, 'h-10 cursor-pointer py-0 [&>option]:bg-bg-raised')
/** Textarea on a card. */
const textareaCls = cn(accountInputCls, 'resize-none')
/** Compact input inside a lighter inner row (choice label / stored value). */
const rowInputCls = cn(accountInputCls, 'h-9 min-w-0 bg-bg-overlay-2 px-2.5 py-0')

/** Icon-only button inside a row. */
const iconBtnCls =
  'grid h-9 w-9 shrink-0 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-white/[0.08] hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50'
const iconBtnDangerCls =
  'grid h-9 w-9 shrink-0 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-[color-mix(in_srgb,var(--color-error)_14%,transparent)] hover:text-error'

/** Toggle chip on a card (selected = lighter fill). */
const chipCls = (on: boolean) =>
  cn(
    'h-8 max-w-full truncate rounded-full px-3 text-[12.5px] font-medium transition-colors',
    on
      ? 'bg-white/[0.14] text-text-primary'
      : 'bg-white/[0.05] text-text-secondary hover:bg-white/[0.08] hover:text-text-primary'
  )

function Field({
  label, required, hint, children, className,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={cn('block min-w-0', className)}>
      <span className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-[13px] font-medium text-text-secondary">
          {label}
          {required && <span className="ml-1 text-error">*</span>}
        </span>
        {hint && <span className="text-[12px] text-text-tertiary">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

function ToggleField({
  label, hint, value, onChange,
}: {
  label: string
  hint?: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex min-w-0 cursor-pointer items-center justify-between gap-3 self-end rounded-md bg-bg-overlay px-3.5 py-2.5">
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-text-primary">{label}</span>
        {hint && <span className="block text-[12px] text-text-tertiary">{hint}</span>}
      </span>
      <Switch
        checked={value}
        onCheckedChange={() => onChange(!value)}
        aria-label={label}
      />
    </label>
  )
}
