/**
 * /signup-become-seller — the "Sign up to sell" split-screen flow.
 *
 * The fast path from the /sell choice modal (vs. the founding waitlist). It is a
 * self-contained three-step experience (create account → confirm email → start
 * application) that MIRRORS the seller application's split-screen look (left rail
 * stepper, right pane, no site navbar/footer) so signing up and applying feel
 * like one continuous flow. It hands off to the existing, untouched
 * /account/become-seller wizard. See _SignupToSellFlow.tsx for the state machine.
 */

import type { Metadata } from 'next'
import { SignupToSellFlow } from './_SignupToSellFlow'

export const metadata: Metadata = {
  title: 'Sign Up to Sell on DropMarket — Become a Seller',
  description:
    'Create your account, verify once, and complete the seller application to start selling on DropMarket. Most applications are reviewed within 12 hours.',
  alternates: { canonical: '/signup-become-seller' },
  robots: { index: false, follow: false },
}

export default function SignupBecomeSellerPage() {
  return <SignupToSellFlow />
}
