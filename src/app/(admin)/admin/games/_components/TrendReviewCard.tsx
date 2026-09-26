'use client'

/**
 * Review card for a trend-radar game (review_status pending | declining).
 * Rendered under its row in /admin/games. Everything shown here is evidence
 * the radar collected — metrics, signals, prepare steps, the wiki draft — and
 * the three decisions: Approve (game goes live), Reject (note, 90-day
 * suppression), Snooze (7 days).
 */

import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, X, Clock, ExternalLink, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  fetchTrendReview, approveTrendGame, rejectTrendGame, snoozeTrendGame, type ReviewData,
} from '@/lib/actions/admin-trend-review'

const SIGNAL_LABEL: Record<string, string> = {
  top30_entry: 'Entered top 30',
  growth_48h: '48h growth',
  rmt_chart: 'New on Eldorado chart',
}

function fmt(n: number | null | undefined) {
  return typeof n === 'number' ? n.toLocaleString('en-US') : '—'
}

function Sparkline({ points }: { points: { captured_at: string; playing: number }[] }) {
  if (points.length < 2) {
    return <div className="text-[12px] text-text-tertiary">{points.length === 1 ? `1 sample: ${fmt(points[0].playing)} playing` : 'No samples yet'}</div>
  }
  const w = 220
  const h = 44
  const max = Math.max(...points.map((p) => p.playing), 1)
  const min = Math.min(...points.map((p) => p.playing))
  const span = Math.max(max - min, 1)
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * (w - 2) + 1
      const y = h - 1 - ((p.playing - min) / span) * (h - 2)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <div className="flex items-end gap-3">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible" aria-label="Players over the last 7 days">
        <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-lime" />
      </svg>
      <div className="text-[12px] leading-tight text-text-tertiary">
        <div>max <span className="font-mono text-text-secondary">{fmt(max)}</span></div>
        <div>now <span className="font-mono text-text-secondary">{fmt(points[points.length - 1].playing)}</span></div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-text-tertiary">{label}</div>
      <div className="mt-1 text-[13px] text-text-secondary">{children}</div>
    </div>
  )
}

function Step({ ok, label }: { ok: boolean | 'warn'; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px]',
        ok === true && 'border-lime-tint-border bg-lime-tint-bg text-lime-text',
        ok === 'warn' && 'border-warning bg-warning-bg text-warning',
        ok === false && 'border-border-default bg-bg-raised text-text-tertiary',
      )}
    >
      {ok === true ? <Check className="h-3 w-3" /> : ok === 'warn' ? <AlertTriangle className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {label}
    </span>
  )
}

export function TrendReviewCard({ gameId, slug, onChanged }: { gameId: string; slug: string; onChanged?: () => void }) {
  const qc = useQueryClient()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [note, setNote] = useState('')

  const q = useQuery<ReviewData | null>({
    queryKey: ['admin-trend-review', gameId],
    queryFn: () => fetchTrendReview(gameId),
    staleTime: 30_000,
  })

  const done = (msg: string) => {
    toast.success(msg)
    qc.invalidateQueries({ queryKey: ['admin-games'] })
    qc.invalidateQueries({ queryKey: ['admin-trend-review', gameId] })
    onChanged?.()
  }
  const approve = useMutation({
    mutationFn: () => approveTrendGame(gameId),
    onSuccess: (r) => (r.ok ? done(`${slug} is live`) : toast.error(r.error)),
    onError: (e: any) => toast.error(e?.message ?? 'Approve failed'),
  })
  const reject = useMutation({
    mutationFn: () => rejectTrendGame(gameId, note),
    onSuccess: (r) => {
      if (r.ok) { setRejectOpen(false); setNote(''); done(`${slug} rejected`) } else toast.error(r.error)
    },
    onError: (e: any) => toast.error(e?.message ?? 'Reject failed'),
  })
  const snooze = useMutation({
    mutationFn: () => snoozeTrendGame(gameId),
    onSuccess: (r) => (r.ok ? done(`${slug} snoozed for 7 days`) : toast.error(r.error)),
    onError: (e: any) => toast.error(e?.message ?? 'Snooze failed'),
  })
  const busy = approve.isPending || reject.isPending || snooze.isPending

  if (q.isLoading) return <div className="px-5 py-4 text-[13px] text-text-tertiary">Loading review…</div>
  const r = q.data
  if (!r) return <div className="px-5 py-4 text-[13px] text-text-tertiary">No review data for this game.</div>

  const g = r.game
  const primary = r.events.find((e) => e.signal === 'top30_entry') ?? r.events[0]
  const flags = Object.assign({}, ...r.events.map((e) => e.flags ?? {})) as Record<string, any>
  const prep = (r.prepare ?? {}) as Record<string, any>
  const draft = r.draft
  const robloxUrl = flags.rootPlaceId
    ? `https://www.roblox.com/games/${flags.rootPlaceId}`
    : r.externalId ? `https://www.roblox.com/games/refer?universeId=${r.externalId}` : null
  const warnings: string[] = []
  if (flags.ambiguous) warnings.push('Title matched more than one universe — resolved to the busier one; check the Roblox link.')
  if (flags.slugCollision) warnings.push(`Slug "${flags.slugCollision}" was taken; created as "${g.slug}".`)
  if (Array.isArray(prep.errors) && prep.errors.length) warnings.push(...prep.errors.map((e: string) => `Prepare: ${e}`))
  if (g.review_status === 'declining' && g.review_note) warnings.push(g.review_note)

  return (
    <div className="border-b border-border-subtle bg-bg-base/60 px-5 py-5">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr_1fr]">
        {/* Evidence */}
        <div className="space-y-4">
          <Field label="Players · last 7 days">
            <Sparkline points={r.metrics} />
          </Field>
          <Field label="Signals">
            <ul className="space-y-1">
              {r.events.length === 0 && <li className="text-text-tertiary">—</li>}
              {r.events.map((e) => (
                <li key={e.id} className="flex items-baseline gap-2">
                  <span className="text-text-primary">{SIGNAL_LABEL[e.signal] ?? e.signal}</span>
                  <span className="font-mono text-[12px] text-text-tertiary">
                    {e.signal === 'top30_entry' && `#${e.value}`}
                    {e.signal === 'growth_48h' && `+${e.value}% (${fmt(e.flags?.playing48hAgo)} → ${fmt(e.flags?.playingNow)})`}
                    {e.signal === 'rmt_chart' && (e.flags?.resolved?.matchedTitle ?? '')}
                    {' · '}{new Date(e.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </li>
              ))}
            </ul>
          </Field>
          <Field label="Detected">
            {g.trend_detected_at ? new Date(g.trend_detected_at).toLocaleString('en-GB') : '—'}
            {typeof g.trend_peak_playing === 'number' && <> · peak <span className="font-mono">{fmt(g.trend_peak_playing)}</span> playing</>}
            {primary?.flags?.playingNow && <> · now <span className="font-mono">{fmt(primary.flags.playingNow)}</span></>}
          </Field>
        </div>

        {/* Prepared */}
        <div className="space-y-4">
          <Field label="Prepared">
            <div className="flex flex-wrap gap-1.5">
              <Step ok={r.categories.length >= 2} label={`Categories: ${r.categories.length ? r.categories.join(', ') : 'none'}`} />
              <Step ok={g.image_url ? true : prep.icon === 'ambiguous' || prep.icon === 'unmatched' ? 'warn' : false} label={`Icon: ${g.image_url ? 'ready' : prep.icon ?? 'pending'}`} />
              <Step ok={draft?.found ? true : draft ? 'warn' : false} label={draft?.found ? 'Wiki draft' : draft ? 'No wiki found' : 'Wiki: pending'} />
              <Step ok={prep.discord === 'sent' || prep.discord === 'already'} label={`Discord: ${prep.discord ?? 'pending'}`} />
            </div>
          </Field>
          <Field label="Draft taxonomy (read-only, from Fandom)">
            {!draft ? (
              <span className="text-text-tertiary">Not generated yet.</span>
            ) : !draft.found ? (
              <span className="text-text-tertiary">{draft.note ?? 'No wiki found for this title.'}</span>
            ) : (
              <div className="space-y-1.5">
                <div className="text-[12px] text-text-tertiary">
                  <a href={draft.wiki?.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary">
                    {draft.wiki?.sitename} <ExternalLink className="h-3 w-3" />
                  </a>{' '}· {fmt(draft.wiki?.articles)} articles
                </div>
                {draft.categories.map((c) => (
                  <div key={c.name}>
                    <span className="text-text-primary">{c.name}</span>
                    <span className="text-text-tertiary"> ({c.size}) · </span>
                    <span className="text-[12px] text-text-tertiary">{c.members.slice(0, 8).join(', ')}{c.members.length > 8 ? '…' : ''}</span>
                  </div>
                ))}
                {draft.rarities.length > 0 && (
                  <div><span className="text-text-primary">Rarities</span><span className="text-text-tertiary"> · {draft.rarities.join(' · ')}</span></div>
                )}
                {draft.currencies.length > 0 && (
                  <div><span className="text-text-primary">Currencies</span><span className="text-text-tertiary"> · {draft.currencies.join(', ')}</span></div>
                )}
              </div>
            )}
          </Field>
        </div>

        {/* Decide */}
        <div className="space-y-4">
          {warnings.length > 0 && (
            <div className="rounded-xl border border-warning bg-warning-bg px-3 py-2 text-[12.5px] text-warning">
              <ul className="list-disc space-y-0.5 pl-4">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          )}
          <Field label="Links">
            <div className="flex flex-wrap gap-3 text-[12.5px]">
              {robloxUrl && <a href={robloxUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary">Roblox page <ExternalLink className="h-3 w-3" /></a>}
              <a href={`/admin/games/${g.id}/edit`} className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary">Edit game</a>
              {r.externalId && <span className="font-mono text-text-tertiary">universe {r.externalId}</span>}
            </div>
          </Field>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={() => approve.mutate()} disabled={busy} className="bg-lime text-black hover:bg-lime/90">
              <Check className="mr-1.5 h-4 w-4" /> Approve &amp; Go Live
            </Button>
            {g.review_status !== 'rejected' && (
              <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)} disabled={busy}>
                <X className="mr-1.5 h-4 w-4" /> Reject
              </Button>
            )}
            {g.review_status === 'pending' && (
              <Button size="sm" variant="ghost" onClick={() => snooze.mutate()} disabled={busy}>
                <Clock className="mr-1.5 h-4 w-4" /> Snooze 7 Days
              </Button>
            )}
          </div>
          {g.review_snoozed_until && new Date(g.review_snoozed_until) > new Date() && (
            <div className="text-[12px] text-text-tertiary">Snoozed until {new Date(g.review_snoozed_until).toLocaleDateString('en-GB')} — no re-alerts before then.</div>
          )}
          <p className="text-[12px] leading-relaxed text-text-tertiary">
            Approve sets the game active and posts a &ldquo;live&rdquo; reply in Discord. Reject keeps it hidden and suppresses re-alerts for 90 days. Nothing here touches listings, fees or existing games.
          </p>
        </div>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {g.name}?</DialogTitle>
            <DialogDescription>
              The game stays hidden and the radar will not alert on it again for 90 days. The note is kept on the game for later.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why not — e.g. no tradeable items, already covered by another game, knock-off…"
            rows={3}
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={reject.isPending}>Cancel</Button>
            <Button variant="destructive" onClick={() => reject.mutate()} disabled={reject.isPending || !note.trim()}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
