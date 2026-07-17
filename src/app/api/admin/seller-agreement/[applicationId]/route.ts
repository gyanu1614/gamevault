/**
 * GET /api/admin/seller-agreement/[applicationId] — downloads the executed
 * Seller Agency Agreement PDF for an application (admin only): the full live
 * agreement text with the seller named as Principal and their recorded
 * electronic signature + consents on the execution page.
 */

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { createClient } from '@/lib/supabase/server'
import { buildSellerAgreementPdf } from '@/lib/pdf/seller-agreement-pdf'

export async function GET(
  _req: Request,
  { params }: { params: { applicationId: string } },
) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: app } = (await supabase
    .from('seller_applications')
    .select(
      `id, full_legal_name, shop_name, country, seller_type, seller_signature,
       seller_signed_at, seller_signature_image, submitted_at, alternate_email,
       accepted_seller_agreement, accepted_privacy_policy, accepted_anti_fraud_policy,
       accepted_commission_structure, accepted_data_processing, information_accurate_confirmed,
       profiles!user_id ( email )`,
    )
    .eq('id', params.applicationId)
    .single()) as any

  if (!app) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  const bytes = await buildSellerAgreementPdf({
    applicationId: app.id,
    legalName: app.full_legal_name || 'Unknown',
    shopName: app.shop_name ?? null,
    email: (app.profiles as any)?.email ?? app.alternate_email ?? null,
    country: app.country ?? null,
    sellerType: app.seller_type ?? null,
    signatureName: app.seller_signature ?? null,
    signatureImage: app.seller_signature_image ?? null,
    signedAt: app.seller_signed_at ?? app.submitted_at ?? null,
    submittedAt: app.submitted_at ?? null,
    consents: [
      { label: 'Seller Agency Agreement', accepted: !!app.accepted_seller_agreement },
      { label: 'Terms Of Service & Privacy Policy', accepted: !!app.accepted_privacy_policy },
      { label: 'Fee Schedule', accepted: !!app.accepted_commission_structure },
      { label: 'Anti-Fraud Policy', accepted: !!app.accepted_anti_fraud_policy },
      { label: 'Data Processing (GDPR)', accepted: !!app.accepted_data_processing },
      { label: 'Information Accuracy Confirmation', accepted: !!app.information_accurate_confirmed },
    ],
  })

  const filename = `Seller-Agency-Agreement-${(app.shop_name || app.full_legal_name || 'seller')
    .replace(/[^a-zA-Z0-9-]+/g, '-')}.pdf`

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
