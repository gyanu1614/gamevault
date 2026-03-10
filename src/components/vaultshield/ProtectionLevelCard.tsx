/**
 * Protection Level Card Component
 *
 * Detailed card showing VaultShield protection features
 * Used on checkout and order detail pages
 */

'use client'

import React from 'react'
import { Shield, ShieldCheck, ShieldAlert, Check, Clock, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { VaultShieldLevel } from './VaultShieldBadge'

interface ProtectionLevelCardProps {
  level: VaultShieldLevel
  orderValue: number
  showDetails?: boolean
  className?: string
}

const levelConfig = {
  standard: {
    icon: Shield,
    label: 'Standard Protection',
    color: 'text-blue-400',
    bgGradient: 'from-blue-500/10 to-blue-500/5',
    borderColor: 'border-blue-500/20',
    description: 'Essential buyer protection for peace of mind',
    features: [
      { icon: Clock, text: '48-hour secure escrow hold' },
      { icon: Shield, text: 'Dispute resolution support' },
      { icon: Check, text: 'Full refund if seller fails to deliver' }
    ],
    notice: 'Orders under $100 automatically receive Standard Protection'
  },
  enhanced: {
    icon: ShieldCheck,
    label: 'Enhanced Protection',
    color: 'text-violet-400',
    bgGradient: 'from-violet-500/10 to-violet-500/5',
    borderColor: 'border-violet-500/20',
    description: 'Advanced security for valuable purchases',
    features: [
      { icon: Clock, text: '48-hour secure escrow hold' },
      { icon: FileText, text: 'Delivery evidence required from seller' },
      { icon: Shield, text: 'Priority dispute resolution' },
      { icon: Check, text: 'Full refund guarantee' }
    ],
    notice: 'Orders $100-$499 receive Enhanced Protection'
  },
  premium: {
    icon: ShieldAlert,
    label: 'Premium Protection',
    color: 'text-amber-400',
    bgGradient: 'from-amber-500/10 to-amber-500/5',
    borderColor: 'border-amber-500/20',
    description: 'Maximum security for high-value transactions',
    features: [
      { icon: Clock, text: '48-hour secure escrow hold' },
      { icon: FileText, text: 'Mandatory delivery evidence (screenshots/video)' },
      { icon: Shield, text: 'Priority dispute resolution' },
      { icon: Check, text: 'Full refund guarantee' },
      { icon: ShieldCheck, text: 'Extended verification process' }
    ],
    notice: 'Orders $500+ receive Premium Protection'
  }
}

export function ProtectionLevelCard({
  level,
  orderValue,
  showDetails = true,
  className
}: ProtectionLevelCardProps) {
  const config = levelConfig[level]
  const Icon = config.icon

  return (
    <div
      className={cn(
        'rounded-xl border p-6 bg-gradient-to-br',
        config.bgGradient,
        config.borderColor,
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'p-2.5 rounded-lg bg-white/[0.05] border',
              config.borderColor
            )}
          >
            <Icon className={cn('w-6 h-6', config.color)} />
          </div>
          <div>
            <h3 className={cn('text-lg font-semibold', config.color)}>
              {config.label}
            </h3>
            <p className="text-sm text-gray-400 mt-0.5">
              {config.description}
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-sm text-gray-400">Order Value</div>
          <div className="text-xl font-bold text-white">
            ${orderValue.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Features */}
      {showDetails && (
        <>
          <div className="space-y-3 mb-4">
            {config.features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3">
                <feature.icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', config.color)} />
                <span className="text-sm text-gray-300">{feature.text}</span>
              </div>
            ))}
          </div>

          {/* Notice */}
          <div className="pt-4 border-t border-white/[0.05]">
            <p className="text-xs text-gray-400">{config.notice}</p>
          </div>
        </>
      )}
    </div>
  )
}

export default ProtectionLevelCard
