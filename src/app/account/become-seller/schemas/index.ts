/**
 * Seller Registration Validation Schemas
 *
 * All Zod schemas for the 6-step seller registration process.
 * Every field marked with a star in the UI is enforced here.
 */

import * as z from 'zod'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { OTHER_COUNTRY } from '../data/countries'

/**
 * A document that has ACTUALLY been uploaded to storage — `path` only exists
 * after the immediate upload succeeds, so requiring it enforces the upload,
 * not just a local file pick.
 */
export const uploadedDocSchema = z.object({
  path: z.string().min(1),
  name: z.string(),
  size: z.number(),
  type: z.string(),
})

export type UploadedDoc = z.infer<typeof uploadedDocSchema>

/**
 * Per-game category selection captured in Step 1 (Account & Games). For each
 * game the seller picks, they choose which category sections they'll sell in
 * (Items / Accounts / Currency / Top-Up / Boosting) — derived from that game's
 * real categories. Stored into the new `games_categories` JSONB column.
 */
export const gameCategorySelectionSchema = z.object({
  gameId: z.string().min(1),
  gameSlug: z.string().min(1),
  categorySlugs: z.array(z.string()),
})

export type GameCategorySelection = z.infer<typeof gameCategorySelectionSchema>

// Step 1: Account & Games Schema
export const step1Schema = z
  .object({
    is18OrOlder: z.boolean().refine((val) => val === true, {
      message: 'You must be 18 or older to become a seller',
    }),
    sellerType: z.enum(['individual', 'business'], {
      required_error: 'Please select a seller type',
    }),
    /** Real game UUIDs from the games table. */
    primaryGames: z.array(z.string()),
    /**
     * Per-game category selection, parallel to primaryGames. Each entry maps a
     * selected game to the category sections the seller will trade in. Optional
     * per game — a seller can pick a game without narrowing categories yet.
     */
    gamesCategories: z.array(gameCategorySelectionSchema).optional().default([]),
    /** Free-text games not in the catalog ("Other"). */
    otherGames: z.string().max(200, 'Keep it under 200 characters').optional(),
    expectedVolume: z.enum(['under_500', '500_2000', '2000_10000', 'over_10000'], {
      required_error: 'Please select your expected monthly volume',
    }),
    referralCode: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.primaryGames.length === 0 && !data.otherGames?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['primaryGames'],
        message: 'Select at least one game or enter one under Other',
      })
    }
  })

export type Step1FormData = z.infer<typeof step1Schema>

// Step 2: Identity & Contact Schema
export const step2Schema = z
  .object({
    fullLegalName: z.string().min(2, 'Full legal name is required'),
    displayName: z.string().min(3, 'Display name must be at least 3 characters'),
    shopName: z
      .string()
      .min(3, 'Shop name must be at least 3 characters')
      .max(50, 'Shop name must not exceed 50 characters'),
    /** Full country name from the dataset, or the OTHER sentinel. */
    country: z.string().min(1, 'Country is required'),
    countryOther: z.string().optional(),
    stateProvince: z.string().optional(),
    /**
     * ZIP / postal code. No dedicated legacy column exists, so the Personal Info
     * screen folds this into `stateProvince` (the persisted `state_province`
     * column) on submit — this key stays optional and UI-side only, and never
     * changes the submitSellerApplication payload contract.
     */
    zipPostal: z.string().max(20, 'Postal code is too long').optional(),
    city: z.string().min(2, 'City is required'),
    /** E.164 phone number emitted by the phone input. */
    phoneNumber: z
      .string()
      .min(1, 'Phone number is required')
      .refine((val) => parsePhoneNumberFromString(val)?.isValid() === true, {
        message: 'Enter a valid phone number for the selected country code',
      }),
    alternateEmail: z.string().email('Invalid email').optional().or(z.literal('')),

    // Business-specific fields (conditionally required)
    companyLegalName: z.string().optional(),
    businessRegistrationNumber: z.string().optional(),
    taxIdVat: z.string().optional(),
    companyAddress: z.string().optional(),
    businessType: z
      .enum(['llc', 'corporation', 'sole_proprietorship', 'partnership', 'other'])
      .optional(),
    yearEstablished: z.string().optional(),
    businessEmail: z.string().email('Invalid email').optional().or(z.literal('')),
    businessPhone: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.country === OTHER_COUNTRY && !data.countryOther?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['countryOther'],
        message: 'Please enter your country',
      })
    }
  })

export type Step2FormData = z.infer<typeof step2Schema>

// Step 3: Identity Verification Schema — required docs must have a storage
// path, which only exists after the immediate upload completed successfully.
export const step3Schema = z.object({
  idDocument: uploadedDocSchema.nullish().refine((d) => !!d?.path, {
    message: 'Government ID upload is required',
  }),
  selfieWithId: uploadedDocSchema.nullish().refine((d) => !!d?.path, {
    message: 'Selfie with ID upload is required',
  }),
  proofOfAddress: uploadedDocSchema.nullish().refine((d) => !!d?.path, {
    message: 'Proof of address upload is required',
  }),
  // Business documents (optional)
  certificateOfIncorporation: uploadedDocSchema.nullish(),
  businessLicense: uploadedDocSchema.nullish(),
  directorId: uploadedDocSchema.nullish(),
  bankStatement: uploadedDocSchema.nullish(),
})

export type Step3FormData = z.infer<typeof step3Schema>

// Step 4: Seller Profile Setup Schema
export const step4Schema = z.object({
  /** Store Image — uploaded immediately to the profile-pictures bucket. */
  storeImage: uploadedDocSchema.nullish(),
  bio: z.string().max(500, 'Bio must be 500 characters or less').optional(),
  businessHours: z.string().optional(),
  timezone: z.string().optional(),
  languagesSpoken: z.array(z.string()).optional(),
  discordUsername: z.string().optional(),
  twitterHandle: z.string().optional(),
  twitchChannel: z.string().optional(),
  youtubeChannel: z.string().optional(),
  refundPolicy: z.string().optional(),
  deliveryTimeframe: z.string().optional(),
  termsOfService: z.string().optional(),
})

export type Step4FormData = z.infer<typeof step4Schema>

// Step 5: Payout Schema — rails match the real payout system (see @/lib/fees)
export const step5Schema = z
  .object({
    payoutMethod: z.enum(['bank_transfer', 'crypto'], {
      required_error: 'Please select a payout method',
    }),
    // Bank transfer fields
    accountHolderName: z.string().optional(),
    bankName: z.string().optional(),
    accountNumber: z.string().optional(),
    routingCode: z.string().optional(),
    swiftCode: z.string().optional(),
    iban: z.string().optional(),
    // Crypto
    cryptoWalletAddress: z.string().optional(),
    cryptoType: z.enum(['BTC', 'ETH', 'USDT']).optional(),
    // Tax information
    taxResidencyCountry: z.string().min(2, 'Tax residency country is required'),
    taxForm: z.enum(['w9', 'w8ben', 'none']).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.payoutMethod === 'bank_transfer') {
      if (!data.accountHolderName?.trim())
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['accountHolderName'], message: 'Account holder name is required' })
      if (!data.bankName?.trim())
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['bankName'], message: 'Bank name is required' })
      if (!data.accountNumber?.trim() && !data.iban?.trim())
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['accountNumber'], message: 'Enter an account number or IBAN' })
    }
    if (data.payoutMethod === 'crypto') {
      if (!data.cryptoType)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cryptoType'], message: 'Select a cryptocurrency' })
      if (!data.cryptoWalletAddress?.trim())
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cryptoWalletAddress'], message: 'Wallet address is required' })
    }
  })

export type Step5FormData = z.infer<typeof step5Schema>

// Step 6: Agreements & Submission Schema
export const step6Schema = z.object({
  acceptedSellerAgreement: z.boolean().refine((val) => val === true, {
    message: 'You must accept the Seller Agency Agreement',
  }),
  acceptedPrivacyPolicy: z.boolean().refine((val) => val === true, {
    message: 'You must accept the Privacy Policy',
  }),
  acceptedAntiFraudPolicy: z.boolean().refine((val) => val === true, {
    message: 'You must accept the Anti-Fraud Policy',
  }),
  acceptedFeeSchedule: z.boolean().refine((val) => val === true, {
    message: 'You must accept the Fee Schedule',
  }),
  acceptedDataProcessing: z.boolean().refine((val) => val === true, {
    message: 'You must accept the Data Processing Agreement',
  }),
  informationAccurate: z.boolean().refine((val) => val === true, {
    message: 'You must confirm that all information is accurate',
  }),
  understandConsequences: z.boolean().refine((val) => val === true, {
    message: 'You must understand the consequences of providing false information',
  }),
})

export type Step6FormData = z.infer<typeof step6Schema>

/**
 * Payout currency preference (optional) — offered on the Payout Setup step and
 * stored into the new `payout_currency` column. Kept as a plain enum so the
 * adapter can pass it straight through.
 */
export const PAYOUT_CURRENCIES = ['USD', 'EUR', 'GBP', 'USDT'] as const
export type PayoutCurrency = (typeof PAYOUT_CURRENCIES)[number]

// ── Redesign: Review & Sign step slice ────────────────────────────────────────
//
// The "Forest Ledger" redesign collapses the old 5-checkbox agreements step
// into ONE consolidated consent + an e-signature. This slice is the source of
// truth for that step; the adapter fans `consolidatedConsent` out to the six
// legacy accepted_* booleans the server action still writes.

/** Optional "have you sold elsewhere?" block on Review & Sign. */
export const sellingExperienceSchema = z.object({
  /**
   * REQUIRED free text: prior selling experience — marketplaces they've sold
   * on, store links, or a short summary. A few lines minimum so review has
   * something real to work with.
   */
  sellingExperience: z
    .string()
    .trim()
    .min(1, 'Tell us about your selling experience')
    .min(60, 'A few lines, please — marketplaces, store links, or a short summary')
    .max(600, 'Keep it under 600 characters'),
})

export type SellingExperience = z.infer<typeof sellingExperienceSchema>

export const reviewSignSchema = z
  .object({
    ...sellingExperienceSchema.shape,
    /**
     * The single consolidated consent that replaces the old five checkboxes:
     * Terms of Service + Privacy Policy + Fee Schedule (+ data processing +
     * anti-fraud + accuracy — all one consent now). MUST be true.
     */
    consolidatedConsent: z.literal(true, {
      errorMap: () => ({
        message: 'You must agree to the Terms of Service, Privacy Policy & Fee Schedule',
      }),
    }),
    /**
     * Seller Agency Agreement e-signature. When DocuSeal isn't configured the
     * fallback is a typed-name click-accept — this holds the typed name and the
     * moment it was recorded. Required before submit.
     */
    signatureName: z.string().min(2, 'Type your full legal name to sign'),
    signedAt: z.string().min(1, 'Signature timestamp is required'),
    /** Optional, separate, unchecked-by-default marketing consent. */
    marketingConsent: z.boolean().optional().default(false),
  })


export type ReviewSignFormData = z.infer<typeof reviewSignSchema>
