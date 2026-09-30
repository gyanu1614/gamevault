'use client'

import { useState } from 'react'
import { fixApprovedSellers } from '@/lib/actions/fix-approved-sellers'
import { CheckCircle, CircleNotch, WarningCircle } from '@phosphor-icons/react'
import { adminBtn } from '../components/kit'
import { useRouter } from 'next/navigation'

interface Props {
  needsUpdate: number
}

export default function FixApprovedSellersButton({ needsUpdate }: Props) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message: string
    updated?: number
    errors?: string[]
  } | null>(null)

  const handleFix = async () => {
    setIsLoading(true)
    setResult(null)

    try {
      const response = await fixApprovedSellers()
      setResult({
        success: response.success,
        message: response.message || (response.success ? 'Done' : 'An error occurred'),
        updated: response.updated,
        errors: response.errors,
      })

      // Force refresh to update stats
      if (response.success) {
        setTimeout(() => {
          router.refresh()
        }, 500)
      }
    } catch (error: any) {
      setResult({
        success: false,
        message: error.message || 'An error occurred'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={handleFix} disabled={isLoading || needsUpdate === 0} className={adminBtn.primary}>
        {isLoading ? (
          <>
            <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
            <span>Fixing...</span>
          </>
        ) : (
          <>
            <CheckCircle aria-hidden weight="bold" className="h-4 w-4" />
            <span>
              {needsUpdate === 0 ? 'All Up to Date' : `Fix ${needsUpdate} Seller${needsUpdate > 1 ? 's' : ''}`}
            </span>
          </>
        )}
      </button>

      {result && (
        <div
          className={`rounded-md p-4 ${result.success ? 'bg-success-bg' : 'bg-error-bg'}`}
        >
          <div className="flex items-start gap-2">
            {result.success ? (
              <CheckCircle aria-hidden weight="fill" className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            ) : (
              <WarningCircle aria-hidden weight="fill" className="mt-0.5 h-5 w-5 shrink-0 text-error" />
            )}
            <div className="flex-1">
              <p
                className={`text-sm font-medium ${
                  result.success ? 'text-success' : 'text-error'
                }`}
              >
                {result.message}
              </p>
              {result.updated !== undefined && result.updated > 0 && (
                <p className="text-xs text-text-secondary mt-1">
                  Updated {result.updated} seller profile{result.updated > 1 ? 's' : ''}
                </p>
              )}
              {result.errors && result.errors.length > 0 && (
                <div className="mt-2 space-y-1">
                  {result.errors.map((error, idx) => (
                    <p key={idx} className="text-xs text-error">
                      {error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
