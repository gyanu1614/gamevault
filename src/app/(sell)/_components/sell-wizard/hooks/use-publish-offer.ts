'use client'

import { useCallback, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { publishListing, updateListingFromWizard, uploadSellImage, type SellGameOption } from '@/lib/actions/sell-wizard'
import type { AttributeTemplateFull } from '@/lib/actions/new-schema'
import type { CurrencyConfig } from '@/lib/types/category-configs'
import { classifyOfferType } from '@/lib/utils/offer-type'

import type { OfferForm } from '../offer-form'
import { publishPayloadFor } from '../offer-rules'
import { clearWizardSnapshot } from './use-wizard-snapshot'

/** Most photos one listing may carry. */
export const MAX_LISTING_IMAGES = 5

/**
 * Create Offer / Save Changes, and photo uploads.
 *
 * A synchronous ref guards against a double click creating two listings
 * (state updates land a render later). On success the seller goes to their
 * Offers tab for that type and the button stays disabled through the
 * navigation; it re-enables only when we stay on the page.
 */
export function usePublishOffer(input: {
  form: OfferForm
  game: SellGameOption | null
  categorySlug: string | undefined
  template: AttributeTemplateFull | null
  currencyConfig: CurrencyConfig | null
  editListingId: string | null
  editStatus: string | null
  addImages: (urls: string[]) => void
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [, startTransition] = useTransition()
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const submittingRef = useRef(false)
  const { form, game, categorySlug, template, currencyConfig, editListingId, editStatus, addImages } = input

  const publish = useCallback(
    async (asDraft: boolean) => {
      if (!game || !categorySlug || submittingRef.current) return
      submittingRef.current = true
      setSubmitting(true)
      let succeeded = false
      try {
        const payload = publishPayloadFor({ form, game, categorySlug, template, currencyConfig, asDraft })
        const res = editListingId ? await updateListingFromWizard(editListingId, payload) : await publishListing(payload)
        if (!res.success) {
          toast.error(res.error)
          return
        }
        const landed = res.data.status
        if (editListingId) {
          // An offer the review team bounced back re-enters the queue: say so.
          const wasBounced = editStatus === 'changes_requested' || editStatus === 'rejected'
          toast.success(wasBounced && landed === 'pending_approval' ? 'Resubmitted for review' : 'Listing updated')
        } else if (asDraft) {
          toast.success('Saved as draft')
        } else if (landed === 'pending_approval') {
          toast.success('Listing submitted — pending review by our team')
        } else {
          toast.success('Listing published!')
        }
        clearWizardSnapshot()
        // The Offers pages read through react-query; drop their cached rows.
        queryClient.invalidateQueries({ queryKey: ['seller', 'listings'] })
        queryClient.invalidateQueries({ queryKey: ['seller', 'dashboard'] })
        succeeded = true
        startTransition(() => router.push(`/account/listings?type=${classifyOfferType(undefined, categorySlug)}`))
      } finally {
        if (!succeeded) {
          submittingRef.current = false
          setSubmitting(false)
        }
      }
    },
    [form, game, categorySlug, template, currencyConfig, editListingId, editStatus, queryClient, router],
  )

  const uploadImages = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      if (form.images.length + files.length > MAX_LISTING_IMAGES) {
        toast.error(`Maximum ${MAX_LISTING_IMAGES} images`)
        return
      }
      setUploading(true)
      try {
        // One at a time: Next runs a client's server actions in sequence anyway,
        // and a failed photo should not stop the others.
        const urls: string[] = []
        for (const file of Array.from(files)) {
          const fd = new FormData()
          fd.append('file', file)
          const res = await uploadSellImage(fd)
          if (res.success) urls.push(res.data.url)
          else toast.error(res.error)
        }
        if (urls.length > 0) addImages(urls)
      } finally {
        setUploading(false)
      }
    },
    [form.images.length, addImages],
  )

  return { submitting, publish, uploading, uploadImages }
}
