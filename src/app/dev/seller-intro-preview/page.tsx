/**
 * Dev-only preview of the seller-application IntroScreen so the design can be
 * iterated without logging in (mirrors /dev/checkout-preview). 404s outside
 * development.
 */

'use client'

import { notFound } from 'next/navigation'
import IntroScreen from '@/app/account/become-seller/_redesign/components/IntroScreen'

export default function SellerIntroPreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <IntroScreen onStart={() => {}} />
}
