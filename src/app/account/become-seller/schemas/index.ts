/**
 * Seller Registration Validation Schemas
 *
 * All Zod schemas for the 6-step seller registration process
 */

import * as z from 'zod'

// Step 1: Eligibility & Intent Schema
export const step1Schema = z.object({
  is18OrOlder: z.boolean().refine((val) => val === true, {
    message: 'You must be 18 or older to become a seller',
  }),
  sellerType: z.enum(['individual', 'business'], {
    required_error: 'Please select a seller type',
  }),
  primaryGames: z.array(z.string()).min(1, 'Select at least one game'),
  expectedVolume: z.enum(['under_500', '500_2000', '2000_10000', 'over_10000'], {
    required_error: 'Please select your expected monthly volume',
  }),
  referralCode: z.string().optional(),
})

export type Step1FormData = z.infer<typeof step1Schema>

// Step 2: Business Information Schema
export const step2Schema = z.object({
  fullLegalName: z.string().min(2, 'Full legal name is required'),
  displayName: z.string().min(3, 'Display name must be at least 3 characters'),
  shopName: z.string().min(3, 'Shop name must be at least 3 characters').max(50, 'Shop name must not exceed 50 characters'),
  country: z.string().min(2, 'Country is required'),
  stateProvince: z.string().optional(),
  city: z.string().min(2, 'City is required'),
  phoneNumber: z.string().min(10, 'Valid phone number is required'),
  alternateEmail: z.string().email('Invalid email').optional().or(z.literal('')),

  // Business-specific fields (conditionally required)
  companyLegalName: z.string().optional(),
  businessRegistrationNumber: z.string().optional(),
  taxIdVat: z.string().optional(),
  companyAddress: z.string().optional(),
  businessType: z.enum(['llc', 'corporation', 'sole_proprietorship', 'partnership', 'other']).optional(),
  yearEstablished: z.string().optional(),
  businessEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  businessPhone: z.string().optional(),
})

export type Step2FormData = z.infer<typeof step2Schema>

// Step 3: Identity Verification Schema
export const step3Schema = z.object({
  idDocument: z.any().optional(),
  selfieWithId: z.any().optional(),
  proofOfAddress: z.any().optional(),
  // Business documents
  certificateOfIncorporation: z.any().optional(),
  businessLicense: z.any().optional(),
  directorId: z.any().optional(),
  bankStatement: z.any().optional(),
})

export type Step3FormData = z.infer<typeof step3Schema>

// Step 4: Seller Profile Setup Schema
export const step4Schema = z.object({
  profilePicture: z.any().optional(),
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

// Step 5: Payment & Banking Schema
export const step5Schema = z.object({
  payoutMethod: z.enum(['bank_transfer', 'paypal', 'cryptocurrency'], {
    required_error: 'Please select a payout method',
  }),
  // Bank transfer fields
  accountHolderName: z.string().optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  routingCode: z.string().optional(),
  swiftCode: z.string().optional(),
  iban: z.string().optional(),
  // PayPal
  paypalEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  // Cryptocurrency
  cryptoWalletAddress: z.string().optional(),
  cryptoType: z.enum(['BTC', 'ETH', 'USDT']).optional(),
  // Tax information
  taxResidencyCountry: z.string().min(2, 'Tax residency country is required'),
  taxForm: z.enum(['w9', 'w8ben', 'none']).optional(),
}).refine(
  (data) => {
    if (data.payoutMethod === 'bank_transfer') {
      return !!(data.accountHolderName && data.bankName && data.accountNumber)
    }
    if (data.payoutMethod === 'paypal') {
      return !!data.paypalEmail
    }
    if (data.payoutMethod === 'cryptocurrency') {
      return !!(data.cryptoWalletAddress && data.cryptoType)
    }
    return true
  },
  {
    message: 'Please fill in all required fields for your selected payout method',
    path: ['payoutMethod'],
  }
)

export type Step5FormData = z.infer<typeof step5Schema>

// Step 6: Agreements & Submission Schema
export const step6Schema = z.object({
  acceptedSellerAgreement: z.boolean().refine((val) => val === true, {
    message: 'You must accept the Seller Agreement',
  }),
  acceptedPrivacyPolicy: z.boolean().refine((val) => val === true, {
    message: 'You must accept the Privacy Policy',
  }),
  acceptedAntiFraudPolicy: z.boolean().refine((val) => val === true, {
    message: 'You must accept the Anti-Fraud Policy',
  }),
  acceptedCommissionStructure: z.boolean().refine((val) => val === true, {
    message: 'You must accept the Commission Structure',
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
