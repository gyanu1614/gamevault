/**
 * Daily Discord value-list post cron.
 *
 * Posts the day's top values + biggest movers to a #value-list channel via an
 * incoming webhook. The growth playbook's core retention hook: a concrete daily
 * reason to return, and the wedge against the big competitors who don't publish
 * good daily price data.
 *
 * Runs at 10:30 UTC (see vercel.json) — after correct-sab-prices (10:00) so the
 * post reflects the freshly-corrected, fake-filtered values.
 *
 * No gateway, no bot presence: just an authenticated cron making one HTTP POST.
 * A missing webhook URL is a no-op (not an error), so the route is safe to ship
 * before the channel/webhook exists.
 */

import { NextRequest, NextResponse } from 'next/server'

import { buildDailyPost, sendToWebhook } from '@/lib/discord/dailyPost'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CRON_SECRET = process.env.CRON_SECRET
const WEBHOOK_URL = process.env.DISCORD_VALUE_WEBHOOK_URL

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!WEBHOOK_URL) {
      // Not configured yet — succeed quietly so the cron isn't a red herring.
      return NextResponse.json({
        success: true,
        skipped: 'DISCORD_VALUE_WEBHOOK_URL not set',
      })
    }

    const payload = await buildDailyPost(new Date())

    if (!payload) {
      return NextResponse.json({
        success: true,
        skipped: 'no price data to post',
      })
    }

    const posted = await sendToWebhook(WEBHOOK_URL, payload)

    return NextResponse.json({
      success: posted,
      posted,
      movers: payload.embeds?.[0]?.fields?.some((f) => f.name.includes('Movers'))
        ? 'included'
        : 'none yet',
    })
  } catch (error: any) {
    console.error('Unexpected error in discord-daily-post cron:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
