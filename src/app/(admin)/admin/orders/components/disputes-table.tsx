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
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-12">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="h-12 w-12 rounded-full bg-violet-500/10 flex items-center justify-center mb-3">
          <AlertTriangle className="h-6 w-6 text-violet-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-1">Disputes</h3>
        <p className="text-sm text-gray-500 mb-4">
          View and manage disputes in the dedicated disputes section
        </p>
        <Link
          href="/admin/disputes"
          className="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium rounded-lg transition-all"
        >
          Go to Disputes
        </Link>
      </div>
    </div>
  )
}
