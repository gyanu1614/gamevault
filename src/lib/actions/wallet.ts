'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ── Types ──────────────────────────────────────────────────────────────────

export interface WalletBalance {
  available_balance: number
  pending_balance: number
  lifetime_earned: number
  lifetime_spent: number
  total_cashback: number
  referral_earnings: number
}

export interface WalletTransaction {
  id: string
  type: 'top_up' | 'purchase' | 'refund' | 'cashback' | 'referral_bonus' | 'admin_adjustment' | 'withdrawal'
  amount: number
  balance_after: number
  description: string | null
  reference_id: string | null
  reference_type: string | null
  status: 'pending' | 'completed' | 'failed' | 'reversed'
  created_at: string
  completed_at: string | null
}

// ── Get wallet balance ─────────────────────────────────────────────────────

export async function getWalletBalance(): Promise<{
  success: boolean
  balance?: WalletBalance
  error?: string
}> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data, error } = await supabase
      .from('wallet_balances')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error) {
      // If wallet doesn't exist, create it
      if (error.code === 'PGRST116') {
        const { data: newWallet, error: createError } = await supabase
          .from('wallet_balances')
          .insert({ user_id: user.id, available_balance: 0 })
          .select()
          .single()

        if (createError) {
          return { success: false, error: createError.message }
        }

        return { success: true, balance: newWallet as WalletBalance }
      }

      return { success: false, error: error.message }
    }

    return { success: true, balance: data as WalletBalance }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// ── Get wallet transactions ────────────────────────────────────────────────

export async function getWalletTransactions(limit = 50): Promise<{
  success: boolean
  transactions?: WalletTransaction[]
  error?: string
}> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, transactions: data as WalletTransaction[] }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// ── Create Stripe checkout for top-up ──────────────────────────────────────

export async function createTopUpCheckout(amount: number): Promise<{
  success: boolean
  url?: string
  error?: string
}> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Validate amount
    if (amount < 5 || amount > 1000) {
      return { success: false, error: 'Amount must be between $5 and $1000' }
    }

    // Create Stripe checkout session
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Wallet Top-Up',
            description: `Add $${amount.toFixed(2)} to your GameVault wallet`,
          },
          unit_amount: Math.round(amount * 100), // Convert to cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/account/wallet?top_up=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/account/wallet?top_up=cancelled`,
      client_reference_id: user.id,
      metadata: {
        type: 'wallet_top_up',
        user_id: user.id,
        amount: amount.toString(),
      },
    })

    return { success: true, url: session.url }
  } catch (err: any) {
    console.error('[Wallet] Top-up checkout error:', err)
    return { success: false, error: err.message }
  }
}

// ── Add cashback (called after purchase) ───────────────────────────────────

export async function addCashback(userId: string, amount: number, orderId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Get current balance
    const { data: wallet } = await supabase
      .from('wallet_balances')
      .select('available_balance, total_cashback')
      .eq('user_id', userId)
      .single()

    if (!wallet) {
      return { success: false, error: 'Wallet not found' }
    }

    const newBalance = (wallet.available_balance || 0) + amount
    const newCashback = (wallet.total_cashback || 0) + amount

    // Create transaction record
    const { error: txError } = await supabase
      .from('wallet_transactions')
      .insert({
        user_id: userId,
        type: 'cashback',
        amount: amount,
        balance_after: newBalance,
        description: `Cashback from order`,
        reference_id: orderId,
        reference_type: 'order',
        status: 'completed',
        completed_at: new Date().toISOString(),
      })

    if (txError) {
      return { success: false, error: txError.message }
    }

    // Update wallet balance
    const { error: updateError } = await supabase
      .from('wallet_balances')
      .update({
        available_balance: newBalance,
        total_cashback: newCashback,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    revalidatePath('/account/wallet')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// ── Deduct from wallet (for purchases) ─────────────────────────────────────

export async function deductFromWallet(userId: string, amount: number, orderId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Get current balance
    const { data: wallet } = await supabase
      .from('wallet_balances')
      .select('available_balance, lifetime_spent')
      .eq('user_id', userId)
      .single()

    if (!wallet) {
      return { success: false, error: 'Wallet not found' }
    }

    if (wallet.available_balance < amount) {
      return { success: false, error: 'Insufficient balance' }
    }

    const newBalance = wallet.available_balance - amount
    const newLifetimeSpent = (wallet.lifetime_spent || 0) + amount

    // Create transaction record
    const { error: txError } = await supabase
      .from('wallet_transactions')
      .insert({
        user_id: userId,
        type: 'purchase',
        amount: -amount, // Negative for deductions
        balance_after: newBalance,
        description: `Purchase - Order`,
        reference_id: orderId,
        reference_type: 'order',
        status: 'completed',
        completed_at: new Date().toISOString(),
      })

    if (txError) {
      return { success: false, error: txError.message }
    }

    // Update wallet balance
    const { error: updateError } = await supabase
      .from('wallet_balances')
      .update({
        available_balance: newBalance,
        lifetime_spent: newLifetimeSpent,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    revalidatePath('/account/wallet')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// ── Refund to wallet (for order cancellations) ────────────────────────────

export async function refundToWallet(userId: string, amount: number, orderId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Get current balance
    const { data: wallet } = await supabase
      .from('wallet_balances')
      .select('available_balance, lifetime_earned')
      .eq('user_id', userId)
      .single()

    if (!wallet) {
      return { success: false, error: 'Wallet not found' }
    }

    const newBalance = (wallet.available_balance || 0) + amount
    const newLifetimeEarned = (wallet.lifetime_earned || 0) + amount

    // Create transaction record
    const { error: txError } = await supabase
      .from('wallet_transactions')
      .insert({
        user_id: userId,
        type: 'refund',
        amount: amount, // Positive for refunds
        balance_after: newBalance,
        description: `Refund for cancelled order`,
        reference_id: orderId,
        reference_type: 'order',
        status: 'completed',
        completed_at: new Date().toISOString(),
      })

    if (txError) {
      return { success: false, error: txError.message }
    }

    // Update wallet balance
    const { error: updateError } = await supabase
      .from('wallet_balances')
      .update({
        available_balance: newBalance,
        lifetime_earned: newLifetimeEarned,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    revalidatePath('/account/wallet')
    revalidatePath('/account/orders')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
