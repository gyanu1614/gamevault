# GameVault - P2P Gaming Marketplace

A modern, secure P2P marketplace for trading gaming items, currency, accounts, and more. Built with Next.js 14, Supabase, and Stripe.

## Features

- 🎮 Multi-game support (Roblox, Fortnite, Valorant, etc.)
- 💰 Lowest fees in the industry (6.9-10.4% vs competitors' 17-26%)
- 🛡️ 30-day buyer protection
- 💬 Built-in messaging system (email notifications + polling)
- ⭐ Review and rating system
- 🔒 Secure escrow payments with Stripe
- 📱 Mobile-first responsive design
- 🌙 Dark/Light theme support

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS, Shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Functions)
- **Payments**: Stripe Connect
- **State Management**: Zustand, TanStack Query
- **Animations**: Framer Motion

## Getting Started

### 1. Install Dependencies

\`\`\`bash
npm install
\`\`\`

### 2. Set Up Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your credentials:

\`\`\`bash
cp .env.local.example .env.local
\`\`\`

You'll need:
- Supabase project URL and keys
- Stripe publishable and secret keys
- App URL (http://localhost:3000 for development)

### 3. Set Up Supabase Database

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the SQL scripts from `docs/database-schema.sql` in your Supabase SQL Editor
3. Create storage buckets: `avatars`, `listings`, `kyc-documents`

### 4. Run Development Server

\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) to see your app!

## Project Structure

\`\`\`
src/
├── app/                    # Next.js app router pages
├── components/             # Reusable UI components
│   ├── ui/                # Shadcn/ui components
│   └── providers.tsx      # React Query, Theme providers
├── features/              # Feature-based modules
│   ├── auth/             # Authentication
│   ├── listings/         # Marketplace listings
│   ├── cart/             # Shopping cart
│   ├── checkout/         # Payment flow
│   ├── messaging/        # User messaging
│   ├── seller/           # Seller dashboard & KYC
│   └── buyer/            # Buyer dashboard
├── lib/                   # Utilities and configurations
│   ├── supabase/         # Supabase clients
│   └── utils.ts          # Helper functions
└── types/                # TypeScript type definitions
\`\`\`

## Key Features Implementation

### Messaging System
- Email notifications for new messages
- 10-second polling when on messages page
- No WebSocket overhead (saves costs)
- Easy upgrade path to real-time later

### Payment Flow
- Stripe Connect for marketplace payments
- Escrow system for buyer protection
- Automatic fee calculation
- Secure webhook handling

### Seller Tiers
- Bronze → Platinum progression
- Fee reductions based on sales
- Gamification for seller retention

## Development Roadmap

### Phase 1 (Months 1-3) - MVP
- ✅ Project setup
- ⏳ Core marketplace features
- ⏳ Authentication & profiles
- ⏳ Listing creation & browsing
- ⏳ Basic checkout flow
- ⏳ Messaging system

### Phase 2 (Months 4-6) - Growth
- ⏳ KYC verification
- ⏳ Advanced search & filters
- ⏳ Seller dashboard & analytics
- ⏳ Review system
- ⏳ Referral program

### Phase 3 (Months 7-12) - Scale
- ⏳ Mobile app (React Native)
- ⏳ Auto-delivery API
- ⏳ Multi-seller orders
- ⏳ Advanced fraud detection

## Contributing

This is a private project. For questions or issues, contact the development team.

## License

Proprietary - All rights reserved
