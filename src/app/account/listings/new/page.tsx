'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  X,
  Plus,
  Minus,
  Save,
  Sparkles,
  AlertCircle,
  Check,
  DollarSign,
  Zap,
  Clock,
  Info,
  Loader2,
  Shield,
  ShieldAlert,
  Image as ImageIcon,
  ChevronRight,
  Gamepad2,
  Tag,
  FileText,
  Package,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { canSellerPublish } from '@/lib/utils/seller-status'
import type { SellerStatus } from '@/lib/utils/seller-status'
import {
  getListingTemplate,
  uploadListingImage,
  deleteListingImage,
  createListing,
  updateListing,
  getListingById,
  checkSellerNeedsModeration,
  getSellerProfile,
  getGameCategories,
  getCategoryById,
  type ListingTemplate,
  type TemplateField,
  type CreateListingInput,
  type Category,
} from '@/lib/actions/listings'
import GameSelector from '@/components/listings/GameSelector'
import CategorySelector from '@/components/listings/CategorySelector'
import RegionSelector from '@/components/listings/RegionSelector'
import InstantDeliveryFields from '@/components/listings/InstantDeliveryFields'
import { addInstantDeliveryInventory } from '@/lib/actions/instant-delivery'
import type { DeliveryType } from '@/lib/actions/instant-delivery'
import { getDeliveryMethodsForGame, type DeliveryMethodOption } from '@/lib/config/delivery-methods'

// ─── constants ────────────────────────────────────────────────────────────────

const deliveryMethods = [
  {
    value: 'instant',
    label: 'Instant Delivery',
    description: 'Delivered automatically within seconds',
    icon: Zap,
    color: 'text-yellow-400',
    bgActive: 'bg-yellow-500/10 border-yellow-500/40',
  },
  {
    value: 'manual',
    label: 'Manual Delivery',
    description: 'You deliver within your specified time',
    icon: Clock,
    color: 'text-violet-400',
    bgActive: 'bg-violet-500/10 border-violet-500/40',
  },
]

const deliveryTimeOptions = [
  { value: '20min',  label: '20 minutes' },
  { value: '1hr',   label: '1 hour' },
  { value: '3hr',   label: '3 hours' },
  { value: '6hr',   label: '6 hours' },
  { value: '12hr',  label: '12 hours' },
  { value: '24hr',  label: '1 day' },
]

const sellerTierInfo: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  unverified: { label: 'Unverified', color: 'text-gray-400', bg: 'bg-gray-500/15', icon: '🆕' },
  bronze: { label: 'Bronze Seller', color: 'text-orange-400', bg: 'bg-orange-500/15', icon: '🥉' },
  silver: { label: 'Silver Seller', color: 'text-gray-300', bg: 'bg-gray-400/15', icon: '🥈' },
  gold: { label: 'Gold Seller', color: 'text-yellow-400', bg: 'bg-yellow-500/15', icon: '🥇' },
  platinum: { label: 'Platinum Seller', color: 'text-cyan-400', bg: 'bg-cyan-500/15', icon: '💎' },
}

const STEPS = [
  { id: 1, label: 'Game & Category', icon: Gamepad2, description: 'Choose what you\'re selling' },
  { id: 2, label: 'Listing Details', icon: FileText, description: 'Add info, images & pricing' },
]

// ─── sub-components ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const done = current > step.id
        const active = current === step.id
        const Icon = step.icon
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-300',
                  done
                    ? 'border-violet-500 bg-violet-500 text-white'
                    : active
                    ? 'border-violet-500/60 bg-violet-500/15 text-violet-400'
                    : 'border-white/10 bg-white/[0.03] text-gray-600'
                )}
              >
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <div className="hidden sm:block">
                <p
                  className={cn(
                    'text-xs font-semibold transition-colors',
                    active ? 'text-white' : done ? 'text-violet-400' : 'text-gray-600'
                  )}
                >
                  {step.label}
                </p>
                <p className="text-[10px] text-gray-600">{step.description}</p>
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div className="mx-4 h-px w-12 sm:w-20 bg-white/10 relative overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-violet-500 transition-all duration-500"
                  style={{ width: done ? '100%' : '0%' }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={cn(
        'relative h-6 w-11 rounded-full transition-all duration-300',
        enabled ? 'bg-violet-500' : 'bg-white/10'
      )}
    >
      <div
        className={cn(
          'absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all duration-300',
          enabled ? 'left-6' : 'left-1'
        )}
      />
    </button>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function CreateListingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Edit mode
  const editListingId = searchParams.get('id')
  const isEditMode = !!editListingId

  // Step
  const [step, setStep] = useState(1)

  // Data
  const [games, setGames] = useState<any[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategoryData, setSelectedCategoryData] = useState<Category | null>(null)
  const [loading, setLoading] = useState(true)

  // Seller
  const [sellerProfile, setSellerProfile] = useState<any>(null)
  const [moderationInfo, setModerationInfo] = useState<any>(null)

  // Template
  const [template, setTemplate] = useState<ListingTemplate | null>(null)
  const [loadingTemplate, setLoadingTemplate] = useState(false)

  // Form state
  const [selectedGame, setSelectedGame] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedRegion, setSelectedRegion] = useState('')
  const [selectedPlatform, setSelectedPlatform] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [originalPrice, setOriginalPrice] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [minQuantity, setMinQuantity] = useState('1')
  const [deliveryMethod, setDeliveryMethod] = useState('manual')
  const [deliveryTime, setDeliveryTime] = useState('1hr')
  const [deliveryMethodType, setDeliveryMethodType] = useState('in_game_trade')
  const [images, setImages] = useState<string[]>([])
  const [templateData, setTemplateData] = useState<Record<string, any>>({})

  // Instant delivery
  const [instantDeliveryCodes, setInstantDeliveryCodes] = useState('')
  const [instantDeliveryType, setInstantDeliveryType] = useState<'code' | 'credentials' | 'key' | 'gift_card'>('code')

  // Auto-calculate stock from instant delivery codes
  useEffect(() => {
    if (deliveryMethod === 'instant' && instantDeliveryCodes) {
      const codes = instantDeliveryCodes.split('\n').filter(line => line.trim().length > 0)
      setQuantity(codes.length.toString())
    }
  }, [deliveryMethod, instantDeliveryCodes])

  // UI
  const [uploadingImage, setUploadingImage] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isRestricted, setIsRestricted] = useState(false)

  // ── initial data fetch ──────────────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        // First, check seller profile for restrictions BEFORE loading anything else
        const profileRes = await getSellerProfile()

        if (profileRes.success) {
          setSellerProfile(profileRes.profile)

          // Check if seller is restricted - BLOCK immediately
          const sellerStatus = (profileRes.profile?.seller_status as SellerStatus) || 'active'
          if (!canSellerPublish(sellerStatus)) {
            setIsRestricted(true)
            setLoading(false)
            toast.error('Access Denied: Your seller account is restricted.')
            // Redirect to restrictions page immediately
            router.replace('/account/restrictions')
            return // Stop execution here
          }
        }

        // Only load games and moderation if seller is not restricted
        const [gamesRes, moderationRes] = await Promise.all([
          supabase.from('games').select('*').eq('is_active', true).order('name'),
          checkSellerNeedsModeration(),
        ])

        if (gamesRes.data) setGames(gamesRes.data)
        if (moderationRes.success) setModerationInfo(moderationRes)
      } catch (error) {
        console.error('Failed to fetch initial data:', error)
        toast.error('Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [router])

  // ── load listing for editing ────────────────────────────────────────────────
  useEffect(() => {
    if (isEditMode && editListingId && !loading) {
      loadListingForEdit()
    }
  }, [isEditMode, editListingId, loading])

  const loadListingForEdit = async () => {
    try {
      const result = await getListingById(editListingId!)
      if (!result.success || !result.listing) {
        toast.error('Failed to load listing')
        router.push('/account/listings')
        return
      }

      const listing = result.listing

      // Pre-fill all form fields
      setSelectedGame(listing.game_id)
      setSelectedCategory(listing.category_id)
      setTitle(listing.title)
      setDescription(listing.description || '')
      setPrice(listing.price.toString())
      setOriginalPrice(listing.original_price?.toString() || '')
      setQuantity(listing.quantity.toString())
      setMinQuantity(listing.min_quantity?.toString() || '1')
      setDeliveryMethod(listing.delivery_method || 'manual')
      setDeliveryTime(listing.delivery_time || '1hr')
      setDeliveryMethodType(listing.delivery_method_type || 'in_game_trade')
      setImages(listing.images || [])
      setTemplateData(listing.template_data || {})
      setSelectedRegion(listing.region || '')
      setSelectedPlatform(listing.platform || '')

      toast.success('Listing loaded for editing')
    } catch (error) {
      console.error('Failed to load listing:', error)
      toast.error('Failed to load listing')
      router.push('/account/listings')
    }
  }

  // ── game change ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedGame) {
      loadGameCategories()
      setSelectedCategory('')
      setSelectedCategoryData(null)
      setSelectedRegion('')
      setSelectedPlatform('')
      setTemplate(null)
      setTemplateData({})
    } else {
      setCategories([])
      setSelectedCategory('')
      setSelectedCategoryData(null)
      setSelectedRegion('')
      setSelectedPlatform('')
      setTemplate(null)
      setTemplateData({})
    }
  }, [selectedGame])

  const loadGameCategories = async () => {
    try {
      const result = await getGameCategories(selectedGame)
      if (result.success && result.categories) {
        setCategories(result.categories)
      } else {
        toast.error('Failed to load categories')
      }
    } catch (error) {
      toast.error('Failed to load categories')
    }
  }

  // ── category change ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedCategory) {
      loadCategoryData()
    } else {
      setSelectedCategoryData(null)
      setSelectedRegion('')
      setSelectedPlatform('')
    }
  }, [selectedCategory])

  const loadCategoryData = async () => {
    try {
      const result = await getCategoryById(selectedCategory)
      if (result.success && result.category) {
        setSelectedCategoryData(result.category)
        if (!result.category.metadata?.requires_region) setSelectedRegion('')
        if (!result.category.metadata?.requires_platform) setSelectedPlatform('')
        // Currency/item categories cannot use instant delivery — force manual
        if (result.category.metadata?.type === 'currency') {
          setDeliveryMethod('manual')
        }
      }
    } catch (error) {
      console.error('Failed to load category data:', error)
    }
  }

  // ── template load ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedGame && selectedCategory) {
      loadTemplate()
    } else {
      setTemplate(null)
      setTemplateData({})
    }
  }, [selectedGame, selectedCategory])

  const loadTemplate = async () => {
    setLoadingTemplate(true)
    try {
      const result = await getListingTemplate(selectedGame, selectedCategory)
      if (result.success) {
        setTemplate(result.template || null)
        if (result.template) {
          const initialData: Record<string, any> = {}
          result.template.fields.forEach((field: TemplateField) => {
            if (field.defaultValue !== undefined) initialData[field.name] = field.defaultValue
          })
          setTemplateData(initialData)
        }
      }
    } catch (error) {
      console.error('Failed to load template:', error)
    } finally {
      setLoadingTemplate(false)
    }
  }

  // ── image upload ────────────────────────────────────────────────────────────
  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (images.length + files.length > 5) {
      toast.error('Maximum 5 images allowed')
      return
    }
    setUploadingImage(true)
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData()
        formData.append('file', file)
        const result = await uploadListingImage(formData)
        if (!result.success) throw new Error(result.error)
        return result.url!
      })
      const uploadedUrls = await Promise.all(uploadPromises)
      setImages((prev) => [...prev, ...uploadedUrls])
      toast.success(`${uploadedUrls.length} image(s) uploaded`)
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload images')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  const removeImage = async (index: number) => {
    const imageUrl = images[index]
    try {
      await deleteListingImage(imageUrl)
      setImages((prev) => prev.filter((_, i) => i !== index))
      toast.success('Image removed')
    } catch {
      toast.error('Failed to remove image')
    }
  }

  // ── validation ──────────────────────────────────────────────────────────────
  const step1Valid = !!selectedGame && !!selectedCategory &&
    (!selectedCategoryData?.metadata?.requires_region || !!selectedRegion) &&
    (!selectedCategoryData?.metadata?.requires_platform || !!selectedPlatform)

  const validateForm = (): string | null => {
    if (!selectedGame) return 'Please select a game'
    if (!selectedCategory) return 'Please select a category'
    if (selectedCategoryData?.metadata?.requires_region && !selectedRegion) return 'Please select a region'
    if (selectedCategoryData?.metadata?.requires_platform && !selectedPlatform) return 'Please select a platform'
    if (!title || title.trim().length < 5) return 'Title must be at least 5 characters'
    if (!price || parseFloat(price) <= 0) return 'Price must be greater than 0'
    if (images.length === 0) return 'At least one image is required'

    // Instant delivery validation
    if (deliveryMethod === 'instant') {
      const codes = instantDeliveryCodes.split('\n').filter(line => line.trim().length > 0)
      if (codes.length === 0) return 'Please add at least one code/credential for instant delivery'
      // Quantity is auto-set from codes, so no need to validate it separately
    } else {
      // Manual delivery validation
      if (!quantity || parseInt(quantity) < 1) return 'Total stock must be at least 1'
    }

    if (!minQuantity || parseInt(minQuantity) < 1) return 'Min order quantity must be at least 1'
    if (parseInt(minQuantity) > parseInt(quantity)) return 'Min order quantity cannot exceed total stock'
    if (template) {
      for (const field of template.fields) {
        if (field.required && !templateData[field.name]) return `${field.label} is required`
      }
    }
    return null
  }

  // ── submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (draft = false) => {
    const error = validateForm()
    if (error && !draft) {
      toast.error(error)
      return
    }
    setIsSubmitting(true)
    try {
      const input: CreateListingInput = {
        game_id: selectedGame,
        category_id: selectedCategory,
        title,
        description,
        price: parseFloat(price),
        original_price: originalPrice ? parseFloat(originalPrice) : undefined,
        quantity: parseInt(quantity),
        min_quantity: parseInt(minQuantity),
        delivery_method: deliveryMethod as 'instant' | 'manual',
        delivery_time: deliveryTime,
        delivery_method_type: deliveryMethodType,
        images,
        template_data: template ? templateData : undefined,
        region: selectedRegion || undefined,
        platform: selectedPlatform || undefined,
        status: draft ? 'draft' : 'active',
      }

      // Use updateListing if editing, createListing if creating new
      const result = isEditMode && editListingId
        ? await updateListing(editListingId, input)
        : await createListing(input)
      if (result.success) {
        // If instant delivery, add encrypted codes to inventory (only for new listings with codes)
        if (!isEditMode && deliveryMethod === 'instant' && instantDeliveryCodes.trim()) {
          const codes = instantDeliveryCodes.split('\n').map(c => c.trim()).filter(c => c.length > 0)

          if (codes.length > 0 && result.listing?.id) {
            const inventoryResult = await addInstantDeliveryInventory(
              result.listing.id,
              codes,
              instantDeliveryType
            )

            if (!inventoryResult.success) {
              toast.error(`Listing created but failed to add codes: ${inventoryResult.error}`)
              // Still navigate to listings page so they can add codes later
            } else if (inventoryResult.invalidCodes && inventoryResult.invalidCodes.length > 0) {
              toast.warning(`${inventoryResult.count} codes added, ${inventoryResult.invalidCodes.length} invalid codes skipped`)
            } else {
              toast.success(`Listing published with ${inventoryResult.count} codes!`)
            }
          }
        } else {
          if (result.listing?.requiresModeration) {
            toast.info('Listing submitted for moderation review')
          } else {
            const action = isEditMode ? 'updated' : (draft ? 'saved' : 'published')
            toast.success(`Listing ${action} successfully!`)
          }
        }

        queryClient.invalidateQueries({ queryKey: ['seller', 'listings'] })
        queryClient.invalidateQueries({ queryKey: ['seller', 'dashboard'] })
        router.push('/account/listings')
      } else {
        const action = isEditMode ? 'update' : 'create'
        toast.error(result.error || `Failed to ${action} listing`)
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create listing')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── derived ─────────────────────────────────────────────────────────────────
  const discountPercent =
    originalPrice && price
      ? Math.round(((parseFloat(originalPrice) - parseFloat(price)) / parseFloat(originalPrice)) * 100)
      : 0

  const tierInfo =
    sellerTierInfo[sellerProfile?.seller_tier as keyof typeof sellerTierInfo] ?? sellerTierInfo.unverified

  const youReceive = price ? (parseFloat(price) * 0.896).toFixed(2) : null

  const selectedGameName = games.find((g) => g.id === selectedGame)?.name
  const selectedCategoryName = categories.find((c) => c.id === selectedCategory)?.name

  // ── checklist items ─────────────────────────────────────────────────────────
  const checklistItems = [
    { label: 'Game selected', done: !!selectedGame },
    { label: 'Category selected', done: !!selectedCategory },
    {
      label: 'Region selected',
      done: !selectedCategoryData?.metadata?.requires_region || !!selectedRegion,
      hidden: !selectedCategoryData?.metadata?.requires_region,
    },
    {
      label: 'Platform selected',
      done: !selectedCategoryData?.metadata?.requires_platform || !!selectedPlatform,
      hidden: !selectedCategoryData?.metadata?.requires_platform,
    },
    { label: 'Title (5+ chars)', done: !!title && title.length >= 5 },
    { label: 'Price set', done: !!price && parseFloat(price) > 0 },
    { label: 'At least 1 image', done: images.length > 0 },
    {
      label: 'Template fields',
      done: !template || template.fields.every((f: TemplateField) => !f.required || templateData[f.name]),
      hidden: !template,
    },
    {
      label: 'Codes added',
      done: deliveryMethod !== 'instant' || (instantDeliveryCodes.trim().split('\n').filter(c => c.trim()).length > 0),
      hidden: deliveryMethod !== 'instant',
    },
  ].filter((item) => !item.hidden)

  const allDone = checklistItems.every((i) => i.done)

  // ── loading screen ──────────────────────────────────────────────────────────
  if (isRestricted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-4">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="h-16 w-16 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center">
            <ShieldAlert className="h-8 w-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Access Denied</h2>
          <p className="text-sm text-gray-400">
            Your seller account is restricted. You cannot create new listings at this time.
          </p>
          <p className="text-xs text-gray-500">Redirecting to account restrictions...</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border border-violet-500/30 bg-violet-500/10" />
            <Loader2 className="absolute inset-0 m-auto h-6 w-6 animate-spin text-violet-400" />
          </div>
          <p className="text-sm text-gray-500">Loading listing creator…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">

      <div className="mx-auto w-full max-w-5xl px-4 pb-12 pt-6">
        {/* ── header ── */}
        <div className="mb-8">
          <Link
            href="/account/listings"
            className="mb-5 inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Listings
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  {isEditMode ? 'Edit Listing' : 'Create Listing'}
                </h1>
                {sellerProfile && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
                      tierInfo.bg,
                      tierInfo.color
                    )}
                  >
                    {tierInfo.icon} {tierInfo.label}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                {isEditMode
                  ? 'Update your listing details and pricing'
                  : step === 1
                  ? 'Select a game and category to get started'
                  : 'Add details, images, and pricing for your listing'}
              </p>
            </div>

            {/* step indicator */}
            <StepIndicator current={step} />
          </div>

          {/* Moderation banner */}
          {moderationInfo?.needsModeration && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 rounded-xl border border-yellow-500/25 bg-yellow-500/8 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-yellow-500/30 bg-yellow-500/15">
                  <Shield className="h-4 w-4 text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="mb-0.5 text-sm font-semibold text-yellow-300">Pre-Moderation Required</h4>
                  <p className="text-xs text-yellow-300/70">
                    Your first {moderationInfo.requiredCount} listings need admin approval. You have{' '}
                    {moderationInfo.approvedCount} approved.
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-yellow-900/30">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-amber-400 transition-all duration-500"
                        style={{
                          width: `${Math.min((moderationInfo.approvedCount / moderationInfo.requiredCount) * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium text-yellow-400">
                      {moderationInfo.approvedCount}/{moderationInfo.requiredCount}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* ── step content ── */}
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.22 }}
            >
              {/* Step 1: Game & Category */}
              <div className="mx-auto max-w-3xl">
                {/* hero card */}
                <div className="mb-6 rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/8 via-purple-500/5 to-transparent p-6">
                  <div className="mb-1 flex items-center gap-2 text-violet-400">
                    <Gamepad2 className="h-5 w-5" />
                    <span className="text-sm font-semibold uppercase tracking-widest">Step 1 of 2</span>
                  </div>
                  <h2 className="mb-1 text-xl font-bold text-white">What are you selling?</h2>
                  <p className="text-sm text-gray-500">
                    Pick a game and the right category. This helps buyers find your listing instantly.
                  </p>
                </div>

                {/* game selector */}
                <div className="mb-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/15">
                      <Gamepad2 className="h-3.5 w-3.5 text-violet-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-white">
                      Select Game <span className="text-red-400">*</span>
                    </h3>
                  </div>
                  <GameSelector
                    games={games}
                    selectedGameId={selectedGame}
                    onSelectGame={setSelectedGame}
                  />
                </div>

                {/* category selector */}
                <AnimatePresence>
                  {selectedGame && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 12 }}
                      transition={{ duration: 0.2 }}
                      className="mb-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6"
                    >
                      <div className="mb-4 flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/15">
                          <Tag className="h-3.5 w-3.5 text-violet-400" />
                        </div>
                        <h3 className="text-sm font-semibold text-white">
                          Select Category <span className="text-red-400">*</span>
                        </h3>
                      </div>
                      <CategorySelector
                        categories={categories}
                        selectedCategoryId={selectedCategory}
                        onSelectCategory={setSelectedCategory}
                        disabled={false}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* region selector */}
                <AnimatePresence>
                  {selectedCategoryData?.metadata?.requires_region &&
                    selectedCategoryData.metadata.available_regions && (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 12 }}
                        transition={{ duration: 0.2 }}
                        className="mb-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6"
                      >
                        <div className="mb-4 flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/15">
                            <span className="text-xs">🌍</span>
                          </div>
                          <h3 className="text-sm font-semibold text-white">
                            Select Region <span className="text-red-400">*</span>
                          </h3>
                        </div>
                        <RegionSelector
                          regions={selectedCategoryData.metadata.available_regions}
                          selectedRegion={selectedRegion}
                          onSelectRegion={setSelectedRegion}
                        />
                      </motion.div>
                    )}
                </AnimatePresence>

                {/* platform selector */}
                <AnimatePresence>
                  {selectedCategoryData?.metadata?.requires_platform &&
                    selectedCategoryData.metadata.available_platforms && (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 12 }}
                        transition={{ duration: 0.2 }}
                        className="mb-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6"
                      >
                        <div className="mb-4 flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/15">
                            <span className="text-xs">🖥️</span>
                          </div>
                          <h3 className="text-sm font-semibold text-white">
                            Select Platform <span className="text-red-400">*</span>
                          </h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {selectedCategoryData.metadata.available_platforms.map((platform: string) => {
                            const icons: Record<string, string> = {
                              pc: '🖥️', playstation: '🎮', xbox: '🎮', mobile: '📱', 'nintendo switch': '🕹️',
                            }
                            const labels: Record<string, string> = {
                              pc: 'PC', playstation: 'PlayStation', xbox: 'Xbox', mobile: 'Mobile', 'nintendo switch': 'Switch',
                            }
                            const active = selectedPlatform === platform
                            return (
                              <button
                                key={platform}
                                onClick={() => setSelectedPlatform(platform)}
                                className={cn(
                                  'flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all',
                                  active
                                    ? 'border-violet-500/50 bg-violet-500/15 text-white'
                                    : 'border-white/10 bg-white/[0.03] text-gray-400 hover:border-white/20 hover:text-white'
                                )}
                              >
                                <span>{icons[platform.toLowerCase()] ?? '🎮'}</span>
                                {labels[platform.toLowerCase()] ?? platform}
                                {active && <Check className="h-3.5 w-3.5 text-violet-400" />}
                              </button>
                            )
                          })}
                        </div>
                      </motion.div>
                    )}
                </AnimatePresence>

                {/* template loading */}
                {loadingTemplate && (
                  <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                    Loading category template…
                  </div>
                )}

                {/* continue button */}
                <div className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4">
                  <div className="text-sm text-gray-500">
                    {step1Valid ? (
                      <span className="flex items-center gap-1.5 text-green-400">
                        <Check className="h-4 w-4" />
                        Ready to continue
                      </span>
                    ) : (
                      <span>Select game {selectedGame ? '✓' : '·'} and category {selectedCategory ? '✓' : '·'}</span>
                    )}
                  </div>
                  <button
                    onClick={() => setStep(2)}
                    disabled={!step1Valid}
                    className={cn(
                      'flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold transition-all',
                      step1Valid
                        ? 'bg-violet-500 text-white hover:bg-violet-400 active:scale-95 shadow-lg shadow-violet-500/20'
                        : 'bg-white/[0.04] text-gray-600 cursor-not-allowed'
                    )}
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.22 }}
            >
              {/* Step 2: Details */}
              <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
                {/* ── left column ── */}
                <div className="space-y-5">
                  {/* selection summary */}
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/8 px-4 py-3">
                    <button
                      onClick={() => setStep(1)}
                      className="flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Change
                    </button>
                    <div className="h-4 w-px bg-violet-500/30" />
                    {selectedGameName && (
                      <span className="rounded-lg bg-violet-500/15 px-2.5 py-1 text-xs font-medium text-violet-300">
                        🎮 {selectedGameName}
                      </span>
                    )}
                    {selectedCategoryName && (
                      <span className="rounded-lg bg-violet-500/15 px-2.5 py-1 text-xs font-medium text-violet-300">
                        <Tag className="inline h-3 w-3 mr-1" />
                        {selectedCategoryName}
                      </span>
                    )}
                    {selectedRegion && (
                      <span className="rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-gray-400">
                        🌍 {selectedRegion}
                      </span>
                    )}
                    {selectedPlatform && (
                      <span className="rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-gray-400">
                        🖥️ {selectedPlatform}
                      </span>
                    )}
                  </div>

                  {/* ── listing details ── */}
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
                    <div className="mb-5 flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/15">
                        <FileText className="h-3.5 w-3.5 text-violet-400" />
                      </div>
                      <h2 className="text-sm font-semibold text-white">Listing Details</h2>
                    </div>

                    {/* title */}
                    <div className="mb-4">
                      <label className="mb-1.5 block text-xs font-medium text-gray-400">
                        Title <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g., Valorant Radiant Account – 5000+ VP – All Agents Unlocked"
                        maxLength={100}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15 transition-all"
                      />
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className={cn('text-xs', title.length >= 5 ? 'text-green-500' : 'text-gray-600')}>
                          {title.length >= 5 ? '✓ Good length' : `${5 - title.length} more chars needed`}
                        </span>
                        <span className="text-xs text-gray-600">{title.length}/100</span>
                      </div>
                    </div>

                    {/* description */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-400">Description</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe your listing in detail — what's included, account level, features, etc."
                        rows={5}
                        maxLength={2000}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15 transition-all resize-none"
                      />
                      <div className="mt-1.5 text-right text-xs text-gray-600">{description.length}/2000</div>
                    </div>
                  </div>

                  {/* ── template fields ── */}
                  <AnimatePresence>
                    {template && template.fields.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 12 }}
                        className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/6 via-purple-500/4 to-transparent p-6"
                      >
                        <div className="mb-5 flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/20">
                            <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                          </div>
                          <div>
                            <h2 className="text-sm font-semibold text-white">{template.template_name}</h2>
                            <p className="text-xs text-gray-500">Game-specific fields</p>
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          {template.fields.map((field: TemplateField) => (
                            <div key={field.name} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
                              <label className="mb-1.5 block text-xs font-medium text-gray-400">
                                {field.label} {field.required && <span className="text-red-400">*</span>}
                              </label>

                              {field.type === 'text' && (
                                <input
                                  type="text"
                                  value={templateData[field.name] || ''}
                                  onChange={(e) => setTemplateData({ ...templateData, [field.name]: e.target.value })}
                                  placeholder={field.placeholder}
                                  maxLength={field.maxLength}
                                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15 transition-all"
                                />
                              )}

                              {field.type === 'number' && (
                                <input
                                  type="number"
                                  value={templateData[field.name] || ''}
                                  onChange={(e) => setTemplateData({ ...templateData, [field.name]: e.target.value })}
                                  onFocus={(e) => e.target.select()}
                                  placeholder={field.placeholder}
                                  min={field.min}
                                  max={field.max}
                                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15 transition-all"
                                />
                              )}

                              {field.type === 'textarea' && (
                                <textarea
                                  value={templateData[field.name] || ''}
                                  onChange={(e) => setTemplateData({ ...templateData, [field.name]: e.target.value })}
                                  placeholder={field.placeholder}
                                  maxLength={field.maxLength}
                                  rows={3}
                                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15 transition-all resize-none"
                                />
                              )}

                              {field.type === 'select' && (
                                <select
                                  value={templateData[field.name] || ''}
                                  onChange={(e) => setTemplateData({ ...templateData, [field.name]: e.target.value })}
                                  className="w-full rounded-xl border border-white/10 bg-gray-950 px-4 py-3 text-sm text-white focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15 transition-all"
                                >
                                  <option value="">Select…</option>
                                  {field.options?.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                              )}

                              {field.type === 'boolean' && (
                                <div className="flex items-center gap-3">
                                  <Toggle
                                    enabled={!!templateData[field.name]}
                                    onChange={() =>
                                      setTemplateData({ ...templateData, [field.name]: !templateData[field.name] })
                                    }
                                  />
                                  <span className="text-sm text-gray-400">
                                    {templateData[field.name] ? 'Yes' : 'No'}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ── images ── */}
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
                    <div className="mb-5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/15">
                          <ImageIcon className="h-3.5 w-3.5 text-violet-400" />
                        </div>
                        <h2 className="text-sm font-semibold text-white">
                          Images <span className="text-red-400">*</span>
                        </h2>
                      </div>
                      <span className="text-xs text-gray-500">{images.length}/5 uploaded</span>
                    </div>

                    {/* grid */}
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                      {images.map((image, index) => (
                        <div
                          key={index}
                          className="group relative aspect-square overflow-hidden rounded-xl border border-white/10"
                        >
                          <img src={image} alt={`Preview ${index + 1}`} className="h-full w-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100" />
                          <button
                            onClick={() => removeImage(index)}
                            className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 opacity-0 transition-all group-hover:opacity-100 active:scale-90"
                          >
                            <X className="h-3 w-3 text-white" />
                          </button>
                          {index === 0 && (
                            <div className="absolute bottom-1.5 left-1.5 rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-bold text-white">
                              Main
                            </div>
                          )}
                        </div>
                      ))}

                      {images.length < 5 && (
                        <label
                          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                          onDragLeave={() => setIsDragging(false)}
                          onDrop={handleDrop}
                          className={cn(
                            'group relative flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all',
                            isDragging
                              ? 'border-violet-500 bg-violet-500/10'
                              : 'border-white/15 bg-white/[0.02] hover:border-violet-500/50 hover:bg-violet-500/5'
                          )}
                        >
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleImageUpload}
                            className="hidden"
                            disabled={uploadingImage}
                          />
                          {uploadingImage ? (
                            <>
                              <Loader2 className="mb-1 h-6 w-6 animate-spin text-violet-400" />
                              <span className="text-[10px] text-gray-500">Uploading…</span>
                            </>
                          ) : (
                            <>
                              <Upload className="mb-1 h-6 w-6 text-gray-600 transition-colors group-hover:text-violet-400" />
                              <span className="text-[10px] text-gray-600 group-hover:text-gray-400">
                                {isDragging ? 'Drop here' : 'Upload'}
                              </span>
                            </>
                          )}
                        </label>
                      )}
                    </div>

                    <div className="mt-4 flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-gray-500">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-600" />
                      <span>First image is the main thumbnail. Use min 800×600px screenshots. Drag & drop supported.</span>
                    </div>
                  </div>

                  {/* ── pricing ── */}
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
                    <div className="mb-5 flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-green-500/30 bg-green-500/15">
                        <DollarSign className="h-3.5 w-3.5 text-green-400" />
                      </div>
                      <h2 className="text-sm font-semibold text-white">Pricing</h2>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-400">
                          Your Price (USD) <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">$</span>
                          <input
                            type="number"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            onFocus={(e) => e.target.select()}
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                            className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 pl-8 pr-4 text-sm text-white placeholder:text-gray-600 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15 transition-all"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-400">
                          Original Price{' '}
                          <span className="text-gray-600">(optional – shows discount)</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">$</span>
                          <input
                            type="number"
                            value={originalPrice}
                            onChange={(e) => setOriginalPrice(e.target.value)}
                            onFocus={(e) => e.target.select()}
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                            className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 pl-8 pr-4 text-sm text-white placeholder:text-gray-600 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15 transition-all"
                          />
                        </div>
                        {discountPercent > 0 && (
                          <p className="mt-1.5 text-xs text-green-400">{discountPercent}% discount badge will show</p>
                        )}
                      </div>
                    </div>

                    {/* fee breakdown */}
                    <AnimatePresence>
                      {price && parseFloat(price) > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4 overflow-hidden"
                        >
                          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                            <p className="mb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fee Breakdown</p>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between text-gray-400">
                                <span>Listing price</span>
                                <span className="text-white">${parseFloat(price).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-gray-500">
                                <span>Platform fee (6.9%)</span>
                                <span className="text-red-400/80">−${(parseFloat(price) * 0.069).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-gray-500">
                                <span>Payment processing (3.5%)</span>
                                <span className="text-red-400/80">−${(parseFloat(price) * 0.035).toFixed(2)}</span>
                              </div>
                              <div className="mt-2 flex justify-between border-t border-white/[0.06] pt-2">
                                <span className="font-semibold text-white">You receive</span>
                                <span className="font-bold text-green-400">${youReceive}</span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* ── inventory ── */}
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
                    <div className="mb-5 flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                        <Package className="h-3.5 w-3.5 text-gray-400" />
                      </div>
                      <h2 className="text-sm font-semibold text-white">Inventory</h2>
                    </div>

                    {/* Stock and Min Quantity - Side by side */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Total Stock */}
                      <div>
                        <label className="mb-2 block text-xs font-medium text-gray-400">
                          Total Stock
                          {deliveryMethod === 'instant' && (
                            <span className="ml-2 text-[10px] text-violet-400">(Auto-calculated)</span>
                          )}
                        </label>
                        <input
                          type="number"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          min="1"
                          disabled={deliveryMethod === 'instant'}
                          readOnly={deliveryMethod === 'instant'}
                          className={cn(
                            "w-full rounded-xl border px-4 py-3 text-sm transition-all",
                            deliveryMethod === 'instant'
                              ? 'border-violet-500/30 bg-violet-500/10 text-violet-300 cursor-not-allowed'
                              : 'border-white/10 bg-white/[0.04] text-white focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15'
                          )}
                          placeholder="e.g., 100"
                        />
                        <p className="mt-1.5 text-xs text-gray-500">
                          {deliveryMethod === 'instant'
                            ? '⚡ Stock equals number of codes entered below'
                            : 'How many units you have available'
                          }
                        </p>
                      </div>

                      {/* Min Quantity */}
                      <div>
                        <label className="mb-2 block text-xs font-medium text-gray-400">
                          Min. Order Qty
                        </label>
                        <input
                          type="number"
                          value={minQuantity}
                          onChange={(e) => setMinQuantity(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          min="1"
                          max={quantity}
                          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15 transition-all"
                          placeholder="e.g., 1"
                        />
                        <p className="mt-1.5 text-xs text-gray-500">
                          Minimum units per order
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ── delivery ── */}
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
                    <div className="mb-5 flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                        <Zap className="h-3.5 w-3.5 text-gray-400" />
                      </div>
                      <h2 className="text-sm font-semibold text-white">Delivery Method</h2>
                    </div>

                    {/* Category-aware notice for currency/items */}
                    {selectedCategoryData?.metadata?.type === 'currency' && (
                      <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/8 px-3 py-2.5">
                        <Clock className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-[11px] text-amber-400/80 leading-relaxed">
                          <span className="font-semibold">Manual delivery required</span> — in-game currency &amp; items must be transferred manually and cannot be instant.
                        </p>
                      </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                      {deliveryMethods.map((method) => {
                        const Icon = method.icon
                        const active = deliveryMethod === method.value
                        // Instant is disabled for currency/item categories
                        const isDisabled = method.value === 'instant' && selectedCategoryData?.metadata?.type === 'currency'
                        return (
                          <button
                            key={method.value}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => {
                              if (!isDisabled) {
                                setDeliveryMethod(method.value)
                                // Reset to manual if switching away from instant
                                if (method.value === 'manual' && deliveryTime === 'instant') setDeliveryTime('1hr')
                              }
                            }}
                            className={cn(
                              'relative rounded-xl border-2 p-4 text-left transition-all',
                              isDisabled && 'opacity-40 cursor-not-allowed',
                              !isDisabled && active ? method.bgActive : !isDisabled ? 'border-white/10 bg-white/[0.02] hover:border-white/20' : 'border-white/10 bg-white/[0.02]'
                            )}
                          >
                            <div className={cn('mb-2 flex h-8 w-8 items-center justify-center rounded-lg border', active ? 'border-current bg-current/10' : 'border-white/10 bg-white/[0.04]')}>
                              <Icon className={cn('h-4 w-4', active ? method.color : 'text-gray-500')} />
                            </div>
                            <p className="mb-0.5 text-sm font-semibold text-white">{method.label}</p>
                            <p className="text-xs text-gray-500">{method.description}</p>
                            {isDisabled && (
                              <p className="text-[10px] text-amber-500/70 mt-1">Not available for this category</p>
                            )}
                            {active && !isDisabled && (
                              <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-violet-500">
                                <Check className="h-3 w-3 text-white" />
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    <AnimatePresence>
                      {deliveryMethod === 'manual' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4 overflow-hidden"
                        >
                          <label className="mb-1.5 block text-xs font-medium text-gray-400">
                            Guaranteed Delivery Time
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {deliveryTimeOptions.map(opt => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setDeliveryTime(opt.value)}
                                className={cn(
                                  'rounded-xl border px-3 py-2.5 text-sm font-medium transition-all text-center',
                                  deliveryTime === opt.value
                                    ? 'border-violet-500/50 bg-violet-500/15 text-violet-300'
                                    : 'border-white/10 bg-white/[0.02] text-gray-400 hover:border-white/20 hover:text-white'
                                )}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                          <p className="mt-2 text-[10px] text-gray-600">
                            Buyers see this as your guaranteed delivery window. Your average delivery time is tracked and shown on your shop.
                          </p>

                          {/* Game-Specific Delivery Method Type */}
                          {selectedGame && (
                            <div className="mt-4">
                              <label className="mb-2 block text-xs font-medium text-gray-400">
                                Specific Delivery Method
                              </label>
                              <select
                                value={deliveryMethodType}
                                onChange={(e) => setDeliveryMethodType(e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15 transition-all"
                              >
                                {getDeliveryMethodsForGame(games.find(g => g.id === selectedGame)?.slug || 'default').map((method) => (
                                  <option key={method.value} value={method.value} className="bg-gray-900">
                                    {method.label}
                                  </option>
                                ))}
                              </select>
                              <p className="mt-1.5 text-xs text-gray-500">
                                How exactly will you deliver this to the buyer?
                              </p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* ── Instant Delivery Fields ── */}
                  <AnimatePresence>
                    {deliveryMethod === 'instant' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <InstantDeliveryFields
                          categoryType={selectedCategoryData?.metadata?.type as any}
                          codes={instantDeliveryCodes}
                          onCodesChange={setInstantDeliveryCodes}
                          deliveryType={instantDeliveryType}
                          onDeliveryTypeChange={setInstantDeliveryType}
                          disabled={isSubmitting}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ── right sidebar ── */}
                <div className="space-y-3 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)]">

                  {/* ── Checklist card ── */}
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
                    {/* Header with progress */}
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-3.5 w-3.5 text-gray-500" />
                        <h3 className="text-sm font-semibold text-white">Checklist</h3>
                      </div>
                      <span className="text-[10px] font-semibold text-gray-600">
                        {checklistItems.filter(i => i.done).length}/{checklistItems.length}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="mb-4 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          allDone ? 'bg-green-500' : 'bg-violet-500'
                        )}
                        style={{ width: `${(checklistItems.filter(i => i.done).length / checklistItems.length) * 100}%` }}
                      />
                    </div>

                    {/* Items */}
                    <div className="space-y-2">
                      {checklistItems.map((item, index) => (
                        <div key={index} className="flex items-center gap-2.5">
                          <div className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-all duration-200',
                            item.done ? 'bg-green-500' : 'border border-white/[0.12] bg-white/[0.03]'
                          )}>
                            {item.done && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                          </div>
                          <span className={cn('text-xs transition-colors', item.done ? 'text-gray-300' : 'text-gray-600')}>
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── Publish + Draft card ── */}
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">

                    {/* Ready banner */}
                    {allDone ? (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-4 flex items-center gap-2 rounded-xl border border-green-500/25 bg-green-500/8 px-3 py-2"
                      >
                        <div className="relative flex h-2 w-2 flex-shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
                        </div>
                        <span className="text-xs font-semibold text-green-400">Ready to publish!</span>
                      </motion.div>
                    ) : (
                      <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                        <div className="h-2 w-2 flex-shrink-0 rounded-full bg-gray-700" />
                        <span className="text-xs text-gray-600">
                          Complete {checklistItems.filter(i => !i.done).length} more item{checklistItems.filter(i => !i.done).length !== 1 ? 's' : ''} to publish
                        </span>
                      </div>
                    )}

                    {/* Publish button */}
                    <button
                      onClick={() => handleSubmit(false)}
                      disabled={isSubmitting || !allDone}
                      className={cn(
                        'relative mb-2.5 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold transition-all duration-200',
                        allDone && !isSubmitting
                          ? 'bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow-lg shadow-violet-500/30 hover:from-violet-500 hover:to-violet-400 hover:shadow-violet-500/40 active:scale-[0.98]'
                          : 'bg-white/[0.04] text-gray-600 cursor-not-allowed'
                      )}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {isEditMode ? 'Updating…' : 'Publishing…'}
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          {isEditMode ? 'Update Listing' : 'Publish Listing'}
                        </>
                      )}
                    </button>

                    {/* Save as Draft — subtle link style (hide in edit mode) */}
                    {!isEditMode && (
                      <button
                        onClick={() => handleSubmit(true)}
                        disabled={isSubmitting}
                        className="flex w-full items-center justify-center gap-1.5 py-2 text-xs font-medium text-gray-600 transition-colors hover:text-gray-400 disabled:opacity-40"
                      >
                        <Save className="h-3.5 w-3.5" />
                        Save as draft instead
                      </button>
                    )}

                    {moderationInfo?.needsModeration && (
                      <div className="mt-3 rounded-xl border border-yellow-500/20 bg-yellow-500/8 p-3">
                        <p className="text-xs font-medium text-yellow-400">⏳ Moderation Required</p>
                        <p className="mt-0.5 text-xs text-yellow-300/60">Listing will be reviewed before going live</p>
                      </div>
                    )}
                  </div>

                  {/* ── Pro tips ── */}
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-600">Pro Tips</p>
                    <div className="space-y-2.5 text-xs text-gray-500">
                      {[
                        'Use high-quality screenshots for better conversions',
                        'Detailed descriptions increase buyer confidence',
                        'Competitive pricing drives faster sales',
                        'Instant delivery listings rank higher',
                      ].map((tip, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-violet-500/40" />
                          {tip}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
