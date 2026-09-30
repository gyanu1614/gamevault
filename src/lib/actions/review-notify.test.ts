import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  userId: 'buyer-1' as string | null,
  review: null as Record<string, unknown> | null,
  seller: { email: 'seller@example.com', username: 'bloxshop', full_name: null, shop_name: 'BloxShop' } as Record<string, unknown> | null,
  reviewer: { username: 'gyanu' } as Record<string, unknown> | null,
  notifyOnce: true,
  rpcCalls: [] as { fn: string; args: Record<string, unknown> }[],
  emailAllowed: true,
  allowedAsked: [] as unknown[][],
}))

vi.mock('@/lib/email', () => ({ sendNewReviewEmail: vi.fn(async () => ({ success: true })) }))
vi.mock('@/lib/email/preferences', () => ({
  emailAllowed: vi.fn(async (...args: unknown[]) => {
    h.allowedAsked.push(args)
    return h.emailAllowed
  }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.userId ? { id: h.userId } : null } }) },
  }),
}))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, id: string) => ({
          maybeSingle: async () => {
            if (table === 'reviews') return { data: h.review, error: null }
            if (table === 'profiles') return { data: id === 'seller-1' ? h.seller : h.reviewer, error: null }
            return { data: null, error: null }
          },
        }),
      }),
    }),
    rpc: async (fn: string, args: Record<string, unknown>) => {
      h.rpcCalls.push({ fn, args })
      return { data: h.notifyOnce, error: null }
    },
  }),
}))

import { sendNewReviewEmail } from '@/lib/email'
import { notifySellerOfReview } from './review-notify'

const fresh = () => ({
  id: 'review-1',
  reviewer_id: 'buyer-1',
  seller_id: 'seller-1',
  rating: 5,
  comment: 'Fast and friendly',
  created_at: new Date().toISOString(),
})

describe('notifySellerOfReview', () => {
  beforeEach(() => {
    vi.mocked(sendNewReviewEmail).mockClear()
    h.userId = 'buyer-1'
    h.review = fresh()
    h.notifyOnce = true
    h.rpcCalls = []
    h.emailAllowed = true
    h.allowedAsked = []
  })

  it('writes one in-app notification (deduped per review) and emails the seller', async () => {
    await notifySellerOfReview('review-1')
    expect(h.rpcCalls).toHaveLength(1)
    expect(h.rpcCalls[0].fn).toBe('notify_once')
    expect(h.rpcCalls[0].args).toMatchObject({
      p_user_id: 'seller-1',
      p_type: 'review_received',
      p_link: '/account/reviews',
      p_dedupe_key: 'review_received:review-1',
    })
    expect(h.allowedAsked).toEqual([['seller-1', 'new_review']])
    expect(sendNewReviewEmail).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendNewReviewEmail).mock.calls[0][0]).toMatchObject({
      to: 'seller@example.com',
      rating: 5,
      comment: 'Fast and friendly',
      reviewerName: 'gyanu',
    })
  })

  it('does nothing for a review the caller did not write', async () => {
    h.userId = 'someone-else'
    await notifySellerOfReview('review-1')
    expect(h.rpcCalls).toHaveLength(0)
    expect(sendNewReviewEmail).not.toHaveBeenCalled()
  })

  it('does nothing when signed out or the review is missing', async () => {
    h.userId = null
    await notifySellerOfReview('review-1')
    h.userId = 'buyer-1'
    h.review = null
    await notifySellerOfReview('review-1')
    expect(h.rpcCalls).toHaveLength(0)
    expect(sendNewReviewEmail).not.toHaveBeenCalled()
  })

  it('ignores old reviews (no re-sending by calling again later)', async () => {
    h.review = { ...fresh(), created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() }
    await notifySellerOfReview('review-1')
    expect(h.rpcCalls).toHaveLength(0)
    expect(sendNewReviewEmail).not.toHaveBeenCalled()
  })

  it('a repeat call emails nothing (notify_once already fired)', async () => {
    h.notifyOnce = false
    await notifySellerOfReview('review-1')
    expect(sendNewReviewEmail).not.toHaveBeenCalled()
  })

  it('respects the seller turning review emails off (bell notification still written)', async () => {
    h.emailAllowed = false
    await notifySellerOfReview('review-1')
    expect(h.rpcCalls).toHaveLength(1)
    expect(sendNewReviewEmail).not.toHaveBeenCalled()
  })
})
