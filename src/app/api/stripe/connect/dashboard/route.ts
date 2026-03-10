import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateLoginLink, generateOnboardingLink } from '@/lib/stripe/connect'

export async function POST() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_connect_account_id, stripe_connect_status')
    .eq('id', user.id)
    .single()

  if (!profile?.stripe_connect_account_id) {
    return NextResponse.json({ error: 'No Connect account found' }, { status: 404 })
  }

  try {
    let url: string

    if (profile.stripe_connect_status === 'active') {
      // Active accounts get the Express dashboard login link
      url = await generateLoginLink(profile.stripe_connect_account_id)
    } else {
      // Incomplete accounts get the onboarding link
      url = await generateOnboardingLink(profile.stripe_connect_account_id)
    }

    return NextResponse.json({ url })
  } catch (err) {
    console.error('[Connect/dashboard]', err)
    return NextResponse.json({ error: 'Failed to generate dashboard link' }, { status: 500 })
  }
}
