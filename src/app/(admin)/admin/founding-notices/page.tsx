/**
 * /admin/founding-notices — the founding-seller announcement composer.
 *
 * Server wrapper: fetches every notice (incl. drafts) via the admin-guarded
 * action and hands it to the client composer for create / edit / pin / publish /
 * delete. What gets published here renders as the "What's happening" stream on
 * the Founding Seller HQ (/founding). Auth is enforced by the (admin) layout.
 */

import { listFoundingNotices } from '@/lib/actions/founding-notices'
import FoundingNoticesClient from './_FoundingNoticesClient'

export const metadata = { title: 'Founding Notices' }

export default async function AdminFoundingNoticesPage() {
  const notices = await listFoundingNotices()
  return <FoundingNoticesClient initialNotices={notices} />
}
