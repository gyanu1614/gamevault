'use client'

import { motion } from 'framer-motion'
import { ShieldAlert, Ban, CheckCircle, AlertCircle, Clock, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface RestrictionStatusProps {
  profile: any
  restrictions: any[]
}

export default function RestrictionStatus({ profile, restrictions }: RestrictionStatusProps) {
  const isRestricted = profile.seller_status === 'restricted'
  const isBanned = profile.seller_status === 'banned'
  const isActive = profile.seller_status === 'active'

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Account Status</h1>
          <p className="text-text-secondary">Your seller account restriction information</p>
        </div>

        {/* Status Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "rounded-2xl border-2 p-8 mb-8",
            isActive && "bg-success-bg border-success/30",
            isRestricted && "bg-warning-bg border-warning/40",
            isBanned && "bg-error-bg border-error/40"
          )}
        >
          <div className="flex items-start gap-6">
            {/* Icon */}
            <div className={cn(
              "h-16 w-16 rounded-full flex items-center justify-center flex-shrink-0",
              isActive && "bg-success-bg",
              isRestricted && "bg-warning-bg",
              isBanned && "bg-error-bg"
            )}>
              {isActive && <CheckCircle className="h-8 w-8 text-success" />}
              {isRestricted && <ShieldAlert className="h-8 w-8 text-warning" />}
              {isBanned && <Ban className="h-8 w-8 text-error" />}
            </div>

            {/* Content */}
            <div className="flex-1">
              <h2 className={cn(
                "text-2xl font-bold mb-2",
                isActive && "text-success",
                isRestricted && "text-warning",
                isBanned && "text-error"
              )}>
                {isActive && "Account Active"}
                {isRestricted && "Account Restricted"}
                {isBanned && "Account Banned"}
              </h2>

              {isActive && (
                <p className="text-text-secondary mb-4">
                  Your seller account is in good standing. You have full access to all seller features.
                </p>
              )}

              {isRestricted && (
                <>
                  <p className="text-text-secondary mb-4">
                    Your seller account has been restricted. You cannot create or publish new listings.
                  </p>
                  {profile.seller_restriction_reason && (
                    <div className="bg-black/30 rounded-lg p-4 mb-4">
                      <p className="text-sm font-medium text-warning mb-2">Restriction Reason:</p>
                      <p className="text-sm text-text-secondary">{profile.seller_restriction_reason}</p>
                    </div>
                  )}
                </>
              )}

              {isBanned && (
                <>
                  <p className="text-text-secondary mb-4">
                    Your seller account has been banned. You no longer have access to seller features.
                  </p>
                  {profile.seller_restriction_reason && (
                    <div className="bg-black/30 rounded-lg p-4 mb-4">
                      <p className="text-sm font-medium text-error mb-2">Ban Reason:</p>
                      <p className="text-sm text-text-secondary">{profile.seller_restriction_reason}</p>
                    </div>
                  )}
                </>
              )}

              {/* Timestamps */}
              {profile.seller_restricted_at && (
                <div className="flex items-center gap-2 text-sm text-text-secondary mb-4">
                  <Clock className="h-4 w-4" />
                  <span>
                    {isRestricted && "Restricted on "}
                    {isBanned && "Banned on "}
                    {new Date(profile.seller_restricted_at).toLocaleDateString('en-US', {
                      month: 'long',
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
                <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <AlertCircle className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-400 mb-1">Need Help?</p>
                    <p className="text-sm text-text-secondary mb-2">
                      If you believe this restriction was made in error or would like to appeal, please contact our support team.
                    </p>
                    <a
                      href="mailto:test@gmail.com"
                      className="inline-flex items-center gap-2 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <Mail className="h-4 w-4" />
                      test@gmail.com
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* What This Means */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6 mb-8"
        >
          <h3 className="text-lg font-semibold text-white mb-4">What This Means</h3>

          <div className="space-y-3">
            {isActive && (
              <>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-text-secondary">You can create and publish new listings</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-text-secondary">You can manage your existing listings</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-text-secondary">You have full access to seller dashboard</p>
                </div>
              </>
            )}

            {isRestricted && (
              <>
                <div className="flex items-start gap-3">
                  <Ban className="h-5 w-5 text-error flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-text-secondary">You cannot create new listings</p>
                </div>
                <div className="flex items-start gap-3">
                  <Ban className="h-5 w-5 text-error flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-text-secondary">You cannot publish or make listings live</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-text-secondary">You can view your existing listings (read-only)</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-text-secondary">You can access your seller dashboard (limited)</p>
                </div>
              </>
            )}

            {isBanned && (
              <>
                <div className="flex items-start gap-3">
                  <Ban className="h-5 w-5 text-error flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-text-secondary">You cannot access seller features</p>
                </div>
                <div className="flex items-start gap-3">
                  <Ban className="h-5 w-5 text-error flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-text-secondary">You cannot create or manage listings</p>
                </div>
                <div className="flex items-start gap-3">
                  <Ban className="h-5 w-5 text-error flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-text-secondary">Your existing listings are hidden from buyers</p>
                </div>
              </>
            )}
          </div>
        </motion.div>

        {/* Restriction History */}
        {restrictions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Restriction History</h3>

            <div className="space-y-3">
              {restrictions.map((restriction: any) => (
                <div
                  key={restriction.id}
                  className="bg-black/30 rounded-lg p-4 border border-gray-700"
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
                    <span className="text-xs text-text-tertiary">
                      {new Date(restriction.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {restriction.reason && (
                    <p className="text-sm text-text-secondary mb-2">{restriction.reason}</p>
                  )}

                  {restriction.admin && (
                    <p className="text-xs text-text-tertiary">
                      By: {restriction.admin.username || restriction.admin.email}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Back to Dashboard */}
        <div className="mt-8 text-center">
          <Link
            href="/seller/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-lime hover:bg-lime-hover text-text-inverse font-medium rounded-lg transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
