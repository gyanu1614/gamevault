/**
 * V54 — /admin/activities server wrapper.
 *
 * Fetches the activity feed ON THE SERVER via the same getAllActivities()
 * action the client used and seeds the client component's react-query
 * cache via initialData. The page ships fully rendered — no client-side
 * "Loading activities…" pass on refresh — while the client-side filters
 * and 30s polling refetch keep working unchanged.
 */

import { getAllActivities } from '@/lib/actions/admin-dashboard'
import ActivitiesPageClient from './_components/ActivitiesPageClient'

export const metadata = { title: 'Activities' }

export default async function ActivitiesPage() {
  const result = await getAllActivities()

  return (
    <ActivitiesPageClient
      // On server-side failure, pass undefined so the client falls back
      // to its own fetch → error state, exactly as before.
      initialActivities={result.success ? result.activities ?? [] : undefined}
    />
  )
}
