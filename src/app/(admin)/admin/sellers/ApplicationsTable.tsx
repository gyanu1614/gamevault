'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { SellerApplication } from '@/lib/actions/admin-sellers'
import { calculateVerificationStatus } from '@/lib/utils/seller-verification'
import { getAvatarUrl } from '@/lib/utils/avatar'
import { StatusBadge, TABLE } from '../components/kit'
import { SELLER_TYPE_LABELS } from '@/lib/seller-application/labels'
import {
  Eye,
  ChevronRight,
  FileText,
  Calendar
} from 'lucide-react'

interface ApplicationsTableProps {
  applications: SellerApplication[]
}

export default function ApplicationsTable({ applications }: ApplicationsTableProps) {
  const router = useRouter()
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)

  const getStatusBadge = (app: SellerApplication) => {
    // Check seller_status first for approved sellers
    // The view flattens the data, so seller_status is at root level
    const sellerStatus = (app as any).seller_status || (app.user as any)?.seller_status
    if (app.status === 'approved' && sellerStatus) {
      if (sellerStatus === 'restricted') {
        return <StatusBadge status="restricted" tone="warning" />
      }
      if (sellerStatus === 'banned') {
        return <StatusBadge status="banned" />
      }
    }

    // Otherwise show application status
    switch (app.status) {
      case 'pending':
      case 'approved':
      case 'rejected':
        return <StatusBadge status={app.status} />
      default:
        return null
    }
  }

  const getVerificationStatus = (app: SellerApplication) => {
    // Calculate verification status using documents
    const status = calculateVerificationStatus(app.documents, {
      identity_verified: app.identity_verified,
      address_verified: app.address_verified,
      business_verified: app.business_verified,
      tax_verified: app.tax_verified
    })

    return (
      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-overlay">
          <motion.div
            className={cn(
              "h-full rounded-full",
              status.percentage === 100 ? "bg-success" : status.percentage >= 50 ? "bg-warning" : "bg-error"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${status.percentage}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        <span className="whitespace-nowrap text-xs tabular-nums text-text-tertiary">
          {status.verified}/{status.total}
        </span>
      </div>
    )
  }

  const formatDate = (date: string) => {
    const d = new Date(date)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    // Relative time for recent submissions
    if (days === 0) {
      if (hours === 0) {
        if (minutes === 0) return 'Just now'
        return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
      }
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
    } else if (days < 7) {
      return `${days} ${days === 1 ? 'day' : 'days'} ago`
    }

    // Absolute date for older submissions
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  }

  if (applications.length === 0) {
    return (
      <div className="p-12 text-center">
        <FileText className="mx-auto mb-4 h-12 w-12 text-text-tertiary" />
        <p className="text-lg font-semibold text-text-primary">No applications found</p>
        <p className="mt-1 text-sm text-text-secondary">New seller applications will appear here</p>
      </div>
    )
  }

  return (
    <div className={TABLE.wrap}>
      <table className={TABLE.table}>
        <thead>
          <tr>
            <th className={TABLE.th}>Store</th>
            <th className={TABLE.th}>Applicant</th>
            <th className={TABLE.th}>Verification</th>
            <th className={TABLE.th}>Status</th>
            <th className={TABLE.th}>Applied</th>
            <th className={cn(TABLE.th, 'text-right')}>Action</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((app) => (
            <motion.tr
              key={app.id}
              className={cn(
                'cursor-pointer',
                TABLE.row,
                hoveredRow === app.id && 'bg-bg-overlay'
              )}
              onMouseEnter={() => setHoveredRow(app.id)}
              onMouseLeave={() => setHoveredRow(null)}
              onClick={() => router.push(`/admin/sellers/${app.id}`)}
            >
              {/* Store — submitted store image + store name lead the row */}
              <td className={TABLE.td}>
                <div className="flex items-center gap-3">
                  <img
                    src={getAvatarUrl(
                      app.store_image_url || app.user.avatar_url,
                      app.display_name || app.user.username || app.user.email
                    )}
                    alt={app.shop_name || app.display_name || 'Store'}
                    className="h-10 w-10 rounded-lg border border-border-default bg-bg-overlay object-cover"
                  />
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-text-primary">{app.shop_name || app.display_name || 'Unnamed Store'}</p>
                    <p className="text-xs text-text-tertiary">
                      {(app.display_name || app.user.username || '')}{app.display_name || app.user.username ? ' · ' : ''}{SELLER_TYPE_LABELS[app.seller_type ?? ''] ?? app.seller_type ?? 'Not specified'}
                    </p>
                    {app.game_names && app.game_names.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {app.game_names.slice(0, 2).map((game, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center rounded border border-border-default bg-bg-overlay px-2 py-0.5 text-[10px] font-medium text-text-secondary"
                          >
                            {game}
                          </span>
                        ))}
                        {app.game_names.length > 2 && (
                          <span className="text-[10px] text-text-tertiary">+{app.game_names.length - 2} more</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </td>

              {/* Applicant */}
              <td className={TABLE.td}>
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {app.user.full_name || app.user.username || 'Unknown'}
                  </p>
                  <p className="text-xs text-text-tertiary">{app.user.email}</p>
                </div>
              </td>

              {/* Verification Status */}
              <td className={TABLE.td}>
                <div className="w-32">
                  {getVerificationStatus(app)}
                </div>
              </td>

              {/* Status */}
              <td className={TABLE.td}>
                {getStatusBadge(app)}
              </td>

              {/* Applied Date */}
              <td className={TABLE.td}>
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <Calendar className="h-3 w-3" />
                  {formatDate(app.created_at)}
                </div>
              </td>

              {/* Action */}
              <td className={cn(TABLE.td, 'text-right')}>
                <button
                  className={cn(
                    "inline-flex items-center gap-1 rounded-lg px-3 py-1.5",
                    "text-sm font-semibold transition-colors duration-200",
                    hoveredRow === app.id
                      ? "border border-lime-tint-border bg-lime-tint-bg text-lime-text"
                      : "border border-transparent text-text-tertiary"
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    router.push(`/admin/sellers/${app.id}`)
                  }}
                >
                  <Eye className="h-3.5 w-3.5" />
                  Review
                  <ChevronRight className={cn(
                    "h-3 w-3 transition-transform",
                    hoveredRow === app.id && "translate-x-0.5"
                  )} />
                </button>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
