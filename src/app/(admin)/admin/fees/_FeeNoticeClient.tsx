'use client'

/**
 * Seller fee notice sender (PR 7, Part 5). Dry run shows the facts, the
 * recipient list and the rendered email; Send requires typing SEND and is
 * at-most-once per seller (seller_notice_sends claim before the send).
 */

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { AdminPanel } from '../components/kit'
import { previewFeeNotice, sendFeeNotice } from '@/lib/actions/fee-notice'

type Preview = Awaited<ReturnType<typeof previewFeeNotice>>

export function FeeNoticeClient() {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [confirm, setConfirm] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [busy, start] = useTransition()

  const dryRun = () =>
    start(async () => {
      const p = await previewFeeNotice()
      if (!p.success) return void toast.error(p.error || 'Preview failed')
      setPreview(p)
      setResult(null)
    })

  const send = () =>
    start(async () => {
      const r = await sendFeeNotice({ confirm: 'SEND' })
      if (!r.success) return void toast.error(r.error || 'Send failed')
      setResult(`Sent ${r.sent}, skipped ${r.skipped} (already claimed), failed ${r.failed}. Key ${r.noticeKey}.`)
      setConfirm('')
      const p = await previewFeeNotice()
      if (p.success) setPreview(p)
    })

  return (
    <AdminPanel>
      <div className="mb-4">
        <h2 className="text-[15px] font-semibold text-text-primary">Seller fee notice</h2>
        <p className="mt-0.5 text-[12.5px] text-text-tertiary">
          Emails every active seller once: the new commission schedule and its start date, the founding rate, payout fees and minimums,
          the new-seller withdrawal rule, the completion hold and the dispute window. Dry run first — nothing is sent until you type SEND.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={dryRun} disabled={busy}>{busy ? 'Working…' : 'Dry Run'}</Button>
        {preview?.success && (
          <span className="text-[12.5px] text-text-secondary">
            {preview.recipients?.length ?? 0} to send · {preview.alreadySent ?? 0} already sent · {preview.failed ?? 0} failed · key <span className="font-mono">{preview.noticeKey}</span>
          </span>
        )}
      </div>

      {preview?.success && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="rounded-lg border border-border-default bg-bg-overlay p-3 text-[12.5px]">
              <div className="font-semibold text-text-primary">Facts (from the database)</div>
              <ul className="mt-1.5 space-y-0.5 text-text-secondary">
                <li>Rates start: <b className="text-text-primary">{new Date(preview.facts!.ratesStartAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</b></li>
                <li>Founding: {preview.facts!.foundingDiscountPct}% off for the {preview.facts!.foundingPeriodText}</li>
                {preview.facts!.methods.map((m) => <li key={m.displayName}>{m.displayName}: {m.feeText}, min ${m.minWithdrawal}</li>)}
                <li>Hold {preview.facts!.completionHoldHours} h · dispute window {preview.facts!.disputeWindowDays} d · seller gate {preview.facts!.minAccountAgeDays} d · payout freeze {preview.facts!.payoutFreezeHours} h</li>
              </ul>
            </div>
            <div className="rounded-lg border border-border-default bg-bg-overlay p-3 text-[12.5px]">
              <div className="font-semibold text-text-primary">Recipients ({preview.recipients?.length ?? 0})</div>
              <ul className="mt-1.5 max-h-56 space-y-0.5 overflow-auto text-text-secondary">
                {(preview.recipients ?? []).map((r) => <li key={r.id} className="truncate">{r.name} · {r.email}</li>)}
                {(preview.recipients?.length ?? 0) === 0 && <li className="text-text-tertiary">Nobody left to send to.</li>}
              </ul>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <label className="block text-[12.5px] font-medium text-text-primary">Type SEND to email {preview.recipients?.length ?? 0} seller{(preview.recipients?.length ?? 0) === 1 ? '' : 's'}</label>
              <div className="mt-2 flex gap-2">
                <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="SEND"
                  className="w-32 rounded-lg border border-border-default bg-bg-overlay px-3 py-1.5 font-mono text-[13px] text-text-primary focus:outline-none focus:ring-1 focus:ring-lime-text" />
                <Button size="sm" disabled={busy || confirm !== 'SEND' || (preview.recipients?.length ?? 0) === 0} onClick={send}>
                  {busy ? 'Sending…' : 'Send Notice'}
                </Button>
              </div>
              {result && <p className="mt-2 text-[12.5px] text-text-secondary">{result}</p>}
            </div>
          </div>
          <div className="min-w-0">
            <div className="mb-1.5 text-[12.5px] text-text-secondary">Subject: <span className="font-medium text-text-primary">{preview.subject}</span></div>
            <iframe title="Fee notice preview" srcDoc={preview.html} className="h-[720px] w-full rounded-lg border border-border-default bg-white" sandbox="" />
          </div>
        </div>
      )}
    </AdminPanel>
  )
}
