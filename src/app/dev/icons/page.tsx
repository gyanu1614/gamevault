/**
 * DEV-ONLY icon set showcase — every DropMarket UI icon rendered
 * through the SilverIcon material (icon left, name right), grouped by
 * where it's used. 404s outside development.
 */

import { notFound } from 'next/navigation'
import { SilverIcon } from '@/components/ui/silver-icon'

const GROUPS: Array<{ title: string; items: Array<[string, string]> }> = [
  {
    title: 'Categories',
    items: [
      ['/icons/set/coins.svg', 'Currency'],
      ['/icons/checkout/sword.svg', 'Items'],
      ['/icons/set/account-card.svg', 'Accounts'],
      ['/icons/set/topup.svg', 'Top Up'],
      ['/icons/set/rocket.svg', 'Boosting'],
    ],
  },
  {
    title: 'Commerce & Checkout',
    items: [
      ['/icons/checkout/cart.svg', 'Checkout'],
      ['/icons/checkout/receipt.svg', 'Order Details'],
      ['/icons/set/package.svg', 'Orders'],
      ['/icons/set/wallet.svg', 'Wallet'],
      ['/icons/set/tag.svg', 'Offers'],
      ['/icons/set/discount.svg', 'Discount'],
      ['/icons/set/card.svg', 'Payment'],
      ['/icons/set/crypto.svg', 'Crypto'],
      ['/icons/set/gift.svg', 'Gift Card'],
    ],
  },
  {
    title: 'Trust & Safety',
    items: [
      ['/icons/set/shield-check.svg', 'Protection'],
      ['/icons/set/warranty.svg', 'Warranty'],
      ['/icons/set/vault.svg', 'SafeDrop'],
      ['/icons/set/lock.svg', 'Secure'],
      ['/icons/set/refund.svg', 'Refund'],
      ['/icons/set/support.svg', 'Support'],
      ['/icons/set/verified.svg', 'Verified'],
    ],
  },
  {
    title: 'Listing Page',
    items: [
      ['/icons/set/document.svg', 'Description'],
      ['/icons/set/bolt.svg', 'Instant Delivery'],
      ['/icons/set/stock.svg', 'In Stock'],
      ['/icons/set/globe.svg', 'Region'],
      ['/icons/set/gamepad.svg', 'Platform'],
      ['/icons/set/store.svg', 'Seller Shop'],
      ['/icons/set/star.svg', 'Reviews'],
      ['/icons/set/clock.svg', 'Delivery Time'],
    ],
  },
  {
    title: 'Account',
    items: [
      ['/icons/set/dashboard.svg', 'Dashboard'],
      ['/icons/set/messages.svg', 'Messages'],
      ['/icons/set/settings.svg', 'Settings'],
      ['/icons/set/notifications.svg', 'Notifications'],
      ['/icons/set/analytics.svg', 'Analytics'],
      ['/icons/set/profile.svg', 'Profile'],
    ],
  },
  {
    title: 'Utility',
    items: [
      ['/icons/set/search.svg', 'Search'],
      ['/icons/set/filter.svg', 'Filter'],
      ['/icons/set/key.svg', 'Account Keys'],
      ['/icons/set/crown.svg', 'Top Seller'],
    ],
  },
]

export default function IconSetPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return (
    <div
      className="min-h-screen bg-[#0c0e14] px-6 py-12"
      style={{ backgroundImage: 'radial-gradient(120% 46% at 50% -6%, #141a26, rgba(20,26,38,0) 62%)' }}
    >
      <div className="mx-auto w-full max-w-7xl">
        <h1 className="text-[26px] font-extrabold tracking-[-0.4px] text-white">DropMarket Icon Set</h1>
        <p className="mt-1 text-[13px] text-[#7b8398]">
          {GROUPS.reduce((n, g) => n + g.items.length, 0)} icons · rendered through the SilverIcon material · sources in
          public/icons/set/
        </p>

        {GROUPS.map((g) => (
          <section key={g.title} className="mt-10">
            <h2 className="mb-4 text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#7b8398]">{g.title}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {g.items.map(([src, label]) => (
                <div
                  key={src}
                  className="flex items-center gap-3.5 rounded-md border border-white/[0.07] bg-[#12151e] px-4 py-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/[0.16] hover:bg-[#171c29]"
                >
                  <SilverIcon src={src} className="h-8 w-8" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-bold text-white">{label}</span>
                    <span className="block truncate text-[10.5px] text-[#6d7488]">{src.split('/').pop()}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
