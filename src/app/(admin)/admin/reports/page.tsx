/**
 * /admin/reports — buyer reports on listings. Open ones first; a listing
 * with three open reports is already hidden and waits here for a verdict.
 */
import { listReports } from '@/lib/actions/admin-moderation-tools'
import ReportsClient from './_components/ReportsClient'

export const metadata = { title: 'Reports' }

export default async function AdminReportsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const tab = searchParams.tab === 'resolved' ? 'resolved' : 'open'
  const result = await listReports(tab)
  return <ReportsClient tab={tab} rows={result.rows} error={result.success ? null : result.error ?? 'Could not load reports'} />
}
