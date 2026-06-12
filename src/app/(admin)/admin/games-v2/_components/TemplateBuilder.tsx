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
  ArrowLeft, Plus, Pencil, Trash2, Loader2,
  Sparkles, GitBranch, Hash, Type, ToggleLeft, List, AlignLeft, Image as ImageIcon,
  CheckSquare, AlertCircle, Save, X, GripVertical,
} from 'lucide-react'
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
import { GlassCard } from '@/components/ui/glass-card'
import {
  createAttribute, updateAttribute, deleteAttribute,
  createOption, updateOption, deleteOption, uploadOptionIcon, reorderOptions,
  saveRule, deleteRule, createSubAttribute,
  type AttrType,
  type BuilderAttribute,
  type BuilderOption,
  type BuilderRule,
  type BuilderState,
} from '@/lib/actions/admin-template-builder'

// ─── Icons per attribute type ────────────────────────────────────────────────

const TYPE_META: Record<AttrType, { label: string; icon: React.ComponentType<{ className?: string }>; supportsOptions: boolean }> = {
  text:         { label: 'Short text',  icon: Type,         supportsOptions: false },
  number:       { label: 'Number',      icon: Hash,         supportsOptions: false },
  textarea:     { label: 'Long text',   icon: AlignLeft,    supportsOptions: false },
  select:       { label: 'Dropdown',    icon: List,         supportsOptions: true },
  multiselect:  { label: 'Multi-select', icon: CheckSquare,  supportsOptions: true },
  boolean:      { label: 'Yes/No',      icon: ToggleLeft,   supportsOptions: false },
  image_select: { label: 'Image picker', icon: ImageIcon,    supportsOptions: true },
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
      <header className="space-y-2">
        <Link
          href={`/admin/games-v2/${state.header.game_id}/edit`}
          className="inline-flex items-center gap-1.5 text-xs text-text-tertiary transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to {state.header.game_name}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
                {state.header.game_name} <span className="text-text-tertiary">·</span>{' '}
                <span className="text-lime-text">{state.header.global_category_name}</span>
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-lime-tint-border bg-lime-tint-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-lime-text">
                <Sparkles className="h-3 w-3" />
                attribute template
              </span>
            </div>
            <p className="mt-1 text-sm text-text-secondary">
              Define the fields sellers fill in when listing in this category.
              Sub-fields appear only when another field has a specific value.
            </p>
          </div>
          {state.template && (
            <div className="text-[11px] text-text-tertiary">
              version {state.template.version} · {state.attributes.length} attributes
            </div>
          )}
        </div>
      </header>

      {/* ── Main grid ── */}
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
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
          <GlassCard intensity="light" rounded="2xl" className="flex items-center justify-center py-20">
            <div className="text-center">
              <Pencil className="mx-auto mb-3 h-6 w-6 text-text-disabled" />
              <p className="text-sm text-text-tertiary">Pick a field on the left to edit it, or add a new one.</p>
            </div>
          </GlassCard>
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
    <GlassCard intensity="light" rounded="2xl" className="p-0">
      {/* Header + explainer */}
      <div className="border-b border-border-subtle px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Fields</div>
          <button
            type="button"
            onClick={props.onAddTopLevel}
            className="inline-flex h-7 items-center gap-1 rounded-lg bg-text-primary px-2 text-[11px] font-semibold text-text-inverse hover:bg-lime-hover"
          >
            <Plus className="h-3 w-3" />
            Add field
          </button>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-text-tertiary">
          Fields are what sellers fill in. Add a top-level field, then for choice-type fields
          you can add <span className="text-text-secondary">sub-fields</span> that only appear when a
          specific choice is picked.
        </p>
      </div>

      {/* Inline "add top-level" form */}
      {props.addingTopLevel && (
        <div className="space-y-2 border-b border-border-subtle bg-bg-base px-4 py-3">
          <input
            value={props.draftName}
            onChange={(e) => props.setDraftName(e.target.value)}
            placeholder="e.g. Item Type"
            autoFocus
            className="h-9 w-full rounded-lg border border-border-default bg-bg-raised px-3 text-sm text-text-primary placeholder:text-text-disabled focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime-tint-bg"
          />
          <select
            value={props.draftType}
            onChange={(e) => props.setDraftType(e.target.value as AttrType)}
            className="h-9 w-full rounded-lg border border-border-default bg-bg-overlay px-2 text-xs text-text-primary focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime-tint-bg"
          >
            {TYPE_ORDER.map((t) => (
              <option key={t} value={t}>{TYPE_META[t].label}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={props.onCreateTopLevel}
              disabled={props.busy || !props.draftName.trim()}
              className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-lime px-2 text-xs font-semibold text-text-inverse hover:bg-lime-hover disabled:opacity-40"
            >
              {props.busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Create field
            </button>
            <button
              type="button"
              onClick={props.onCancelTopLevel}
              className="inline-flex h-8 items-center justify-center rounded-lg border border-border-default bg-bg-raised px-2 text-xs font-medium text-text-secondary hover:bg-bg-raised-hover"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      <div className="max-h-[70vh] overflow-y-auto py-2">
        {topLevel.length === 0 && !props.addingTopLevel ? (
          <div className="px-4 py-10 text-center text-xs text-text-tertiary">
            No fields yet. Click <span className="font-semibold text-text-secondary">Add field</span> to start —
            e.g. a <em>Dropdown</em> called "Item Type".
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
    </GlassCard>
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

  // padding-left per depth (12 px each)
  const indentPx = depth * 14

  return (
    <li>
      <div
        className={cn(
          'group flex items-center gap-2 rounded-md py-1.5 pr-2 transition-colors',
          selected ? 'bg-lime-tint-bg text-text-primary' : 'hover:bg-bg-raised text-text-secondary'
        )}
        style={{ paddingLeft: 12 + indentPx }}
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
        <button
          type="button"
          onClick={() => onSelect(attribute.id)}
          className="min-w-0 flex-1 truncate text-left text-sm"
        >
          <span className="font-medium">{attribute.name}</span>
          <span className="ml-2 text-[10px] text-text-tertiary">
            {TYPE_META[attribute.type].label}
            {attribute.is_required && <span className="ml-1 text-error">*</span>}
          </span>
        </button>
        <button
          type="button"
          onClick={() => onDelete(attribute.id)}
          className="rounded p-1 text-text-tertiary opacity-0 transition-opacity hover:bg-error-bg hover:text-error group-hover:opacity-100"
          title="Delete field"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* Sub-tree per choice */}
      {buckets.length > 0 && (
        <ul className="space-y-0.5">
          {buckets.map((b) => {
            const children = inner.get(b.key) ?? []
            return (
              <li key={b.key}>
                <div
                  className="flex items-center gap-1.5 py-0.5 text-[10px] uppercase tracking-wider text-text-disabled"
                  style={{ paddingLeft: 12 + indentPx + 14 }}
                >
                  {b.iconUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={b.iconUrl} alt="" className="h-3 w-3 rounded object-cover" />
                  ) : (
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-bg-overlay-2" />
                  )}
                  {b.label}
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
          className="group inline-flex items-center gap-1 py-0.5 text-[11px] text-text-tertiary hover:text-lime-text"
          style={{ paddingLeft: 12 + indentPx + 14 }}
        >
          <Plus className="h-3 w-3" />
          Add sub-field shown when {triggerLabel} is chosen
        </button>
      </li>
    )
  }

  return (
    <li>
      <div
        className="rounded-lg border border-lime-tint-border bg-lime/[0.06] p-2"
        style={{ marginLeft: 12 + indentPx + 14, marginRight: 8 }}
      >
        <div className="mb-1.5 text-[10px] uppercase tracking-wider text-lime-text">
          New sub-field — appears when “{triggerLabel}” is chosen
        </div>
        <div className="space-y-1.5">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Rarity"
            className="h-8 w-full rounded-md border border-border-default bg-bg-raised px-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime-tint-bg"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AttrType)}
            className="h-8 w-full rounded-md border border-border-default bg-bg-overlay px-2 text-xs text-text-primary focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime-tint-bg"
          >
            {TYPE_ORDER.map((t) => (
              <option key={t} value={t}>{TYPE_META[t].label}</option>
            ))}
          </select>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={handleCreate}
              disabled={busy || !name.trim()}
              className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-md bg-success px-2 text-[11px] font-semibold text-text-inverse hover:bg-success disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Create sub-field
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setName('') }}
              className="inline-flex h-7 items-center justify-center rounded-md border border-border-default bg-bg-raised px-2 text-[11px] text-text-secondary hover:bg-bg-raised-hover"
            >
              <X className="h-3 w-3" />
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
    <div className="space-y-4">
      {/* ── Step-by-step explainer ── */}
      <div className="rounded-2xl border border-lime-tint-border bg-lime-tint-bg p-4">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-lime-text">
          Editing a field
        </div>
        <ol className="space-y-1 text-xs text-text-secondary">
          <li><span className="font-semibold text-text-primary">1.</span> Set a <span className="text-text-primary">Name</span> and pick a <span className="text-text-primary">Type</span>.</li>
          {supportsOptions && (
            <li><span className="font-semibold text-text-primary">2.</span> Add the <span className="text-text-primary">Choices</span> below (e.g. Pet, Egg, Cash).</li>
          )}
          <li>
            <span className="font-semibold text-text-primary">{supportsOptions ? '3.' : '2.'}</span>{' '}
            {supportsOptions
              ? <>Optional — back in the tree, click "+ Add sub-field shown when <em>X</em> is chosen" to add a field that only appears for that choice.</>
              : <>Use <span className="text-text-primary">Advanced</span> below for placeholder, help text, and validation.</>}
          </li>
        </ol>
      </div>

      {/* ── Essentials ── */}
      <GlassCard intensity="light" rounded="2xl" className="p-0">
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Field</div>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors',
              dirty ? 'bg-lime text-text-inverse hover:bg-lime-hover' : 'bg-bg-raised text-text-disabled'
            )}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            {dirty ? 'Save' : 'Saved'}
          </button>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          <Field label="Name" required className="sm:col-span-2">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Type">
            <select value={type} onChange={(e) => setType(e.target.value as AttrType)} className={cn(inputCls, 'bg-bg-overlay')}>
              {TYPE_ORDER.map((t) => (
                <option key={t} value={t}>{TYPE_META[t].label}</option>
              ))}
            </select>
          </Field>
          <ToggleField label="Required" hint="seller must fill in" value={isRequired} onChange={setIsRequired} />

          {isNumeric && (
            <>
              <Field label="Min value">
                <input type="number" value={minValue} onChange={(e) => setMinValue(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Max value">
                <input type="number" value={maxValue} onChange={(e) => setMaxValue(e.target.value)} className={inputCls} />
              </Field>
            </>
          )}
          {isTextish && (
            <Field label="Max length" className="sm:col-span-2">
              <input type="number" value={maxLength} onChange={(e) => setMaxLength(e.target.value)} className={inputCls} />
            </Field>
          )}
        </div>
      </GlassCard>

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
    <GlassCard intensity="light" rounded="2xl" className="p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <div className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Advanced
          <span className="ml-2 text-[10px] font-normal normal-case tracking-normal text-text-disabled">
            slug, placeholder, help text, description, search
          </span>
        </div>
        <span className="text-xs text-text-tertiary">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div className="grid gap-3 border-t border-border-subtle p-5 sm:grid-cols-2">
          <Field label="Slug" hint="used in URLs · lowercase, dashes only" className="sm:col-span-2">
            <input value={slug} onChange={(e) => setSlug(e.target.value)} className={cn(inputCls, 'font-mono text-xs')} />
          </Field>
          <Field label="Placeholder" hint="grey hint inside the input" className="sm:col-span-2">
            <input value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Help text" hint="small explainer next to the field label" className="sm:col-span-2">
            <textarea value={helpText} onChange={(e) => setHelpText(e.target.value)} rows={2} className={cn(inputCls, 'h-auto py-2')} />
          </Field>
          <Field label="Description" hint="admin-only note · sellers don't see this" className="sm:col-span-2">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={cn(inputCls, 'h-auto py-2')} />
          </Field>
          <ToggleField
            label="Facet indexed"
            hint="future · include this field in search filters"
            value={facetIndexed}
            onChange={setFacetIndexed}
          />
        </div>
      )}
    </GlassCard>
  )
}

// ─── Options editor ──────────────────────────────────────────────────────────

function OptionsEditor({ attribute, onChange }: { attribute: BuilderAttribute; onChange: () => void }) {
  const [newLabel, setNewLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [localOptions, setLocalOptions] = useState<BuilderOption[]>(attribute.options)

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
    <GlassCard intensity="light" rounded="2xl" className="p-0">
      <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Choices <span className="text-text-disabled">({localOptions.length})</span>
        </div>
      </div>
      <div className="space-y-2 p-4">
        {localOptions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border-default bg-bg-base px-3 py-4 text-center text-xs text-text-tertiary">
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

        <div className="flex gap-2 pt-1">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Add a choice (e.g. Pet, Egg, Cash)…"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
            className="h-9 flex-1 rounded-lg border border-border-default bg-bg-raised px-3 text-sm text-text-primary placeholder:text-text-disabled focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime-tint-bg"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={busy || !newLabel.trim()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-lime px-3 text-xs font-semibold text-text-inverse hover:bg-lime-hover disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Add choice
          </button>
        </div>
      </div>
    </GlassCard>
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
      className={cn('flex items-stretch gap-1', isDragging && 'opacity-60')}
    >
      <button
        type="button"
        {...dragAttrs}
        {...listeners}
        aria-label="Drag to reorder"
        className="flex shrink-0 cursor-grab touch-none items-center justify-center rounded-md px-1 text-text-disabled hover:text-text-secondary active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <div className="flex-1">
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
      'grid items-center gap-2 rounded-lg border border-border-default bg-bg-base p-2',
      showIcon ? 'grid-cols-[36px_1fr_140px_120px]' : 'grid-cols-[1fr_140px_80px]'
    )}>
      {showIcon && (
        <label className="relative flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-border-default bg-bg-raised hover:bg-bg-raised-hover">
          {option.icon_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={option.icon_url} alt="" className="h-full w-full object-cover" />
          ) : uploading ? (
            <Loader2 className="h-4 w-4 animate-spin text-lime-text" />
          ) : (
            <ImageIcon className="h-4 w-4 text-text-tertiary" />
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
        className="h-8 rounded-md border border-border-default bg-bg-raised px-2 text-sm text-text-primary focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime-tint-bg"
      />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="stored value"
        className="h-8 rounded-md border border-border-default bg-bg-raised px-2 font-mono text-xs text-text-secondary focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime-tint-bg"
      />
      <div className="flex justify-end gap-1">
        {dirty && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-text-primary px-2 text-[11px] font-semibold text-text-inverse hover:bg-lime-hover disabled:opacity-50"
            title="Save"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          </button>
        )}
        {showIcon && option.icon_url && (
          <button
            type="button"
            onClick={handleIconClear}
            disabled={uploading}
            className="inline-flex h-7 items-center rounded-md px-1.5 text-text-tertiary hover:bg-bg-raised-hover hover:text-text-primary"
            title="Clear icon"
          >
            <X className="h-3 w-3" />
          </button>
        )}
        <button
          type="button"
          onClick={handleDelete}
          className="inline-flex h-7 items-center rounded-md px-1.5 text-text-tertiary hover:bg-error-bg hover:text-error"
          title="Delete choice"
        >
          <Trash2 className="h-3 w-3" />
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
    <GlassCard intensity="light" rounded="2xl" className="p-0">
      <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
          <GitBranch className="h-3.5 w-3.5" />
          When this field is shown
          <span className="ml-1 rounded-full bg-bg-raised-hover px-1.5 py-0.5 text-[9px] font-normal normal-case tracking-normal text-text-tertiary">
            advanced
          </span>
        </div>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          disabled={triggerableSiblings.length === 0}
          className="inline-flex h-7 items-center gap-1 rounded-lg bg-text-primary px-2 text-[11px] font-semibold text-text-inverse hover:bg-lime-hover disabled:opacity-40"
          title={triggerableSiblings.length === 0 ? 'Need at least one dropdown / yes-no field above to drive a rule' : ''}
        >
          <Plus className="h-3 w-3" />
          Add rule
        </button>
      </div>
      <div className="space-y-2 p-4">
        {attribute.rules.length === 0 && !adding ? (
          <p className="rounded-lg border border-dashed border-border-default bg-bg-base px-3 py-4 text-center text-xs text-text-tertiary">
            This field is always shown. Tip: easier way to make a sub-field is via the
            "+ Add sub-field shown when X is chosen" link in the tree on the left.
          </p>
        ) : (
          attribute.rules.map((r) => {
            const trig = siblings.find((s) => s.id === r.trigger_attribute_id)
            return (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-lime-tint-border bg-lime-tint-bg px-3 py-2 text-xs">
                <div className="text-text-secondary">
                  Show when{' '}
                  <span className="font-semibold text-text-primary">{trig?.name ?? '?'}</span>{' '}
                  <span className="font-mono text-lime-text">{r.operator}</span>{' '}
                  {r.trigger_values.map((v, i) => {
                    const label = trig?.options.find((o) => o.value === v)?.label ?? v
                    return (
                      <span key={i} className="ml-1 inline-flex rounded-md bg-bg-raised-hover px-1.5 py-0.5 text-[10px] text-text-primary">
                        {label}
                      </span>
                    )
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(r.id)}
                  className="rounded p-1 text-text-tertiary hover:bg-error-bg hover:text-error"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )
          })
        )}

        {adding && (
          <div className="space-y-2 rounded-lg border border-border-default bg-bg-base p-3">
            <div className="grid grid-cols-[1fr_120px] gap-2">
              <select
                value={triggerId}
                onChange={(e) => { setTriggerId(e.target.value); setVals([]) }}
                className={cn(inputCls, 'bg-bg-overlay h-9')}
              >
                {triggerableSiblings.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({TYPE_META[s.type].label})</option>
                ))}
              </select>
              <select value={op} onChange={(e) => setOp(e.target.value as any)} className={cn(inputCls, 'bg-bg-overlay h-9')}>
                <option value="equals">equals</option>
                <option value="not_equals">not equals</option>
                <option value="in">in</option>
                <option value="not_in">not in</option>
              </select>
            </div>

            {/* Value picker */}
            <div className="space-y-1">
              <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Values</div>
              {triggerAttr?.type === 'boolean' ? (
                <div className="flex gap-2">
                  {['true', 'false'].map((v) => {
                    const on = vals.includes(v)
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setVals((cur) => on ? cur.filter((x) => x !== v) : [...cur, v])}
                        className={cn(
                          'h-7 rounded-md border px-2 text-xs',
                          on ? 'border-lime-tint-border bg-lime-tint-bg text-lime-text' : 'border-border-default bg-bg-raised text-text-secondary'
                        )}
                      >
                        {v}
                      </button>
                    )
                  })}
                </div>
              ) : (triggerAttr?.options ?? []).length === 0 ? (
                <p className="text-[11px] text-warning">
                  <AlertCircle className="mr-1 inline h-3 w-3" />
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
                        className={cn(
                          'h-7 rounded-full border px-2.5 text-xs',
                          on ? 'border-lime-tint-border bg-lime-tint-bg text-lime-text' : 'border-border-default bg-bg-raised text-text-secondary hover:text-text-primary'
                        )}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setAdding(false); setVals([]) }}
                className="inline-flex h-7 items-center rounded-md border border-border-default bg-bg-raised px-2 text-[11px] text-text-secondary hover:bg-bg-raised-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={busy || vals.length === 0}
                className="inline-flex h-7 items-center gap-1 rounded-md bg-success px-2 text-[11px] font-semibold text-text-inverse hover:bg-success disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                Save rule
              </button>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  )
}

// ─── Live preview ────────────────────────────────────────────────────────────

function LivePreview({ attributes }: { attributes: BuilderAttribute[] }) {
  const [values, setValues] = useState<Record<string, unknown>>({})

  // Pure visibility check — mirrors isAttributeVisible in new-schema.ts.
  // Done client-side here for snappy preview without round-trips.
  const isVisible = (attr: BuilderAttribute): boolean => {
    if (attr.rules.length === 0) return true
    for (const r of attr.rules) {
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

  const set = (id: string, v: unknown) => setValues((p) => ({ ...p, [id]: v }))

  return (
    <GlassCard intensity="light" rounded="2xl" className="p-0">
      <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Live preview
        </div>
        <div className="text-[10px] text-text-tertiary">
          Try selecting values to see conditional fields appear
        </div>
      </div>

      <div className="space-y-4 p-5">
        {attributes.length === 0 ? (
          <p className="text-center text-xs text-text-tertiary">No attributes yet.</p>
        ) : (
          attributes.map((a) => {
            if (!isVisible(a)) return null
            return (
              <div key={a.id}>
                <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                  {a.name}
                  {a.is_required && <span className="ml-1 text-error">*</span>}
                  {a.help_text && (
                    <span className="ml-2 text-[10px] font-normal text-text-tertiary">{a.help_text}</span>
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
                    className={cn(inputCls, 'h-auto py-2')}
                  />
                )}
                {a.type === 'boolean' && (
                  <button
                    type="button"
                    onClick={() => set(a.id, values[a.id] === 'true' ? 'false' : 'true')}
                    className={cn(
                      'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm',
                      values[a.id] === 'true' ? 'border-success bg-success-bg text-success' : 'border-border-default bg-bg-raised text-text-secondary'
                    )}
                  >
                    {values[a.id] === 'true' ? 'Yes' : 'No'}
                  </button>
                )}
                {a.type === 'select' && (
                  <select
                    value={(values[a.id] as string) ?? ''}
                    onChange={(e) => set(a.id, e.target.value)}
                    className={cn(inputCls, 'bg-bg-overlay')}
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
                      <p className="col-span-full text-[11px] text-text-tertiary">No options yet.</p>
                    ) : a.options.map((o) => {
                      const on = values[a.id] === o.value
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => set(a.id, on ? '' : o.value)}
                          className={cn(
                            'flex flex-col items-center gap-1 rounded-lg border p-2 text-[10px] transition-colors',
                            on
                              ? 'border-lime bg-lime-tint-bg text-lime-text'
                              : 'border-border-default bg-bg-base text-text-secondary hover:bg-bg-raised'
                          )}
                        >
                          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md bg-bg-raised">
                            {o.icon_url ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={o.icon_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <ImageIcon className="h-4 w-4 text-text-disabled" />
                            )}
                          </div>
                          <span className="line-clamp-1">{o.label}</span>
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
                          className={cn(
                            'h-7 rounded-full border px-2.5 text-xs',
                            on ? 'border-lime-tint-border bg-lime-tint-bg text-lime-text' : 'border-border-default bg-bg-raised text-text-secondary'
                          )}
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
    </GlassCard>
  )
}

// ─── Small field primitives ──────────────────────────────────────────────────

const inputCls =
  'h-9 w-full rounded-lg border border-border-default bg-bg-raised px-3 text-sm text-text-primary placeholder:text-text-disabled focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime-tint-bg'

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
    <div className={className}>
      <div className="mb-1 flex items-baseline justify-between">
        <label className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          {label}
          {required && <span className="ml-1 text-error">*</span>}
        </label>
        {hint && <span className="text-[10px] text-text-disabled">{hint}</span>}
      </div>
      {children}
    </div>
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
    <label className="flex flex-1 items-center justify-between rounded-lg border border-border-default bg-bg-base px-3 py-2">
      <div>
        <div className="text-xs font-medium text-text-primary">{label}</div>
        {hint && <div className="text-[10px] text-text-tertiary">{hint}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={cn(
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
          value ? 'bg-lime' : 'bg-bg-raised'
        )}
        aria-pressed={value}
      >
        <span
          className={cn(
            'inline-block h-3 w-3 transform rounded-full bg-text-primary transition-transform',
            value ? 'translate-x-5' : 'translate-x-1'
          )}
        />
      </button>
    </label>
  )
}
