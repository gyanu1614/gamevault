'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { SellerApplication } from '@/lib/actions/admin-sellers'
import { rejectApplication } from '@/lib/actions/admin-sellers'
// approve comes from the CANONICAL review module — it promotes the profile
// (role/shop_name/shop_slug/badges) FIRST, then flips the application status,
// sends the approval email + notification. The admin-sellers.ts copy only
// flipped the application row, leaving the seller without access.
import { approveApplication } from '@/lib/actions/admin-seller-review'
import { getDocumentsSignedUrls } from '@/lib/actions/kyc-documents'
import { calculateVerificationStatus } from '@/lib/utils/seller-verification'
import { restrictSeller, unrestrictSeller } from '@/lib/actions/admin-seller-restrictions'
import { getAvatarUrl } from '@/lib/utils/avatar'
import { VOLUME_LABELS, PAYOUT_METHOD_LABELS, SELLER_TYPE_LABELS } from '@/lib/seller-application/labels'
import { toast } from 'sonner'
import {
  CheckCircle,
  XCircle,
  Clock,
  User,
  Building,
  Mail,
  Calendar,
  FileText,
  Download,
  ExternalLink,
  Shield,
  MapPin,
  Briefcase,
  Receipt,
  AlertCircle,
  Loader2,
  ChevronDown,
  Phone,
  Globe,
  Gamepad2,
  Hash,
  Twitter,
  MessageCircle,
  Youtube,
  Video,
  Ban,
  ShieldAlert,
  ShieldCheck,
  History,
  X
} from 'lucide-react'

interface ApplicationDetailProps {
  application: SellerApplication
}

// Collapsible Section Component
function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
  badge
}: {
  title: string
  icon: any
  defaultOpen?: boolean
  children: React.ReactNode
  badge?: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="bg-bg-raised border border-border-default rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-bg-raised-hover transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-bg-overlay border border-border-subtle flex items-center justify-center">
            <Icon className="h-4.5 w-4.5 text-lime-text" />
          </div>
          <h3 className="text-base font-semibold text-text-primary">{title}</h3>
          {badge}
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-5 w-5 text-text-secondary" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-6 pb-6 pt-2">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Info Field Component
function InfoField({ label, value, icon: Icon }: { label: string; value: string | React.ReactNode; icon?: any }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide">{label}</p>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-text-secondary flex-shrink-0" />}
        <p className="text-sm text-text-primary font-medium">{value || 'Not provided'}</p>
      </div>
    </div>
  )
}

export default function ApplicationDetail({ application }: ApplicationDetailProps) {
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRestrictModal, setShowRestrictModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectionCategory, setRejectionCategory] = useState('other')
  const [adminNotes, setAdminNotes] = useState('')
  const [restrictionReason, setRestrictionReason] = useState('')
  const [restrictionType, setRestrictionType] = useState<'restricted' | 'banned'>('restricted')
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({})
  const [loadingUrls, setLoadingUrls] = useState(true)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [restrictionHistory, setRestrictionHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Fetch signed URLs for all documents
  useEffect(() => {
    const fetchDocumentUrls = async () => {
      if (application.documents && application.documents.length > 0) {
        const filePaths = application.documents.map(doc => doc.file_path)
        const { urls } = await getDocumentsSignedUrls(filePaths)
        setDocumentUrls(urls)
      }
      setLoadingUrls(false)
    }

    fetchDocumentUrls()
  }, [application.documents])

  const handleApprove = async () => {
    setIsProcessing(true)
    const result = await approveApplication(application.id, adminNotes)

    if (result.success) {
      setShowApproveModal(false)
      toast.success('Application approved successfully')
      // Show success state briefly before redirecting
      setTimeout(() => {
        router.push('/admin/sellers?status=approved')
        router.refresh()
      }, 500)
    } else {
      toast.error(result.error || 'Failed to approve application')
      setIsProcessing(false)
      setShowApproveModal(false)
    }
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }

    if (!rejectionCategory.trim()) {
      toast.error('Please select a rejection category')
      return
    }

    setIsProcessing(true)
    const result = await rejectApplication(application.id, rejectionReason, rejectionCategory, adminNotes)

    if (result.success) {
      setShowRejectModal(false)
      toast.success('Application rejected successfully')
      // Show success state briefly before redirecting
      setTimeout(() => {
        router.push('/admin/sellers?status=rejected')
        router.refresh()
      }, 500)
    } else {
      toast.error(result.error || 'Failed to reject application')
      setIsProcessing(false)
      setShowRejectModal(false)
    }
  }

  const handleRestrictSeller = async () => {
    if (!restrictionReason.trim()) {
      toast.error('Please provide a reason for restriction')
      return
    }

    setIsProcessing(true)
    const result = await restrictSeller({
      userId: application.user_id,
      status: restrictionType,
      reason: restrictionReason
    })

    if (result.success) {
      setShowRestrictModal(false)
      setRestrictionReason('')
      toast.success(`Seller has been ${restrictionType === 'banned' ? 'banned' : 'restricted'} successfully`)
      router.refresh()
    } else {
      toast.error(result.error || 'Failed to restrict seller')
    }
    setIsProcessing(false)
  }

  const handleUnrestrictSeller = async () => {
    setIsProcessing(true)
    const result = await unrestrictSeller(application.user_id)

    if (result.success) {
      toast.success('Seller restriction has been removed')
      router.refresh()
    } else {
      toast.error(result.error || 'Failed to remove restriction')
    }
    setIsProcessing(false)
  }

  const handleViewHistory = async () => {
    setLoadingHistory(true)
    setShowHistoryModal(true)

    try {
      // Import createClient here to avoid SSR issues
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      const { data, error } = await supabase
        .from('seller_restrictions')
        .select('*, admin:restricted_by(username, email)')
        .eq('seller_id', application.user_id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setRestrictionHistory(data || [])
    } catch (error) {
      console.error('Error fetching restriction history:', error)
      toast.error('Failed to load restriction history')
    } finally {
      setLoadingHistory(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            <Clock className="h-3.5 w-3.5" />
            Pending Review
          </div>
        )
      case 'approved':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-500/10 text-green-400 border border-green-500/20">
            <CheckCircle className="h-3.5 w-3.5" />
            Approved
          </div>
        )
      case 'rejected':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            <XCircle className="h-3.5 w-3.5" />
            Rejected
          </div>
        )
      default:
        return null
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
        {/* Main Content */}
        <div className="space-y-4">
          {/* Merged Profile Card */}
          <div className="bg-bg-raised border border-border-default rounded-xl p-6">
            {/* Header — submitted store image + store name lead */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <img
                  src={getAvatarUrl(
                    application.store_image_url,
                    application.display_name || application.user.username || application.user.email
                  )}
                  alt={application.display_name || 'Store'}
                  className="h-16 w-16 rounded-xl object-cover border border-border-default bg-bg-overlay"
                />
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl font-bold text-text-primary">{application.display_name}</h1>
                    {getStatusBadge(application.status)}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
                    <span className="capitalize">
                      {SELLER_TYPE_LABELS[application.seller_type ?? ''] ?? application.seller_type ?? 'Seller'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      {application.user.email}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" />
                      {application.phone_number}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5" />
                      {application.country}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-text-tertiary mb-1">Application ID</p>
                <p className="text-xs font-mono text-text-secondary">{application.id.split('-')[0]}</p>
              </div>
            </div>

            {/* Games */}
            <div className="pt-4 border-t border-border-default">
              <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2.5">Primary Games</p>
              <div className="flex flex-wrap gap-2">
                {(application.game_names || application.primary_games || []).map((game: string, idx: number) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-overlay border border-border-default text-text-secondary text-sm font-medium"
                  >
                    <Gamepad2 className="h-3.5 w-3.5" />
                    {game}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Collapsible Sections */}
          <CollapsibleSection title="Applicant Information" icon={User} defaultOpen={true}>
            {/* Personal identity lives here — the page header leads with the store. */}
            <div className="mb-4 flex items-center gap-3">
              <img
                src={getAvatarUrl(application.user.avatar_url, application.user.username || application.user.email)}
                alt={application.user.full_name || application.user.username || 'Profile'}
                className="h-10 w-10 rounded-full object-cover border border-border-default bg-bg-overlay"
              />
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  {application.user.full_name || application.user.username || 'Unknown User'}
                </p>
                <p className="text-xs text-text-tertiary">{application.user.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InfoField label="Full Name" value={application.user.full_name || 'Not provided'} />
              <InfoField label="Username" value={application.user.username || 'Not set'} />
              <InfoField label="Legal Name" value={application.full_legal_name} />
              <InfoField label="Seller Type" value={SELLER_TYPE_LABELS[application.seller_type ?? ''] ?? application.seller_type ?? 'Not specified'} />
              <InfoField label="Alternate Email" value={application.alternate_email || 'Not provided'} icon={Mail} />
              <InfoField
                label="Account Created"
                value={new Date(application.user.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
                icon={Calendar}
              />
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Location Details" icon={MapPin}>
            <div className="grid grid-cols-2 gap-4">
              <InfoField label="Country" value={application.country} icon={Globe} />
              {application.state_province && (
                <InfoField label="State/Province" value={application.state_province} />
              )}
              {application.city && (
                <InfoField label="City" value={application.city} />
              )}
            </div>
          </CollapsibleSection>

          {application.seller_type === 'business' && (
            <CollapsibleSection title="Business Information" icon={Briefcase}>
              <div className="grid grid-cols-2 gap-4">
                {application.company_legal_name && (
                  <InfoField label="Company Legal Name" value={application.company_legal_name} />
                )}
                {application.business_registration_number && (
                  <InfoField label="Registration Number" value={application.business_registration_number} icon={Hash} />
                )}
                {application.tax_id_vat && (
                  <InfoField label="Tax ID / VAT" value={application.tax_id_vat} />
                )}
                {application.business_type && (
                  <InfoField label="Business Type" value={application.business_type} />
                )}
                {application.year_established && (
                  <InfoField label="Year Established" value={application.year_established.toString()} />
                )}
                {application.business_email && (
                  <InfoField label="Business Email" value={application.business_email} icon={Mail} />
                )}
                {application.business_phone && (
                  <InfoField label="Business Phone" value={application.business_phone} icon={Phone} />
                )}
              </div>
              {application.company_address && (
                <div className="mt-4 pt-4 border-t border-border-subtle">
                  <InfoField label="Company Address" value={application.company_address} icon={MapPin} />
                </div>
              )}
            </CollapsibleSection>
          )}

          <CollapsibleSection title="Profile & Policies" icon={FileText}>
            <div className="space-y-4">
              {application.profile_bio && (
                <div>
                  <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2">Bio</p>
                  <p className="text-sm text-text-secondary leading-relaxed">{application.profile_bio}</p>
                </div>
              )}

              {application.languages_spoken.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2.5">Languages</p>
                  <div className="flex flex-wrap gap-2">
                    {application.languages_spoken.map((lang, idx) => (
                      <span key={idx} className="px-3 py-1 rounded-lg bg-bg-overlay-2 border border-border-subtle text-text-secondary text-sm">
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {application.business_hours && (
                  <InfoField label="Business Hours" value={application.business_hours} icon={Clock} />
                )}
                {application.timezone && (
                  <InfoField label="Timezone" value={application.timezone} icon={Globe} />
                )}
              </div>

              {application.expected_monthly_volume && (
                <div className="pt-4 border-t border-border-subtle">
                  <InfoField label="Expected Monthly Volume" value={VOLUME_LABELS[application.expected_monthly_volume] ?? application.expected_monthly_volume} icon={Receipt} />
                </div>
              )}

              {(application.refund_policy || application.delivery_timeframe || application.terms_of_service) && (
                <div className="pt-4 border-t border-border-subtle space-y-4">
                  {application.refund_policy && (
                    <div>
                      <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2">Refund Policy</p>
                      <p className="text-sm text-text-secondary leading-relaxed">{application.refund_policy}</p>
                    </div>
                  )}
                  {application.delivery_timeframe && (
                    <div>
                      <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2">Delivery Timeframe</p>
                      <p className="text-sm text-text-secondary">{application.delivery_timeframe}</p>
                    </div>
                  )}
                  {application.terms_of_service && (
                    <div>
                      <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2">Terms of Service</p>
                      <p className="text-sm text-text-secondary leading-relaxed">{application.terms_of_service}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CollapsibleSection>

          {(application.discord_username || application.twitter_handle || application.twitch_channel || application.youtube_channel) && (
            <CollapsibleSection title="Social Profiles" icon={MessageCircle}>
              <div className="grid grid-cols-2 gap-4">
                {application.discord_username && (
                  <InfoField label="Discord" value={application.discord_username} icon={MessageCircle} />
                )}
                {application.twitter_handle && (
                  <InfoField label="Twitter" value={application.twitter_handle} icon={Twitter} />
                )}
                {application.twitch_channel && (
                  <InfoField label="Twitch" value={application.twitch_channel} icon={Video} />
                )}
                {application.youtube_channel && (
                  <InfoField label="YouTube" value={application.youtube_channel} icon={Youtube} />
                )}
              </div>
            </CollapsibleSection>
          )}

          <CollapsibleSection title="Payment Information" icon={Receipt}>
            <div className="grid grid-cols-2 gap-4">
              {application.payout_method && (
                <InfoField label="Payout Method" value={PAYOUT_METHOD_LABELS[application.payout_method] ?? application.payout_method} />
              )}
              {application.bank_account_holder_name && (
                <InfoField label="Account Holder" value={application.bank_account_holder_name} />
              )}
              {application.bank_name && (
                <InfoField label="Bank Name" value={application.bank_name} />
              )}
              {application.bank_iban && (
                <InfoField label="IBAN" value={application.bank_iban} />
              )}
              {application.tax_residency_country && (
                <InfoField label="Tax Residency" value={application.tax_residency_country} icon={Globe} />
              )}
            </div>
            {application.crypto_wallet_address && (
              <div className="mt-4 pt-4 border-t border-border-subtle">
                <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2">
                  Crypto Wallet{application.crypto_type ? ` (${application.crypto_type})` : ''}
                </p>
                <p className="text-xs font-mono text-text-secondary break-all bg-bg-overlay px-3 py-2 rounded-lg border border-border-subtle">
                  {application.crypto_wallet_address}
                </p>
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            title="Verification Documents"
            icon={Shield}
            defaultOpen={true}
            badge={
              <span className="text-xs px-2 py-1 rounded-md bg-lime-tint-bg text-lime-text border border-lime-tint-border">
                {application.documents.length} files
              </span>
            }
          >
            {application.documents.length > 0 ? (
              <div className="grid grid-cols-1 gap-3">
                {application.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="bg-bg-overlay border border-border-subtle rounded-xl p-4 hover:bg-bg-overlay-2 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={cn(
                          "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0",
                          doc.verified
                            ? "bg-green-500/20 border border-green-500/30"
                            : "bg-yellow-500/20 border border-yellow-500/30"
                        )}>
                          <FileText className={cn(
                            "h-5 w-5",
                            doc.verified ? "text-green-400" : "text-yellow-400"
                          )} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-text-primary capitalize">
                              {doc.document_type.replace(/_/g, ' ')}
                            </p>
                            {doc.verified && (
                              <CheckCircle className="h-4 w-4 text-green-400" />
                            )}
                          </div>
                          <p className="text-xs text-text-tertiary mb-2">
                            Uploaded {new Date(doc.uploaded_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </p>
                          <p className="text-xs text-text-secondary font-mono truncate">{doc.file_name}</p>
                        </div>
                      </div>

                      <div className="flex gap-2 flex-shrink-0">
                        {loadingUrls ? (
                          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-overlay-2 text-sm text-text-tertiary">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          </div>
                        ) : documentUrls[doc.file_path] ? (
                          <>
                            <a
                              href={documentUrls[doc.file_path]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-overlay-2 hover:bg-[#2B2B37] text-sm text-text-secondary transition-colors"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              View
                            </a>
                            <a
                              href={documentUrls[doc.file_path]}
                              download={doc.file_name}
                              className="inline-flex items-center justify-center p-2 rounded-lg bg-bg-overlay-2 hover:bg-[#2B2B37] text-text-secondary transition-colors"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          </>
                        ) : (
                          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-sm text-red-400">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Unavailable
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <FileText className="h-12 w-12 text-text-disabled mx-auto mb-3" />
                <p className="text-sm text-text-secondary">No documents uploaded yet</p>
              </div>
            )}
          </CollapsibleSection>

          {/* Verification Status */}
          <div className="bg-bg-raised border border-border-default rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">Verification Status</h3>
              {(() => {
                const status = calculateVerificationStatus(application.documents, {
                  identity_verified: application.identity_verified,
                  address_verified: application.address_verified,
                  business_verified: application.business_verified,
                  tax_verified: application.tax_verified
                })
                return (
                  <span className={cn(
                    "text-sm font-bold",
                    status.percentage === 100 ? "text-green-400" : status.percentage >= 50 ? "text-yellow-400" : "text-red-400"
                  )}>
                    {status.verified}/{status.total} Complete
                  </span>
                )
              })()}
            </div>

            <div className="space-y-3">
              {[
                { label: 'Identity', verified: application.identity_verified || calculateVerificationStatus(application.documents).identity_verified },
                { label: 'Address', verified: application.address_verified || calculateVerificationStatus(application.documents).address_verified },
                { label: 'Business', verified: application.business_verified || calculateVerificationStatus(application.documents).business_verified },
                { label: 'Tax Documents', verified: application.tax_verified || calculateVerificationStatus(application.documents).tax_verified }
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-2">
                  <span className="text-sm text-text-secondary">{item.label}</span>
                  <div className="flex items-center gap-2">
                    {item.verified ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-400" />
                        <span className="text-xs text-green-400 font-medium">Verified</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-text-disabled" />
                        <span className="text-xs text-text-tertiary font-medium">Pending</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Admin Notes & Rejection Reason */}
          {(application.admin_notes || application.rejection_reason) && (
            <div className="space-y-3">
              {application.admin_notes && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-blue-400" />
                    <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Admin Notes</p>
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed">{application.admin_notes}</p>
                </div>
              )}

              {application.rejection_reason && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="h-4 w-4 text-red-400" />
                    <p className="text-xs font-semibold text-red-400 uppercase tracking-wide">Rejection Reason</p>
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed">{application.rejection_reason}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky Sidebar */}
        <div className="space-y-4">
          <div className="sticky top-20 md:top-24 space-y-4">
            {/* Status Card */}
            <div className="bg-bg-raised border border-border-default rounded-xl p-5">
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">Status</h3>
              <div className="flex justify-center mb-4">
                {getStatusBadge(application.status)}
              </div>

              {application.reviewed_at && (
                <div className="text-center">
                  <p className="text-xs text-text-tertiary mb-1">Reviewed on</p>
                  <p className="text-sm text-text-secondary font-medium">
                    {new Date(application.reviewed_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              )}

              {!application.reviewed_at && (
                <div className="text-center">
                  <p className="text-xs text-text-tertiary mb-1">Submitted</p>
                  <p className="text-sm text-text-secondary font-medium">
                    {new Date(application.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            {application.status === 'pending' && (
              <div className="bg-bg-raised border border-border-default rounded-xl p-5">
                <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">Actions</h3>

                {/* Admin Notes Input */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
                    Admin Notes (Optional)
                  </label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="w-full px-2.5 py-2 bg-bg-base border border-border-default rounded-lg text-xs text-text-primary placeholder:text-text-tertiary focus:border-lime focus:outline-none resize-none transition-colors"
                    rows={2}
                    placeholder="Add internal notes..."
                  />
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => setShowApproveModal(true)}
                    disabled={isProcessing}
                    className={cn(
                      "w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                      "bg-lime-pressed text-text-inverse font-bold",
                      "hover:bg-lime",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "flex items-center justify-center gap-1.5"
                    )}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle className="h-3.5 w-3.5" />
                    )}
                    Approve
                  </button>

                  <button
                    onClick={() => setShowRejectModal(true)}
                    disabled={isProcessing}
                    className={cn(
                      "w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                      "bg-red-500/10 text-red-400 border border-red-500/20",
                      "hover:bg-red-500/20 hover:border-red-500/30",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "flex items-center justify-center gap-1.5"
                    )}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Reject
                  </button>
                </div>
              </div>
            )}

            {/* Seller Restriction Actions - For Approved Sellers */}
            {application.status === 'approved' && (
              <div className="bg-bg-raised border border-border-default rounded-xl p-5">
                <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">Seller Management</h3>

                {/* Show current restriction status */}
                {application.user.seller_status && application.user.seller_status !== 'active' && (
                  <div className={cn(
                    "mb-3 p-3 rounded-lg border",
                    application.user.seller_status === 'banned'
                      ? "bg-red-500/10 border-red-500/20"
                      : "bg-yellow-500/10 border-yellow-500/20"
                  )}>
                    <div className="flex items-center gap-2 mb-2">
                      {application.user.seller_status === 'banned' ? (
                        <Ban className="h-4 w-4 text-red-400" />
                      ) : (
                        <ShieldAlert className="h-4 w-4 text-yellow-400" />
                      )}
                      <p className={cn(
                        "text-sm font-semibold",
                        application.user.seller_status === 'banned' ? "text-red-400" : "text-yellow-400"
                      )}>
                        Currently {application.user.seller_status === 'banned' ? 'Banned' : 'Restricted'}
                      </p>
                    </div>
                    {application.user.seller_restriction_reason && (
                      <p className="text-xs text-text-secondary mb-2">
                        Reason: {application.user.seller_restriction_reason}
                      </p>
                    )}
                    {application.user.seller_restricted_at && (
                      <p className="text-xs text-text-tertiary">
                        Since: {new Date(application.user.seller_restricted_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  {/* Show Remove Restriction button if seller is restricted or banned */}
                  {application.user.seller_status && application.user.seller_status !== 'active' ? (
                    <button
                      onClick={handleUnrestrictSeller}
                      disabled={isProcessing}
                      className={cn(
                        "w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                        "bg-lime-pressed text-text-inverse font-bold",
                        "hover:bg-lime",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        "flex items-center justify-center gap-1.5"
                      )}
                    >
                      {isProcessing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      )}
                      Remove Restriction
                    </button>
                  ) : (
                    <>
                      {/* Show Restrict/Ban buttons if seller is active */}
                      <button
                        onClick={() => {
                          setRestrictionType('restricted')
                          setShowRestrictModal(true)
                        }}
                        disabled={isProcessing}
                        className={cn(
                          "w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                          "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
                          "hover:bg-yellow-500/20 hover:border-yellow-500/30",
                          "disabled:opacity-50 disabled:cursor-not-allowed",
                          "flex items-center justify-center gap-1.5"
                        )}
                      >
                        <ShieldAlert className="h-3.5 w-3.5" />
                        Restrict
                      </button>

                      <button
                        onClick={() => {
                          setRestrictionType('banned')
                          setShowRestrictModal(true)
                        }}
                        disabled={isProcessing}
                        className={cn(
                          "w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                          "bg-red-500/10 text-red-400 border border-red-500/20",
                          "hover:bg-red-500/20 hover:border-red-500/30",
                          "disabled:opacity-50 disabled:cursor-not-allowed",
                          "flex items-center justify-center gap-1.5"
                        )}
                      >
                        <Ban className="h-3.5 w-3.5" />
                        Ban
                      </button>
                    </>
                  )}

                  {/* View History Button - Always shown if seller application is approved */}
                  {application.status === 'approved' && (
                    <button
                      onClick={handleViewHistory}
                      className={cn(
                        "w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 mt-2",
                        "bg-bg-overlay text-text-secondary border border-border-default",
                        "hover:bg-bg-overlay-2 hover:border-border-strong",
                        "flex items-center justify-center gap-1.5"
                      )}
                    >
                      <History className="h-3.5 w-3.5" />
                      View Restriction History
                    </button>
                  )}
                </div>

                <div className="mt-3 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-[11px] text-blue-400 leading-relaxed">
                    <strong>Restrict:</strong> Prevents new listings
                    <br />
                    <strong>Ban:</strong> Full restriction
                  </p>
                </div>
              </div>
            )}

            {/* Rejected Application - Allow Re-approval */}
            {application.status === 'rejected' && (
              <div className="bg-bg-raised border border-border-default rounded-xl p-5">
                <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">Re-evaluate</h3>

                {/* Show rejection reason */}
                {application.rejection_reason && (
                  <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-[11px] font-medium text-red-400 mb-1">Rejection Reason:</p>
                    <p className="text-[11px] text-text-secondary">{application.rejection_reason}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <button
                    onClick={() => setShowApproveModal(true)}
                    disabled={isProcessing}
                    className={cn(
                      "w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                      "bg-lime-pressed text-text-inverse font-bold",
                      "hover:bg-lime",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "flex items-center justify-center gap-1.5"
                    )}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle className="h-3.5 w-3.5" />
                    )}
                    Approve
                  </button>
                </div>

                <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <p className="text-[11px] text-amber-400 leading-relaxed">
                    Approving grants full seller access
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Approval Modal */}
      <AnimatePresence>
        {showApproveModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60"
              onClick={() => !isProcessing && setShowApproveModal(false)}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", duration: 0.3, bounce: 0.3 }}
              className="relative w-full max-w-md bg-bg-raised border border-border-default rounded-xl p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="mx-auto w-14 h-14 rounded-xl bg-green-500/10 border border-green-500/25 flex items-center justify-center mb-4">
                  <CheckCircle className="h-7 w-7 text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-text-primary mb-2">Approve Application?</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  This will grant <span className="text-text-primary font-medium">{application.display_name}</span> access to the seller dashboard and allow them to start listing products.
                </p>
              </div>

              <div className="flex gap-2.5">
                <button
                  onClick={() => setShowApproveModal(false)}
                  disabled={isProcessing}
                  className="flex-1 px-3 py-2 rounded-lg border border-border-default text-text-secondary hover:bg-bg-overlay transition-colors disabled:opacity-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApprove}
                  disabled={isProcessing}
                  className={cn(
                    "flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                    "bg-lime-pressed text-text-inverse font-bold",
                    "hover:bg-lime",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "flex items-center justify-center gap-1.5"
                  )}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-3.5 w-3.5" />
                      Approve
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rejection Modal */}
      <AnimatePresence>
        {showRejectModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60"
              onClick={() => setShowRejectModal(false)}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", duration: 0.3, bounce: 0.3 }}
              className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-bg-raised border border-border-default rounded-xl p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="mx-auto w-14 h-14 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center mb-4">
                  <XCircle className="h-7 w-7 text-red-400" />
                </div>
                <h3 className="text-xl font-bold text-text-primary mb-2">Reject Application</h3>
                <p className="text-sm text-text-secondary">
                  Please provide a clear reason for rejecting this application.
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
                  Rejection Category *
                </label>
                <select
                  value={rejectionCategory}
                  onChange={(e) => setRejectionCategory(e.target.value)}
                  className="w-full px-3 py-2.5 bg-bg-base border border-border-default rounded-lg text-sm text-text-primary focus:border-lime focus:outline-none"
                  required
                >
                  <option value="incomplete_documentation">Incomplete Documentation</option>
                  <option value="invalid_documents">Invalid or Expired Documents</option>
                  <option value="information_mismatch">Information Mismatch</option>
                  <option value="suspicious_activity">Suspicious Activity</option>
                  <option value="business_verification_failed">Business Verification Failed</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="mb-6">
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
                  Rejection Reason *
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2.5 bg-bg-base border border-border-default rounded-lg text-sm text-text-primary placeholder:text-text-tertiary focus:border-lime focus:outline-none resize-none"
                  rows={4}
                  placeholder="Enter detailed reason for rejection..."
                  required
                />
              </div>

              <div className="flex gap-2.5">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="flex-1 px-3 py-2 rounded-lg border border-border-default text-text-secondary hover:bg-bg-overlay transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowRejectModal(false)
                    handleReject()
                  }}
                  disabled={!rejectionReason.trim()}
                  className={cn(
                    "flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                    "bg-red-500 text-text-primary hover:bg-red-600",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "flex items-center justify-center gap-1.5"
                  )}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Restriction Modal */}
      <AnimatePresence>
        {showRestrictModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60"
              onClick={() => {
                setShowRestrictModal(false)
                setRestrictionReason('')
              }}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", duration: 0.3, bounce: 0.3 }}
              className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-bg-raised border border-border-default rounded-xl p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className={cn(
                  "mx-auto w-14 h-14 rounded-xl border flex items-center justify-center mb-4",
                  restrictionType === 'banned'
                    ? "bg-red-500/10 border-red-500/25"
                    : "bg-yellow-500/10 border-yellow-500/25"
                )}>
                  {restrictionType === 'banned' ? (
                    <Ban className="h-7 w-7 text-red-400" />
                  ) : (
                    <ShieldAlert className="h-7 w-7 text-yellow-400" />
                  )}
                </div>
                <h3 className="text-xl font-bold text-text-primary mb-2">
                  {restrictionType === 'banned' ? 'Ban Seller' : 'Restrict Seller'}
                </h3>
                <p className="text-sm text-text-secondary">
                  {restrictionType === 'banned'
                    ? 'This will completely ban the seller from accessing seller features.'
                    : 'This will prevent the seller from creating new listings or making existing listings live.'}
                </p>
              </div>

              <div className="mb-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <p className="text-xs text-orange-400">
                  When {restrictionType === 'banned' ? 'banned' : 'restricted'}, the seller will see an error message when attempting to upload or publish listings:
                </p>
                <p className="text-xs text-text-primary mt-2 font-mono bg-black/40 p-2 rounded">
                  &quot;Your seller account is {restrictionType === 'banned' ? 'banned' : 'under review'}. Please contact support at test@gmail.com&quot;
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
                  Restriction Reason *
                </label>
                <textarea
                  value={restrictionReason}
                  onChange={(e) => setRestrictionReason(e.target.value)}
                  className="w-full px-3 py-2.5 bg-bg-base border border-border-default rounded-lg text-sm text-text-primary placeholder:text-text-tertiary focus:border-lime focus:outline-none resize-none"
                  rows={4}
                  placeholder="Enter detailed reason for restriction..."
                  required
                />
              </div>

              <div className="flex gap-2.5">
                <button
                  onClick={() => {
                    setShowRestrictModal(false)
                    setRestrictionReason('')
                  }}
                  disabled={isProcessing}
                  className="flex-1 px-3 py-2 rounded-lg border border-border-default text-text-secondary hover:bg-bg-overlay transition-colors text-sm font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRestrictSeller}
                  disabled={!restrictionReason.trim() || isProcessing}
                  className={cn(
                    "flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                    restrictionType === 'banned'
                      ? "bg-red-500 hover:bg-red-600"
                      : "bg-yellow-500 hover:bg-yellow-600",
                    "text-text-primary",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "flex items-center justify-center gap-1.5"
                  )}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      {restrictionType === 'banned' ? (
                        <Ban className="h-3.5 w-3.5" />
                      ) : (
                        <ShieldAlert className="h-3.5 w-3.5" />
                      )}
                      Confirm
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Restriction History Modal */}
      <AnimatePresence>
        {showHistoryModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistoryModal(false)}
              className="absolute inset-0 bg-black/60"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg bg-bg-raised border border-border-default rounded-xl shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border-subtle">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-lime-text" />
                  <h3 className="text-base font-semibold text-text-primary">Restriction History</h3>
                </div>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="p-1.5 hover:bg-bg-overlay rounded-lg transition-colors"
                >
                  <X className="h-4 w-4 text-text-secondary" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 max-h-[60vh] overflow-y-auto">
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-lime-text" />
                  </div>
                ) : restrictionHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-text-secondary">No restriction history found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {restrictionHistory.map((restriction: any) => (
                      <div
                        key={restriction.id}
                        className="bg-bg-overlay rounded-lg p-3 border border-border-subtle"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {restriction.restriction_type === 'restricted' && (
                              <ShieldAlert className="h-3.5 w-3.5 text-yellow-400" />
                            )}
                            {restriction.restriction_type === 'banned' && (
                              <Ban className="h-3.5 w-3.5 text-red-400" />
                            )}
                            {restriction.restriction_type === 'unrestricted' && (
                              <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                            )}
                            <span className="text-sm font-medium text-text-primary capitalize">
                              {restriction.restriction_type}
                            </span>
                          </div>
                          <span className="text-xs text-text-tertiary">
                            {new Date(restriction.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>

                        {restriction.reason && (
                          <p className="text-xs text-text-secondary mb-2">{restriction.reason}</p>
                        )}

                        {restriction.admin && (
                          <p className="text-xs text-text-tertiary">
                            By: {restriction.admin.username || restriction.admin.email}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
