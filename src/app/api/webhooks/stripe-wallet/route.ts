import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
})

const webhookSecret = process.env.STRIPE_WALLET_WEBHOOK_SECRET!

export async function POST(req: Request) {
  try {
    const body = await req.text()
    const headersList = await headers()
    const signature = headersList.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 })
    }

    // Verify webhook signature
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err: any) {
      console.error(`[Stripe Wallet Webhook] Signature verification failed:`, err.message)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    console.log(`[Stripe Wallet Webhook] Event: ${event.type}`)

    // Handle successful payment
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session

      // Check if this is a wallet top-up
      if (session.metadata?.type === 'wallet_top_up') {
        const userId = session.metadata.user_id
        const amount = parseFloat(session.metadata.amount || '0')
        const paymentIntentId = session.payment_intent as string

        console.log(`[Stripe Wallet Webhook] Processing top-up: $${amount} for user ${userId}`)

        const supabase = await createClient()

        // Get current balance
        const { data: wallet, error: walletError } = await supabase
          .from('wallet_balances')
          .select('available_balance, lifetime_earned')
          .eq('user_id', userId)
          .single()

        if (walletError) {
          console.error(`[Stripe Wallet Webhook] Error fetching wallet:`, walletError)
          return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
        }

        const newBalance = (wallet.available_balance || 0) + amount
        const newLifetimeEarned = (wallet.lifetime_earned || 0) + amount

        // Create transaction record
        const { error: txError } = await supabase
          .from('wallet_transactions')
          .insert({
            user_id: userId,
            type: 'top_up',
            amount: amount,
            balance_after: newBalance,
            description: `Wallet top-up via Stripe`,
            payment_method: 'stripe',
            payment_intent_id: paymentIntentId,
            status: 'completed',
            completed_at: new Date().toISOString(),
          })

        if (txError) {
          console.error(`[Stripe Wallet Webhook] Error creating transaction:`, txError)
          return NextResponse.json({ error: 'Transaction failed' }, { status: 500 })
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
          console.error(`[Stripe Wallet Webhook] Error updating balance:`, updateError)
          return NextResponse.json({ error: 'Update failed' }, { status: 500 })
        }

        console.log(`[Stripe Wallet Webhook] ✅ Top-up successful: User ${userId} balance is now $${newBalance}`)

        // Send notification to user
        try {
          await supabase
            .from('notifications')
            .insert({
              user_id: userId,
              type: 'system',
              title: 'Wallet Topped Up',
              message: `Your wallet has been credited with $${amount.toFixed(2)}`,
              link: '/account/wallet',
            })
        } catch (notifError) {
          console.error(`[Stripe Wallet Webhook] Notification failed:`, notifError)
          // Non-fatal, continue
        }

        return NextResponse.json({ received: true, credited: amount })
      }
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('[Stripe Wallet Webhook] Error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed', message: error.message },
      { status: 500 }
    )
  }
}
