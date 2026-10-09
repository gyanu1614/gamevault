'use server'

/**
 * Open seller signup — the server half of /founding (2026-10-08).
 *
 * Four steps, one row per user in seller_onboarding, one append-only row per
 * signature in seller_agreements, and ONE write that makes the account a
 * seller: the service-role RPC seller_onboarding_complete (migration
 * 20261008023032). Every action here:
 *   · reads the user from the session (never from the input);
 *   · validates with the zod schemas in @/lib/founding/onboarding;
 *   · writes as the service role scoped to that user (the tables are closed
 *     to JWT callers);
 *   · never flips profiles.role itself — only the RPC does, after it has
 *     re-checked details + store + a signature for the CURRENT agreement.
 *
 * Identity verification is NOT part of this flow: the seller lists as
 * unverified (no blue badge, listings above UNVERIFIED_REVIEW_PRICE_USD go to
 * review) and verifies at their first withdrawal (payout gate: kyc_required).
 */

import { createHash, randomUUID } from 'node:crypto'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { rateLimitAction } from '@/lib/security/rate-limit'
import { getLegalDoc, LEGAL_ENTITY } from '@/lib/legal/documents'
import { getFoundingProgress } from '@/lib/actions/early-seller'
import { uploadProfileAvatar } from '@/lib/actions/auth'
import type { FoundingProgress } from '@/lib/config/founding-seller'
import { slugify } from '@/lib/utils'
import {
  agreementCanonicalText,
  agreementVersionOf,
  completionRefusalMessage,
  deriveStage,
  detailsSchema,
  parsePngDataUrl,
  storeNameSchema,
  typedNameSchema,
  type DetailsInput,
  type FoundingStage,
  type SellsEntry,
} from '@/lib/founding/onboarding'

const SIGNATURE_BUCKET = 'seller-signatures'

export interface FoundingFlowState {
  signedIn: boolean
  user: { id: string; email: string | null; name: string | null; avatarUrl: string | null } | null
  /** profiles.role === 'seller' — the flow is finished. */
  isSeller: boolean
  isVerified: boolean
  /** profiles.founding_seller — the half-price fee programme. */
  isFounding: boolean
  shopSlug: string | null
  shopName: string | null
  details: {
    country: string | null
    sells: SellsEntry[]
    discord: string | null
    isAdult: boolean
  } | null
  store: { name: string | null; logoUploadedAt: string | null } | null
  agreement: { signedAt: string; version: string } | null
  /** The version the seller must sign now (from documents.ts). */
  agreementVersion: string
  stage: FoundingStage
  progress: FoundingProgress | null
}

async function sessionUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function svc() {
  return createServiceRoleClient() as any
}

function currentAgreement() {
  const doc = getLegalDoc('seller-agreement')
  if (!doc) throw new Error('seller-agreement document missing')
  const version = agreementVersionOf(doc, LEGAL_ENTITY.version)
  const text = agreementCanonicalText(doc, LEGAL_ENTITY.version)
  const sha256 = createHash('sha256').update(text, 'utf8').digest('hex')
  return { doc, version, sha256 }
}

/** First hop of x-forwarded-for + the user agent; null outside a request. */
async function requestIdentity(): Promise<{ ip: string | null; ua: string | null }> {
  try {
    const h = await headers()
    const fwd = h.get('x-forwarded-for')
    const ip = (fwd ? fwd.split(',')[0].trim() : h.get('x-real-ip')) || null
    const ua = h.get('user-agent')
    return { ip: ip && /^[0-9a-fA-F.:]{3,45}$/.test(ip) ? ip : null, ua: ua ? ua.slice(0, 300) : null }
  } catch {
    return { ip: null, ua: null }
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getFoundingFlowState(): Promise<FoundingFlowState> {
  const { version } = currentAgreement()
  const progressP = getFoundingProgress().catch(() => null)
  const user = await sessionUser()

  if (!user) {
    return {
      signedIn: false, user: null, isSeller: false, isVerified: false, isFounding: false, shopSlug: null, shopName: null,
      details: null, store: null, agreement: null, agreementVersion: version, stage: 1, progress: await progressP,
    }
  }

  const s = svc()
  const [{ data: profile }, { data: ob }, { data: ag }] = await Promise.all([
    s.from('profiles').select('id, email, full_name, username, avatar_url, role, is_verified, founding_seller, shop_slug, shop_name').eq('id', user.id).maybeSingle(),
    s.from('seller_onboarding').select('country, sells, discord, is_adult_confirmed_at, store_name, logo_uploaded_at, completed_at').eq('user_id', user.id).maybeSingle(),
    s.from('seller_agreements').select('signed_at, agreement_version').eq('user_id', user.id).eq('agreement_version', version).order('signed_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  const isSeller = profile?.role === 'seller'
  const details = ob
    ? {
        country: ob.country ?? null,
        sells: Array.isArray(ob.sells) ? (ob.sells as SellsEntry[]) : [],
        discord: ob.discord ?? null,
        isAdult: Boolean(ob.is_adult_confirmed_at),
      }
    : null
  const detailsDone = Boolean(details && details.country && details.isAdult && details.sells.length > 0)
  const storeDone = Boolean(ob?.store_name)

  return {
    signedIn: true,
    user: {
      id: user.id,
      email: profile?.email ?? user.email ?? null,
      name: profile?.full_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
    },
    isSeller,
    isVerified: profile?.is_verified === true,
    isFounding: profile?.founding_seller === true,
    shopSlug: profile?.shop_slug ?? null,
    shopName: profile?.shop_name ?? null,
    details,
    store: ob ? { name: ob.store_name ?? null, logoUploadedAt: ob.logo_uploaded_at ?? null } : null,
    agreement: ag ? { signedAt: ag.signed_at, version: ag.agreement_version } : null,
    agreementVersion: version,
    stage: deriveStage({ signedIn: true, isSeller, details: detailsDone, store: storeDone, agreement: Boolean(ag) }),
    progress: await progressP,
  }
}

// ── Step 2: details ───────────────────────────────────────────────────────────

export async function saveFoundingDetails(input: DetailsInput): Promise<{ success: boolean; error?: string }> {
  try {
    const limited = await rateLimitAction('contact')
    if (limited) return { success: false, error: limited.error }
    const user = await sessionUser()
    if (!user) return { success: false, error: 'Sign in first.' }

    const parsed = detailsSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Check the form.' }
    const d = parsed.data

    const { error } = await svc().from('seller_onboarding').upsert(
      {
        user_id: user.id,
        country: d.country,
        sells: d.sells,
        discord: d.discord || null,
        is_adult_confirmed_at: new Date().toISOString(),
        ...(d.source ? { source: d.source } : {}),
        current_step: 3,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    if (error) throw error
    return { success: true }
  } catch (err: any) {
    console.error('[founding] saveFoundingDetails:', err?.message)
    return { success: false, error: 'Could not save your details. Try again.' }
  }
}

// ── Step 3: store ─────────────────────────────────────────────────────────────

/** Store names are unique ignoring case; the slug they produce must be free too. */
export async function checkStoreNameAvailable(name: string): Promise<{ available: boolean; error?: string }> {
  try {
    const user = await sessionUser()
    if (!user) return { available: false, error: 'Sign in first.' }
    const parsed = storeNameSchema.safeParse(name)
    if (!parsed.success) return { available: false, error: parsed.error.issues[0]?.message }
    const clean = parsed.data
    const slug = slugify(clean)
    if (slug.length < 3) return { available: false, error: 'Add a few more letters or numbers' }

    const s = svc()
    const [{ data: byName }, { data: bySlug }] = await Promise.all([
      s.from('profiles').select('id').ilike('shop_name', clean.replace(/[%_]/g, (c: string) => `\\${c}`)).neq('id', user.id).limit(1),
      s.from('profiles').select('id').eq('shop_slug', slug).neq('id', user.id).limit(1),
    ])
    if ((byName?.length ?? 0) > 0) return { available: false, error: 'That store name is taken.' }
    if ((bySlug?.length ?? 0) > 0) return { available: false, error: 'That store name is too close to an existing one.' }
    return { available: true }
  } catch (err: any) {
    console.error('[founding] checkStoreNameAvailable:', err?.message)
    return { available: false, error: 'Could not check that name. Try again.' }
  }
}

export async function saveFoundingStore(input: { storeName: string; logoDataUrl?: string | null }): Promise<{ success: boolean; error?: string; logoUrl?: string | null }> {
  try {
    const limited = await rateLimitAction('contact')
    if (limited) return { success: false, error: limited.error }
    const user = await sessionUser()
    if (!user) return { success: false, error: 'Sign in first.' }

    const check = await checkStoreNameAvailable(input.storeName)
    if (!check.available) return { success: false, error: check.error ?? 'That store name is taken.' }
    const storeName = storeNameSchema.parse(input.storeName)

    let logoUrl: string | null = null
    if (input.logoDataUrl) {
      // The avatar IS the store logo on the storefront. uploadProfileAvatar
      // re-validates type + size and writes to the capped `avatars` bucket.
      const up = await uploadProfileAvatar(input.logoDataUrl)
      if ('error' in up && up.error) {
        // The shared action speaks of avatars; on this step it is the store logo.
        return { success: false, error: String(up.error).replace(/avatar/gi, 'logo') }
      }
      logoUrl = (up as { avatarUrl?: string }).avatarUrl ?? null
    }

    const { data: existing } = await svc().from('seller_onboarding').select('user_id').eq('user_id', user.id).maybeSingle()
    if (!existing) return { success: false, error: 'Finish your details first.' }

    const { error } = await svc().from('seller_onboarding').update({
      store_name: storeName,
      ...(logoUrl ? { logo_uploaded_at: new Date().toISOString() } : {}),
      current_step: 4,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id)
    if (error) throw error
    return { success: true, logoUrl }
  } catch (err: any) {
    console.error('[founding] saveFoundingStore:', err?.message)
    return { success: false, error: 'Could not save your store. Try again.' }
  }
}

// ── Step 4: agreement + finish ────────────────────────────────────────────────

export interface SignFoundingAgreementResult {
  success: boolean
  error?: string
  shopSlug?: string | null
}

export async function signFoundingAgreement(input: {
  typedName: string
  signatureDataUrl: string
  agreed: boolean
}): Promise<SignFoundingAgreementResult> {
  try {
    const limited = await rateLimitAction('contact')
    if (limited) return { success: false, error: limited.error }
    const user = await sessionUser()
    if (!user) return { success: false, error: 'Sign in first.' }
    if (input.agreed !== true) return { success: false, error: 'Tick the box to accept the agreement.' }

    const name = typedNameSchema.safeParse(input.typedName)
    if (!name.success) return { success: false, error: name.error.issues[0]?.message ?? 'Enter your full name.' }
    const png = parsePngDataUrl(input.signatureDataUrl)
    if (!png.ok) return { success: false, error: png.error }

    const { version, sha256 } = currentAgreement()
    const { ip, ua } = await requestIdentity()
    const s = svc()

    // Nothing is written until the earlier steps are really done: a signature
    // is evidence, so it is recorded only when it can complete the setup.
    const { data: ob } = await s.from('seller_onboarding').select('country, sells, is_adult_confirmed_at, store_name').eq('user_id', user.id).maybeSingle()
    if (!ob || !ob.country || !ob.is_adult_confirmed_at || !Array.isArray(ob.sells) || ob.sells.length === 0) {
      return { success: false, error: completionRefusalMessage('details_incomplete') }
    }
    if (!ob.store_name) return { success: false, error: completionRefusalMessage('store_incomplete') }

    // One signature per version is enough; a re-sign appends (append-only evidence).
    const agreementId = randomUUID()
    const path = `${user.id}/${agreementId}.png`
    const { error: upErr } = await s.storage.from(SIGNATURE_BUCKET).upload(path, png.bytes, { contentType: 'image/png', upsert: false })
    if (upErr) throw new Error(`signature upload: ${upErr.message}`)

    const { error: insErr } = await s.from('seller_agreements').insert({
      id: agreementId,
      user_id: user.id,
      agreement_slug: 'seller-agreement',
      agreement_version: version,
      agreement_sha256: sha256,
      typed_name: name.data,
      signature_path: path,
      ip,
      user_agent: ua,
    })
    if (insErr) {
      await s.storage.from(SIGNATURE_BUCKET).remove([path]).catch(() => undefined)
      throw new Error(`agreement insert: ${insErr.message}`)
    }

    // Keep the typed legal name on the profile when none is set yet.
    await s.from('profiles').update({ full_name: name.data, updated_at: new Date().toISOString() })
      .eq('id', user.id).is('full_name', null)

    const { data, error } = await s.rpc('seller_onboarding_complete', { p_user: user.id, p_agreement_version: version })
    if (error) throw new Error(`seller_onboarding_complete: ${error.message}`)
    if (!data?.completed) return { success: false, error: completionRefusalMessage(data?.reason) }

    revalidatePath('/founding')
    revalidatePath('/admin/active-sellers')
    return { success: true, shopSlug: data.shop_slug ?? null }
  } catch (err: any) {
    console.error('[founding] signFoundingAgreement:', err?.message)
    return { success: false, error: 'Could not finish your setup. Try again.' }
  }
}
