'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, AlertCircle, CheckCircle2, Eye, EyeOff, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DeliveryType } from '@/lib/actions/instant-delivery'

interface InstantDeliveryFieldsProps {
  categoryType?: 'currency' | 'items' | 'account' | 'service' | 'gift_card'
  codes: string
  onCodesChange: (codes: string) => void
  deliveryType: DeliveryType
  onDeliveryTypeChange: (type: DeliveryType) => void
  disabled?: boolean
  className?: string
}

export default function InstantDeliveryFields({
  categoryType,
  codes,
  onCodesChange,
  deliveryType,
  onDeliveryTypeChange,
  disabled = false,
  className
}: InstantDeliveryFieldsProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [validationStatus, setValidationStatus] = useState<{
    valid: number
    invalid: number
    duplicates: number
  }>({ valid: 0, invalid: 0, duplicates: 0 })

  // Auto-detect delivery type based on category
  useEffect(() => {
    if (categoryType === 'account') {
      onDeliveryTypeChange('credentials')
    } else if (categoryType === 'gift_card' || categoryType === 'currency') {
      onDeliveryTypeChange('gift_card')
    } else {
      onDeliveryTypeChange('code')
    }
  }, [categoryType, onDeliveryTypeChange])

  // Real-time validation
  useEffect(() => {
    if (!codes.trim()) {
      setValidationStatus({ valid: 0, invalid: 0, duplicates: 0 })
      return
    }

    const lines = codes.split('\n').map(l => l.trim()).filter(l => l.length > 0)
    const seen = new Set<string>()
    let valid = 0
    let invalid = 0
    let duplicates = 0

    lines.forEach(line => {
      const normalized = line.toLowerCase()

      // Check duplicates
      if (seen.has(normalized)) {
        duplicates++
        return
      }
      seen.add(normalized)

      // Validate format
      if (deliveryType === 'credentials') {
        if (line.includes(':') && line.split(':').length === 2) {
          const [username, password] = line.split(':')
          if (username.trim() && password.trim()) {
            valid++
          } else {
            invalid++
          }
        } else {
          invalid++
        }
      } else {
        if (line.length >= 4) {
          valid++
        } else {
          invalid++
        }
      }
    })

    setValidationStatus({ valid, invalid, duplicates })
  }, [codes, deliveryType])

  // Get placeholder and helper text based on delivery type
  const getPlaceholderText = () => {
    switch (deliveryType) {
      case 'credentials':
        return 'username:password\nuser@email.com:securePass123\nplayer123:myPassword456'
      case 'gift_card':
        return 'ABCD-1234-EFGH-5678\nXYZ9-8765-MNOP-4321\nQRST-1111-UVWX-2222'
      case 'key':
        return 'XXXXX-XXXXX-XXXXX-XXXXX-XXXXX\nYYYYY-YYYYY-YYYYY-YYYYY-YYYYY'
      default:
        return 'Enter codes here (one per line)\nCode1\nCode2\nCode3'
    }
  }

  const getHelperText = () => {
    switch (deliveryType) {
      case 'credentials':
        return 'Enter account credentials in format: username:password or email:password (one per line)'
      case 'gift_card':
        return 'Enter gift card codes (one per line). Each code will be delivered to one buyer.'
      case 'key':
        return 'Enter product keys or license codes (one per line)'
      default:
        return 'Enter redemption codes (one per line). Each code will be automatically delivered to one buyer.'
    }
  }

  const getDeliveryTypeLabel = () => {
    switch (deliveryType) {
      case 'credentials':
        return 'Account Credentials'
      case 'gift_card':
        return 'Gift Card Codes'
      case 'key':
        return 'License Keys'
      default:
        return 'Redemption Codes'
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn('space-y-4', className)}
    >
      {/* Header with icon */}
      <div className="flex items-center gap-3 pb-2 border-b border-white/10">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
          <Sparkles className="w-5 h-5 text-purple-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white">Instant Delivery Setup</h3>
          <p className="text-sm text-text-secondary">
            Add your {getDeliveryTypeLabel().toLowerCase()} for automatic delivery
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4">
        <div className="flex items-start gap-3">
          <Package className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-semibold text-blue-300">
              How Instant Delivery Works
            </p>
            <p className="text-xs text-text-secondary">
              {getHelperText()} Your codes are encrypted and stored securely. When a buyer purchases,
              one code is automatically delivered to them. <span className="text-blue-400 font-medium">Stock automatically updates</span> based on the number of codes you enter.
            </p>
          </div>
        </div>
      </div>

      {/* Textarea for codes */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-white flex items-center gap-2">
            {getDeliveryTypeLabel()}
            <span className="text-xs text-text-tertiary font-normal">
              (one per line)
            </span>
          </label>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              showPreview
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'bg-white/5 text-text-secondary border border-white/10 hover:bg-white/10'
            )}
            disabled={disabled}
          >
            {showPreview ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                Hide Preview
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                Show Preview
              </>
            )}
          </button>
        </div>

        <textarea
          value={codes}
          onChange={(e) => onCodesChange(e.target.value)}
          placeholder={getPlaceholderText()}
          disabled={disabled}
          rows={12}
          style={{ whiteSpace: 'pre-wrap' }}
          className={cn(
            'w-full rounded-xl border bg-black/40 backdrop-blur-xl px-4 py-3',
            'text-sm text-white placeholder:text-text-disabled font-mono',
            'focus:outline-none focus:ring-2 transition-all resize-none',
            disabled
              ? 'border-white/5 opacity-50 cursor-not-allowed'
              : 'border-white/10 focus:border-primary/50 focus:ring-primary/20'
          )}
        />

        {/* Validation Status */}
        <AnimatePresence mode="wait">
          {codes.trim() && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2"
            >
              {/* Stats */}
              <div className="flex items-center gap-3 flex-wrap">
                {validationStatus.valid > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success-bg border border-green-500/20">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    <span className="text-xs font-semibold text-green-300">
                      {validationStatus.valid} Valid
                    </span>
                  </div>
                )}

                {validationStatus.invalid > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-error-bg border border-error/40">
                    <AlertCircle className="w-4 h-4 text-error" />
                    <span className="text-xs font-semibold text-error">
                      {validationStatus.invalid} Invalid
                    </span>
                  </div>
                )}

                {validationStatus.duplicates > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
                    <AlertCircle className="w-4 h-4 text-orange-400" />
                    <span className="text-xs font-semibold text-orange-300">
                      {validationStatus.duplicates} Duplicate{validationStatus.duplicates > 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Stock preview */}
              {validationStatus.valid > 0 && (
                <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-3">
                  <p className="text-sm text-purple-200">
                    <span className="font-bold text-purple-100">{validationStatus.valid}</span> code{validationStatus.valid > 1 ? 's' : ''} will be added to your inventory
                  </p>
                  <p className="text-xs text-text-secondary mt-1">
                    Stock quantity will be automatically set to {validationStatus.valid}
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Security notice */}
      <div className="rounded-lg bg-white/5 border border-white/10 p-3">
        <div className="flex items-start gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-text-secondary leading-relaxed">
              <span className="text-success font-medium">Secure & Private:</span> Your codes are encrypted using military-grade AES-256 encryption before storage.
              They're only decrypted when delivered to the buyer. Admins cannot see your codes.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
