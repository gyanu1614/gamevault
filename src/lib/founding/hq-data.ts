/**
 * Server-side data resolution for the Founding Seller HQ page (/founding).
 *
 * Three entry states, resolved here so the page component stays declarative:
 *  1. Valid `?id=&token=`  → a real founder: their name, join order, spot number,
 *     status, and whether they gave us a Discord handle. Read via service role
 *     because early_seller_signups is RLS-locked (see migration 20260724).
 *  2. No/invalid token, admin session → a PREVIEW with sample founder data so the
 *     owner can see the real design without a magic link.
 *  3. No/invalid token, anyone else → generic mode: the programme landing (perks
 *     + Discord + apply CTA), no personal data.
 *
 * Never leak: an invalid token resolves to generic/preview, never to a real row.
 */

import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { createClient } from '@/lib/supabase/server'
import { getFoundingProgress } from '@/lib/actions/early-seller'
import { foundingTokenMatches } from './token'
import { FOUNDING_SPOT_CAP, type FoundingProgress } from '@/lib/config/founding-seller'

export type FoundingViewMode = 'founder' | 'preview' | 'generic'

/** The signed-in viewer, for the profile chip + home link (null if logged out). */
export interface HqUser {
  username: string
  avatarUrl: string | null
  /** Approved seller? (profiles.role === 'seller') — governs which menu items show. */
  isSeller: boolean
}

export interface FoundingFounder {
  /** First name / display handle for the greeting. */
  name: string
  /** 1-based join order among all signups (oldest = #1). */
  joinNumber: number
  /** Their application status. */
  status: 'new' | 'contacted' | 'approved' | 'rejected'
  /** Whether they told us a Discord handle at signup. */
  hasDiscord: boolean
  /** ISO date they applied — for "applied N days ago". */
  appliedAt: string
}

/** The five milestones on a founder's path to selling, in order. */
export type JourneyStepKey =
  | 'claimed'
  | 'application'
  | 'review'
  | 'approved'
  | 'listing'

export type JourneyStepState = 'done' | 'current' | 'upcoming'

export interface JourneyStep {
  key: JourneyStepKey
  label: string
  /** Short line shown under the current step only. */
  hint: string
  state: JourneyStepState
}

export interface SellerJourney {
  steps: JourneyStep[]
  /** Index of the current (or last-done) step, for the progress fill. */
  activeIndex: number
}

export interface FoundingHqData {
  mode: FoundingViewMode
  founder: FoundingFounder | null
  progress: FoundingProgress | null
  /** Per-founder status tracker (null in generic mode). */
  journey: SellerJourney | null
  /** Signed-in viewer for the profile chip; null when logged out. */
  user: HqUser | null
  cap: number
}

/** Sample founder shown to an admin previewing /founding with no token. */
const PREVIEW_FOUNDER: FoundingFounder = {
  name: 'Alex',
  joinNumber: 12,
  status: 'new',
  hasDiscord: false,
  appliedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
}

/**
 * Resolve the founder identified by a magic-link (id + token). Returns null when
 * the token is missing/invalid or the row doesn't exist — the caller decides
 * whether that becomes preview (admin) or generic.
 */
async function resolveFounderFromToken(
  id: string | undefined,
  token: string | undefined,
): Promise<{ founder: FoundingFounder; email: string } | null> {
  if (!id || !token) return null

  // early_seller_signups isn't in the generated DB types, so query through
  // `as any` at the boundary — the same pattern src/lib/actions/early-seller.ts
  // uses for this table.
  const supabase = createServiceRoleClient() as any
  const { data: row, error } = await supabase
    .from('early_seller_signups')
    .select('id, username, email, discord, status, created_at')
    .eq('id', id)
    .maybeSingle()

  if (error || !row) return null
  if (!foundingTokenMatches(row.id, row.email, token)) return null

  // Join order = how many signups are older-or-equal to this one.
  const { count } = await supabase
    .from('early_seller_signups')
    .select('id', { count: 'exact', head: true })
    .lte('created_at', row.created_at)

  const founder: FoundingFounder = {
    name: firstName(row.username),
    joinNumber: count ?? 1,
    status: (row.status as FoundingFounder['status']) ?? 'new',
    hasDiscord: Boolean(row.discord && row.discord.trim()),
    appliedAt: row.created_at,
  }
  return { founder, email: row.email as string }
}

/**
 * Resolve a founder's real selling journey by matching their waitlist email to
 * an account, then reading their seller application status and listing count.
 * Everything degrades gracefully: no account yet → only "Claimed" is done.
 *
 * Chain: early_seller_signups.email → profiles(id) → seller_applications(status)
 *        + listings(count by seller_id).
 */
async function resolveSellerJourney(email: string): Promise<SellerJourney> {
  const supabase = createServiceRoleClient() as any

  // 1. Do they have an account? (match on lowercased email)
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .ilike('email', email.trim())
    .maybeSingle()

  let appStatus: string | null = null
  let listingCount = 0

  if (profile?.id) {
    // 2. Their latest seller application status.
    const { data: app } = await supabase
      .from('seller_applications')
      .select('status, created_at')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    appStatus = (app?.status as string) ?? null

    // 3. How many listings they have.
    const { count } = await supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', profile.id)
    listingCount = count ?? 0
  }

  return buildJourney({ hasAccount: Boolean(profile?.id), appStatus, listingCount })
}

/**
 * Turn raw signals into the ordered 5-step tracker. The "furthest reached" step
 * is `current`; everything before it is `done`, everything after `upcoming`.
 */
function buildJourney({
  hasAccount,
  appStatus,
  listingCount,
}: {
  hasAccount: boolean
  appStatus: string | null
  listingCount: number
}): SellerJourney {
  // How far along are they? (0 = claimed … 4 = listing live)
  let reached = 0 // claimed — always true for a founder on their HQ
  if (hasAccount || appStatus) reached = 1 // application started
  if (appStatus === 'pending' || appStatus === 'under_review' || appStatus === 'info_requested') reached = 2
  if (appStatus === 'approved') reached = 3
  if (listingCount > 0) reached = 4

  const defs: Array<{ key: JourneyStepKey; label: string; hint: string }> = [
    { key: 'claimed', label: 'Claimed your spot', hint: 'You’re in the founding programme.' },
    { key: 'application', label: 'Application started', hint: 'Finish your seller application to move forward.' },
    { key: 'review', label: 'Under review', hint: 'We’re reviewing your application — usually a couple of days.' },
    { key: 'approved', label: 'Approved to sell', hint: 'You’re cleared — list your first item.' },
    { key: 'listing', label: 'First listing live', hint: 'You’re selling. Nice.' },
  ]

  const steps: JourneyStep[] = defs.map((d, i) => ({
    ...d,
    state: i < reached ? 'done' : i === reached ? 'current' : 'upcoming',
  }))

  return { steps, activeIndex: reached }
}

/** Sample journey shown to an admin previewing /founding. */
const PREVIEW_JOURNEY: SellerJourney = buildJourney({
  hasAccount: true,
  appStatus: 'pending',
  listingCount: 0,
})

/**
 * Resolve the currently signed-in user's real founder view from their session:
 * their profile identity + real selling journey. Returns null when logged out
 * or the profile can't be read. This is what makes the page functional for a
 * user who's actually logged in (e.g. an approved seller sees THEIR status, not
 * sample data).
 */
async function resolveLoggedInFounder(): Promise<{
  founder: FoundingFounder
  journey: SellerJourney
  user: HqUser
} | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Profile identity (service role so RLS never hides the row we already own).
  const svc = createServiceRoleClient() as any
  const { data: profile } = await svc
    .from('profiles')
    .select('id, username, full_name, email, avatar_url, created_at, role')
    .eq('id', user.id)
    .maybeSingle()

  const email = (profile?.email as string) || user.email || ''
  const username = (profile?.full_name as string) || (profile?.username as string) || 'there'

  // Their real journey + a founder record built from real data. joinNumber comes
  // from the matching waitlist row if they have one (else omitted gracefully).
  const journey = email ? await resolveSellerJourney(email) : buildJourney({ hasAccount: true, appStatus: null, listingCount: 0 })

  let joinNumber = 0
  if (email) {
    const { data: wl } = await svc
      .from('early_seller_signups')
      .select('created_at')
      .ilike('email', email.trim())
      .maybeSingle()
    if (wl?.created_at) {
      const { count } = await svc
        .from('early_seller_signups')
        .select('id', { count: 'exact', head: true })
        .lte('created_at', wl.created_at)
      joinNumber = count ?? 0
    }
  }

  const founder: FoundingFounder = {
    name: firstName(username),
    joinNumber, // 0 → rail shows the generic "First 100" headline instead of #N
    status: 'new',
    hasDiscord: false,
    appliedAt: (profile?.created_at as string) || new Date(0).toISOString(),
  }
  const hqUser: HqUser = {
    username,
    avatarUrl: (profile?.avatar_url as string) || null,
    // profiles.role === 'seller' is the source of truth for an APPROVED seller.
    isSeller: (profile?.role as string) === 'seller',
  }
  return { founder, journey, user: hqUser }
}

/**
 * Full HQ data for the page. Priority: magic-link founder → signed-in user's own
 * real data → admin preview (sample) → generic public landing.
 */
export async function getFoundingHqData({
  id,
  token,
  isAdmin,
}: {
  id?: string
  token?: string
  isAdmin: boolean
}): Promise<FoundingHqData> {
  const progress = await getFoundingProgress()

  // 1. Magic-link founder (waitlist applicant, no account needed).
  const resolved = await resolveFounderFromToken(id, token)
  if (resolved) {
    const journey = await resolveSellerJourney(resolved.email)
    return { mode: 'founder', founder: resolved.founder, progress, journey, user: null, cap: FOUNDING_SPOT_CAP }
  }

  // 2. A signed-in user viewing their own HQ — real identity + real status.
  const loggedIn = await resolveLoggedInFounder()
  if (loggedIn) {
    return {
      mode: 'founder',
      founder: loggedIn.founder,
      progress,
      journey: loggedIn.journey,
      user: loggedIn.user,
      cap: FOUNDING_SPOT_CAP,
    }
  }

  // 3. Admin previewing with no token/session match — sample data.
  if (isAdmin) {
    return { mode: 'preview', founder: PREVIEW_FOUNDER, progress, journey: PREVIEW_JOURNEY, user: null, cap: FOUNDING_SPOT_CAP }
  }

  // 4. Logged-out stranger — generic programme landing.
  return { mode: 'generic', founder: null, progress, journey: null, user: null, cap: FOUNDING_SPOT_CAP }
}

/** First token of a username/handle, capped so a greeting never runs long. */
function firstName(username: string): string {
  const first = (username || '').trim().split(/[\s@._-]+/)[0] || 'there'
  return first.length > 20 ? first.slice(0, 20) : first
}
