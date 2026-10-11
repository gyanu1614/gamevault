'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  fetchExistingBundleListingId,
  fetchPublishPolicy,
  fetchSellGamesForCategory,
  fetchSellTemplate,
  type SellGameOption,
  type SellerPublishPolicy,
} from '@/lib/actions/sell-wizard'
import { fetchCategoryConfigBySlug } from '@/lib/actions/admin-category-configs'
import type { AttributeTemplateFull, GlobalCategory } from '@/lib/actions/new-schema'
import type { CurrencyConfig } from '@/lib/types/category-configs'
import type { WizardPrefill } from '@/lib/sell/wizard-prefill'
import { safeLocal } from '@/lib/safe-storage'

import { RECENT_GAMES_KEY } from '../constants'

/**
 * The server data behind the wizard: the category's games, the (game,
 * category) attribute template, the currency config, the seller's publish
 * policy, and the "you already list this bundle" check.
 *
 * With a server prefill (edit / duplicate) the first values come from it and
 * the matching fetch is skipped: the effect sees its key already loaded. A
 * later change of category or game fetches as before. Every fetch ignores a
 * reply that arrives after its inputs changed.
 */
export function useSellCatalog(input: {
  category: GlobalCategory | null
  game: SellGameOption | null
  bundleId: string
  region: string
  platform: string
  isEditMode: boolean
  prefill: WizardPrefill | null
}) {
  const { category, game, bundleId, region, platform, isEditMode, prefill } = input

  const [games, setGames] = useState<SellGameOption[]>(prefill?.games ?? [])
  const [gamesLoading, setGamesLoading] = useState(false)
  const [template, setTemplate] = useState<AttributeTemplateFull | null>(prefill?.template ?? null)
  const [templateLoading, setTemplateLoading] = useState(false)
  const [currencyConfig, setCurrencyConfig] = useState<CurrencyConfig | null>(prefill?.currencyConfig ?? null)
  const [currencyConfigLoading, setCurrencyConfigLoading] = useState(false)
  const [policy, setPolicy] = useState<SellerPublishPolicy | null>(prefill?.policy ?? null)
  const [existingBundleListingId, setExistingBundleListingId] = useState('')

  // What the prefill already loaded, so the first effect run skips its fetch.
  const loaded = useRef({
    gamesFor: prefill ? prefill.listing.category_slug : null,
    templateFor: prefill ? `${prefill.game.game_id}:${prefill.listing.category_slug}` : null,
    configFor: prefill ? prefill.game.game_id : null,
  })

  useEffect(() => {
    if (prefill) return
    let cancelled = false
    fetchPublishPolicy().then((res) => {
      if (!cancelled && res.success) setPolicy(res.data)
    })
    return () => {
      cancelled = true
    }
  }, [prefill])

  useEffect(() => {
    if (!category) return
    const cache = loaded.current
    if (cache.gamesFor === category.slug) return
    cache.gamesFor = category.slug
    let cancelled = false
    setGamesLoading(true)
    fetchSellGamesForCategory(category.slug)
      .then((res) => {
        if (cancelled) return
        if (res.success) setGames(res.data)
        else toast.error(res.error)
      })
      .finally(() => {
        if (!cancelled) setGamesLoading(false)
      })
    return () => {
      cancelled = true
      // A cancelled load must run again if this category comes back.
      if (cache.gamesFor === category.slug) cache.gamesFor = null
    }
  }, [category])

  useEffect(() => {
    if (!category || !game) return
    const key = `${game.game_id}:${category.slug}`
    const cache = loaded.current
    if (cache.templateFor === key) return
    cache.templateFor = key
    let cancelled = false
    setTemplateLoading(true)
    fetchSellTemplate(game.game_id, category.slug)
      .then((res) => {
        if (cancelled) return
        if (res.success) setTemplate(res.data)
        else toast.error(res.error)
      })
      .finally(() => {
        if (!cancelled) setTemplateLoading(false)
      })
    return () => {
      cancelled = true
      if (cache.templateFor === key) cache.templateFor = null
    }
  }, [category, game])

  useEffect(() => {
    const cache = loaded.current
    if (!game || category?.slug !== 'currency') {
      setCurrencyConfig(null)
      setCurrencyConfigLoading(false)
      cache.configFor = null
      return
    }
    if (cache.configFor === game.game_id) return
    cache.configFor = game.game_id
    let cancelled = false
    setCurrencyConfigLoading(true)
    fetchCategoryConfigBySlug(game.game_slug, 'currency').then((cfg) => {
      if (cancelled) return
      setCurrencyConfig(cfg)
      setCurrencyConfigLoading(false)
    })
    return () => {
      cancelled = true
      if (cache.configFor === game.game_id) cache.configFor = null
    }
  }, [category, game])

  // Best effort: the publish-time guard is the hard check. Skipped in edit
  // mode (the listing being edited IS the existing one).
  useEffect(() => {
    if (isEditMode || !game || !bundleId) {
      setExistingBundleListingId('')
      return
    }
    let cancelled = false
    fetchExistingBundleListingId(game.game_id, bundleId, region || null, platform || null).then((res) => {
      if (!cancelled) setExistingBundleListingId(res?.id ?? '')
    })
    return () => {
      cancelled = true
    }
  }, [game, bundleId, region, platform, isEditMode])

  /** Forget the template when the category or game changes (its answers no longer apply). */
  const clearTemplate = useCallback(() => setTemplate(null), [])

  return {
    games,
    gamesLoading,
    template,
    templateLoading,
    clearTemplate,
    currencyConfig,
    currencyConfigLoading,
    policy,
    existingBundleListingId,
  }
}

/** Recently listed games (this browser), newest first, at most 12. */
export function useRecentGames() {
  const [recentGameIds, setRecentGameIds] = useState<string[]>([])
  useEffect(() => {
    const raw = safeLocal.get(RECENT_GAMES_KEY)
    if (!raw) return
    try {
      const ids = JSON.parse(raw)
      if (Array.isArray(ids)) setRecentGameIds(ids.filter((x): x is string => typeof x === 'string'))
    } catch {
      // A corrupt entry is ignored; the next remember() overwrites it.
    }
  }, [])
  const remember = useCallback((gameId: string) => {
    setRecentGameIds((prev) => {
      const next = [gameId, ...prev.filter((id) => id !== gameId)].slice(0, 12)
      safeLocal.set(RECENT_GAMES_KEY, JSON.stringify(next))
      return next
    })
  }, [])
  return { recentGameIds, remember }
}
