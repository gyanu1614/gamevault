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
import { AnimatePresence, motion } from 'framer-motion'
import { ChatCircleDots, CircleNotch, Plus, Trash, Tray } from '@phosphor-icons/react'
import { StatStrip, accountInputCls } from '@/components/account/AccountSurface'
import { SegmentedTabs, TabCount } from '@/components/account/SegmentedTabs'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  createSellerLead,
  updateSellerLead,
  deleteSellerLead,
} from '@/lib/actions/seller-leads'
import {
  SELLER_LEAD_STATUSES,
  type SellerLead,
  type SellerLeadStatus,
} from '@/lib/actions/seller-leads-types'
import { AdminEmpty, LabeledField, PageHeader, TABLE, adminBtn } from '../components/kit'

/** Inline editor on a card/table row: fill only, 36px. 16px below sm (no iOS zoom). */
const INLINE =
  'h-9 rounded-md border border-transparent bg-bg-overlay px-2.5 text-base text-text-primary placeholder:text-text-disabled ' +
  'transition-colors hover:border-white/[0.08] focus:border-focus-border focus:outline-none focus:ring-2 focus:ring-focus-soft sm:text-[13px]'

const STATUS_LABEL: Record<SellerLeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  replied: 'Replied',
  negotiating: 'Negotiating',
  signed_up: 'Signed Up',
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

  // Confirmed in the Delete Lead dialog below.
  function remove(lead: SellerLead) {
    setLeads((prev) => prev.filter((l) => l.id !== lead.id))
    startTransition(async () => {
      const res = await deleteSellerLead(lead.id)
      if (!res.ok) {
        toast.error(res.error)
        setLeads((prev) => [lead, ...prev])
      }
    })
  }

  const [confirmDelete, setConfirmDelete] = useState<SellerLead | null>(null)

  const TABS: Tab[] = ['all', 'due', ...SELLER_LEAD_STATUSES]

  const statusSelect = (lead: SellerLead, className?: string) => (
    <select
      value={lead.status}
      onChange={(e) => changeStatus(lead, e.target.value as SellerLeadStatus)}
      aria-label={`Status for ${lead.handle}`}
      className={cn(INLINE, 'cursor-pointer [&>option]:bg-bg-raised', className)}
    >
      {SELLER_LEAD_STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  )

  const notesInput = (lead: SellerLead, className?: string) => (
    <input
      defaultValue={lead.notes ?? ''}
      onBlur={(e) => saveNotes(lead, e.target.value)}
      placeholder="Add notes…"
      aria-label={`Notes for ${lead.handle}`}
      className={cn(INLINE, 'bg-transparent hover:bg-bg-overlay focus:bg-bg-overlay', className)}
    />
  )

  const followUpInput = (lead: SellerLead, className?: string) => (
    <input
      type="date"
      value={lead.next_follow_up ? lead.next_follow_up.slice(0, 10) : ''}
      onChange={(e) => setFollowUp(lead, e.target.value)}
      aria-label={`Follow-up date for ${lead.handle}`}
      className={cn(INLINE, '[color-scheme:dark]', isDue(lead) && 'bg-warning-bg text-warning', className)}
    />
  )

  const contactedCell = (lead: SellerLead) => (
    <div className="flex items-center gap-1.5">
      <span className="whitespace-nowrap text-[12.5px] text-text-secondary">{fmtDate(lead.last_contacted)}</span>
      <button
        type="button"
        onClick={() => markContacted(lead)}
        aria-label={`Mark ${lead.handle} contacted now`}
        title="Mark contacted now"
        className="grid h-8 w-8 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
      >
        <ChatCircleDots aria-hidden weight="bold" className="h-4 w-4" />
      </button>
    </div>
  )

  const deleteButton = (lead: SellerLead) => (
    <button
      type="button"
      onClick={() => setConfirmDelete(lead)}
      aria-label={`Delete lead ${lead.handle}`}
      className="grid h-8 w-8 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-error-bg hover:text-error"
    >
      <Trash aria-hidden weight="bold" className="h-4 w-4" />
    </button>
  )

  const sub = (lead: SellerLead) =>
    `${[lead.source, lead.game].filter(Boolean).join(' · ') || '—'}${lead.contact ? ` · ${lead.contact}` : ''}`

  return (
    <div className="space-y-5">
      <PageHeader
        title="Seller Leads"
        description="Concierge outreach — sellers you found and are courting 1:1. Log them, track the pipeline, never miss a follow-up."
        className="mb-0 sm:mb-0"
        actions={
          <button type="button" onClick={() => setShowForm((s) => !s)} className={adminBtn.primary} aria-expanded={showForm}>
            <Plus aria-hidden weight="bold" className="h-4 w-4" /> Add Lead
          </button>
        }
      />

      {fetchError && (
        <p role="alert" className="rounded-lg bg-error-bg px-4 py-3 text-[13.5px] text-error">
          {fetchError}
        </p>
      )}

      <StatStrip
        stats={[
          { label: 'Total Leads', value: leads.length },
          { label: 'Active Pipeline', value: Math.max(0, activePipeline) },
          {
            label: 'Due for Follow-Up',
            value: <span className={(counts.due ?? 0) > 0 ? 'text-warning' : undefined}>{counts.due ?? 0}</span>,
          },
          { label: 'Converted', value: converted },
        ]}
      />

      <AnimatePresence initial={false}>
        {showForm && (
          <motion.div
            key="add-lead"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleAdd()
              }}
              className="rounded-lg bg-bg-raised p-4 sm:p-5"
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <LabeledField label="Handle / Username *" htmlFor="lead-handle">
                  <input
                    id="lead-handle"
                    autoFocus
                    value={form.handle}
                    onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))}
                    className={accountInputCls}
                  />
                </LabeledField>
                <LabeledField label="Source" htmlFor="lead-source">
                  <input
                    id="lead-source"
                    value={form.source}
                    onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                    placeholder="epicnpc, sythe, discord…"
                    className={accountInputCls}
                  />
                </LabeledField>
                <LabeledField label="Contact" htmlFor="lead-contact">
                  <input
                    id="lead-contact"
                    value={form.contact}
                    onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                    placeholder="Discord or URL"
                    className={accountInputCls}
                  />
                </LabeledField>
                <LabeledField label="Game" htmlFor="lead-game">
                  <input
                    id="lead-game"
                    value={form.game}
                    onChange={(e) => setForm((f) => ({ ...f, game: e.target.value }))}
                    placeholder="steal-a-brainrot…"
                    className={accountInputCls}
                  />
                </LabeledField>
              </div>
              <LabeledField label="Notes" htmlFor="lead-notes" className="mt-3">
                <textarea
                  id="lead-notes"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Volume, what they sell, where you found them…"
                  rows={2}
                  className={cn(accountInputCls, 'resize-none')}
                />
              </LabeledField>
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setShowForm(false)} className={adminBtn.secondary}>
                  Cancel
                </button>
                <button type="submit" disabled={pending} className={adminBtn.primary}>
                  {pending ? (
                    <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus aria-hidden weight="bold" className="h-4 w-4" />
                  )}
                  Add
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <SegmentedTabs
        tabs={TABS.map((t) => ({
          id: t,
          label: (
            <>
              {t === 'all' ? 'All' : t === 'due' ? 'Due' : STATUS_LABEL[t as SellerLeadStatus]}
              {(counts[t] ?? 0) > 0 && <TabCount n={counts[t] ?? 0} />}
            </>
          ),
        }))}
        value={tab}
        onChange={setTab}
        layoutId="admin-leads-tabs"
        ariaLabel="Lead status"
      />

      {visible.length === 0 ? (
        <AdminEmpty
          icon={Tray}
          title={leads.length === 0 ? 'No leads yet' : 'No leads in this view'}
          hint={leads.length === 0 ? 'Add the first seller you found on EpicNPC, Sythe or Discord.' : undefined}
        />
      ) : (
        <>
          {/* Below lg: cards with the same inline editors */}
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:hidden">
            {visible.map((lead) => (
              <li key={lead.id} className={cn('space-y-3 rounded-lg bg-bg-raised p-4', isDue(lead) && 'ring-1 ring-inset ring-[color-mix(in_srgb,var(--color-warning)_30%,transparent)]')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14.5px] font-semibold text-text-primary">{lead.handle}</p>
                    <p className="truncate text-[12.5px] text-text-tertiary">{sub(lead)}</p>
                  </div>
                  {deleteButton(lead)}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <LabeledField label="Status">{statusSelect(lead, 'w-full')}</LabeledField>
                  <LabeledField label="Follow-Up">{followUpInput(lead, 'w-full')}</LabeledField>
                </div>
                <LabeledField label="Notes">{notesInput(lead, 'w-full bg-bg-overlay')}</LabeledField>
                <div className="flex items-center justify-between border-t border-white/[0.06] pt-2 text-[12.5px] text-text-tertiary">
                  Last contacted
                  {contactedCell(lead)}
                </div>
              </li>
            ))}
          </ul>

          {/* lg+: table */}
          <div className="hidden overflow-hidden rounded-lg bg-bg-raised lg:block">
            <div className={TABLE.wrap}>
              <table className={TABLE.table}>
                <thead>
                  <tr>
                    <th className={TABLE.th}>Seller</th>
                    <th className={TABLE.th}>Status</th>
                    <th className={TABLE.th}>Notes</th>
                    <th className={TABLE.th}>Last Contacted</th>
                    <th className={TABLE.th}>Follow-Up</th>
                    <th className={TABLE.th}>
                      <span className="sr-only">Delete</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((lead) => (
                    <tr
                      key={lead.id}
                      className={cn(TABLE.row, isDue(lead) && 'bg-[color-mix(in_srgb,var(--color-warning)_6%,transparent)]')}
                    >
                      <td className={TABLE.tdPrimary}>
                        <div className="max-w-[240px]">
                          <p className="truncate">{lead.handle}</p>
                          <p className="truncate text-[12px] font-normal text-text-tertiary">{sub(lead)}</p>
                        </div>
                      </td>
                      <td className={TABLE.td}>{statusSelect(lead)}</td>
                      <td className={TABLE.td}>{notesInput(lead, 'w-56')}</td>
                      <td className={TABLE.td}>{contactedCell(lead)}</td>
                      <td className={TABLE.td}>{followUpInput(lead)}</td>
                      <td className={TABLE.td}>{deleteButton(lead)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-[420px] border-0 p-5 sm:p-6">
          <div className="pr-8">
            <DialogTitle className="text-[18px] font-bold">Delete Lead?</DialogTitle>
            <DialogDescription className="mt-1.5">
              “{confirmDelete?.handle}” and its notes are removed from the tracker.
            </DialogDescription>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" onClick={() => setConfirmDelete(null)} className={cn(adminBtn.secondary, 'sm:flex-1')}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const lead = confirmDelete
                setConfirmDelete(null)
                if (lead) remove(lead)
              }}
              className={cn(adminBtn.danger, 'sm:flex-1')}
            >
              <Trash aria-hidden weight="bold" className="h-4 w-4" />
              Delete
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
