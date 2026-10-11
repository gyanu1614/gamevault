/**
 * Step 4 — /admin/imports server wrapper.
 *
 * Fetches the batch list, the importable games and the store accounts on the
 * server so the page arrives rendered, then hands them to the client component
 * as initial data (same pattern as /admin/games).
 */
import { fetchImportBatches, fetchImportableGames, fetchStoreSellers } from '@/lib/actions/admin-imports'
import ImportsPageClient from './_components/ImportsPageClient'

export const metadata = { title: 'Bulk Import' }

export default async function AdminImportsPage() {
  const [batches, games, sellers] = await Promise.all([
    fetchImportBatches(),
    fetchImportableGames(),
    fetchStoreSellers(),
  ])

  return (
    <ImportsPageClient
      initialBatches={batches.success ? batches.data : []}
      games={games.success ? games.data : []}
      sellers={sellers.success ? sellers.data : []}
      loadError={
        [batches, games, sellers].find((r) => !r.success && 'error' in r)?.success === false
          ? ((batches as any).error ?? (games as any).error ?? (sellers as any).error ?? null)
          : null
      }
    />
  )
}
