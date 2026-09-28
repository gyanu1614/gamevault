/**
 * DropMarket system notices in an order chat (dispute opened / resolved).
 *
 * Stored as a messages row with sender_id NULL and a JSON body; only the
 * service role can write one (see migration 20260927184110). Older rows used
 * the all-zeros "system" id, which never actually inserted, but readers
 * still treat it as a notice.
 */

export const LEGACY_SYSTEM_SENDER = '00000000-0000-0000-0000-000000000000'

export type SystemNotice =
  | { type: 'dispute_opened'; category?: string; reason?: string }
  | {
      type: 'dispute_resolved'
      resolution: 'buyer_favor' | 'seller_favor' | 'partial'
      notes?: string
      refundAmount?: number
      /** Who closed it; 'buyer' when they confirmed receipt themselves. */
      resolvedBy?: 'buyer' | 'admin'
    }

export function isSystemMessage(senderId: string | null | undefined): boolean {
  return !senderId || senderId === LEGACY_SYSTEM_SENDER
}

export function parseSystemNotice(content: string): SystemNotice | null {
  try {
    const v = JSON.parse(content)
    return v && typeof v === 'object' && (v.type === 'dispute_opened' || v.type === 'dispute_resolved') ? v : null
  } catch {
    return null
  }
}

/** One-line text for inbox previews and toasts. */
export function systemNoticePreview(content: string): string {
  const n = parseSystemNotice(content)
  if (!n) return 'DropMarket update'
  if (n.type === 'dispute_opened') return 'Dispute opened'
  if (n.resolvedBy === 'buyer') return 'Dispute closed by the buyer'
  return 'Dispute resolved'
}
