/**
 * P6.3 — Admin Fraud Detection Dashboard
 *
 * Server component: pre-loads open flags + stats, passes to FraudClient.
 */

import { getFraudFlags, getFraudStats } from '@/lib/actions/fraud-detection'
import FraudClient from './FraudClient'

export const metadata = { title: 'Fraud Detection | Admin — GameVault' }

export default async function AdminFraudPage() {
  const [flagsResult, statsResult] = await Promise.all([
    getFraudFlags('open'),
    getFraudStats(),
  ])

  return (
    <FraudClient
      initialFlags={flagsResult.success ? (flagsResult.flags ?? []) : []}
      stats={statsResult}
      fetchError={flagsResult.success ? undefined : flagsResult.error}
    />
  )
}
