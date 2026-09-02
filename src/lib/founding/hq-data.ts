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

/**
 * The four storefront-setup milestones a founder works through, in order.
 * "Confirm email" is done the moment they arrive from the magic link, so it
 * leads; the remaining three carry them into the real signup/verify/list flow.
 */
export type JourneyStepKey =
  | 'email'
  | 'application'
  | 'review'
  | 'listing'

export type JourneyStepState = 'done' | 'current' | 'upcoming'

export interface JourneyStep {
  key: JourneyStepKey
  label: string
  /** One-line description shown under every step title (design 2b). */
  hint: string
  state: JourneyStepState
  /**
   * The step's right-aligned action. Present on done / current / upcoming so the
   * card can render it in the matching visual state (done → "Done" pill, current
   * → solid button, upcoming → locked/disabled). `null` means no button (a step
   * that is purely a status, like the confirmed email).
   */
  action?: { label: string; href: string } | null
}

export interface SellerJourney {
  steps: JourneyStep[]
  /** Index of the current (or last-done) step, for the progress fill. */
  activeIndex: number
  /** How many of the four steps are fully done — drives "N of 4 complete". */
  doneCount: number
  /** Total steps (4) — kept explicit so the UI copy never drifts. */
  total: number
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
 * Turn raw signals into the ordered 4-step storefront setup (design 2b). The
 * "furthest reached" step is `current`; everything before it is `done`,
 * everything after `upcoming`. Every step keeps its action so the card can
 * render a "Done" pill, a live button, or a locked button per state.
 *
 * Step 0 (confirm email) is always done here — a founder only reaches this HQ
 * by opening their magic link, which confirms the email.
 */
function buildJourney({
  hasAccount,
  appStatus,
  listingCount,
}: {
  /** Do they already have an account? Only affects step 2's label/target, not
   *  whether step 2 is "done" (that needs a started application). */
  hasAccount: boolean
  appStatus: string | null
  listingCount: number
}): SellerJourney {
  // How far along are they? (1 = email confirmed … 4 = listing live)
  //
  // Email is ALWAYS done: a founder only reaches this HQ by opening their magic
  // link, which confirms the address. So the minimum is 1, making step 2
  // ("Set Up Your Store") the current, actionable step for a brand-new founder.
  //
  // IMPORTANT: "Set Up Your Store" (step 2) is only DONE once they've actually
  // STARTED the seller application (appStatus exists) — NOT merely because an
  // account exists. Just having a login is not "setting up a store", so it must
  // not tick step 2. (Otherwise a founder who signed up but never filled the
  // seller application sees a false ✓.)
  let reached = 1 // email confirmed — always true for a founder on their HQ
  if (appStatus) reached = 2 // seller application started → store is set up
  if (appStatus === 'approved') reached = 3 // approved → next real action is listing
  if (listingCount > 0) reached = 4

  // Step 2's action adapts to whether they already have an account:
  //   - No account yet (magic-link founder): "Create Account" → the store-name
  //     modal → the signup-to-sell funnel (sets the password safely + tags
  //     founding). The tracker opens the modal for step.key === 'application'.
  //   - Already logged in: "Set Up Store" → straight into the seller wizard
  //     (/account/become-seller). No redundant create-account step.
  const step2Action = hasAccount
    ? { label: 'Set Up Store', href: '/account/become-seller' }
    : { label: 'Create Account', href: '/signup-become-seller?src=founding-hq' }

  // Steps 3 → the seller wizard (ID + agreement); step 4 → the new-listing flow.
  // Labels are short (one line); the hint adds the single-line detail.
  const defs: Array<{
    key: JourneyStepKey
    label: string
    hint: string
    action?: { label: string; href: string }
  }> = [
    {
      key: 'email',
      label: 'Verify Your Email',
      hint: 'Confirmed from your founding link.',
    },
    {
      key: 'application',
      label: 'Set Up Your Store',
      hint: hasAccount ? 'Add your games and store details.' : 'Pick a store name and password.',
      action: step2Action,
    },
    {
      key: 'review',
      label: 'Get Approved',
      hint: 'Verify your ID and sign the agreement.',
      action: { label: 'Start Verification', href: '/account/become-seller' },
    },
    {
      key: 'listing',
      label: 'Start Selling',
      hint: 'List your first item and go live.',
      action: { label: 'Start Listing', href: '/sell/new' },
    },
  ]

  const steps: JourneyStep[] = defs.map((d, i) => {
    const state: JourneyStepState = i < reached ? 'done' : i === reached ? 'current' : 'upcoming'
    return {
      key: d.key,
      label: d.label,
      hint: d.hint,
      state,
      // Action travels in every state; the card styles it by state.
      action: d.action ?? null,
    }
  })

  return { steps, activeIndex: reached, doneCount: reached, total: defs.length }
}

/** Sample journey shown to an admin previewing /founding. */
const PREVIEW_JOURNEY: SellerJourney = buildJourney({
  hasAccount: true,
  appStatus: "pending",
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

      // Self-heal the routing flag: this account's email is on the waitlist, so
      // it's a founding applicant. Setting it here means the account menu shows
      // "Founding Seller" on their next load without needing a separate job.
      // UI/routing only — never grants the `founding_seller` fee perk.
      if (profile?.id) {
        await svc
          .from('profiles')
          .update({ is_founding_applicant: true })
          .eq('id', profile.id)
          .eq('is_founding_applicant', false)
      }
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
