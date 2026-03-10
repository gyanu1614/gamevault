'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { SellerApplication } from '@/lib/actions/admin-sellers'
import { calculateVerificationStatus } from '@/lib/utils/seller-verification'
import { getAvatarUrl } from '@/lib/utils/avatar'
import {
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  ChevronRight,
  FileText,
  User,
  Calendar,
  Building,
  ShieldAlert,
  Ban
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
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
            <ShieldAlert className="h-3 w-3" />
            Restricted
          </span>
        )
      }
      if (sellerStatus === 'banned') {
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
            <Ban className="h-3 w-3" />
            Banned
          </span>
        )
      }
    }

    // Otherwise show application status
    switch (app.status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
            <Clock className="h-3 w-3" />
            Pending
          </span>
        )
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
            <CheckCircle className="h-3 w-3" />
            Approved
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
            <XCircle className="h-3 w-3" />
            Rejected
          </span>
        )
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
        <div className="flex-1 h-2 bg-white/[0.05] rounded-full overflow-hidden">
          <motion.div
            className={cn(
              "h-full rounded-full",
              status.percentage === 100 ? "bg-green-500" : status.percentage >= 50 ? "bg-yellow-500" : "bg-red-500"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${status.percentage}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap">
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
        <FileText className="h-12 w-12 text-gray-600 mx-auto mb-4" />
        <p className="text-lg font-medium text-white">No applications found</p>
        <p className="text-sm text-gray-400 mt-1">New seller applications will appear here</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b border-white/[0.1]">
          <tr className="text-left">
            <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
              Applicant
            </th>
            <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
              Store Details
            </th>
            <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
              Verification
            </th>
            <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
              Applied
            </th>
            <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">
              Action
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {applications.map((app) => (
            <motion.tr
              key={app.id}
              className={cn(
                "cursor-pointer transition-colors",
                "hover:bg-white/[0.02]",
                hoveredRow === app.id && "bg-white/[0.02]"
              )}
              onMouseEnter={() => setHoveredRow(app.id)}
              onMouseLeave={() => setHoveredRow(null)}
              onClick={() => router.push(`/admin/sellers/${app.id}`)}
            >
              {/* Applicant */}
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <img
                    src={getAvatarUrl(app.user.avatar_url, app.user.username || app.user.email)}
                    alt={app.user.full_name || app.user.username || 'Profile'}
                    className="h-10 w-10 rounded-full object-cover border-2 border-white/10 bg-gradient-to-br from-violet-500/20 to-indigo-500/20"
                  />
                  <div>
                    <p className="text-sm font-medium text-white">
                      {app.user.full_name || app.user.username || 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-400">{app.user.email}</p>
                  </div>
                </div>
              </td>

              {/* Store Details */}
              <td className="px-6 py-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-gray-500" />
                    <p className="text-sm font-medium text-white">{app.display_name}</p>
                  </div>
                  <p className="text-xs text-gray-400 capitalize ml-6">{app.seller_type?.replace('_', ' ') || 'Not specified'}</p>
                  {app.game_names && app.game_names.length > 0 && (
                    <div className="flex flex-wrap gap-1 ml-6">
                      {app.game_names.slice(0, 2).map((game, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20"
                        >
                          {game}
                        </span>
                      ))}
                      {app.game_names.length > 2 && (
                        <span className="text-[10px] text-gray-500">+{app.game_names.length - 2} more</span>
                      )}
                    </div>
                  )}
                </div>
              </td>

              {/* Verification Status */}
              <td className="px-6 py-4">
                <div className="w-32">
                  {getVerificationStatus(app)}
                </div>
              </td>

              {/* Status */}
              <td className="px-6 py-4">
                {getStatusBadge(app)}
              </td>

              {/* Applied Date */}
              <td className="px-6 py-4">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Calendar className="h-3 w-3" />
                  {formatDate(app.created_at)}
                </div>
              </td>

              {/* Action */}
              <td className="px-6 py-4 text-right">
                <button
                  className={cn(
                    "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg",
                    "text-sm font-medium transition-all duration-200",
                    "hover:bg-white/[0.1]",
                    hoveredRow === app.id
                      ? "text-violet-400 bg-violet-500/10"
                      : "text-gray-400"
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