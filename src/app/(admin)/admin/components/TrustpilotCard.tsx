'use client'

/**
 * /admin — Trustpilot invites this week + the review-count switch.
 *
 * Counts come from trustpilot_invitations (one row per completed order; see
 * lib/trustpilot/invite.ts). The review count is typed in by an admin from
 * the Trustpilot profile; at 10+ the public TrustBox appears on the home and
 * listing pages without a redeploy.
 */
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'

import { setTrustpilotReviewCount, type TrustpilotSummary } from '@/lib/actions/admin-trustpilot'
import { TRUSTBOX_MIN_REVIEWS, TRUSTPILOT_PROFILE_URL } from '@/lib/trustpilot/links'

const CELLS: Array<{ key: 'scheduled' | 'sent' | 'failed' | 'skipped'; label: string }> = [
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'sent', label: 'Sent' },
  { key: 'failed', label: 'Failed' },
  { key: 'skipped', label: 'Skipped' },
]

export function TrustpilotCard({ summary, loadError }: { summary: TrustpilotSummary | null; loadError?: string }) {
  const [count, setCount] = useState(String(summary?.reviewCount ?? 0))
  const [saved, setSaved] = useState(summary?.reviewCount ?? 0)
  const [pending, startTransition] = useTransition()

  const save = () => {
    const n = Number(count)
    startTransition(async () => {
      const res = await setTrustpilotReviewCount(n)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setSaved(n)
      toast.success('Review count saved')
    })
  }

  const showing = saved >= TRUSTBOX_MIN_REVIEWS

  return (
    <section className="rounded-lg bg-[#16171B] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-semibold text-text-primary">Trustpilot Reviews</h2>
          <p className="mt-0.5 text-[12.5px] text-text-tertiary">Review invites from the last 7 days</p>
        </div>
        <a
          href={TRUSTPILOT_PROFILE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3.5 text-[13px] font-semibold text-[#0F1012] transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring"
        >
          Open Profile
          <OpenInNewIcon aria-hidden sx={{ fontSize: 15 }} />
        </a>
      </div>

      {summary ? (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CELLS.map((c) => (
            <div key={c.key} className="rounded-lg bg-[#24252B] px-3.5 py-3">
              <p className="text-[12.5px] font-medium text-text-secondary">{c.label}</p>
              <p className="mt-1 text-[22px] font-bold leading-tight tabular-nums text-text-primary">
                {summary[c.key].toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-[13px] text-text-secondary">{loadError ?? 'Couldn’t load invite stats.'}</p>
      )}

      {summary && !summary.bccConfigured && (
        <p className="mt-3 text-[13px] text-text-secondary">
          TRUSTPILOT_BCC_EMAIL is not set, so no invites can go out.
        </p>
      )}
      {summary && summary.failed > 0 && (
        <p className="mt-3 text-[13px] text-text-secondary">
          The daily run retries failed invites (up to three tries). If one fails two days in a row, a Discord alert goes out.
        </p>
      )}

      <div className="mt-5 border-t border-white/[0.06] pt-4">
        <label htmlFor="trustpilot-review-count" className="text-[13px] font-semibold text-text-primary">
          Reviews On Trustpilot
        </label>
        <p className="mt-0.5 text-[12.5px] text-text-tertiary">
          Copy the number from the profile. The TrustBox shows on the home and listing pages at {TRUSTBOX_MIN_REVIEWS} or more.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            id="trustpilot-review-count"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="h-10 w-28 rounded-lg bg-[#24252B] px-3 text-base tabular-nums text-text-primary outline-none focus-visible:ring-1 focus-visible:ring-focus-ring sm:text-sm"
          />
          <button
            type="button"
            onClick={save}
            disabled={pending || count === String(saved) || count.trim() === ''}
            className="h-10 rounded-lg bg-[#24252B] px-4 text-[13px] font-semibold text-text-primary transition-colors hover:bg-[#2C2D34] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
          <span className="text-[12.5px] text-text-secondary">
            {showing ? 'TrustBox: Showing' : `TrustBox: Hidden (${saved}/${TRUSTBOX_MIN_REVIEWS})`}
          </span>
        </div>
      </div>
    </section>
  )
}
