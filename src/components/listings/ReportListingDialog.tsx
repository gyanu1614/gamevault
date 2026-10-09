'use client'

/**
 * "Report this listing": a quiet text link under the buy box that opens a
 * small dialog — pick a reason, add a line, send. Signed-out viewers are
 * sent to log in. Own listings never show it.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Flag } from '@phosphor-icons/react/dist/ssr/Flag'
import { reportListing } from '@/lib/actions/listing-reports'
import { REPORT_REASONS, type ReportReason } from '@/lib/listings/report-reasons'

export function ReportListingLink({ listingId, signedIn }: { listingId: string; signedIn: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason | ''>('')
  const [details, setDetails] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const submit = () => {
    if (!reason) return setError('Pick a reason.')
    setError(null)
    start(async () => {
      const r = await reportListing({ listingId, reason, details })
      if (!r.success) return setError(r.error ?? 'Could not send your report.')
      setDone(r.hidden ? 'Thanks. This listing is now hidden until a moderator reviews it.' : 'Thanks. A moderator will look at it.')
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => (signedIn ? setOpen(true) : router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`))}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 text-[12.5px] text-text-tertiary transition-colors hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <Flag aria-hidden className="h-3.5 w-3.5" />
        Report this listing
      </button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setDone(null); setError(null) } }}>
        <DialogContent className="max-w-[420px] rounded-lg border-white/[0.08] bg-[#16171B] p-5 text-text-primary">
          <DialogTitle className="text-[17px] font-semibold">Report This Listing</DialogTitle>
          <DialogDescription className="text-[13px] text-text-secondary">Tell us what is wrong. Reports are private; the seller does not see who reported.</DialogDescription>
          {done ? (
            <p className="mt-4 rounded-md bg-lime-tint-bg px-3 py-2.5 text-[13.5px] text-lime-text">{done}</p>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              <ul className="flex flex-col gap-1.5">
                {(Object.keys(REPORT_REASONS) as ReportReason[]).map((k) => (
                  <li key={k}>
                    <label className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-[13.5px] transition-colors ${reason === k ? 'border-white/25 bg-white/[0.06]' : 'border-white/[0.08] hover:bg-white/[0.04]'}`}>
                      <input type="radio" name="reason" value={k} checked={reason === k} onChange={() => setReason(k)} className="h-3.5 w-3.5 accent-white" />
                      {REPORT_REASONS[k]}
                    </label>
                  </li>
                ))}
              </ul>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="Anything else a moderator should know (optional)"
                className="w-full resize-none rounded-md border border-white/[0.08] bg-bg-well px-3 py-2 text-[16px] text-text-primary outline-none placeholder:text-text-tertiary focus:border-white/25 sm:text-[13.5px]"
              />
              {error && <p className="text-[13px] text-error">{error}</p>}
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="inline-flex h-10 items-center justify-center rounded-md bg-white px-4 text-[13.5px] font-semibold text-black transition-colors hover:bg-white/90 disabled:opacity-60"
              >
                {pending ? 'Sending…' : 'Send Report'}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
