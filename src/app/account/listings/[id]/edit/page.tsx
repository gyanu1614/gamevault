'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  ArrowLeft,
  Upload,
  X,
  Plus,
  Minus,
  Eye,
  Save,
  Sparkles,
  AlertCircle,
  Check,
  Image as ImageIcon,
  DollarSign,
  Package,
  Zap,
  Clock,
  Info,
  Loader2,
  Shield,
  AlertTriangle,
  Star,
  ChevronRight,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  getListingTemplate,
  uploadListingImage,
  deleteListingImage,
  updateListing,
  getListingById,
  getSellerProfile,
  getGameCategories,
  getCategoryById,
  type ListingTemplate,
  type TemplateField,
  type CreateListingInput,
  type Category,
} from '@/lib/actions/listings'
import {
  addInstantDeliveryInventory,
  getListingInventory,
  deleteAvailableInventory,
  type DeliveryType,
} from '@/lib/actions/instant-delivery'
import InstantDeliveryFields from '@/components/listings/InstantDeliveryFields'

const deliveryMethods = [
  {
    value: 'instant',
    label: 'Instant Delivery',
    description: 'Delivered automatically within seconds',
    icon: Zap,
  },
  {
    value: 'manual',
    label: 'Manual Delivery',
    description: 'You deliver within your specified time',
    icon: Clock,
  },
]

const deliveryTimeOptions = [
  { value: '20min', label: '20 minutes' },
  { value: '1hr',   label: '1 hour' },
  { value: '3hr',   label: '3 hours' },
  { value: '6hr',   label: '6 hours' },
  { value: '12hr',  label: '12 hours' },
  { value: '24hr',  label: '1 day' },
]

const sellerTierInfo = {
  unverified: {
    label: 'Unverified',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20',
    icon: '🆕',
  },
  bronze: {
    label: 'Bronze Seller',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    icon: '🥉',
  },
  silver: {
    label: 'Silver Seller',
    color: 'text-gray-300',
    bgColor: 'bg-gray-400/20',
    icon: '🥈',
  },
  gold: {
    label: 'Gold Seller',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    icon: '🥇',
  },
  platinum: {
    label: 'Platinum Seller',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    icon: '💎',
  },
}

export default function EditListingPage() {
  const router = useRouter()
  const params = useParams()
  const listingId = params.id as string
  const supabase = createClient()

  // Data from database
  const [games, setGames] = useState<any[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategoryData, setSelectedCategoryData] = useState<Category | null>(null)
  const [loading, setLoading] = useState(true)

  // Seller info
  const [sellerProfile, setSellerProfile] = useState<any>(null)

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
  const [deliveryMethod, setDeliveryMethod] = useState('manual')
  const [deliveryTime, setDeliveryTime] = useState('1-24 hours')
  const [images, setImages] = useState<string[]>([])
  const [templateData, setTemplateData] = useState<Record<string, any>>({})
  const [instantDeliveryCodes, setInstantDeliveryCodes] = useState('')
  const [instantDeliveryType, setInstantDeliveryType] = useState<DeliveryType>('code')
  const [currentInventoryCount, setCurrentInventoryCount] = useState(0)

  // UI state
  const [uploadingImage, setUploadingImage] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [listingStatus, setListingStatus] = useState<string>('')

  // Auto-calculate stock from instant delivery codes
  useEffect(() => {
    if (deliveryMethod === 'instant' && instantDeliveryCodes) {
      const codes = instantDeliveryCodes.split('\n').filter(line => line.trim().length > 0)
      const totalStock = currentInventoryCount + codes.length
      setQuantity(totalStock.toString())
    }
  }, [deliveryMethod, instantDeliveryCodes, currentInventoryCount])

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [gamesRes, profileRes, listingRes] = await Promise.all([
          supabase.from('games').select('*').eq('is_active', true).order('name'),
          getSellerProfile(),
          getListingById(listingId),
        ])

        if (gamesRes.data) setGames(gamesRes.data)
        if (profileRes.success) setSellerProfile(profileRes.profile)

        if (listingRes.success && listingRes.listing) {
          const listing = listingRes.listing

          // Pre-fill form with existing data
          setSelectedGame(listing.game_id)
          setSelectedCategory(listing.category_id)
          setSelectedRegion(listing.region || '')
          setSelectedPlatform(listing.platform || '')
          setTitle(listing.title)
          setDescription(listing.description || '')
          setPrice(listing.price.toString())
          setOriginalPrice(listing.original_price ? listing.original_price.toString() : '')
          setQuantity(listing.quantity ? listing.quantity.toString() : '1')
          setListingStatus(listing.status || '')
          setDeliveryMethod(listing.delivery_method)
          setDeliveryTime(listing.delivery_time || '1-24 hours')
          setImages(listing.images || [])
          setTemplateData(listing.template_data || {})

          // Load instant delivery inventory if instant delivery
          if (listing.delivery_method === 'instant') {
            const inventoryRes = await getListingInventory(listingId)
            if (inventoryRes.success && inventoryRes.inventory) {
              const availableCount = inventoryRes.inventory.filter(i => i.status === 'available').length
              setCurrentInventoryCount(availableCount)
            }
          }
        } else {
          toast.error('Failed to load listing')
          router.push('/account/listings')
        }
      } catch (error) {
        console.error('Failed to fetch initial data:', error)
        toast.error('Failed to load data')
        router.push('/account/listings')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [listingId])

  // Load game-specific categories when game is set
  useEffect(() => {
    if (selectedGame && !loading) {
      loadGameCategories()
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
      console.error('Failed to load categories:', error)
      toast.error('Failed to load categories')
    }
  }

  // Load category metadata when category is set
  useEffect(() => {
    if (selectedCategory && !loading) {
      loadCategoryData()
    }
  }, [selectedCategory])

  const loadCategoryData = async () => {
    try {
      const result = await getCategoryById(selectedCategory)
      if (result.success && result.category) {
        setSelectedCategoryData(result.category)
        // Currency/item categories cannot use instant delivery — force manual
        if (result.category.metadata?.type === 'currency') {
          setDeliveryMethod('manual')
        }
      }
    } catch (error) {
      console.error('Failed to load category data:', error)
    }
  }

  // Load template when game+category is set
  useEffect(() => {
    if (selectedGame && selectedCategory && !loading) {
      loadTemplate()
    }
  }, [selectedGame, selectedCategory])

  const loadTemplate = async () => {
    setLoadingTemplate(true)
    try {
      const result = await getListingTemplate(selectedGame, selectedCategory)
      if (result.success) {
        setTemplate(result.template || null)
      } else {
        toast.error('Failed to load template')
      }
    } catch (error) {
      console.error('Failed to load template:', error)
    } finally {
      setLoadingTemplate(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    // Check total images limit
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
        if (!result.success) {
          throw new Error(result.error)
        }
        return result.url!
      })

      const uploadedUrls = await Promise.all(uploadPromises)
      setImages([...images, ...uploadedUrls])
      toast.success(`${uploadedUrls.length} image(s) uploaded successfully`)
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload images')
    } finally {
      setUploadingImage(false)
    }
  }

  const removeImage = async (index: number) => {
    const imageUrl = images[index]
    try {
      await deleteListingImage(imageUrl)
      setImages(images.filter((_, i) => i !== index))
      toast.success('Image removed')
    } catch (error) {
      toast.error('Failed to remove image')
    }
  }

  const validateForm = (): string | null => {
    if (!selectedGame) return 'Please select a game'
    if (!selectedCategory) return 'Please select a category'

    // Validate region if required
    if (selectedCategoryData?.metadata?.requires_region && !selectedRegion) {
      return 'Please select a region for this category'
    }

    // Validate platform if required
    if (selectedCategoryData?.metadata?.requires_platform && !selectedPlatform) {
      return 'Please select a platform for this category'
    }

    if (!title || title.trim().length < 10) return 'Title must be at least 10 characters'
    if (!price || parseFloat(price) <= 0) return 'Price must be greater than 0'
    if (images.length === 0) return 'At least one image is required'

    // Instant delivery validation
    if (deliveryMethod === 'instant') {
      const codes = instantDeliveryCodes.split('\n').filter(line => line.trim().length > 0)
      const totalStock = currentInventoryCount + codes.length
      if (totalStock === 0) return 'Please add at least one code for instant delivery'
    } else {
      if (!quantity || parseInt(quantity) < 1) {
        return 'Quantity must be at least 1'
      }
    }

    // Validate template fields
    if (template) {
      for (const field of template.fields) {
        if (field.required && !templateData[field.name]) {
          return `${field.label} is required`
        }
      }
    }

    return null
  }

  const handleSubmit = async () => {
    // Validation
    const error = validateForm()
    if (error) {
      toast.error(error)
      return
    }

    setIsSubmitting(true)

    try {
      // Auto-activate listing if stock is added
      const finalStatus = parseInt(quantity) > 0 && listingStatus === 'out_of_stock'
        ? 'active'
        : listingStatus

      const input: Partial<CreateListingInput> = {
        title,
        description,
        price: parseFloat(price),
        original_price: originalPrice ? parseFloat(originalPrice) : undefined,
        quantity: parseInt(quantity),
        delivery_method: deliveryMethod as 'instant' | 'manual',
        delivery_time: deliveryTime,
        images,
        template_data: template ? templateData : undefined,
        region: selectedRegion || undefined,
        platform: selectedPlatform || undefined,
        status: finalStatus,
      }

      const result = await updateListing(listingId, input)

      if (result.success) {
        // If instant delivery and new codes were added, save them to inventory
        if (deliveryMethod === 'instant' && instantDeliveryCodes.trim()) {
          const codes = instantDeliveryCodes.split('\n').map(c => c.trim()).filter(c => c.length > 0)

          if (codes.length > 0) {
            const inventoryResult = await addInstantDeliveryInventory(
              listingId,
              codes,
              instantDeliveryType
            )

            if (!inventoryResult.success) {
              toast.error(`Listing updated but failed to add codes: ${inventoryResult.error}`)
            } else if (inventoryResult.invalidCodes && inventoryResult.invalidCodes.length > 0) {
              toast.warning(`${inventoryResult.count} codes added, ${inventoryResult.invalidCodes.length} invalid codes skipped`)
            } else {
              toast.success(`Listing updated! ${inventoryResult.count} codes added to inventory.`)
            }
          }
        } else {
          toast.success('Listing updated successfully!')
        }

        setShowSuccess(true)
        setTimeout(() => {
          router.push('/account/listings')
        }, 2000)
      } else {
        toast.error(result.error || 'Failed to update listing')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update listing')
    } finally {
      setIsSubmitting(false)
    }
  }

  const discountPercent =
    originalPrice && price
      ? Math.round(
          ((parseFloat(originalPrice) - parseFloat(price)) / parseFloat(originalPrice)) * 100
        )
      : 0

  const tierInfo = sellerProfile?.seller_tier
    ? sellerTierInfo[sellerProfile.seller_tier as keyof typeof sellerTierInfo] ||
      sellerTierInfo.unverified
    : sellerTierInfo.unverified

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-gray-400">Loading listing...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Success Animation */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-500/20 to-green-600/20 p-8 text-center backdrop-blur-xl"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 }}
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500"
              >
                <Check className="h-8 w-8 text-white" />
              </motion.div>
              <h3 className="mb-2 text-2xl font-bold text-white">Listing Updated!</h3>
              <p className="text-gray-300">Redirecting to your listings...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto w-full max-w-5xl px-4 pb-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/account/listings"
            className="mb-4 inline-flex items-center gap-2 text-gray-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Listings
          </Link>

          {/* Sold-out restock banner */}
          {listingStatus === 'sold' && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3">
              <Package className="h-5 w-5 flex-shrink-0 text-orange-400" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-orange-300">This listing is sold out</div>
                <div className="text-xs text-orange-400/70">Update the quantity below and save to reactivate it.</div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white">Edit Listing</h1>
                {sellerProfile && (
                  <div
                    className={cn(
                      'flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold',
                      tierInfo.bgColor,
                      tierInfo.color
                    )}
                  >
                    <span>{tierInfo.icon}</span>
                    <span>{tierInfo.label}</span>
                  </div>
                )}
              </div>
              <p className="mt-1 text-gray-400">Update your listing details</p>
            </div>
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white transition-all hover:bg-white/10"
            >
              <Eye className="h-4 w-4" />
              {previewMode ? 'Edit' : 'Preview'}
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          {/* Main Form */}
          <div className="space-y-5">
            {/* Game & Category Info - Improved Design with Logo */}
            <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-purple-600/5 p-5 backdrop-blur-md">
              <div className="mb-4 flex items-center gap-2">
                <div className="rounded-lg bg-violet-500/20 p-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-violet-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-violet-200/90">
                    Game, category, region, and platform cannot be changed after creation
                  </p>
                </div>
              </div>

              {/* Improved Breadcrumb with Game Logo */}
              <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-black/30 p-4 backdrop-blur-xl">
                {/* Game Icon/Logo */}
                {games.find(g => g.id === selectedGame) && (
                  <div className="flex-shrink-0">
                    <img
                      src={`/games/${games.find(g => g.id === selectedGame)?.slug || 'default'}.png`}
                      alt={games.find(g => g.id === selectedGame)?.name || ''}
                      className="h-12 w-12 rounded-lg object-cover border border-white/20"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  </div>
                )}

                {/* Game & Category Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-lg font-bold text-white mb-1">
                    {games.find(g => g.id === selectedGame)?.name || 'Unknown Game'}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-400">
                    <span className="text-violet-300 font-medium">
                      {selectedCategoryData?.name || categories.find(c => c.id === selectedCategory)?.name || 'Unknown Category'}
                    </span>

                    {/* Region */}
                    {selectedRegion && selectedCategoryData?.metadata?.requires_region && (
                      <>
                        <span className="text-gray-600">•</span>
                        <span>
                          {selectedCategoryData.metadata.available_regions?.find(r => r.code === selectedRegion)?.name || selectedRegion}
                        </span>
                      </>
                    )}

                    {/* Platform */}
                    {selectedPlatform && selectedCategoryData?.metadata?.requires_platform && (
                      <>
                        <span className="text-gray-600">•</span>
                        <span>
                          {selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Listing Details */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-md">
              <h2 className="mb-4 text-sm font-semibold text-white">Listing Details</h2>

              {/* Title */}
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-medium text-gray-300">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Valorant Radiant Account - 5000+ VP - All Agents"
                  maxLength={100}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-gray-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <div className="mt-1 text-right text-xs text-gray-500">{title.length}/100 characters</div>
              </div>

              {/* Description */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-300">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your listing in detail. Include what's included, features, etc."
                  rows={6}
                  maxLength={2000}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-gray-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <div className="mt-1 text-right text-xs text-gray-500">
                  {description.length}/2000 characters
                </div>
              </div>
            </div>

            {/* Dynamic Template Fields */}
            {template && template.fields.length > 0 && (
              <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/[0.02] p-6 backdrop-blur-md">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-white">{template.template_name}</h2>
                </div>
                <p className="mb-6 text-xs text-gray-500">
                  Fill in game-specific details to make your listing more attractive
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  {template.fields.map((field: TemplateField) => (
                    <div key={field.name} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
                      <label className="mb-1.5 block text-xs font-medium text-gray-300">
                        {field.label} {field.required && <span className="text-red-400">*</span>}
                      </label>

                      {/* Text input */}
                      {field.type === 'text' && (
                        <input
                          type="text"
                          value={templateData[field.name] || ''}
                          onChange={(e) =>
                            setTemplateData({ ...templateData, [field.name]: e.target.value })
                          }
                          placeholder={field.placeholder}
                          maxLength={field.maxLength}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-gray-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      )}

                      {/* Number input */}
                      {field.type === 'number' && (
                        <input
                          type="number"
                          value={templateData[field.name] || ''}
                          onChange={(e) =>
                            setTemplateData({ ...templateData, [field.name]: e.target.value })
                          }
                          placeholder={field.placeholder}
                          min={field.min}
                          max={field.max}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-gray-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      )}

                      {/* Textarea */}
                      {field.type === 'textarea' && (
                        <textarea
                          value={templateData[field.name] || ''}
                          onChange={(e) =>
                            setTemplateData({ ...templateData, [field.name]: e.target.value })
                          }
                          placeholder={field.placeholder}
                          maxLength={field.maxLength}
                          rows={3}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-gray-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      )}

                      {/* Select dropdown */}
                      {field.type === 'select' && (
                        <select
                          value={templateData[field.name] || ''}
                          onChange={(e) =>
                            setTemplateData({ ...templateData, [field.name]: e.target.value })
                          }
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          <option value="">Select...</option>
                          {field.options?.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      )}

                      {/* Boolean toggle */}
                      {field.type === 'boolean' && (
                        <button
                          onClick={() =>
                            setTemplateData({
                              ...templateData,
                              [field.name]: !templateData[field.name],
                            })
                          }
                          className={cn(
                            'relative h-6 w-11 rounded-full transition-all',
                            templateData[field.name] ? 'bg-primary' : 'bg-gray-600'
                          )}
                        >
                          <div
                            className={cn(
                              'absolute top-1 h-4 w-4 rounded-full bg-white transition-all',
                              templateData[field.name] ? 'left-6' : 'left-1'
                            )}
                          />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pricing */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-md">
              <h2 className="mb-4 text-sm font-semibold text-white">Pricing</h2>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Price */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-300">
                    Price (USD) <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-white placeholder:text-gray-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                {/* Original Price (for discounts) */}
                <div>
                  <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-gray-300">
                    Original Price (Optional)
                    <div className="group relative">
                      <Info className="h-4 w-4 text-gray-400" />
                      <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 rounded-lg border border-white/10 bg-black/95 p-2 text-xs text-white shadow-xl backdrop-blur-xl group-hover:block">
                        Show discount badge
                      </div>
                    </div>
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input
                      type="number"
                      value={originalPrice}
                      onChange={(e) => setOriginalPrice(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-white placeholder:text-gray-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  {discountPercent > 0 && (
                    <div className="mt-2 text-xs text-green-400">
                      {discountPercent}% discount will be shown
                    </div>
                  )}
                </div>
              </div>

              {/* Fee Breakdown */}
              {price && (
                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-2 text-xs font-medium text-gray-500">Fee Breakdown</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-gray-400">
                      <span>Listing Price</span>
                      <span className="font-medium text-white">${parseFloat(price).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Platform Fee (6.9%)</span>
                      <span className="text-red-400">-${(parseFloat(price) * 0.069).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Payment Processing (3.5%)</span>
                      <span className="text-red-400">-${(parseFloat(price) * 0.035).toFixed(2)}</span>
                    </div>
                    <div className="border-t border-white/10 pt-2">
                      <div className="flex justify-between font-bold">
                        <span className="text-white">You'll Receive</span>
                        <span className="text-green-400">${(parseFloat(price) * 0.896).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Inventory */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-md">
              <h2 className="mb-4 text-sm font-semibold text-white">Inventory</h2>

              {/* Instant Delivery Stock Display */}
              {deliveryMethod === 'instant' && (
                <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">Total Stock</span>
                    <span className="text-2xl font-bold text-violet-400">{quantity}</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Stock is automatically calculated from codes in inventory. Add more codes below to increase stock.
                  </p>
                </div>
              )}

              {/* Manual Delivery Quantity Input */}
              {deliveryMethod === 'manual' && (
                <div>
                  <div className="mb-1.5 flex items-center gap-2">
                    <label className="text-xs font-medium text-gray-300">Quantity Available</label>
                    {listingStatus === 'sold' && (
                      <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-400">
                        Set to restock
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQuantity(Math.max(1, parseInt(quantity) - 1).toString())}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition-all hover:bg-white/10"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      min="1"
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-center text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      onClick={() => setQuantity((parseInt(quantity) + 1).toString())}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition-all hover:bg-white/10"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Delivery */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-md">
              <h2 className="mb-4 text-sm font-semibold text-white">Delivery</h2>

              {/* Delivery Method */}
              <div className="mb-4">
                <label className="mb-3 block text-xs font-medium text-gray-300">Delivery Method</label>

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
                    const isDisabled = method.value === 'instant' && selectedCategoryData?.metadata?.type === 'currency'
                    return (
                      <button
                        key={method.value}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => { if (!isDisabled) setDeliveryMethod(method.value) }}
                        className={cn(
                          'relative rounded-xl border-2 p-4 text-left transition-all',
                          isDisabled && 'opacity-40 cursor-not-allowed',
                          !isDisabled && active ? 'border-violet-500/50 bg-violet-500/15' : !isDisabled ? 'border-white/10 bg-white/[0.02] hover:border-white/20' : 'border-white/10 bg-white/[0.02]'
                        )}
                      >
                        <div className={cn('mb-2 flex h-8 w-8 items-center justify-center rounded-lg border', active ? 'border-violet-500/40 bg-violet-500/10' : 'border-white/10 bg-white/[0.04]')}>
                          <Icon className={cn('h-4 w-4', active ? 'text-violet-400' : 'text-gray-500')} />
                        </div>
                        <div className="mb-1 text-sm font-semibold text-white">{method.label}</div>
                        <div className="text-xs text-gray-500">{method.description}</div>
                        {isDisabled && <p className="text-[10px] text-amber-500/70 mt-1">Not available for this category</p>}
                        {active && !isDisabled && (
                          <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-violet-500">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Delivery Time */}
              {deliveryMethod === 'manual' && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-300">
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
                </div>
              )}

              {/* Instant Delivery Fields */}
              {deliveryMethod === 'instant' && (
                <div className="mt-4">
                  <div className="mb-3 rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
                    <p className="text-xs text-blue-300">
                      <span className="font-semibold">Current Stock:</span> {currentInventoryCount} code{currentInventoryCount !== 1 ? 's' : ''} in inventory.
                      Add more codes below to increase your stock.
                    </p>
                  </div>
                  <InstantDeliveryFields
                    categoryType={selectedCategoryData?.metadata?.type as any}
                    codes={instantDeliveryCodes}
                    onCodesChange={setInstantDeliveryCodes}
                    deliveryType={instantDeliveryType}
                    onDeliveryTypeChange={setInstantDeliveryType}
                    disabled={isSubmitting}
                  />
                </div>
              )}
            </div>

            {/* Images */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-md">
              <h2 className="mb-4 text-sm font-semibold text-white">
                Images (Max 5) <span className="text-red-400">*</span>
              </h2>

              {/* Image Grid */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {images.map((image, index) => (
                  <div key={index} className="group relative aspect-square overflow-hidden rounded-xl border border-white/10">
                    <img src={image} alt={`Preview ${index + 1}`} className="h-full w-full object-cover" />
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute right-2 top-2 rounded-full bg-red-500 p-1 opacity-0 transition-all group-hover:opacity-100"
                    >
                      <X className="h-4 w-4 text-white" />
                    </button>
                    {index === 0 && (
                      <div className="absolute bottom-2 left-2 rounded-full bg-primary px-2 py-1 text-xs font-bold text-white">
                        Main
                      </div>
                    )}
                  </div>
                ))}

                {/* Upload Button */}
                {images.length < 5 && (
                  <label className="group relative flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/20 bg-white/5 transition-all hover:border-primary hover:bg-white/10">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={uploadingImage}
                    />
                    {uploadingImage ? (
                      <>
                        <Loader2 className="mb-2 h-8 w-8 animate-spin text-primary" />
                        <span className="text-xs text-gray-400">Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="mb-2 h-8 w-8 text-gray-400 group-hover:text-primary" />
                        <span className="text-xs text-gray-400">Upload</span>
                      </>
                    )}
                  </label>
                )}
              </div>

              <div className="mt-4 flex items-start gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-400">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-medium">Image Tips</div>
                  <ul className="mt-1 list-inside list-disc text-xs text-blue-300">
                    <li>First image will be the main thumbnail</li>
                    <li>Use high-quality images (min 800x600px)</li>
                    <li>Show actual screenshots or product photos</li>
                    <li>Images are uploaded to secure Supabase Storage</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Actions */}
            <div className="sticky top-6 space-y-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-md">
              <h3 className="text-sm font-semibold text-white">Update Listing</h3>

              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-6 py-3 font-semibold text-white transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                style={{
                  boxShadow: '0 0 25px rgba(6,182,212,0.3), 0 0 50px rgba(147,51,234,0.2)',
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5" />
                    Update Listing
                  </>
                )}
              </button>

              {/* Checklist */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-medium text-white">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Checklist
                </div>
                <div className="space-y-2 text-sm">
                  {[
                    { label: 'Title added', done: !!title && title.length >= 10 },
                    { label: 'Price set', done: !!price && parseFloat(price) > 0 },
                    { label: 'At least 1 image', done: images.length > 0 },
                    {
                      label: 'Template fields filled',
                      done: !template || template.fields.every((f: TemplateField) => !f.required || templateData[f.name]),
                    },
                  ].map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      {item.done ? (
                        <Check className="h-4 w-4 text-green-400" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-gray-600" />
                      )}
                      <span className={item.done ? 'text-gray-300' : 'text-gray-500'}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
