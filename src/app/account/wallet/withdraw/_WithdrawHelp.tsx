'use client'

/**
 * The withdrawal questions, on the page where they come up. Every answer restates what the rest of the page and the
 * database rules already do; the pause length is read, never written in.
 */

import { FaqCards, type FaqItem } from '@/components/marketplace/FaqCards'

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
      q: 'Why Is My Withdrawal Scheduled?',
      a: `Adding or changing a payout method starts a ${freezeHours}-hour wait, and we notify you by email. You can still request a withdrawal: we send it when the wait ends, and you can cancel it until then. This protects your funds if someone else accesses your account.`,
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
      <h2 id="withdraw-questions" className="mb-3 text-[16px] font-semibold text-text-primary">
        Withdrawal FAQ
      </h2>
      <FaqCards items={withdrawalQuestions(freezeHours)} defaultOpen={-1} className="mt-0 max-w-none" />
    </section>
  )
}
