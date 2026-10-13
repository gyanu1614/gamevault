/**
 * /admin/buy-rails — switch the buy rails / phone bar off (or back on) per
 * surface. Auth: the (admin) layout; data via admin-guarded actions
 * (lib/actions/admin-buy-rails).
 */
import { getBuyRailSettingsAdmin } from '@/lib/actions/admin-buy-rails'

import BuyRailsClient from './_BuyRailsClient'

export const metadata = { title: 'Buy Rails' }

export default async function AdminBuyRailsPage() {
  const result = await getBuyRailSettingsAdmin()
  return <BuyRailsClient initial={result.ok ? result.data : null} fetchError={result.ok ? undefined : result.error} />
}
