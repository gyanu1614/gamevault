/**
 * Seller Registration Constants
 *
 * All constant data used throughout the registration process
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
  { id: 5, name: 'Payment', icon: CreditCard },
  { id: 6, name: 'Review', icon: CheckCircle2 },
]

export const GAMES = [
  { id: '1', name: 'Roblox', emoji: '🎮', image: '/games/roblox.png' },
  { id: '2', name: 'Fortnite', emoji: '⚔️', image: '/games/fortnite.png' },
  { id: '3', name: 'Valorant', emoji: '🔫', image: '/games/valorant.png' },
  { id: '4', name: 'GTA V', emoji: '🚗', image: '/games/gta-v.png' },
  { id: '5', name: 'Minecraft', emoji: '⛏️', image: '/games/minecraft.png' },
  { id: '6', name: 'League of Legends', emoji: '⚡', image: '/games/lol.png' },
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

export const COMMISSION_TIERS = [
  {
    tier: 'Bronze',
    rate: '6.9%',
    description: 'Entry level',
    color: 'amber',
    gradient: 'from-amber-500/5',
    borderHover: 'border-amber-500/20',
    bgHover: 'from-amber-500/0 to-amber-500/5',
    textColor: 'text-amber-400/60',
  },
  {
    tier: 'Silver',
    rate: '5.9%',
    description: '50+ sales',
    color: 'gray',
    gradient: 'from-gray-400/5',
    borderHover: 'border-gray-400/20',
    bgHover: 'from-gray-400/0 to-gray-400/5',
    textColor: 'text-gray-400/60',
  },
  {
    tier: 'Gold',
    rate: '4.9%',
    description: '500+ sales',
    color: 'yellow',
    gradient: 'from-yellow-500/5',
    borderHover: 'border-yellow-500/20',
    bgHover: 'from-yellow-500/0 to-yellow-500/5',
    textColor: 'text-yellow-400/60',
  },
  {
    tier: 'Diamond',
    rate: '3.9%',
    description: '5000+ sales',
    color: 'blue',
    gradient: 'from-blue-400/5',
    borderHover: 'border-blue-400/20',
    bgHover: 'from-blue-400/0 to-blue-400/5',
    textColor: 'text-blue-400/60',
  },
]

export const DOCUMENT_SAMPLES = {
  idDocument: '/samples/id-sample.svg',
  selfieWithId: '/samples/selfie-sample.svg',
  proofOfAddress: '/samples/address-sample.svg',
  certificateOfIncorporation: '/samples/incorporation-sample.svg',
  businessLicense: '/samples/license-sample.svg',
  bankStatement: '/samples/bank-statement-sample.svg',
}
