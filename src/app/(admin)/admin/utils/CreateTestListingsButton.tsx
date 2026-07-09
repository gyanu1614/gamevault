'use client'

import { useState } from 'react'
import { createTestListings, deleteTestListings } from '@/lib/actions/test-data'
import { debugListings } from '@/lib/actions/debug-listings'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, Bug } from 'lucide-react'

export default function CreateTestListingsButton() {
  const [isCreating, setIsCreating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDebugging, setIsDebugging] = useState(false)

  const handleCreate = async () => {
    setIsCreating(true)
    try {
      const result = await createTestListings()
      if (result.success) {
        toast.success(result.message)
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      toast.error('Failed to create test listings')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete all test listings?')) {
      return
    }

    setIsDeleting(true)
    try {
      const result = await deleteTestListings()
      if (result.success) {
        toast.success(result.message)
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      toast.error('Failed to delete test listings')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDebug = async () => {
    setIsDebugging(true)
    try {
      const result = await debugListings()
      console.log('🐛 DEBUG LISTINGS RESULT:', JSON.stringify(result, null, 2))
      toast.success('Debug data logged to console')
    } catch (error) {
      console.error('Debug error:', error)
      toast.error('Failed to debug listings')
    } finally {
      setIsDebugging(false)
    }
  }

  return (
    <div className="flex gap-3">
      <button
        onClick={handleCreate}
        disabled={isCreating}
        className="flex items-center gap-2 rounded-lg bg-lime-pressed px-4 py-2 text-sm font-bold text-text-inverse transition-colors hover:bg-lime disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isCreating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating...
          </>
        ) : (
          <>
            <Plus className="h-4 w-4" />
            Create Test Listings
          </>
        )}
      </button>

      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isDeleting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Deleting...
          </>
        ) : (
          <>
            <Trash2 className="h-4 w-4" />
            Delete Test Listings
          </>
        )}
      </button>

      <button
        onClick={handleDebug}
        disabled={isDebugging}
        className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isDebugging ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Debugging...
          </>
        ) : (
          <>
            <Bug className="h-4 w-4" />
            Debug Database
          </>
        )}
      </button>
    </div>
  )
}
