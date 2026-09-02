'use client'

/**
 * Seller-lead CRM — the concierge outreach tracker.
 *
 * Log a seller you found (handle + where + optional contact/game/notes), then
 * move them through the pipeline (new → contacted → replied → negotiating →
 * signed_up → converted, or passed/lost). Highlights leads DUE for follow-up.
 * Built on the shared admin kit to match the other list pages.
 */

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  IconPlus,
  IconTrash,
  IconMessageDots,
  IconLoader2,
  IconInbox,
} from '@tabler/icons-react'
import { Target, MessagesSquare, Clock, Inbox as InboxLucide } from 'lucide-react'
import {
  createSellerLead,
  updateSellerLead,
  deleteSellerLead,
  SELLER_LEAD_STATUSES,
  type SellerLead,
  type SellerLeadStatus,
} from '@/lib/actions/seller-leads'
import { PageHeader, StatCard, TABLE } from '../components/kit'

const STATUS_LABEL: Record<SellerLeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  replied: 'Replied',
  negotiating: 'Negotiating',
  signed_up: 'Signed up',
  converted: 'Converted',
  passed: 'Passed',
  lost: 'Lost',
}

type Tab = 'all' | 'due' | SellerLeadStatus

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function isDue(lead: SellerLead) {
  return (
    !!lead.next_follow_up &&
    new Date(lead.next_follow_up) <= new Date() &&
    lead.status !== 'converted' &&
    lead.status !== 'passed' &&
    lead.status !== 'lost'
  )
}

export default function SellerLeadsClient({
  initialLeads,
  fetchError,
}: {
  initialLeads: SellerLead[]
  fetchError?: string
}) {
  const [leads, setLeads] = useState<SellerLead[]>(initialLeads)
  const [tab, setTab] = useState<Tab>('all')
  const [pending, startTransition] = useTransition()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ handle: '', source: '', contact: '', game: '', notes: '' })

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: leads.length, due: 0 }
    for (const l of leads) {
      c[l.status] = (c[l.status] ?? 0) + 1
      if (isDue(l)) c.due += 1
    }
    return c
  }, [leads])

  const visible = useMemo(() => {
    if (tab === 'all') return leads
    if (tab === 'due') return leads.filter(isDue)
    return leads.filter((l) => l.status === tab)
  }, [leads, tab])

  const converted = counts.converted ?? 0
  const activePipeline =
    leads.length - (counts.converted ?? 0) - (counts.passed ?? 0) - (counts.lost ?? 0)

  function refreshLead(id: string, patch: Partial<SellerLead>) {
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...patch, updated_at: new Date().toISOString() } : l)),
    )
  }

  function handleAdd() {
    if (!form.handle.trim()) {
      toast.error('A handle is required.')
      return
    }
    startTransition(async () => {
      const res = await createSellerLead(form)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      const optimistic: SellerLead = {
        id: `tmp-${Date.now()}`,
        handle: form.handle.trim(),
        source: form.source.trim() || null,
        contact: form.contact.trim() || null,
        game: form.game.trim() || null,
        status: 'new',
        notes: form.notes.trim() || null,
        last_contacted: null,
        next_follow_up: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setLeads((prev) => [optimistic, ...prev])
      setForm({ handle: '', source: '', contact: '', game: '', notes: '' })
      setShowForm(false)
      toast.success('Lead added')
    })
  }

  function changeStatus(lead: SellerLead, status: SellerLeadStatus) {
    refreshLead(lead.id, { status })
    startTransition(async () => {
      const touchContacted = lead.status === 'new' && status !== 'new'
      const res = await updateSellerLead(lead.id, { status, touchContacted })
      if (!res.ok) {
        toast.error(res.error)
        refreshLead(lead.id, { status: lead.status })
      } else if (touchContacted) {
        refreshLead(lead.id, { last_contacted: new Date().toISOString() })
      }
    })
  }

  function markContacted(lead: SellerLead) {
    const now = new Date().toISOString()
    refreshLead(lead.id, { last_contacted: now })
    startTransition(async () => {
      const res = await updateSellerLead(lead.id, { touchContacted: true })
      if (!res.ok) toast.error(res.error)
    })
  }

  function setFollowUp(lead: SellerLead, date: string) {
    const iso = date ? new Date(date).toISOString() : null
    refreshLead(lead.id, { next_follow_up: iso })
    startTransition(async () => {
      const res = await updateSellerLead(lead.id, { next_follow_up: iso })
      if (!res.ok) toast.error(res.error)
    })
  }

  function saveNotes(lead: SellerLead, notes: string) {
    if (notes === (lead.notes ?? '')) return
    refreshLead(lead.id, { notes })
    startTransition(async () => {
      const res = await updateSellerLead(lead.id, { notes })
      if (!res.ok) toast.error(res.error)
    })
  }

  function remove(lead: SellerLead) {
    if (!confirm(`Delete lead "${lead.handle}"?`)) return
    setLeads((prev) => prev.filter((l) => l.id !== lead.id))
    startTransition(async () => {
      const res = await deleteSellerLead(lead.id)
      if (!res.ok) {
        toast.error(res.error)
        setLeads((prev) => [lead, ...prev])
      }
    })
  }

  const TABS: Tab[] = ['all', 'due', ...SELLER_LEAD_STATUSES]

  return (
    <div>
      <PageHeader
        title="Seller Leads"
        description="Concierge outreach — sellers you found and are courting 1:1. Log them, track the pipeline, never miss a follow-up."
        actions={
          <button
            onClick={() => setShowForm((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#3FA35C] px-3.5 py-2 text-sm font-semibold text-[#08110B] transition-transform active:scale-[0.98]"
          >
            <IconPlus className="h-4 w-4" stroke={2.4} /> Add lead
          </button>
        }
      />

      {fetchError && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {fetchError}
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Target} label="Total leads" value={leads.length} />
        <StatCard icon={MessagesSquare} label="Active pipeline" value={Math.max(0, activePipeline)} />
        <StatCard icon={Clock} label="Due for follow-up" value={counts.due ?? 0} />
        <StatCard icon={InboxLucide} label="Converted" value={converted} />
      </div>

      {showForm && (
        <div className="mb-6 rounded-xl border border-border-subtle bg-bg-overlay p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input
              autoFocus
              value={form.handle}
              onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))}
              placeholder="Handle / username *"
              className="rounded-lg border border-border-subtle bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-[#3FA35C]"
            />
            <input
              value={form.source}
              onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
              placeholder="Source (epicnpc, sythe, discord…)"
              className="rounded-lg border border-border-subtle bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-[#3FA35C]"
            />
            <input
              value={form.contact}
              onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
              placeholder="Contact (discord / URL)"
              className="rounded-lg border border-border-subtle bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-[#3FA35C]"
            />
            <input
              value={form.game}
              onChange={(e) => setForm((f) => ({ ...f, game: e.target.value }))}
              placeholder="Game (steal-a-brainrot…)"
              className="rounded-lg border border-border-subtle bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-[#3FA35C]"
            />
          </div>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Notes — volume, what they sell, where you found them…"
            rows={2}
            className="mt-3 w-full rounded-lg border border-border-subtle bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-[#3FA35C]"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-border-subtle px-3.5 py-2 text-sm font-medium text-text-secondary hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#3FA35C] px-4 py-2 text-sm font-semibold text-[#08110B] disabled:opacity-60"
            >
              {pending ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconPlus className="h-4 w-4" stroke={2.4} />}
              Add
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const label = t === 'all' ? 'All' : t === 'due' ? 'Due' : STATUS_LABEL[t as SellerLeadStatus]
          const n = counts[t] ?? 0
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                tab === t
                  ? 'border-[#3FA35C] bg-[#3FA35C]/12 text-[#8FBF9C]'
                  : 'border-border-subtle text-text-secondary hover:text-text-primary'
              } ${t === 'due' && n > 0 ? 'text-amber-300' : ''}`}
            >
              {label}
              <span className="text-[11px] opacity-70">{n}</span>
            </button>
          )
        })}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-border-subtle bg-bg-overlay py-16 text-center">
          <IconInbox className="mx-auto h-8 w-8 text-text-tertiary" />
          <p className="mt-3 text-sm text-text-secondary">
            {leads.length === 0
              ? 'No leads yet. Add the first seller you found on EpicNPC / Sythe / Discord.'
              : 'No leads in this view.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border-subtle bg-bg-overlay">
          <div className={TABLE.wrap}>
            <table className={TABLE.table}>
              <thead>
                <tr>
                  <th className={TABLE.th}>Seller</th>
                  <th className={TABLE.th}>Status</th>
                  <th className={TABLE.th}>Notes</th>
                  <th className={TABLE.th}>Last contacted</th>
                  <th className={TABLE.th}>Follow-up</th>
                  <th className={TABLE.th}></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((lead) => (
                  <tr key={lead.id} className={`${TABLE.row} ${isDue(lead) ? 'bg-amber-500/[0.06]' : ''}`}>
                    <td className={TABLE.tdPrimary}>
                      <div className="flex flex-col">
                        <span>{lead.handle}</span>
                        <span className="text-[11px] font-normal text-text-tertiary">
                          {[lead.source, lead.game].filter(Boolean).join(' · ') || '—'}
                          {lead.contact ? ` · ${lead.contact}` : ''}
                        </span>
                      </div>
                    </td>
                    <td className={TABLE.td}>
                      <select
                        value={lead.status}
                        onChange={(e) => changeStatus(lead, e.target.value as SellerLeadStatus)}
                        className="rounded-md border border-border-subtle bg-bg-base px-2 py-1 text-[12.5px] text-text-primary outline-none focus:border-[#3FA35C]"
                      >
                        {SELLER_LEAD_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={TABLE.td}>
                      <input
                        defaultValue={lead.notes ?? ''}
                        onBlur={(e) => saveNotes(lead, e.target.value)}
                        placeholder="Add notes…"
                        className="w-52 rounded-md border border-transparent bg-transparent px-2 py-1 text-[12.5px] text-text-secondary outline-none hover:border-border-subtle focus:border-[#3FA35C] focus:text-text-primary"
                      />
                    </td>
                    <td className={TABLE.td}>
                      <div className="flex items-center gap-2">
                        <span className="text-[12.5px]">{fmtDate(lead.last_contacted)}</span>
                        <button
                          onClick={() => markContacted(lead)}
                          title="Mark contacted now"
                          className="rounded p-1 text-text-tertiary hover:bg-bg-raised-hover hover:text-[#8FBF9C]"
                        >
                          <IconMessageDots className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className={TABLE.td}>
                      <input
                        type="date"
                        value={lead.next_follow_up ? lead.next_follow_up.slice(0, 10) : ''}
                        onChange={(e) => setFollowUp(lead, e.target.value)}
                        className={`rounded-md border bg-bg-base px-2 py-1 text-[12.5px] outline-none focus:border-[#3FA35C] ${
                          isDue(lead) ? 'border-amber-500/50 text-amber-300' : 'border-border-subtle text-text-secondary'
                        }`}
                      />
                    </td>
                    <td className={TABLE.td}>
                      <button
                        onClick={() => remove(lead)}
                        title="Delete lead"
                        className="rounded p-1 text-text-tertiary hover:bg-red-500/10 hover:text-red-400"
                      >
                        <IconTrash className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
