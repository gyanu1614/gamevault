/** Buyer report reasons (plain module: the server action may only export async functions). */
export const REPORT_REASONS = {
  scam: 'Scam or fake item',
  prohibited: 'Not allowed on DropMarket',
  offsite: 'Asks to trade or pay off-site',
  wrong_item: 'Wrong game, item or price',
  inappropriate: 'Inappropriate image or text',
  other: 'Something else',
} as const

export type ReportReason = keyof typeof REPORT_REASONS

