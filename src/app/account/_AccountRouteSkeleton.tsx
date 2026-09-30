'use client'

/**
 * The skeleton for whichever account page is opening, for the account layout
 * to show while sign-in resolves (a hard load, a new tab). It picks the SAME
 * component the route's own loading.tsx renders, so the sequence is one
 * skeleton, then the page: never a spinner, never a second skeleton.
 *
 * A new account route gets its loading.tsx added here too.
 */

import AnalyticsLoading from './analytics/loading'
import BecomeSellerLoading from './become-seller/loading'
import DashboardLoading from './dashboard/loading'
import ListingsLoading from './listings/loading'
import MessagesLoading from './messages/loading'
import OrderDetailLoading from './orders/[orderId]/loading'
import OrdersLoading from './orders/loading'
import ReferralLoading from './referral/loading'
import ReviewsLoading from './reviews/loading'
import SellerStatusLoading from './seller-status/loading'
import WalletLoading from './wallet/loading'
import { WithdrawSkeleton } from './wallet/withdraw/_WithdrawSkeleton'
import { RestrictionsSkeleton } from './restrictions/_RestrictionsSkeleton'
import { SettingsSkeleton } from './settings/_SettingsSkeleton'
import { TiersSkeleton } from './tiers/_TiersSkeleton'

const ROUTES: { match: (path: string) => boolean; Skeleton: () => React.ReactNode }[] = [
  { match: (p) => p.startsWith('/account/settings'), Skeleton: () => <SettingsSkeleton /> },
  { match: (p) => /^\/account\/orders\/[^/]+/.test(p), Skeleton: OrderDetailLoading },
  { match: (p) => p.startsWith('/account/orders'), Skeleton: OrdersLoading },
  { match: (p) => p.startsWith('/account/listings'), Skeleton: ListingsLoading },
  { match: (p) => p.startsWith('/account/messages'), Skeleton: MessagesLoading },
  { match: (p) => p.startsWith('/account/wallet/withdraw'), Skeleton: () => <WithdrawSkeleton /> },
  { match: (p) => p === '/account/wallet', Skeleton: WalletLoading },
  { match: (p) => p.startsWith('/account/referral'), Skeleton: ReferralLoading },
  { match: (p) => p.startsWith('/account/restrictions'), Skeleton: () => <RestrictionsSkeleton /> },
  { match: (p) => p.startsWith('/account/reviews'), Skeleton: ReviewsLoading },
  { match: (p) => p.startsWith('/account/analytics'), Skeleton: AnalyticsLoading },
  { match: (p) => p.startsWith('/account/become-seller'), Skeleton: BecomeSellerLoading },
  { match: (p) => p.startsWith('/account/seller-status'), Skeleton: SellerStatusLoading },
  { match: (p) => p.startsWith('/account/tiers'), Skeleton: () => <TiersSkeleton /> },
  { match: (p) => p === '/account' || p.startsWith('/account/dashboard'), Skeleton: DashboardLoading },
]

export function AccountRouteSkeleton({ pathname }: { pathname: string }) {
  const route = ROUTES.find((r) => r.match(pathname))
  if (route) return <route.Skeleton />
  return <GenericAccountSkeleton />
}

/** Header + two cards, for account pages without a dedicated skeleton yet. */
function GenericAccountSkeleton() {
  return (
    <div className="pb-12" aria-busy>
      <div className="mx-auto w-full max-w-full px-4 sm:px-6 md:max-w-7xl lg:px-8">
        <div className="skeleton h-8 w-40 rounded-md" />
        <div className="skeleton mt-1.5 h-4 w-72 max-w-full rounded" />
        <div className="mt-6 space-y-4">
          <div className="h-40 rounded-lg bg-bg-raised" />
          <div className="h-64 rounded-lg bg-bg-raised" />
        </div>
      </div>
    </div>
  )
}
