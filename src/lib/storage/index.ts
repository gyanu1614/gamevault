/**
 * Supabase Storage - Main Export
 *
 * Centralized exports for all storage utilities
 */

// Listing Images (public bucket)
export {
  uploadListingImage,
  uploadListingImages,
  deleteListingImage,
  deleteListingImages,
  deleteAllListingImages,
  getListingImageUrl,
  getListingImageUrls,
  extractFilePathFromUrl,
  replaceListingImages,
  validateImageFile as validateListingImage,
  checkBucketAccess as checkListingImagesBucketAccess
} from './listing-images'

export type {
  UploadImageResult,
  DeleteImageResult,
  ValidationResult as ImageValidationResult
} from './listing-images'

// Delivery Evidence (private bucket)
export {
  uploadDeliveryEvidence,
  uploadDeliveryEvidences,
  deleteDeliveryEvidence,
  deleteDeliveryEvidences,
  deleteAllOrderEvidence,
  getDeliveryEvidenceSignedUrl,
  getDeliveryEvidenceSignedUrls,
  listOrderEvidence,
  hasDeliveryEvidence,
  getOrderEvidenceSize,
  validateEvidenceFile,
  checkBucketAccess as checkDeliveryEvidenceBucketAccess
} from './delivery-evidence'

export type {
  UploadEvidenceResult,
  DeleteEvidenceResult,
  ValidationResult as EvidenceValidationResult,
  SignedUrlResult
} from './delivery-evidence'
