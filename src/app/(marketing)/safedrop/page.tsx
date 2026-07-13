/**
 * SafeDrop Buyer Protection Landing Page
 *
 * Marketing page explaining DropMarket's buyer-protection programme:
 * what's covered, protection windows by category, how disputes work,
 * seller payouts, and FAQs.
 */

import React from 'react'
import { Metadata } from 'next'
import {
  Shield,
  ShieldCheck,
  Clock,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users,
  Award,
  Coins,
  Package,
  Zap,
  Rocket,
  UserCheck,
  MessageSquare,
  Scale,
  Wallet,
  CreditCard
} from 'lucide-react'
import Link from 'next/link'
import { TrustpilotCarousel } from '@/components/trustpilot/TrustpilotWidget'

export const metadata: Metadata = {
  title: 'SafeDrop Buyer Protection',
  description:
    "SafeDrop is DropMarket's buyer-protection programme, included on every order. Not delivered or not as described? You get your money back.",
  openGraph: {
    title: 'SafeDrop Buyer Protection',
    description:
      'Buyer protection on every DropMarket order — get what you ordered, or your money back',
    type: 'website'
  }
}

export default function SafeDropPage() {
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
          "text": "Every order is covered by SafeDrop Buyer Protection. If your order isn't delivered or isn't as described, you get a full refund."
        }
      },
      {
        "@type": "Question",
        "name": "How long do I have to check my order?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Each category has its own protection window: 48 hours for currency and top-ups, 72 hours for items and boosting, and 5, 7, or 14 days for accounts depending on the account's risk band. Raise any issue within the window and you're covered."
        }
      },
      {
        "@type": "Question",
        "name": "What does SafeDrop cover?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "SafeDrop covers orders that aren't delivered, items that aren't as described, and accounts recovered by their previous owner within the warranty terms in our Risk Disclosure. It doesn't cover a change of mind, publisher bans after delivery outside warranty terms, or deals made off-platform."
        }
      },
      {
        "@type": "Question",
        "name": "Can I get a refund after confirming delivery?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Confirming delivery tells us you received your order as described, so refunds are generally no longer available afterwards unless you can show the seller acted fraudulently. Always check your order carefully before confirming."
        }
      },
      {
        "@type": "Question",
        "name": "How do disputes work?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Contact the seller first — most issues are resolved in chat. If nothing is fixed within the 12-hour grace period, open a dispute. Both sides then have 24 hours to submit evidence, and our team issues a decision within 3 days."
        }
      },
      {
        "@type": "Question",
        "name": "Is there a fee for SafeDrop?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Standard SafeDrop protection is included free on every order. Optional Enhanced and Premium warranty tiers with longer coverage are available at checkout."
        }
      },
      {
        "@type": "Question",
        "name": "When do sellers get paid?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Your sale proceeds are credited to your Seller Balance once the buyer confirms delivery or the protection window closes."
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
        <div className="absolute inset-0 bg-gradient-to-b from-lime/10 via-transparent to-transparent" />

        <div className="max-w-7xl mx-auto relative">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="p-4 rounded-2xl bg-lime/10 border border-lime/20">
                <Shield className="w-12 h-12 text-lime-text" />
              </div>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              SafeDrop Buyer Protection
            </h1>

            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
              Not delivered or not as described? You get your money back.
              SafeDrop is DropMarket&apos;s buyer-protection programme, included
              on every order.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] rounded-lg border border-white/[0.1]">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span className="text-white font-medium">Included on Every Order</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] rounded-lg border border-white/[0.1]">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span className="text-white font-medium">Money-Back Guarantee</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] rounded-lg border border-white/[0.1]">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span className="text-white font-medium">Verified Sellers</span>
              </div>
            </div>
          </div>

          {/* Trust Signals */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
            <StatCard
              icon={ShieldCheck}
              value="Every Order"
              label="Covered by SafeDrop Buyer Protection"
              color="text-lime-text"
            />
            <StatCard
              icon={Award}
              value="UK-Registered"
              label="DropMarket is a UK-registered company"
              color="text-lime-text"
            />
            <StatCard
              icon={Users}
              value="Verified Sellers"
              label="Every seller is verified before they can sell"
              color="text-amber-400"
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              How SafeDrop Works
            </h2>
            <p className="text-gray-400 text-lg">
              Simple, transparent, and automatic on every order
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <HowItWorksStep
              number={1}
              icon={CreditCard}
              title="Buyer Pays at Checkout"
              description="Place your order and pay as normal — SafeDrop coverage applies automatically"
            />

            <HowItWorksStep
              number={2}
              icon={Zap}
              title="Seller Delivers"
              description="Most orders complete in minutes"
            />

            <HowItWorksStep
              number={3}
              icon={CheckCircle2}
              title="Buyer Confirms, Seller Gets Paid"
              description="Confirm delivery and the seller is paid out. Not delivered or not as described? Full refund."
            />
          </div>
        </div>
      </section>

      {/* What's Covered */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              What&apos;s Covered
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Clear rules, no fine-print surprises
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="inline-flex p-3 rounded-lg bg-lime/10 border border-lime/20">
                  <CheckCircle2 className="w-6 h-6 text-lime-text" />
                </div>
                <h3 className="text-xl font-bold text-white">Covered by SafeDrop</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-lime-text" />
                  <span className="text-sm text-gray-300">
                    Your order isn&apos;t delivered
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-lime-text" />
                  <span className="text-sm text-gray-300">
                    The item isn&apos;t as described — wrong item, wrong amount,
                    or a misleading listing
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-lime-text" />
                  <span className="text-sm text-gray-300">
                    An account is recovered by its previous owner within the
                    warranty terms in our Risk Disclosure
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="inline-flex p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <XCircle className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className="text-xl font-bold text-white">Not Covered</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <XCircle className="w-5 h-5 flex-shrink-0 text-amber-400" />
                  <span className="text-sm text-gray-300">
                    Change of mind after delivery
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <XCircle className="w-5 h-5 flex-shrink-0 text-amber-400" />
                  <span className="text-sm text-gray-300">
                    Publisher bans or suspensions after delivery, outside
                    warranty terms
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <XCircle className="w-5 h-5 flex-shrink-0 text-amber-400" />
                  <span className="text-sm text-gray-300">
                    Deals or payments made outside DropMarket
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Protection Windows */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Protection Windows by Category
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Your protection window is the time you have to check your order
              and raise an issue. Sellers are paid out when you confirm
              delivery or the window closes.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            <ProtectionWindowCard icon={Coins} category="Currency" window="48 Hours" />
            <ProtectionWindowCard icon={Package} category="Items" window="72 Hours" />
            <ProtectionWindowCard icon={Zap} category="Top-Ups" window="48 Hours" />
            <ProtectionWindowCard icon={Rocket} category="Boosting" window="72 Hours" />
            <ProtectionWindowCard
              icon={UserCheck}
              category="Accounts"
              window="5–14 Days"
              note="5, 7, or 14 days by risk band"
            />
          </div>
        </div>
      </section>

      {/* How Disputes Work */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              How Disputes Work
            </h2>
            <p className="text-gray-400 text-lg">
              A clear process with fixed timelines — no black box
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8">
            <HowItWorksStep
              number={1}
              icon={MessageSquare}
              title="Contact the Seller"
              description="Message the seller first — most issues are resolved in chat"
            />

            <HowItWorksStep
              number={2}
              icon={Clock}
              title="12-Hour Grace Period"
              description="The seller has 12 hours to put things right"
            />

            <HowItWorksStep
              number={3}
              icon={Shield}
              title="Open a Dispute"
              description="Still unresolved? Escalate it to the DropMarket team"
            />

            <HowItWorksStep
              number={4}
              icon={FileText}
              title="24-Hour Evidence Window"
              description="Both sides have 24 hours to submit evidence"
            />

            <HowItWorksStep
              number={5}
              icon={Scale}
              title="Decision Within 3 Days"
              description="Our team reviews and decides within 3 days — if your claim stands, you get a full refund"
            />
          </div>
        </div>
      </section>

      {/* For Sellers */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white/[0.02]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              For Sellers
            </h2>
            <p className="text-gray-400 text-lg">
              SafeDrop protects both sides of every order
            </p>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-8 text-center">
            <div className="inline-flex p-4 rounded-2xl bg-lime/10 border border-lime/20 mb-6">
              <Wallet className="w-8 h-8 text-lime-text" />
            </div>
            <h3 className="text-xl font-bold text-white mb-4">
              Fast, Guaranteed Payouts
            </h3>
            <p className="text-gray-300 mb-4 max-w-2xl mx-auto">
              You&apos;re paid out after the buyer confirms delivery or the
              protection window closes — payout guaranteed once the window
              closes.
            </p>
            <p className="text-gray-400 text-sm max-w-2xl mx-auto">
              Your sale proceeds are credited to your Seller Balance once the
              buyer confirms delivery or the protection window closes. Evidence
              requirements and a structured dispute process protect you from
              bad-faith claims.
            </p>
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
              answer="Every order is covered by SafeDrop Buyer Protection. If your order isn't delivered or isn't as described, you get a full refund."
            />

            <FAQItem
              question="How long do I have to check my order?"
              answer="Each category has its own protection window: 48 hours for currency and top-ups, 72 hours for items and boosting, and 5, 7, or 14 days for accounts depending on the account's risk band. Raise any issue within the window and you're covered."
            />

            <FAQItem
              question="What does SafeDrop cover?"
              answer="SafeDrop covers orders that aren't delivered, items that aren't as described, and accounts recovered by their previous owner within the warranty terms in our Risk Disclosure. It doesn't cover a change of mind, publisher bans after delivery outside warranty terms, or deals made off-platform."
            />

            <FAQItem
              question="Can I get a refund after confirming delivery?"
              answer="Confirming delivery tells us you received your order as described, so refunds are generally no longer available afterwards unless you can show the seller acted fraudulently. Always check your order carefully before confirming."
            />

            <FAQItem
              question="How do disputes work?"
              answer="Contact the seller first — most issues are resolved in chat. If nothing is fixed within the 12-hour grace period, open a dispute. Both sides then have 24 hours to submit evidence, and our team issues a decision within 3 days."
            />

            <FAQItem
              question="Is there a fee for SafeDrop?"
              answer="Standard SafeDrop protection is included free on every order. Optional Enhanced and Premium warranty tiers with longer coverage are available at checkout."
            />

            <FAQItem
              question="When do sellers get paid?"
              answer="Your sale proceeds are credited to your Seller Balance once the buyer confirms delivery or the protection window closes."
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
              See what buyers and sellers say about shopping with SafeDrop
            </p>
          </div>
          <TrustpilotCarousel />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-r from-lime/10 to-lime/10 border border-lime/20 rounded-2xl p-12">
            <Shield className="w-16 h-16 text-lime-text mx-auto mb-6" />

            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Shop Safely?
            </h2>

            <p className="text-gray-300 text-lg mb-8 max-w-2xl mx-auto">
              Every order is covered by SafeDrop Buyer Protection — get what
              you ordered, or your money back.
            </p>

            <Link
              href="/"
              className="inline-flex items-center gap-2 px-8 py-4 bg-lime hover:bg-lime-hover text-text-inverse font-semibold rounded-lg transition-colors"
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

// Component: Protection Window Card
interface ProtectionWindowCardProps {
  icon: React.ElementType
  category: string
  window: string
  note?: string
}

function ProtectionWindowCard({
  icon: Icon,
  category,
  window: windowLabel,
  note
}: ProtectionWindowCardProps) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-6 text-center">
      <Icon className="w-8 h-8 text-lime-text mx-auto mb-3" />
      <div className="text-sm text-gray-400 mb-1">{category}</div>
      <div className="text-2xl font-bold text-white">{windowLabel}</div>
      {note && <div className="text-xs text-gray-500 mt-2">{note}</div>}
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
        <div className="absolute w-16 h-16 bg-lime/20 rounded-full animate-pulse" />
        <div className="relative w-16 h-16 bg-lime/10 border border-lime/20 rounded-full flex items-center justify-center">
          <Icon className="w-8 h-8 text-lime-text" />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-lime text-text-inverse text-xs font-bold rounded-full flex items-center justify-center">
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
        <AlertCircle className="w-5 h-5 text-lime-text flex-shrink-0 mt-0.5" />
        {question}
      </h3>
      <p className="text-gray-400 text-sm pl-7">{answer}</p>
    </div>
  )
}
