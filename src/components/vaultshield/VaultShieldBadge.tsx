/**
 * VaultShield Badge Component
 *
 * Displays VaultShield protection level badge
 * Shows on listings and order pages
 */

'use client'

import React from 'react'
import { Shield, ShieldCheck, ShieldAlert, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export type VaultShieldLevel = 'standard' | 'enhanced' | 'premium'

interface VaultShieldBadgeProps {
  level: VaultShieldLevel
  orderValue?: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  showTooltip?: boolean
  className?: string
}

const levelConfig = {
  standard: {
    icon: Shield,
    label: 'Standard Protection',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    description: 'Basic buyer protection for orders under $100',
    features: ['48-hour escrow', 'Dispute resolution', 'Refund protection']
  },
  enhanced: {
    icon: ShieldCheck,
    label: 'Enhanced Protection',
    color: 'text-lime-text',
    bgColor: 'bg-lime/10',
    borderColor: 'border-lime-tint-border',
    description: 'Advanced protection for orders $100-$499',
    features: [
      '48-hour escrow',
      'Delivery evidence required',
      'Priority dispute resolution',
      'Full refund guarantee'
    ]
  },
  premium: {
    icon: ShieldAlert,
    label: 'Premium Protection',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    description: 'Maximum protection for orders $500+',
    features: [
      '48-hour escrow',
      'Mandatory delivery evidence',
      'Priority dispute resolution',
      'Full refund guarantee',
      'Extended verification'
    ]
  }
}

export function VaultShieldBadge({
  level,
  orderValue,
  size = 'md',
  showLabel = true,
  showTooltip = false,
  className
}: VaultShieldBadgeProps) {
  const config = levelConfig[level]
  const Icon = config.icon

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs gap-1',
    md: 'px-3 py-1.5 text-sm gap-2',
    lg: 'px-4 py-2 text-base gap-2.5'
  }

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  }

  return (
    <div className="relative inline-flex group">
      <div
        className={cn(
          'inline-flex items-center rounded-lg border font-medium',
          config.color,
          config.bgColor,
          config.borderColor,
          sizeClasses[size],
          className
        )}
      >
        <Icon className={iconSizes[size]} />
        {showLabel && <span>{config.label}</span>}
        {orderValue !== undefined && (
          <span className="text-xs opacity-75">
            ${orderValue.toFixed(2)}
          </span>
        )}
      </div>

      {showTooltip && (
        <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 w-64">
          <div className="bg-gray-900 border border-white/[0.1] rounded-lg p-4 shadow-xl">
            <div className="flex items-start gap-3 mb-3">
              <Icon className={cn('w-5 h-5 flex-shrink-0', config.color)} />
              <div>
                <h4 className="text-sm font-semibold text-white mb-1">
                  {config.label}
                </h4>
                <p className="text-xs text-gray-400">
                  {config.description}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              {config.features.map((feature, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className={cn('w-1 h-1 rounded-full', config.bgColor)} />
                  <span className="text-xs text-gray-300">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VaultShieldBadge
