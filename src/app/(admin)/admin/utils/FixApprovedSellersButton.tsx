'use client'

import { useState } from 'react'
import { fixApprovedSellers } from '@/lib/actions/fix-approved-sellers'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
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
      <button
        onClick={handleFix}
        disabled={isLoading || needsUpdate === 0}
        className="px-4 py-2 bg-lime-pressed hover:bg-lime disabled:bg-bg-overlay disabled:text-text-disabled disabled:cursor-not-allowed text-text-inverse rounded-lg font-bold transition-colors flex items-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Fixing...</span>
          </>
        ) : (
          <>
            <CheckCircle className="h-4 w-4" />
            <span>
              {needsUpdate === 0 ? 'All Up to Date' : `Fix ${needsUpdate} Seller${needsUpdate > 1 ? 's' : ''}`}
            </span>
          </>
        )}
      </button>

      {result && (
        <div
          className={`rounded-lg p-4 ${
            result.success
              ? 'bg-success-bg border border-[rgba(63,217,134,0.25)]'
              : 'bg-error-bg border border-[rgba(255,92,92,0.25)]'
          }`}
        >
          <div className="flex items-start gap-2">
            {result.success ? (
              <CheckCircle className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-error flex-shrink-0 mt-0.5" />
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
