'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldAlert, Ban, CheckCircle, AlertCircle, Clock, Mail, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RestrictionStatusProps {
  profile: any
  restrictions: any[]
}

export default function RestrictionStatus({ profile, restrictions }: RestrictionStatusProps) {
  const [showAllHistoryModal, setShowAllHistoryModal] = useState(false)
  const isRestricted = profile.seller_status === 'restricted'
  const isBanned = profile.seller_status === 'banned'
  const isActive = profile.seller_status === 'active'

  // Always show only latest 2 in main view
  const displayedRestrictions = restrictions.slice(0, 2)

  return (
    <>
      <div className="p-4 sm:p-5 lg:p-6 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">Account Status</h1>
          <p className="text-xs text-text-secondary">View and manage your seller restriction information</p>
        </div>

        {/* Status Card */}
        <div
          className={cn(
            "rounded-xl border-2 p-3 sm:p-4 mb-4",
            isActive && "bg-success-bg border-success/30",
            isRestricted && "bg-warning-bg border-warning/40",
            isBanned && "bg-error-bg border-error/40"
          )}
        >
          <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
            {/* Icon */}
            <div className={cn(
              "h-12 w-12 sm:h-14 sm:w-14 rounded-full flex items-center justify-center flex-shrink-0",
              isActive && "bg-success-bg",
              isRestricted && "bg-warning-bg",
              isBanned && "bg-error-bg"
            )}>
              {isActive && <CheckCircle className="h-6 w-6 sm:h-7 sm:w-7 text-success" />}
              {isRestricted && <ShieldAlert className="h-6 w-6 sm:h-7 sm:w-7 text-warning" />}
              {isBanned && <Ban className="h-6 w-6 sm:h-7 sm:w-7 text-error" />}
            </div>

            {/* Content */}
            <div className="flex-1">
              <h2 className={cn(
                "text-lg sm:text-xl font-bold mb-1.5",
                isActive && "text-success",
                isRestricted && "text-warning",
                isBanned && "text-error"
              )}>
                {isActive && "Account Active"}
                {isRestricted && "Account Restricted"}
                {isBanned && "Account Banned"}
              </h2>

              {isActive && (
                <p className="text-sm text-text-secondary mb-3">
                  Your seller account is in good standing.
                </p>
              )}

              {isRestricted && (
                <>
                  <p className="text-sm text-text-secondary mb-3">
                    You cannot create or publish new listings.
                  </p>
                  {profile.seller_restriction_reason && (
                    <div className="bg-black/30 rounded-lg p-2.5 mb-3">
                      <p className="text-xs font-medium text-warning mb-1">Reason:</p>
                      <p className="text-xs text-text-secondary">{profile.seller_restriction_reason}</p>
                    </div>
                  )}
                </>
              )}

              {isBanned && (
                <>
                  <p className="text-sm text-text-secondary mb-3">
                    You no longer have access to seller features.
                  </p>
                  {profile.seller_restriction_reason && (
                    <div className="bg-black/30 rounded-lg p-2.5 mb-3">
                      <p className="text-xs font-medium text-error mb-1">Reason:</p>
                      <p className="text-xs text-text-secondary">{profile.seller_restriction_reason}</p>
                    </div>
                  )}
                </>
              )}

              {/* Timestamps */}
              {profile.seller_restricted_at && (
                <div className="flex items-center gap-1.5 text-xs text-text-secondary mb-3">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    {isRestricted && "Restricted on "}
                    {isBanned && "Banned on "}
                    {new Date(profile.seller_restricted_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              )}

              {/* Contact Support */}
              {!isActive && (
                <div className="flex items-start gap-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5">
                  <AlertCircle className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-blue-400 mb-0.5">Need Help?</p>
                    <p className="text-xs text-text-secondary mb-1.5">
                      Contact support to appeal this restriction.
                    </p>
                    <a
                      href="mailto:test@gmail.com"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      test@gmail.com
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Two Column Grid for What This Means and History */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* What This Means */}
          <div className="bg-bg-overlay backdrop-blur-sm rounded-xl border border-white/10 p-3 sm:p-4">
            <h3 className="text-base font-semibold text-white mb-3">What This Means</h3>

            <div className="space-y-2">
              {isActive && (
                <>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-text-secondary">Create and publish new listings</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-text-secondary">Manage existing listings</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-text-secondary">Full seller dashboard access</p>
                  </div>
                </>
              )}

              {isRestricted && (
                <>
                  <div className="flex items-start gap-2">
                    <Ban className="h-4 w-4 text-error flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-text-secondary">Cannot create new listings</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Ban className="h-4 w-4 text-error flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-text-secondary">Cannot publish listings</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-text-secondary">View existing listings (read-only)</p>
                  </div>
                </>
              )}

              {isBanned && (
                <>
                  <div className="flex items-start gap-2">
                    <Ban className="h-4 w-4 text-error flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-text-secondary">No seller feature access</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Ban className="h-4 w-4 text-error flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-text-secondary">Cannot manage listings</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Ban className="h-4 w-4 text-error flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-text-secondary">Listings hidden from buyers</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Restriction History */}
          {restrictions.length > 0 && (
            <div className="bg-bg-overlay backdrop-blur-sm rounded-xl border border-white/10 p-3 sm:p-4">
              <h3 className="text-base font-semibold text-white mb-3">Restriction History</h3>

              <div className="space-y-2">
                {displayedRestrictions.map((restriction: any) => (
                  <div
                    key={restriction.id}
                    className="bg-black/30 rounded-lg p-2.5 border border-white/10"
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        {restriction.restriction_type === 'restricted' && (
                          <ShieldAlert className="h-3.5 w-3.5 text-warning" />
                        )}
                        {restriction.restriction_type === 'banned' && (
                          <Ban className="h-3.5 w-3.5 text-error" />
                        )}
                        {restriction.restriction_type === 'unrestricted' && (
                          <CheckCircle className="h-3.5 w-3.5 text-success" />
                        )}
                        <span className="text-xs font-medium text-white capitalize">
                          {restriction.restriction_type}
                        </span>
                      </div>
                      <span className="text-[10px] text-text-tertiary">
                        {new Date(restriction.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    {restriction.reason && (
                      <p className="text-xs text-text-secondary mb-1.5">{restriction.reason}</p>
                    )}

                    {restriction.admin && (
                      <p className="text-[10px] text-text-tertiary">
                        By: {restriction.admin.username || restriction.admin.email}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {restrictions.length > 2 && (
                <button
                  onClick={() => setShowAllHistoryModal(true)}
                  className="mt-3 w-full text-xs font-medium text-lime-text hover:text-lime-text transition-colors py-1.5 px-3 bg-lime/10 hover:bg-lime/20 border border-lime-tint-border rounded-lg"
                >
                  View All ({restrictions.length})
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* View All History Modal */}
      <AnimatePresence>
        {showAllHistoryModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowAllHistoryModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", duration: 0.3, bounce: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl max-h-[80vh] overflow-y-auto bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowAllHistoryModal(false)}
                className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors z-10"
              >
                <X className="h-5 w-5 text-text-secondary hover:text-white" />
              </button>

              <div className="p-6">
                <h2 className="text-xl font-bold text-white mb-4">Complete Restriction History</h2>

                <div className="space-y-3">
                  {restrictions.map((restriction: any) => (
                    <div
                      key={restriction.id}
                      className="bg-bg-overlay rounded-lg p-4 border border-white/10"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {restriction.restriction_type === 'restricted' && (
                            <ShieldAlert className="h-4 w-4 text-warning" />
                          )}
                          {restriction.restriction_type === 'banned' && (
                            <Ban className="h-4 w-4 text-error" />
                          )}
                          {restriction.restriction_type === 'unrestricted' && (
                            <CheckCircle className="h-4 w-4 text-success" />
                          )}
                          <span className="text-sm font-medium text-white capitalize">
                            {restriction.restriction_type}
                          </span>
                        </div>
                        <span className="text-xs text-text-secondary">
                          {new Date(restriction.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>

                      {restriction.reason && (
                        <p className="text-sm text-text-secondary mb-2 bg-black/30 rounded p-2">
                          {restriction.reason}
                        </p>
                      )}

                      {restriction.admin && (
                        <p className="text-xs text-text-tertiary">
                          By: {restriction.admin.username || restriction.admin.email}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
