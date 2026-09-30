'use client'

import { useState } from 'react'
import { createTestListings, deleteTestListings } from '@/lib/actions/test-data'
import { debugListings } from '@/lib/actions/debug-listings'
import { toast } from 'sonner'
import { Bug, CircleNotch, Plus, Trash } from '@phosphor-icons/react'
import { adminBtn } from '../components/kit'

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
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <button type="button" onClick={handleCreate} disabled={isCreating} className={adminBtn.primary}>
        {isCreating ? (
          <>
            <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
            Creating...
          </>
        ) : (
          <>
            <Plus aria-hidden weight="bold" className="h-4 w-4" />
            Create Test Listings
          </>
        )}
      </button>

      <button type="button" onClick={handleDelete} disabled={isDeleting} className={adminBtn.danger}>
        {isDeleting ? (
          <>
            <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
            Deleting...
          </>
        ) : (
          <>
            <Trash aria-hidden weight="bold" className="h-4 w-4" />
            Delete Test Listings
          </>
        )}
      </button>

      <button type="button" onClick={handleDebug} disabled={isDebugging} className={adminBtn.secondary}>
        {isDebugging ? (
          <>
            <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
            Debugging...
          </>
        ) : (
          <>
            <Bug aria-hidden weight="bold" className="h-4 w-4" />
            Debug Database
          </>
        )}
      </button>
    </div>
  )
}
