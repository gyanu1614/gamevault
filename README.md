# GameVault — P2P Gaming Marketplace

A full-stack peer-to-peer marketplace for trading in-game items, currency, accounts, and services. Designed to compete with platforms like G2G, Eldorado.gg, and Gameflip — with lower fees, stronger buyer protection, and a modern developer experience.

## What It Does

- **18 supported games** — Roblox, Fortnite, Valorant, CS2, Genshin Impact, and more
- **Escrow payments** — Stripe Connect holds funds until delivery is confirmed
- **VaultShield buyer protection** — up to 30-day warranty on purchases
- **Seller verification & KYC** — 6-step onboarding with document upload
- **5-tier seller system** — Bronze → Platinum with commission rates from 3.9% to 6.9%
- **Real-time chat** — buyer-seller messaging with order context and delivery evidence
- **Review system** — ratings, seller responses, edit windows, and admin moderation
- **Admin dashboard** — order management, dispute resolution, seller approvals, analytics, fraud detection
- **Programmatic SEO** — dynamic landing pages for organic traffic acquisition
- **Dark-first responsive UI** — glass morphism, Framer Motion animations, mobile-optimized

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router), TypeScript |
| UI | Tailwind CSS, Shadcn/ui, Framer Motion |
| Database | Supabase PostgreSQL with Row-Level Security |
| Auth | Supabase Auth (SSR + MFA/TOTP for admins) |
| Payments | Stripe Connect (escrow, PaymentIntents, webhooks) |
| Storage | Supabase Storage (listing images, KYC docs, delivery evidence) |
| Real-time | Supabase Realtime (chat, presence, order updates) |
| State | Zustand (client), TanStack Query (server) |
| Forms | React Hook Form + Zod validation |
| Email | Resend (transactional notifications) |
| Deployment | Vercel |

## Project Structure

```
src/
├── app/
│   ├── (admin)/admin/        # Admin dashboard, disputes, sellers, analytics
│   ├── (marketplace)/        # Game pages, category listings, listing detail
│   ├── (marketing)/          # VaultShield landing page
│   ├── account/              # Buyer/seller dashboard, orders, settings, wallet
│   ├── api/                  # Stripe webhooks, cron jobs, presence
│   ├── checkout/             # Payment flow with VaultShield tier selection
│   └── shop/                 # Public seller storefronts
├── components/
│   ├── chat/                 # Real-time messaging interface
│   ├── marketplace/          # Filters, search, category pills, listing cards
│   ├── motion/               # Reusable animation components
│   ├── orders/               # Order timeline, delivery evidence, dispute UI
│   ├── reviews/              # Review cards, forms, stats, seller responses
│   ├── seller/               # Tier badges, restriction banners
│   ├── ui/                   # Shadcn + glass morphism components
│   └── vaultshield/          # Protection badges and level cards
├── hooks/                    # Custom hooks (auth, orders, sellers, wishlist)
├── lib/
│   ├── actions/              # Server actions (40+ files)
│   ├── stripe/               # Stripe Connect integration
│   ├── supabase/             # Client, server, service-role clients
│   ├── templates/            # Game-specific listing templates
│   └── utils/                # Helpers (tiers, notifications, rate limiting)
└── supabase/
    └── migrations/           # 80+ SQL migrations (schema, RLS, triggers)
```

## Database

- **80+ migrations** covering schema evolution from January to March 2026
- **Row-Level Security** on all tables — users can only access their own data
- **DB-enforced escrow state machine** — triggers prevent invalid payment transitions
- **Materialized views** for admin analytics
- **Full-text search** with trigram similarity for listing discovery
- **Audit logging** via triggers on all sensitive operations

## Local Development

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.local.example .env.local
# Fill in Supabase and Stripe keys

# Run dev server
npm run dev
```

Open http://localhost:3000

## Environment Variables

See `.env.local.example` for the full list. You'll need:
- Supabase project URL, anon key, and service role key
- Stripe publishable key, secret key, and webhook secret
- Resend API key (for email notifications)
- Cloudflare Turnstile site key (for bot protection)

## License

Proprietary — All rights reserved.
