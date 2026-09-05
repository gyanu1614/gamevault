/** Dev-only harness: render seller-wizard Identity step without auth, for design checks. 404s in prod. */
'use client'

import { notFound } from 'next/navigation'
import StepIdentity from '@/app/account/become-seller/_redesign/steps/StepIdentity'
import type { UploadedDocsState } from '@/app/account/become-seller/types'

const DOCS = {
  idDocument: null,
  selfieWithId: null,
  proofOfAddress: null,
  certificateOfIncorporation: null,
  businessLicense: null,
  directorId: null,
  bankStatement: null,
} as UploadedDocsState

export default function SellerIdentityPreview() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF7', padding: '24px 16px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <StepIdentity
          uploadedDocs={DOCS}
          onDocChange={() => {}}
          onContinue={(d) => console.log('continue', d)}
          sellerType="individual"
        />
      </div>
    </div>
  )
}
