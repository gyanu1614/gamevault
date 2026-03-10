'use server'

/**
 * P5.3 — Promo Code System
 *
 * Promo codes reduce the amount charged to the buyer at checkout.
 * The seller payout is unaffected — the platform absorbs the discount cost.
 *
 * Types:
 *  - 'percentage' : discount = subtotal * (value / 100), capped at max_discount
 *  - 'flat'       : discount = value (capped at subtotal)
 */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { PromoCode } from '@/types/database'

// ── Buyer: validate a promo code at checkout ──────────────────────────────────

export interface PromoValidationResult {
  valid: boolean
  promoCodeId?: string
  code?: string
  discountAmount?: number
  description?: string
  error?: string
}

export async function validatePromoCode(
  rawCode: string,
  subtotal: number
): Promise<PromoValidationResult> {
  try {
    const code = rawCode.trim().toUpperCase()
    if (!code) return { valid: false, error: 'No code entered' }

    const supabase = await createClient()

    // Fetch the promo code (case-insensitive via UPPER)
    const { data: promoRaw, error } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('is_active', true)
      .filter('code', 'ilike', code)
      .maybeSingle()

    if (error) return { valid: false, error: 'Could not validate code' }
    if (!promoRaw) return { valid: false, error: 'Invalid or expired promo code' }

    const promo = promoRaw as PromoCode

    // Check expiry
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return { valid: false, error: 'This promo code has expired' }
    }

    // Check total usage limit
    if (promo.usage_limit !== null && promo.total_used >= promo.usage_limit) {
      return { valid: false, error: 'This promo code has reached its usage limit' }
    }

    // Check minimum order amount
    if (subtotal < promo.min_order_amount) {
      return {
        valid: false,
        error: `Minimum order of $${promo.min_order_amount.toFixed(2)} required for this code`,
      }
    }

    // Check per-user limit (skip for guests / unauthenticated)
    const { data: { user } } = await supabase.auth.getUser()
    if (user && promo.per_user_limit > 0) {
      const { count } = await supabase
        .from('promo_code_usages')
        .select('id', { count: 'exact', head: true })
        .eq('promo_code_id', promo.id)
        .eq('user_id', user.id)

      if ((count ?? 0) >= promo.per_user_limit) {
        return { valid: false, error: 'You have already used this promo code' }
      }
    }

    // Calculate discount
    let discountAmount: number
    if (promo.type === 'percentage') {
      discountAmount = subtotal * (promo.value / 100)
      if (promo.max_discount !== null) {
        discountAmount = Math.min(discountAmount, promo.max_discount)
      }
    } else {
      discountAmount = promo.value
    }
    // Never exceed subtotal
    discountAmount = Math.min(discountAmount, subtotal)
    discountAmount = parseFloat(discountAmount.toFixed(2))

    return {
      valid: true,
      promoCodeId: promo.id,
      code: promo.code,
      discountAmount,
      description: promo.description ||
        (promo.type === 'percentage'
          ? `${promo.value}% off`
          : `$${promo.value.toFixed(2)} off`),
    }
  } catch (err: any) {
    console.error('[promo] validatePromoCode error:', err)
    return { valid: false, error: 'Could not validate code. Please try again.' }
  }
}

// ── Internal: record usage after order is created ────────────────────────────

export async function recordPromoUsage(params: {
  promoCodeId: string
  orderId: string
  discountAmount: number
  userId: string | null
}): Promise<void> {
  const { promoCodeId, orderId, discountAmount, userId } = params
  try {
    const supabase = await createClient()

    // Insert usage record
    await supabase.from('promo_code_usages').insert({
      promo_code_id:   promoCodeId,
      user_id:         userId,
      order_id:        orderId,
      discount_amount: discountAmount,
    } as any)

    // Increment total_used counter
    const { data: current } = await supabase
      .from('promo_codes')
      .select('total_used')
      .eq('id', promoCodeId)
      .single()
    if (current) {
      await (supabase.from('promo_codes') as any)
        .update({ total_used: ((current as any).total_used ?? 0) + 1 })
        .eq('id', promoCodeId)
    }
  } catch (err) {
    console.error('[promo] recordPromoUsage error:', err)
  }
}

// ── Admin: CRUD for promo codes ───────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Check admin_roles table (NOT profiles.role)
  const { data: adminRole } = await supabase
    .from('admin_roles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!adminRole || !['admin', 'super_admin'].includes(adminRole.role)) {
    throw new Error('Admin access required')
  }
  return { supabase, userId: user.id }
}

export interface CreatePromoData {
  code: string
  type: 'percentage' | 'flat'
  value: number
  description?: string
  minOrderAmount?: number
  maxDiscount?: number | null
  usageLimit?: number | null
  perUserLimit?: number
  expiresAt?: string | null
}

export async function createPromoCode(data: CreatePromoData): Promise<{
  success: boolean
  promo?: PromoCode
  error?: string
}> {
  try {
    const { supabase, userId } = await requireAdmin()

    const { data: promoRaw, error } = await supabase
      .from('promo_codes')
      .insert({
        code:             data.code.trim().toUpperCase(),
        type:             data.type,
        value:            data.value,
        description:      data.description || '',
        min_order_amount: data.minOrderAmount ?? 0,
        max_discount:     data.maxDiscount ?? null,
        usage_limit:      data.usageLimit ?? null,
        per_user_limit:   data.perUserLimit ?? 1,
        expires_at:       data.expiresAt ?? null,
        is_active:        true,
        created_by:       userId,
      } as any)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') return { success: false, error: 'A promo code with that name already exists' }
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/promos')
    return { success: true, promo: promoRaw as PromoCode }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function getPromoCodes(): Promise<{
  success: boolean
  promoCodes?: PromoCode[]
  error?: string
}> {
  try {
    const { supabase } = await requireAdmin()
    const { data, error } = await supabase
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return { success: false, error: error.message }
    return { success: true, promoCodes: (data as PromoCode[]) ?? [] }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function togglePromoCode(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await requireAdmin()

    const { data: current } = await supabase
      .from('promo_codes')
      .select('is_active')
      .eq('id', id)
      .single()

    await (supabase.from('promo_codes') as any)
      .update({ is_active: !((current as any)?.is_active ?? true) })
      .eq('id', id)

    revalidatePath('/admin/promos')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function deletePromoCode(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await requireAdmin()
    await supabase.from('promo_codes').delete().eq('id', id)
    revalidatePath('/admin/promos')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
