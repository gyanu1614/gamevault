'use client'

import { useCallback, useMemo, useState, type SetStateAction } from 'react'

import type { OfferForm } from '../offer-form'

/**
 * The Details answers in one state cell, plus stable setters named the way
 * the step components take them (setTitle, onRegion …). The setters never
 * change identity, so memoised children don't re-render because a parent
 * handed them a new function.
 */
export function useOfferForm(initial: OfferForm) {
  const [form, setForm] = useState<OfferForm>(initial)

  const update = useCallback(<K extends keyof OfferForm>(key: K, value: SetStateAction<OfferForm[K]>) => {
    setForm((prev) => ({
      ...prev,
      [key]: typeof value === 'function' ? (value as (p: OfferForm[K]) => OfferForm[K])(prev[key]) : value,
    }))
  }, [])

  const setters = useMemo(
    () => ({
      setTitle: (v: string) => update('title', v),
      setDescription: (v: string) => update('description', v),
      setPrice: (v: string) => update('price', v),
      setOriginalPrice: (v: string) => update('originalPrice', v),
      setQuantity: (v: string) => update('quantity', v),
      setMinQuantity: (v: string) => update('minQuantity', v),
      setDeliveryMethod: (v: 'manual' | 'instant') => update('deliveryMethod', v),
      setDeliveryTime: (v: string) => update('deliveryTime', v),
      setAgreeSellerRules: (v: boolean) => update('agreeSellerRules', v),
      setAgreeTos: (v: boolean) => update('agreeTos', v),
      onRegion: (v: string) => update('region', v),
      onPlatform: (v: string) => update('platform', v),
      onDevice: (v: string) => update('device', v),
      onDeliveryMethodType: (v: string) => update('deliveryMethodType', v),
      onBundleId: (v: string) => update('bundleId', v),
      addImages: (urls: string[]) => update('images', (prev) => [...prev, ...urls]),
      removeImage: (index: number) => update('images', (prev) => prev.filter((_, i) => i !== index)),
    }),
    [update],
  )

  return { form, setForm, update, setters }
}
