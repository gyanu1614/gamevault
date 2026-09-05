/** Dev-only harness: render seller-wizard Step 1 without auth, for layout/mobile checks. 404s in prod. */
'use client'

import { notFound } from 'next/navigation'
import StepAccountGames from '@/app/account/become-seller/_redesign/components/StepAccountGames'
import type { WizardGame } from '@/app/account/become-seller/types'

const GAMES: WizardGame[] = [
  { id: 'g1', name: 'Steal a Brainrot', slug: 'steal-a-brainrot', emoji: null, image_url: null },
  { id: 'g2', name: 'Adopt Me', slug: 'adopt-me', emoji: null, image_url: null },
  { id: 'g3', name: 'Grow a Garden', slug: 'grow-a-garden', emoji: null, image_url: null },
]

export default function SellerStep1Preview() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF7', padding: '24px 16px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <StepAccountGames
          games={GAMES}
          sectionsByGameId={{}}
          onComplete={(d) => console.log('step1 valid:', d)}
        />
      </div>
    </div>
  )
}
