/**
 * Disputes Table Component
 *
 * Displays active disputes (placeholder for now - uses existing disputes system)
 */

'use client'

import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export function DisputesTable() {
  return (
    <div className="rounded-xl border border-border-default bg-bg-raised p-12">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="h-12 w-12 rounded-full border border-border-subtle bg-bg-overlay flex items-center justify-center mb-3">
          <AlertTriangle className="h-6 w-6 text-text-tertiary" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-1">Disputes</h3>
        <p className="text-sm text-text-tertiary mb-4">
          View and manage disputes in the dedicated disputes section
        </p>
        <Link
          href="/admin/disputes"
          className="px-4 py-2 bg-lime-pressed hover:bg-lime text-text-inverse text-sm font-bold rounded-lg transition-all"
        >
          Go to Disputes
        </Link>
      </div>
    </div>
  )
}
