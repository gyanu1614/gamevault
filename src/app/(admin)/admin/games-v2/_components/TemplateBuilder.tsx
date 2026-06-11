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
  ArrowLeft, ChevronUp, ChevronDown, Plus, Pencil, Trash2, Loader2,
  Sparkles, GitBranch, Hash, Type, ToggleLeft, List, AlignLeft, Image as ImageIcon,
  CheckSquare, AlertCircle, Save, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/ui/glass-card'
import {
  createAttribute, updateAttribute, deleteAttribute, reorderAttributes,
  createOption, updateOption, deleteOption,
  saveRule, deleteRule,
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
    toast.success('Attribute added')
    refresh()
  }

  // ── Reorder ───────────────────────────────────────────────────────────────
  const move = async (id: string, dir: -1 | 1) => {
    const idx = state.attributes.findIndex((a) => a.id === id)
    if (idx < 0) return
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= state.attributes.length) return
    const reordered = [...state.attributes]
    ;[reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]]
    setState((s) => ({ ...s, attributes: reordered }))
    const res = await reorderAttributes(reordered.map((a) => a.id))
    if (!res.success) toast.error(res.error)
    refresh()
  }

  // ── Delete attribute ──────────────────────────────────────────────────────
  const handleDeleteAttribute = async (id: string) => {
    if (!confirm('Delete this attribute? All its options and rules will be removed.')) return
    setBusy(true)
    const res = await deleteAttribute(id)
    setBusy(false)
    if (!res.success) { toast.error(res.error); return }
    setSelectedId((cur) => (cur === id ? null : cur))
    toast.success('Attribute deleted')
    refresh()
  }

  return (
    <div className="space-y-5">
      {/* ── Breadcrumb / header ── */}
      <header className="space-y-2">
        <Link
          href={`/admin/games-v2/${state.header.game_id}/edit`}
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to {state.header.game_name}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                {state.header.game_name} <span className="text-gray-500">·</span>{' '}
                <span className="text-violet-300">{state.header.global_category_name}</span>
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300">
                <Sparkles className="h-3 w-3" />
                attribute template
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-400">
              Define the fields sellers fill in when listing in this category.
              Conditional rules show fields only when other fields have specific values.
            </p>
          </div>
          {state.template && (
            <div className="text-[11px] text-gray-500">
              version {state.template.version} · {state.attributes.length} attributes
            </div>
          )}
        </div>
      </header>

      {/* ── Main grid ── */}
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* ── Left: attribute list ── */}
        <GlassCard intensity="light" rounded="2xl" className="p-0">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Attributes
            </div>
            <button
              type="button"
              onClick={() => setAdding((v) => !v)}
              className="inline-flex h-7 items-center gap-1 rounded-lg bg-white px-2 text-[11px] font-semibold text-black hover:bg-white/90"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          </div>

          {adding && (
            <div className="space-y-2 border-b border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="e.g. Item Type"
                autoFocus
                className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-white placeholder:text-gray-600 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15"
              />
              <select
                value={draftType}
                onChange={(e) => setDraftType(e.target.value as AttrType)}
                className="h-9 w-full rounded-lg border border-white/10 bg-gray-950 px-2 text-xs text-white focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15"
              >
                {TYPE_ORDER.map((t) => (
                  <option key={t} value={t}>{TYPE_META[t].label}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddAttribute}
                  disabled={busy || !draftName.trim()}
                  className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-500 px-2 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-40"
                >
                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => { setAdding(false); setDraftName('') }}
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-2 text-xs font-medium text-gray-300 hover:bg-white/[0.08]"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          <ul className="max-h-[60vh] overflow-y-auto">
            {state.attributes.length === 0 && !adding ? (
              <li className="px-4 py-10 text-center text-xs text-gray-500">
                No attributes yet. Click <span className="font-semibold text-gray-300">Add</span> to create the first one.
              </li>
            ) : (
              state.attributes.map((a, idx) => {
                const Icon = TYPE_META[a.type].icon
                const selectedClass = selectedId === a.id
                  ? 'bg-violet-500/10 text-white'
                  : 'text-gray-300 hover:bg-white/[0.03]'
                return (
                  <li key={a.id} className={cn('group flex items-center border-b border-white/[0.04] last:border-b-0', selectedClass)}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(a.id)}
                      className="flex flex-1 items-center gap-2 px-3 py-2.5 text-left"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{a.name}</div>
                        <div className="truncate font-mono text-[10px] text-gray-500">
                          {a.slug} · {TYPE_META[a.type].label}
                          {a.is_required && <span className="ml-1 text-rose-400">*</span>}
                          {a.rules.length > 0 && (
                            <span className="ml-1 inline-flex items-center gap-0.5 text-violet-400">
                              <GitBranch className="h-2.5 w-2.5" />
                              {a.rules.length}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center pr-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        title="Move up"
                        onClick={() => move(a.id, -1)}
                        disabled={idx === 0}
                        className="rounded p-1 text-gray-500 hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        title="Move down"
                        onClick={() => move(a.id, 1)}
                        disabled={idx === state.attributes.length - 1}
                        className="rounded p-1 text-gray-500 hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        onClick={() => handleDeleteAttribute(a.id)}
                        className="rounded p-1 text-gray-500 hover:bg-rose-500/15 hover:text-rose-300"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </li>
                )
              })
            )}
          </ul>
        </GlassCard>

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
              <Pencil className="mx-auto mb-3 h-6 w-6 text-gray-600" />
              <p className="text-sm text-gray-500">Select an attribute on the left, or add a new one.</p>
            </div>
          </GlassCard>
        )}
      </div>

      {/* ── Live preview ── */}
      <LivePreview attributes={state.attributes} />
    </div>
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
    toast.success('Attribute saved')
    onChange()
  }

  return (
    <div className="space-y-4">
      <GlassCard intensity="light" rounded="2xl" className="p-0">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">Attribute</div>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors',
              dirty ? 'bg-white text-black hover:bg-white/90' : 'bg-white/[0.04] text-gray-600'
            )}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            {dirty ? 'Save' : 'Saved'}
          </button>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          <Field label="Name" required>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Slug" hint="lowercase, dashes only">
            <input value={slug} onChange={(e) => setSlug(e.target.value)} className={cn(inputCls, 'font-mono text-xs')} />
          </Field>
          <Field label="Type">
            <select value={type} onChange={(e) => setType(e.target.value as AttrType)} className={cn(inputCls, 'bg-gray-950')}>
              {TYPE_ORDER.map((t) => (
                <option key={t} value={t}>{TYPE_META[t].label}</option>
              ))}
            </select>
          </Field>
          <div className="flex items-end justify-between gap-3">
            <ToggleField label="Required" value={isRequired} onChange={setIsRequired} />
            <ToggleField label="Facet indexed" hint="future search" value={facetIndexed} onChange={setFacetIndexed} />
          </div>

          <Field label="Placeholder" className="sm:col-span-2">
            <input value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Help text" className="sm:col-span-2">
            <textarea value={helpText} onChange={(e) => setHelpText(e.target.value)} rows={2} className={cn(inputCls, 'h-auto py-2')} />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={cn(inputCls, 'h-auto py-2')} />
          </Field>

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
            <Field label="Max length">
              <input type="number" value={maxLength} onChange={(e) => setMaxLength(e.target.value)} className={inputCls} />
            </Field>
          )}
        </div>
      </GlassCard>

      {supportsOptions && (
        <OptionsEditor attribute={attribute} onChange={onChange} />
      )}

      <RulesEditor attribute={attribute} siblings={siblings} onChange={onChange} />
    </div>
  )
}

// ─── Options editor ──────────────────────────────────────────────────────────

function OptionsEditor({ attribute, onChange }: { attribute: BuilderAttribute; onChange: () => void }) {
  const [newLabel, setNewLabel] = useState('')
  const [busy, setBusy] = useState(false)

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

  return (
    <GlassCard intensity="light" rounded="2xl" className="p-0">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Options <span className="text-gray-600">({attribute.options.length})</span>
        </div>
      </div>
      <div className="space-y-2 p-4">
        {attribute.options.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-3 py-4 text-center text-xs text-gray-500">
            No options yet — add one below.
          </p>
        ) : (
          attribute.options.map((opt) => (
            <OptionRow key={opt.id} option={opt} onChange={onChange} />
          ))
        )}

        <div className="flex gap-2 pt-1">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Add option label (e.g. Brainrot)…"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
            className="h-9 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-white placeholder:text-gray-600 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={busy || !newLabel.trim()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-semibold text-black hover:bg-white/90 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Add option
          </button>
        </div>
      </div>
    </GlassCard>
  )
}

function OptionRow({ option, onChange }: { option: BuilderOption; onChange: () => void }) {
  const [label, setLabel] = useState(option.label)
  const [value, setValue] = useState(option.value)
  const [saving, setSaving] = useState(false)
  const dirty = label !== option.label || value !== option.value

  const handleSave = async () => {
    setSaving(true)
    const res = await updateOption({ id: option.id, label, value })
    setSaving(false)
    if (!res.success) { toast.error(res.error); return }
    onChange()
  }

  const handleDelete = async () => {
    if (!confirm('Delete this option?')) return
    const res = await deleteOption(option.id)
    if (!res.success) { toast.error(res.error); return }
    onChange()
  }

  return (
    <div className="grid grid-cols-[1fr_140px_80px] items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-2">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="h-8 rounded-md border border-white/10 bg-white/[0.04] px-2 text-sm text-white focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15"
      />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="stored value"
        className="h-8 rounded-md border border-white/10 bg-white/[0.04] px-2 font-mono text-xs text-gray-300 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15"
      />
      <div className="flex justify-end gap-1">
        {dirty && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-white px-2 text-[11px] font-semibold text-black hover:bg-white/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          </button>
        )}
        <button
          type="button"
          onClick={handleDelete}
          className="inline-flex h-7 items-center rounded-md px-1.5 text-gray-500 hover:bg-rose-500/15 hover:text-rose-300"
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
    if (!confirm('Delete this rule?')) return
    const res = await deleteRule(id)
    if (!res.success) { toast.error(res.error); return }
    onChange()
  }

  return (
    <GlassCard intensity="light" rounded="2xl" className="p-0">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
          <GitBranch className="h-3.5 w-3.5" />
          Conditional rules
        </div>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          disabled={triggerableSiblings.length === 0}
          className="inline-flex h-7 items-center gap-1 rounded-lg bg-white px-2 text-[11px] font-semibold text-black hover:bg-white/90 disabled:opacity-40"
          title={triggerableSiblings.length === 0 ? 'Need at least one select/boolean attribute to trigger a rule' : ''}
        >
          <Plus className="h-3 w-3" />
          Add rule
        </button>
      </div>
      <div className="space-y-2 p-4">
        {attribute.rules.length === 0 && !adding ? (
          <p className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-3 py-4 text-center text-xs text-gray-500">
            Always shown. Add a rule to make this attribute appear only when another attribute has a specific value.
          </p>
        ) : (
          attribute.rules.map((r) => {
            const trig = siblings.find((s) => s.id === r.trigger_attribute_id)
            return (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-violet-500/20 bg-violet-500/[0.05] px-3 py-2 text-xs">
                <div className="text-gray-300">
                  Show when{' '}
                  <span className="font-semibold text-white">{trig?.name ?? '?'}</span>{' '}
                  <span className="font-mono text-violet-300">{r.operator}</span>{' '}
                  {r.trigger_values.map((v, i) => {
                    const label = trig?.options.find((o) => o.value === v)?.label ?? v
                    return (
                      <span key={i} className="ml-1 inline-flex rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-gray-200">
                        {label}
                      </span>
                    )
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(r.id)}
                  className="rounded p-1 text-gray-500 hover:bg-rose-500/15 hover:text-rose-300"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )
          })
        )}

        {adding && (
          <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <div className="grid grid-cols-[1fr_120px] gap-2">
              <select
                value={triggerId}
                onChange={(e) => { setTriggerId(e.target.value); setVals([]) }}
                className={cn(inputCls, 'bg-gray-950 h-9')}
              >
                {triggerableSiblings.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({TYPE_META[s.type].label})</option>
                ))}
              </select>
              <select value={op} onChange={(e) => setOp(e.target.value as any)} className={cn(inputCls, 'bg-gray-950 h-9')}>
                <option value="equals">equals</option>
                <option value="not_equals">not equals</option>
                <option value="in">in</option>
                <option value="not_in">not in</option>
              </select>
            </div>

            {/* Value picker */}
            <div className="space-y-1">
              <div className="text-[10px] font-medium uppercase tracking-wider text-gray-500">Values</div>
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
                          on ? 'border-violet-500/40 bg-violet-500/15 text-violet-200' : 'border-white/10 bg-white/[0.04] text-gray-300'
                        )}
                      >
                        {v}
                      </button>
                    )
                  })}
                </div>
              ) : (triggerAttr?.options ?? []).length === 0 ? (
                <p className="text-[11px] text-amber-300/80">
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
                          on ? 'border-violet-500/40 bg-violet-500/15 text-violet-200' : 'border-white/10 bg-white/[0.04] text-gray-300 hover:text-white'
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
                className="inline-flex h-7 items-center rounded-md border border-white/10 bg-white/[0.04] px-2 text-[11px] text-gray-300 hover:bg-white/[0.08]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={busy || vals.length === 0}
                className="inline-flex h-7 items-center gap-1 rounded-md bg-emerald-500 px-2 text-[11px] font-semibold text-black hover:bg-emerald-400 disabled:opacity-40"
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
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Live preview
        </div>
        <div className="text-[10px] text-gray-500">
          Try selecting values to see conditional fields appear
        </div>
      </div>

      <div className="space-y-4 p-5">
        {attributes.length === 0 ? (
          <p className="text-center text-xs text-gray-500">No attributes yet.</p>
        ) : (
          attributes.map((a) => {
            if (!isVisible(a)) return null
            return (
              <div key={a.id}>
                <label className="mb-1.5 block text-xs font-medium text-gray-300">
                  {a.name}
                  {a.is_required && <span className="ml-1 text-rose-400">*</span>}
                  {a.help_text && (
                    <span className="ml-2 text-[10px] font-normal text-gray-500">{a.help_text}</span>
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
                      values[a.id] === 'true' ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' : 'border-white/10 bg-white/[0.04] text-gray-300'
                    )}
                  >
                    {values[a.id] === 'true' ? 'Yes' : 'No'}
                  </button>
                )}
                {(a.type === 'select' || a.type === 'image_select') && (
                  <select
                    value={(values[a.id] as string) ?? ''}
                    onChange={(e) => set(a.id, e.target.value)}
                    className={cn(inputCls, 'bg-gray-950')}
                  >
                    <option value="">Select…</option>
                    {a.options.map((o) => (
                      <option key={o.id} value={o.value}>{o.label}</option>
                    ))}
                  </select>
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
                            on ? 'border-violet-500/40 bg-violet-500/15 text-violet-200' : 'border-white/10 bg-white/[0.04] text-gray-300'
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
  'h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-white placeholder:text-gray-600 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15'

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
        <label className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
          {label}
          {required && <span className="ml-1 text-rose-400">*</span>}
        </label>
        {hint && <span className="text-[10px] text-gray-600">{hint}</span>}
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
    <label className="flex flex-1 items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
      <div>
        <div className="text-xs font-medium text-white">{label}</div>
        {hint && <div className="text-[10px] text-gray-500">{hint}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={cn(
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
          value ? 'bg-violet-500/70' : 'bg-white/10'
        )}
        aria-pressed={value}
      >
        <span
          className={cn(
            'inline-block h-3 w-3 transform rounded-full bg-white transition-transform',
            value ? 'translate-x-5' : 'translate-x-1'
          )}
        />
      </button>
    </label>
  )
}
