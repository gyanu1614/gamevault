/**
 * VaultShield Protection Landing Page
 *
 * Marketing page explaining GameVault's buyer protection system
 * Shows protection levels, how it works, and FAQs
 */

import React from 'react'
import { Metadata } from 'next'
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Clock,
  FileText,
  CheckCircle2,
  AlertCircle,
  Users,
  TrendingUp,
  Award
} from 'lucide-react'
import Link from 'next/link'
import { TrustpilotCarousel } from '@/components/trustpilot/TrustpilotWidget'

export const metadata: Metadata = {
  title: 'VaultShield Protection | GameVault',
  description:
    'Learn about VaultShield, our comprehensive buyer protection system. Secure escrow, delivery verification, and full refund guarantee for all transactions.',
  openGraph: {
    title: 'VaultShield Protection | GameVault',
    description:
      'Secure escrow and buyer protection for game asset purchases',
    type: 'website'
  }
}

export default function VaultShieldPage() {
  // Schema.org FAQPage structured data for SEO
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What happens if the seller doesn't deliver?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "If the seller fails to deliver within the agreed timeframe or you don't receive what you paid for, you can open a dispute. Our team will review the case and issue a full refund if the seller is at fault."
        }
      },
      {
        "@type": "Question",
        "name": "How long does the escrow period last?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "All orders have a 48-hour escrow period. This gives you time to verify the delivery and report any issues. After 48 hours, the payment is automatically released to the seller unless you've opened a dispute."
        }
      },
      {
        "@type": "Question",
        "name": "What is delivery evidence?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "For Enhanced ($100+) and Premium ($500+) orders, sellers must upload screenshots or videos proving they delivered the items. This creates a clear record of delivery and helps resolve disputes quickly."
        }
      },
      {
        "@type": "Question",
        "name": "Can I get a refund after confirming delivery?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Once you manually confirm delivery, the payment is released immediately and refunds are no longer available unless you can prove the seller engaged in fraud. Always verify items before confirming."
        }
      },
      {
        "@type": "Question",
        "name": "What if I have a dispute?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "You can open a dispute during the 48-hour escrow period. Our support team will review all evidence (messages, delivery proof, etc.) and make a fair decision. Most disputes are resolved within 24-48 hours."
        }
      },
      {
        "@type": "Question",
        "name": "Is there any fee for VaultShield?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No! VaultShield protection is completely free and automatically applied to every purchase. It's our commitment to creating a safe marketplace for all buyers and sellers."
        }
      }
    ]
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black">
      {/* Schema.org FAQPage Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-500/10 via-transparent to-transparent" />

        <div className="max-w-7xl mx-auto relative">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20">
                <Shield className="w-12 h-12 text-violet-400" />
              </div>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              VaultShield Protection
            </h1>

            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
              Every purchase is protected by our comprehensive escrow system.
              Buy with confidence knowing your money is secure until delivery is confirmed.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] rounded-lg border border-white/[0.1]">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span className="text-white font-medium">48-Hour Escrow</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] rounded-lg border border-white/[0.1]">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span className="text-white font-medium">Full Refund Guarantee</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] rounded-lg border border-white/[0.1]">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span className="text-white font-medium">Delivery Verification</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
            <StatCard
              icon={Users}
              value="50,000+"
              label="Protected Buyers"
              color="text-blue-400"
            />
            <StatCard
              icon={TrendingUp}
              value="$2.5M+"
              label="Total Secured"
              color="text-violet-400"
            />
            <StatCard
              icon={Award}
              value="99.8%"
              label="Success Rate"
              color="text-amber-400"
            />
          </div>
        </div>
      </section>

      {/* Protection Levels */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Three Levels of Protection
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Automatically applied based on your order value
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ProtectionLevelCard
              icon={Shield}
              level="Standard"
              priceRange="Under $100"
              color="blue"
              features={[
                '48-hour escrow hold',
                'Dispute resolution',
                'Refund protection'
              ]}
            />

            <ProtectionLevelCard
              icon={ShieldCheck}
              level="Enhanced"
              priceRange="$100 - $499"
              color="violet"
              featured
              features={[
                '48-hour escrow hold',
                'Delivery evidence required',
                'Priority dispute resolution',
                'Full refund guarantee'
              ]}
            />

            <ProtectionLevelCard
              icon={ShieldAlert}
              level="Premium"
              priceRange="$500+"
              color="amber"
              features={[
                '48-hour escrow hold',
                'Mandatory delivery evidence',
                'Priority dispute resolution',
                'Full refund guarantee',
                'Extended verification'
              ]}
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              How VaultShield Works
            </h2>
            <p className="text-gray-400 text-lg">
              Simple, transparent, and automatic protection
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <HowItWorksStep
              number={1}
              icon={Lock}
              title="Payment Secured"
              description="Your payment is held safely in escrow, not released to the seller yet"
            />

            <HowItWorksStep
              number={2}
              icon={FileText}
              title="Delivery"
              description="Seller delivers your items and provides evidence for Enhanced/Premium orders"
            />

            <HowItWorksStep
              number={3}
              icon={Clock}
              title="Review Period"
              description="You have 48 hours to confirm delivery and report any issues"
            />

            <HowItWorksStep
              number={4}
              icon={CheckCircle2}
              title="Auto-Release"
              description="Payment released to seller after 48 hours, or immediately when you confirm"
            />
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-6">
            <FAQItem
              question="What happens if the seller doesn't deliver?"
              answer="If the seller fails to deliver within the agreed timeframe or you don't receive what you paid for, you can open a dispute. Our team will review the case and issue a full refund if the seller is at fault."
            />

            <FAQItem
              question="How long does the escrow period last?"
              answer="All orders have a 48-hour escrow period. This gives you time to verify the delivery and report any issues. After 48 hours, the payment is automatically released to the seller unless you've opened a dispute."
            />

            <FAQItem
              question="What is delivery evidence?"
              answer="For Enhanced ($100+) and Premium ($500+) orders, sellers must upload screenshots or videos proving they delivered the items. This creates a clear record of delivery and helps resolve disputes quickly."
            />

            <FAQItem
              question="Can I get a refund after confirming delivery?"
              answer="Once you manually confirm delivery, the payment is released immediately and refunds are no longer available unless you can prove the seller engaged in fraud. Always verify items before confirming."
            />

            <FAQItem
              question="What if I have a dispute?"
              answer="You can open a dispute during the 48-hour escrow period. Our support team will review all evidence (messages, delivery proof, etc.) and make a fair decision. Most disputes are resolved within 24-48 hours."
            />

            <FAQItem
              question="Is there any fee for VaultShield?"
              answer="No! VaultShield protection is completely free and automatically applied to every purchase. It's our commitment to creating a safe marketplace for all buyers and sellers."
            />
          </div>
        </div>
      </section>

      {/* Trustpilot Reviews Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Trusted by Gamers Worldwide
            </h2>
            <p className="text-gray-400 text-lg">
              See what buyers and sellers say about our protection system
            </p>
          </div>
          <TrustpilotCarousel />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-r from-violet-500/10 to-blue-500/10 border border-violet-500/20 rounded-2xl p-12">
            <Shield className="w-16 h-16 text-violet-400 mx-auto mb-6" />

            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Shop Safely?
            </h2>

            <p className="text-gray-300 text-lg mb-8 max-w-2xl mx-auto">
              Every purchase is protected by VaultShield. Browse thousands of listings
              and buy with complete confidence.
            </p>

            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 px-8 py-4 bg-violet-500 hover:bg-violet-600 text-white font-semibold rounded-lg transition-colors"
            >
              Browse Marketplace
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

// Component: Stat Card
interface StatCardProps {
  icon: React.ElementType
  value: string
  label: string
  color: string
}

function StatCard({ icon: Icon, value, label, color }: StatCardProps) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-6 text-center">
      <Icon className={`w-8 h-8 ${color} mx-auto mb-3`} />
      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      <div className="text-sm text-gray-400">{label}</div>
    </div>
  )
}

// Component: Protection Level Card
interface ProtectionLevelCardProps {
  icon: React.ElementType
  level: string
  priceRange: string
  color: 'blue' | 'violet' | 'amber'
  features: string[]
  featured?: boolean
}

function ProtectionLevelCard({
  icon: Icon,
  level,
  priceRange,
  color,
  features,
  featured = false
}: ProtectionLevelCardProps) {
  const colorClasses = {
    blue: {
      text: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20'
    },
    violet: {
      text: 'text-violet-400',
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/20'
    },
    amber: {
      text: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20'
    }
  }

  const colors = colorClasses[color]

  return (
    <div
      className={`relative bg-white/[0.03] border rounded-xl p-6 ${
        featured ? 'ring-2 ring-violet-500/50 scale-105' : 'border-white/[0.05]'
      }`}
    >
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-violet-500 text-white text-xs font-semibold rounded-full">
          Most Popular
        </div>
      )}

      <div className={`inline-flex p-3 rounded-lg ${colors.bg} ${colors.border} border mb-4`}>
        <Icon className={`w-6 h-6 ${colors.text}`} />
      </div>

      <h3 className="text-xl font-bold text-white mb-1">{level} Protection</h3>
      <p className="text-gray-400 text-sm mb-6">{priceRange}</p>

      <div className="space-y-3">
        {features.map((feature, index) => (
          <div key={index} className="flex items-start gap-2">
            <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${colors.text}`} />
            <span className="text-sm text-gray-300">{feature}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Component: How It Works Step
interface HowItWorksStepProps {
  number: number
  icon: React.ElementType
  title: string
  description: string
}

function HowItWorksStep({ number, icon: Icon, title, description }: HowItWorksStepProps) {
  return (
    <div className="text-center">
      <div className="relative inline-flex items-center justify-center mb-4">
        <div className="absolute w-16 h-16 bg-violet-500/20 rounded-full animate-pulse" />
        <div className="relative w-16 h-16 bg-violet-500/10 border border-violet-500/20 rounded-full flex items-center justify-center">
          <Icon className="w-8 h-8 text-violet-400" />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-violet-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
          {number}
        </div>
      </div>

      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-400">{description}</p>
    </div>
  )
}

// Component: FAQ Item
interface FAQItemProps {
  question: string
  answer: string
}

function FAQItem({ question, answer }: FAQItemProps) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-3 flex items-start gap-2">
        <AlertCircle className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
        {question}
      </h3>
      <p className="text-gray-400 text-sm pl-7">{answer}</p>
    </div>
  )
}
