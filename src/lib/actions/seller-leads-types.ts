/**
 * Plain (non-server) types + constants for the seller-lead CRM.
 *
 * These live OUTSIDE seller-leads.ts because that file is `'use server'`, and a
 * server-actions file may only export async functions — exporting a runtime
 * const (SELLER_LEAD_STATUSES) from it fails the build with
 * "A 'use server' file can only export async functions, found object."
 * Import values from here; import the async actions from seller-leads.ts.
 */

export type SellerLeadStatus =
  | 'new'
  | 'contacted'
  | 'replied'
  | 'negotiating'
  | 'signed_up'
  | 'converted'
  | 'passed'
  | 'lost'

export const SELLER_LEAD_STATUSES: SellerLeadStatus[] = [
  'new',
  'contacted',
  'replied',
  'negotiating',
  'signed_up',
  'converted',
  'passed',
  'lost',
]

export interface SellerLead {
  id: string
  handle: string
  source: string | null
  contact: string | null
  game: string | null
  status: SellerLeadStatus
  notes: string | null
  last_contacted: string | null
  next_follow_up: string | null
  created_at: string
  updated_at: string
}
