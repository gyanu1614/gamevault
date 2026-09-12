'use client'

/**
 * FeesPageClient — the /admin/fees editor.
 *
 * Four sections on the admin kit:
 *   1. Category base fees  (base % + whether rank discount applies)
 *   2. Rank multipliers    (per rank; shows the effective items rate)
 *   3. Game overrides      (per-game per-category %, CRUD)
 *   4. Audit log           (last 50 fee changes)
 */

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Percent, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AdminPanel, PageHeader, SectionLabel, TABLE } from '../../components/kit'
import { tierLabel } from '@/lib/seller/tiers'
import {
  deleteGameOverride,
  updateCategoryFee,
  updateRankMultiplier,
  upsertGameOverride,
} from '@/lib/actions/admin-fees'

const CATEGORY_LABELS: Record<string, string> = {
  currency: 'Game Currency',
  items: 'Items & Boosting',
  accounts: 'Game Accounts',
  'top-up': 'Top-Ups',
}
const FEE_CATEGORIES = ['currency', 'items', 'accounts', 'top-up'] as const

interface FeeAdminData {
  categories: any[]
  gameOverrides: any[]
  rankMultipliers: any[]
  audit: any[]
}

const inputCls =
  'w-20 rounded-md border border-border-default bg-bg-overlay px-2 py-1 text-[13px] text-text-primary tabular-nums focus:border-lime/50 focus:outline-none'

export default function FeesPageClient({ initialData }: { initialData: FeeAdminData }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const run = (fn: () => Promise<{ success: boolean; error?: string }>, okMsg: string) => {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.success) {
        setError(res.error ?? 'Something went wrong')
      } else {
        setNotice(okMsg)
        router.refresh()
      }
    })
  }

  return (
    <div>
      <PageHeader
        title="Fees"
        description="Category base fees, per-game overrides and rank discounts. Changes apply to new orders only — every order snapshots its rate at purchase."
      />

      {(error || notice) && (
        <div
          className={cn(
            'mb-4 rounded-lg border px-4 py-2.5 text-[13px]',
            error
              ? 'border-error/30 bg-error/10 text-error'
              : 'border-lime/30 bg-lime/10 text-lime-text',
          )}
        >
          {error ?? notice}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <CategoryFees categories={initialData.categories} run={run} busy={isPending} />
        <RankMultipliers tiers={initialData.rankMultipliers} run={run} busy={isPending} />
      </div>

      <div className="mt-6">
        <GameOverrides overrides={initialData.gameOverrides} run={run} busy={isPending} />
      </div>

      <div className="mt-6">
        <AuditLog audit={initialData.audit} />
      </div>
    </div>
  )
}

/* ── 1. Category base fees ─────────────────────────────────────────────── */

function CategoryFees({
  categories,
  run,
  busy,
}: {
  categories: any[]
  run: (fn: () => Promise<any>, okMsg: string) => void
  busy: boolean
}) {
  const [draft, setDraft] = useState<Record<string, { pct: string; rank: boolean }>>(() =>
    Object.fromEntries(
      categories.map((c) => [c.category, { pct: String(c.base_pct), rank: !!c.rank_discount }]),
    ),
  )

  return (
    <AdminPanel pad={false}>
      <div className="px-5 pt-5">
        <SectionLabel>Category Base Fees</SectionLabel>
      </div>
      <div className={TABLE.wrap}>
        <table className={TABLE.table}>
          <thead>
            <tr>
              <th className={TABLE.th}>Category</th>
              <th className={TABLE.th}>Base Fee %</th>
              <th className={TABLE.th}>Rank Discount</th>
              <th className={TABLE.th} />
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => {
              const d = draft[c.category] ?? { pct: String(c.base_pct), rank: !!c.rank_discount }
              const dirty =
                Number(d.pct) !== Number(c.base_pct) || d.rank !== !!c.rank_discount
              return (
                <tr key={c.category} className={TABLE.row}>
                  <td className={TABLE.tdPrimary}>{CATEGORY_LABELS[c.category] ?? c.category}</td>
                  <td className={TABLE.td}>
                    <input
                      className={inputCls}
                      type="number"
                      min={0}
                      max={50}
                      step={0.5}
                      value={d.pct}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, [c.category]: { ...d, pct: e.target.value } }))
                      }
                    />
                  </td>
                  <td className={TABLE.td}>
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={d.rank}
                        onChange={(e) =>
                          setDraft((p) => ({
                            ...p,
                            [c.category]: { ...d, rank: e.target.checked },
                          }))
                        }
                        className="h-4 w-4 accent-[#c6ff3d]"
                      />
                      <span className="text-[12.5px]">{d.rank ? 'Applies' : 'Flat Rate'}</span>
                    </label>
                  </td>
                  <td className={TABLE.td}>
                    <SaveButton
                      visible={dirty}
                      disabled={busy}
                      onClick={() =>
                        run(
                          () =>
                            updateCategoryFee({
                              category: c.category,
                              basePct: Number(d.pct),
                              rankDiscount: d.rank,
                            }),
                          `${CATEGORY_LABELS[c.category] ?? c.category} updated`,
                        )
                      }
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </AdminPanel>
  )
}

/* ── 2. Rank multipliers ───────────────────────────────────────────────── */

function RankMultipliers({
  tiers,
  run,
  busy,
}: {
  tiers: any[]
  run: (fn: () => Promise<any>, okMsg: string) => void
  busy: boolean
}) {
  const itemsBase = 10 // display helper only — real base comes from the category table
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(tiers.map((t) => [t.tier, String(t.fee_multiplier ?? 1)])),
  )

  return (
    <AdminPanel pad={false}>
      <div className="px-5 pt-5">
        <SectionLabel>Rank Fee Multipliers</SectionLabel>
      </div>
      <div className={TABLE.wrap}>
        <table className={TABLE.table}>
          <thead>
            <tr>
              <th className={TABLE.th}>Rank</th>
              <th className={TABLE.th}>Multiplier</th>
              <th className={TABLE.th}>Discount</th>
              <th className={TABLE.th}>Items Example</th>
              <th className={TABLE.th} />
            </tr>
          </thead>
          <tbody>
            {tiers.map((t) => {
              const d = draft[t.tier] ?? String(t.fee_multiplier ?? 1)
              const mult = Number(d)
              const dirty = mult !== Number(t.fee_multiplier ?? 1)
              return (
                <tr key={t.tier} className={TABLE.row}>
                  <td className={TABLE.tdPrimary}>{tierLabel(t.tier)}</td>
                  <td className={TABLE.td}>
                    <input
                      className={inputCls}
                      type="number"
                      min={0.5}
                      max={1}
                      step={0.05}
                      value={d}
                      onChange={(e) => setDraft((p) => ({ ...p, [t.tier]: e.target.value }))}
                    />
                  </td>
                  <td className={TABLE.td}>
                    {Number.isFinite(mult) ? `${Math.round((1 - mult) * 100)}% off` : '—'}
                  </td>
                  <td className={cn(TABLE.td, 'tabular-nums')}>
                    {Number.isFinite(mult) ? `${(itemsBase * mult).toFixed(1)}%` : '—'}
                  </td>
                  <td className={TABLE.td}>
                    <SaveButton
                      visible={dirty}
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => updateRankMultiplier({ tier: t.tier, multiplier: mult }),
                          `${tierLabel(t.tier)} multiplier updated`,
                        )
                      }
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="px-5 pb-4 pt-2 text-[11.5px] text-text-tertiary">
        Applies to categories marked “Rank Discount: Applies”. Top-ups stay flat.
      </p>
    </AdminPanel>
  )
}

/* ── 3. Game overrides ─────────────────────────────────────────────────── */

function GameOverrides({
  overrides,
  run,
  busy,
}: {
  overrides: any[]
  run: (fn: () => Promise<any>, okMsg: string) => void
  busy: boolean
}) {
  const [slug, setSlug] = useState('')
  const [category, setCategory] = useState<(typeof FEE_CATEGORIES)[number]>('accounts')
  const [pct, setPct] = useState('')
  const [note, setNote] = useState('')

  const canAdd = useMemo(() => slug.trim().length > 0 && pct.trim().length > 0, [slug, pct])

  return (
    <AdminPanel pad={false}>
      <div className="px-5 pt-5">
        <SectionLabel>Per-Game Overrides</SectionLabel>
      </div>

      {/* Add row */}
      <div className="flex flex-wrap items-center gap-2 px-5 pb-4">
        <input
          className="w-44 rounded-md border border-border-default bg-bg-overlay px-2.5 py-1.5 text-[13px] text-text-primary focus:border-lime/50 focus:outline-none"
          placeholder="game-slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
        <select
          className="rounded-md border border-border-default bg-bg-overlay px-2.5 py-1.5 text-[13px] text-text-primary focus:border-lime/50 focus:outline-none"
          value={category}
          onChange={(e) => setCategory(e.target.value as any)}
        >
          {FEE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <div className="relative">
          <input
            className={cn(inputCls, 'w-24 pr-6 py-1.5')}
            type="number"
            min={0}
            max={50}
            step={0.5}
            placeholder="Fee"
            value={pct}
            onChange={(e) => setPct(e.target.value)}
          />
          <Percent className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-text-tertiary" />
        </div>
        <input
          className="min-w-40 flex-1 rounded-md border border-border-default bg-bg-overlay px-2.5 py-1.5 text-[13px] text-text-primary focus:border-lime/50 focus:outline-none"
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button
          disabled={!canAdd || busy}
          onClick={() =>
            run(
              () =>
                upsertGameOverride({
                  gameSlug: slug,
                  category,
                  pct: Number(pct),
                  note: note || null,
                }),
              `Override saved for ${slug.trim().toLowerCase()}`,
            )
          }
          className="inline-flex items-center gap-1.5 rounded-md bg-lime px-3 py-1.5 text-[13px] font-semibold text-black transition-opacity disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Override
        </button>
      </div>

      <div className={TABLE.wrap}>
        <table className={TABLE.table}>
          <thead>
            <tr>
              <th className={TABLE.th}>Game</th>
              <th className={TABLE.th}>Category</th>
              <th className={TABLE.th}>Fee %</th>
              <th className={TABLE.th}>Note</th>
              <th className={TABLE.th} />
            </tr>
          </thead>
          <tbody>
            {overrides.length === 0 && (
              <tr>
                <td className={TABLE.td} colSpan={5}>
                  No game overrides — every game uses its category base fee.
                </td>
              </tr>
            )}
            {overrides.map((o) => (
              <tr key={o.id} className={TABLE.row}>
                <td className={TABLE.tdPrimary}>{o.game_slug}</td>
                <td className={TABLE.td}>{CATEGORY_LABELS[o.category] ?? o.category}</td>
                <td className={cn(TABLE.td, 'tabular-nums')}>{Number(o.pct).toFixed(2)}%</td>
                <td className={TABLE.td}>{o.note ?? '—'}</td>
                <td className={TABLE.td}>
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(() => deleteGameOverride(o.id), `Override removed for ${o.game_slug}`)
                    }
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-text-tertiary transition-colors hover:bg-error/10 hover:text-error"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminPanel>
  )
}

/* ── 4. Audit log ──────────────────────────────────────────────────────── */

function AuditLog({ audit }: { audit: any[] }) {
  return (
    <AdminPanel pad={false}>
      <div className="px-5 pt-5">
        <SectionLabel>Recent Fee Changes</SectionLabel>
      </div>
      <div className={TABLE.wrap}>
        <table className={TABLE.table}>
          <thead>
            <tr>
              <th className={TABLE.th}>When</th>
              <th className={TABLE.th}>Admin</th>
              <th className={TABLE.th}>Scope</th>
              <th className={TABLE.th}>Key</th>
              <th className={TABLE.th}>Change</th>
            </tr>
          </thead>
          <tbody>
            {audit.length === 0 && (
              <tr>
                <td className={TABLE.td} colSpan={5}>
                  No fee changes recorded yet.
                </td>
              </tr>
            )}
            {audit.map((a) => (
              <tr key={a.id} className={TABLE.row}>
                <td className={cn(TABLE.td, 'whitespace-nowrap')}>
                  {new Date(a.created_at).toLocaleString()}
                </td>
                <td className={TABLE.td}>{a.actor_profile?.username ?? '—'}</td>
                <td className={TABLE.td}>{a.scope}</td>
                <td className={TABLE.td}>{a.key}</td>
                <td className={cn(TABLE.td, 'max-w-md')}>
                  <code className="text-[11.5px] text-text-tertiary">
                    {JSON.stringify(a.old_value)} → {JSON.stringify(a.new_value)}
                  </code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminPanel>
  )
}

/* ── Shared save button ────────────────────────────────────────────────── */

function SaveButton({
  visible,
  disabled,
  onClick,
}: {
  visible: boolean
  disabled: boolean
  onClick: () => void
}) {
  if (!visible) return null
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="rounded-md bg-lime px-2.5 py-1 text-[12px] font-semibold text-black transition-opacity disabled:opacity-40"
    >
      Save
    </button>
  )
}
