/**
 * Dev-only harness: render the sell wizard without the auth redirect, so
 * its layout can be checked in a browser. `/dev/*` 404s in production via
 * the shared DevLayout gate.
 *
 * Categories are the real five from `global_categories` (the taxonomy is
 * fixed — see CLAUDE.md), so the step-1 grid renders at its true width
 * and tile count rather than against invented data.
 */

import SellWizard from '@/app/(sell)/_components/SellWizard'
import { HeroBackdrop, HeroBackdropPreload } from '@/components/hero-backdrop'
import type { GlobalCategory } from '@/lib/actions/new-schema'

const CATEGORIES: GlobalCategory[] = [
  {
    id: 'c1',
    slug: 'currency',
    name: 'Currency',
    description: 'Robux, Gold',
    icon_url: null,
    icon_emoji: null,
    sort_order: 1,
    is_active: true,
    seo_title: null,
    seo_description: null,
  },
  {
    id: 'c2',
    slug: 'items',
    name: 'Items',
    description: 'Pets, Skins, Gear',
    icon_url: null,
    icon_emoji: null,
    sort_order: 2,
    is_active: true,
    seo_title: null,
    seo_description: null,
  },
  {
    id: 'c3',
    slug: 'accounts',
    name: 'Accounts',
    description: 'Ranked, Progressed',
    icon_url: null,
    icon_emoji: null,
    sort_order: 3,
    is_active: true,
    seo_title: null,
    seo_description: null,
  },
  {
    id: 'c4',
    slug: 'top-up',
    name: 'Top Up',
    description: 'Crystals, UC',
    icon_url: null,
    icon_emoji: null,
    sort_order: 4,
    is_active: true,
    seo_title: null,
    seo_description: null,
  },
]

export default function SellWizardPreview() {
  // Mirrors the real (sell) layout so the backdrop and dim match.
  return (
    <>
      <HeroBackdropPreload name="sell" />
      <HeroBackdrop name="sell" className="hero-dim overflow-hidden text-text-primary">
        <SellWizard initialCategories={CATEGORIES} />
      </HeroBackdrop>
    </>
  )
}
