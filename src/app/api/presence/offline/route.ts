/**
 * Presence Offline API Route
 *
 * Handles sendBeacon requests to mark seller offline
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Mark user as offline
    const { error } = await supabase
      .from('seller_presence')
      .update({ is_online: false })
      .eq('seller_id', user.id)

    if (error) {
      console.error('Error marking user offline:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in offline API:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
