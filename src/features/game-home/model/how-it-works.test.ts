import { describe, it, expect } from 'vitest'
import { howItWorksHighlight } from './how-it-works'

const robux = {
  id: 'r',
  name: 'Robux',
  slug: 'buy-robux',
  type: 'currency',
  href: '/roblox/buy-robux',
  icon: '/robux.png',
  count: 7,
  fromLabel: '$0.0052/Robux',
  avgDelivery: null,
  isCurrency: true,
}

describe('howItWorksHighlight', () => {
  it('shows the currency price and its icon when the game sells one', () => {
    expect(howItWorksHighlight({ spotlight: robux, currencyIconUrl: null, gameImageUrl: '/g.png', totalOffers: 20 })).toEqual({
      label: 'Robux from',
      value: '$0.0052',
      note: 'per Robux · 7 offers live now',
      iconUrl: '/robux.png',
      iconAlt: 'Robux icon',
      backdropUrl: '/g.png',
    })
  })

  it('falls back to the live offer count', () => {
    expect(howItWorksHighlight({ spotlight: null, currencyIconUrl: null, gameImageUrl: null, totalOffers: 13 })).toMatchObject({ label: 'Live Now', value: '13 Offers Live' })
  })

  it('shows nothing without offers', () => {
    expect(howItWorksHighlight({ spotlight: null, currencyIconUrl: null, gameImageUrl: null, totalOffers: 0 })).toBeNull()
  })
})
