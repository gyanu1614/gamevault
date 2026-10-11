'use client'

import { PlatformTileRows } from '../../PlatformTileRows'
import { SubCard } from '../../ui/SubCard'
import type { Step4Props } from './types'

/** Currency platform / region / device, one tile row per kind the admin enabled for the game. */
export function ListingDetailsSection({ p }: { p: Pick<Step4Props, 'platformFields' | 'region' | 'onRegion' | 'platform' | 'onPlatform' | 'device' | 'onDevice'> }) {
  return (
<SubCard title="Listing details">
  <PlatformTileRows
    fields={p.platformFields}
    values={{ region: p.region, platform: p.platform, device: p.device }}
    onChange={(kind, v) => {
      if (kind === 'region') p.onRegion(v)
      else if (kind === 'platform') p.onPlatform(v)
      else if (kind === 'device') p.onDevice(v)
    }}
  />
</SubCard>
  )
}
