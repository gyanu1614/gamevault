'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CircleNotch, GitBranch, Plus, Trash, WarningCircle } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { deleteRule, saveRule, type BuilderAttribute } from '@/lib/actions/admin-template-builder'
import { adminBtn, adminBtnSm } from '../../../components/kit'
import { TYPE_META, chipCls, iconBtnDangerCls, selectCls } from './styles'

/**
 * "When This Field Is Shown": the raw rules, for the rare field that hangs
 * off more than one choice or uses Not Equals. Most sub-fields are made by
 * picking a choice in the Finder, which writes the rule itself.
 */
export function RulesEditor({
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
            This field is always shown. To show it only for one choice, pick that choice in the columns and add the field there.
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
