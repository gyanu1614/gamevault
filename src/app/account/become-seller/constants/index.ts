/**
 * Seller Registration Constants
 *
 * All constant data used throughout the registration process.
 * Games come from the DB (passed down from the server page) and all fee
 * numbers come from @/lib/fees — neither lives here.
 */

import {
  CheckCircle2,
  FileText,
  User,
  Building2,
  CreditCard,
  Shield,
} from 'lucide-react'

export const STEPS = [
  { id: 1, name: 'Eligibility', icon: Shield },
  { id: 2, name: 'Information', icon: User },
  { id: 3, name: 'Verification', icon: FileText },
  { id: 4, name: 'Profile', icon: Building2 },
  { id: 5, name: 'Payout', icon: CreditCard },
  { id: 6, name: 'Review', icon: CheckCircle2 },
]

export const LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Portuguese',
  'Russian',
  'Chinese',
  'Japanese',
  'Korean',
  'Arabic',
  'Italian',
  'Dutch',
  'Turkish',
  'Polish',
  'Hindi',
  'Vietnamese',
  'Thai',
  'Swedish',
  'Danish',
  'Norwegian',
]

export const TIMEZONES = [
  'UTC-12:00',
  'UTC-11:00',
  'UTC-10:00',
  'UTC-09:00',
  'UTC-08:00 (PST)',
  'UTC-07:00 (MST)',
  'UTC-06:00 (CST)',
  'UTC-05:00 (EST)',
  'UTC-04:00',
  'UTC-03:00',
  'UTC-02:00',
  'UTC-01:00',
  'UTC+00:00 (GMT)',
  'UTC+01:00',
  'UTC+02:00',
  'UTC+03:00',
  'UTC+04:00',
  'UTC+05:00',
  'UTC+05:30 (IST)',
  'UTC+06:00',
  'UTC+07:00',
  'UTC+08:00',
  'UTC+09:00 (JST)',
  'UTC+10:00',
  'UTC+11:00',
  'UTC+12:00',
]

export const DOCUMENT_SAMPLES = {
  idDocument: '/samples/id-sample.svg',
  selfieWithId: '/samples/selfie-sample.svg',
  proofOfAddress: '/samples/address-sample.svg',
  certificateOfIncorporation: '/samples/incorporation-sample.svg',
  businessLicense: '/samples/license-sample.svg',
  bankStatement: '/samples/bank-statement-sample.svg',
}
