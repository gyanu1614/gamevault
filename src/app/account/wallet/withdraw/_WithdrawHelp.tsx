'use client'

/**
 * Help, on the page where the questions come up: the withdrawal questions and a
 * way to reach the team. Every answer restates what the rest of the page and the
 * database rules already do; the pause length is read, never written in.
 */

import { ArrowRightIcon } from '@phosphor-icons/react/dist/csr/ArrowRight'
import { EnvelopeSimpleIcon } from '@phosphor-icons/react/dist/csr/EnvelopeSimple'
import { LifebuoyIcon } from '@phosphor-icons/react/dist/csr/Lifebuoy'
import { DiscordLogoIcon } from '@phosphor-icons/react/dist/csr/DiscordLogo'
import { IconTile } from '@/components/account/AccountSurface'
import Link from '@/components/navigation/AppLink'
import { FaqCards, type FaqItem } from '@/components/marketplace/FaqCards'
import { DISCORD_INVITE_URL } from '@/lib/config/founding-seller'

const SUPPORT_EMAIL = 'support@dropmarket.gg'

export function withdrawalQuestions(freezeHours: number): FaqItem[] {
  return [
    {
      q: 'How Long Do Withdrawals Take?',
      a: 'Every withdrawal is reviewed first. After review, crypto is processed within 24 to 48 hours and Payoneer arrives within 1 to 3 business days.',
    },
    {
      q: 'What Are The Fees?',
      a: 'Fees depend on the payout method. Your summary shows the exact fee and the amount you receive before you confirm.',
    },
    {
      q: 'Why Do I Need To Verify My Identity?',
      a: 'Identity verification is required once, before your first withdrawal. It protects your funds and adds the verified badge to your store.',
    },
    {
      q: 'Why Are My Withdrawals Paused?',
      a: `Changing your payout details pauses withdrawals for ${freezeHours} hours and we notify you by email. This protects your funds if someone else accesses your account.`,
    },
    {
      q: 'Can I Cancel A Withdrawal?',
      a: 'Yes, while it is pending. Go to Payouts in your wallet and select Cancel. The amount returns to your balance immediately.',
    },
    {
      q: 'What Happens If A Withdrawal Is Declined?',
      a: 'The amount returns to your balance, and the reason appears next to the withdrawal in your wallet.',
    },
    {
      q: 'When Do My Sales Become Available?',
      a: 'A sale is pending until the buyer confirms delivery and a short hold period ends. You can then withdraw it.',
    },
  ]
}

export function WithdrawFaq({ freezeHours }: { freezeHours: number }) {
  return (
    <section aria-labelledby="withdraw-questions">
      <h2 id="withdraw-questions" className="mb-3 text-[15px] font-semibold text-text-primary">
        Withdrawal FAQ
      </h2>
      <FaqCards items={withdrawalQuestions(freezeHours)} defaultOpen={-1} />
    </section>
  )
}

function HelpRow({ href, external, icon, label }: { href: string; external?: boolean; icon: React.ReactNode; label: string }) {
  const cls =
    'group flex min-h-[44px] items-center justify-between gap-3 py-2 text-[13px] font-medium text-text-primary transition-colors hover:text-white'
  const inner = (
    <>
      <span className="inline-flex min-w-0 items-center gap-2">
        <span aria-hidden className="shrink-0 text-text-tertiary">{icon}</span>
        <span className="truncate">{label}</span>
      </span>
      <ArrowRightIcon size={14} weight="bold" aria-hidden className="shrink-0 text-text-tertiary" />
    </>
  )
  return href.startsWith('/') ? (
    <Link href={href} className={cls}>{inner}</Link>
  ) : (
    <a href={href} className={cls} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{inner}</a>
  )
}

export function HelpCard() {
  return (
    <section aria-labelledby="withdraw-help" className="rounded-lg bg-bg-raised p-5">
      <div className="flex items-center gap-3">
        <IconTile tone="trust">
          <LifebuoyIcon size={22} weight="duotone" />
        </IconTile>
        <div className="min-w-0">
          <h2 id="withdraw-help" className="text-[15px] font-semibold text-text-primary">Need Help?</h2>
          <p className="mt-0.5 text-[12.5px] text-text-secondary">Our team usually replies within a few hours.</p>
        </div>
      </div>
      <div className="mt-3 divide-y divide-white/[0.07] border-t border-white/[0.07]">
        <HelpRow href="/support" icon={<LifebuoyIcon size={16} weight="duotone" />} label="Help Center" />
        <HelpRow href={`mailto:${SUPPORT_EMAIL}`} icon={<EnvelopeSimpleIcon size={16} weight="duotone" />} label="Email Support" />
        <HelpRow href={DISCORD_INVITE_URL} external icon={<DiscordLogoIcon size={16} weight="duotone" />} label="Discord Community" />
      </div>
    </section>
  )
}
