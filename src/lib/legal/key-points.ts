/**
 * "Key Points" boxes at the top of the main legal pages (2026-10-23).
 *
 * Research: questions and answers raised understanding most in the UK
 * government's tests (BIT 2019), and a summary must include the unwelcome
 * terms, because readers skip what it leaves out (BIT; CMA37 4.43). StarPets
 * marks its summary "not part of the contract"; the page does the same.
 *
 * Every answer restates a clause of the document it sits on, in plain words.
 * Numbers come from the same constants as the documents, never typed twice.
 * Change a clause, change its answer here.
 */

import { DISPUTE_WINDOW_DAYS, SELLER_RESPONSE_HOURS } from './protection-windows'

export interface KeyPoint {
  q: string
  a: string
}

export const KEY_POINTS: Readonly<Record<string, readonly KeyPoint[]>> = {
  terms: [
    {
      q: 'Who am I buying from?',
      a: 'From the seller, not from DropMarket. We run the marketplace and collect your payment as the seller’s agent, so each sale is between you and the seller.',
    },
    { q: 'Who can use DropMarket?', a: 'You must be 18 or over and not barred by sanctions.' },
    {
      q: 'Can a game ban my account?',
      a: 'Yes. Buying or selling game items, currency or accounts may break the game’s own rules, and the publisher can ban accounts or take items back. You accept that risk, and a publisher ban alone does not entitle you to a refund.',
    },
    {
      q: 'What if my order goes wrong?',
      a: 'Every order is covered by SafeDrop Protection. Open a dispute from your order page; refunds follow the Refund & Dispute Policy.',
    },
    {
      q: 'Should I file a chargeback?',
      a: 'Please use a SafeDrop dispute first. A chargeback on an order you received can restrict your account. Your rights with your bank are not affected.',
    },
    {
      q: 'How much is DropMarket liable for?',
      a: 'For an order, the greater of the fees we earned on it or £100, except where the law does not allow a limit.',
    },
    {
      q: 'Can these terms change?',
      a: 'Yes. We give at least 14 days’ notice of a material change, and a change never applies to an order already placed.',
    },
    {
      q: 'Which law applies?',
      a: 'The law of England and Wales. If you are a consumer living elsewhere, you keep the mandatory rights of your own country.',
    },
  ],
  refunds: [
    {
      q: 'When can I get a refund?',
      a: 'When the order isn’t delivered in the seller’s stated time, isn’t as described, doesn’t work, or an account isn’t fully handed over.',
    },
    {
      q: 'When can’t I?',
      a: 'If you changed your mind, gave wrong details at checkout, changed an account after delivery, or got it banned yourself.',
    },
    { q: 'How long do I have?', a: `You can open a dispute for ${DISPUTE_WINDOW_DAYS} days from delivery, even after the order has completed.` },
    {
      q: 'What happens in a dispute?',
      a: `Talk to the seller in the order chat first. The seller has ${SELLER_RESPONSE_HOURS} hours to fix it; after that you can open a dispute, and our team decides.`,
    },
    {
      q: 'How do I get my money back?',
      a: 'As store credit for the item price, straight away. If your payment method supports refunds, you can ask for the full amount, service fee included, to go back to it instead. Crypto orders are refunded as store credit.',
    },
    {
      q: 'What about chargebacks?',
      a: 'Please use the dispute process first. A chargeback on an order you received can restrict your account, but your rights with your bank stay.',
    },
  ],
  privacy: [
    { q: 'Who looks after my data?', a: 'DropMarket Ltd, a UK company. You can reach us at support@dropmarket.gg.' },
    {
      q: 'What do you collect?',
      a: 'Your account details, orders and chats, payment and payout records, and, for sellers who verify, the ID and selfie checks our verification provider runs.',
    },
    {
      q: 'Do you sell my data?',
      a: 'No. We share it only with the providers that run the service, such as hosting, email and payments, and only what each one needs.',
    },
    {
      q: 'How long do you keep it?',
      a: 'While your account is open. Some records stay longer because the law requires it: identity checks for 5 years, payment records for 6.',
    },
    {
      q: 'What are my rights?',
      a: 'You can see, correct, delete or move your data, and object to some uses. Email us and we reply within one month.',
    },
    { q: 'Do you use cookies?', a: 'Essential cookies to run the site, and analytics cookies only if you accept them.' },
  ],
  'seller-agreement': [
    {
      q: 'What is this agreement?',
      a: 'It appoints DropMarket as your agent: we sell on your behalf, collect the buyer’s payment and pay you out, minus our commission.',
    },
    {
      q: 'When do I get paid?',
      a: 'When the order completes. You can withdraw once you have passed the identity check and the payout rules on the Fees & Charges page.',
    },
    {
      q: 'Who pays for refunds and chargebacks?',
      a: 'You do. We may hold a reserve or take the amount from your balance, and you pay any shortfall within 14 days.',
    },
    { q: 'Can I deal with buyers outside DropMarket?', a: 'No. Taking a buyer you met here off the platform is a serious breach.' },
    {
      q: 'What about tax?',
      a: 'You handle your own tax. We report seller earnings to HMRC where the UK platform-reporting rules require it.',
    },
    { q: 'Can either side end it?', a: 'Yes, on notice. Sales already made, reserves and clawbacks are still settled.' },
  ],
}
