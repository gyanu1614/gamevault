import type { Metadata } from 'next'
import { withArticle } from '@/lib/text/article'
import { hasHubPage, getGameContentTheme } from '@/lib/content/theme'
import { isValueItemIndexable } from '@/lib/games/indexability'
import { getValuePageGate, robotsFor } from '@/lib/seo/gate/read'
import { answerSentence, withAnswer } from '@/components/values/value-answer-format'
import { VALUES_PIPELINE_GAMES } from '@/lib/value-listings/catalogs'
import { valueItemHasPage, valueListHub } from '@/lib/values/hub-config'
import { getValueItems } from '@/lib/values/data'
import { socialTitle } from '@/lib/seo/title'
import { DESC_MAX } from '@/lib/seo/fit'
import { formatTradeValue, frostsLabel } from '@/lib/adopt-me/trade-value'
import { valueItemMetaTail, valueItemMetaTitle } from '../_generic/valueListItemCopy'
import { getAdoptMePet } from './_adoptMePetData'
import { petHeadline } from './_petAnswer'
import { SAB_GAME, getBrainrot } from './_sabItemData'

export interface ItemPageProps {
  params: Promise<{
    gameSlug: string
    itemSlug: string
  }>
}

/**
 * Title, description, canonical and robots for every value item page: Adopt
 * Me pets, value-list hubs (MM2), the other values_* games, then Steal a
 * Brainrot. Unfitted — the route's generateMetadata runs it through seoMeta
 * (title ≤ 60, description ≤ 155).
 */
export async function generateItemMetadata({ params }: ItemPageProps): Promise<Metadata> {
  const { gameSlug, itemSlug } = await params

  if (gameSlug === 'adopt-me') {
    const pet = await getAdoptMePet(itemSlug)
    if (!pet) return { title: 'Value Not Found' }
    const monthYear = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    // Title leads with the pet name + "value" (the head term) and carries the
    // real-money wedge; keeps DropMarket last.
    // Bare: the layout template adds " | DropMarket" (it used to be doubled).
    // ≤ ~60 characters with the brand (the old "— Cash & Trade Value" tail ran
    // to 82 and was cut in results). The price leads the description.
    const title = `${pet.name} Value in Adopt Me (${monthYear})`
    const fr = pet.variants.find((v) => v.variant === 'FR') ?? pet.variants[0]
    // Our trade points (Frost Dragon FR = 100) in the snippet: what Adopt Me
    // searchers compare first. The price is already in the answer sentence.
    const tradeLead = fr?.tradeValue != null ? `Trade value ${formatTradeValue(fr.tradeValue)} (${frostsLabel(fr.tradeValue)}). ` : ''
    // ≤155 characters: question, price, then what the page has (seoMeta trims
    // the tail clause on long pet names, never the price).
    const gate = await getValuePageGate('adopt-me', pet.slug, true)
    const headline = petHeadline(pet)
    // The answer sentence leads the snippet (it is not shown on the page).
    const description = withAnswer(
      headline ? answerSentence({ name: `${pet.name} (${headline.label})`, valueUsd: headline.cashUsd, offers: headline.listingsTracked, updatedAt: gate.evidence?.priceMovedAt ?? null }) : null,
      `${tradeLead}Prices for all 8 forms, Normal to Mega Fly Ride, and safe offers to buy one.`,
    )
    const canonical = `/adopt-me/values/${pet.slug}`
    // Page-specific keywords targeting the uncontested long-tail the brief
    // names — "worth in real money / USD / can you sell". Per-pet, not the dead
    // site-wide stuffed string.
    const keywords = [
      `${pet.name} value`,
      `${pet.name} value adopt me`,
      `${pet.name} worth`,
      `how much is ${withArticle(pet.name)} worth`,
      `${pet.name} value in real money`,
      `${pet.name} usd value`,
      `${pet.name} fly ride value`,
      `${pet.name} neon value`,
      `${pet.name} mega neon value`,
      `sell ${pet.name} adopt me`,
      `adopt me ${pet.name} price`,
    ]
    return {
      title,
      description,
      keywords,
      alternates: { canonical },
      // The data gate (lib/games/indexability valuePageVerdict; the sitemap applies it too).
      ...robotsFor(gate),
      openGraph: {
        title: socialTitle(title),
        description,
        url: canonical,
        type: 'website',
        images: pet.imageUrl ? [pet.imageUrl] : [],
      },
    }
  }

  const listHub = hasHubPage(gameSlug, 'values') ? valueListHub(gameSlug) : null
  if (listHub) {
    const theme = getGameContentTheme(gameSlug)
    const item = (await getValueItems(gameSlug, { itemSlug })).find((i) => i.slug === itemSlug)
    const price = item?.price
    if (!item || !valueItemHasPage(gameSlug, { rarity: item.rarity, priced: price?.cheapestUsd != null })) {
      return { title: 'Value Not Found' }
    }
    const monthYear = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    const cheapest = price!.cheapestUsd!
    // The Adopt Me pattern (8× the clicks of "… — Price in USD" on Bing, 2026-10-19)
    // plus the tier players search by; the snippet says what it is and what the page has.
    const typeLabel = (item.itemType && listHub.itemTypeLabels[item.itemType]) || theme.itemNoun
    const title = valueItemMetaTitle({ name: item.name, shortName: listHub.shortName, rarity: item.rarity, typeLabel }, monthYear)
    const gate = await getValuePageGate(gameSlug, item.slug, isValueItemIndexable({ priced: true, sampleSize: price!.sampleSize }))
    const answer = answerSentence({ name: item.name, valueUsd: cheapest, offers: price!.sampleSize, updatedAt: gate.evidence?.priceMovedAt ?? null })
    const description = withAnswer(
      answer,
      valueItemMetaTail({ rarity: item.rarity, typeNoun: typeLabel.toLowerCase(), obtain: item.obtain, origin: item.origin }, DESC_MAX - (answer ? answer.length + 1 : 0)),
    )
    const canonical = `/${gameSlug}/values/${item.slug}`
    return {
      title,
      description,
      keywords: [
        `${item.name} value`,
        `${item.name} ${listHub.shortName.toLowerCase()} value`,
        `${item.name} worth`,
        `how much is ${item.name} worth`,
        `${item.name} price usd`,
        `${listHub.shortName.toLowerCase()} ${item.name} real money`,
      ],
      alternates: { canonical },
      // The shared rule: the old thin-content floor, then the data gate (the sitemap applies both).
      ...robotsFor(gate),
      openGraph: {
        title: socialTitle(title),
        description,
        url: canonical,
        type: 'website',
        images: item.imageUrl ? [item.imageUrl] : [],
      },
    }
  }

  if (VALUES_PIPELINE_GAMES.has(gameSlug)) {
    const theme = getGameContentTheme(gameSlug)
    const item = (await getValueItems(gameSlug, { itemSlug })).find((i) => i.slug === itemSlug)
    if (!item) return { title: 'Value Not Found' }
    const price = item.price
    const priced = price?.cheapestUsd != null
    // The brief's rule: fewer than 3 live listings behind a value is not
    // enough to index. Every unpriced catalogue page (all pets) is noindex too
    // — it is useful to a reader who lands on it, but it is not a ranking page.
    const thin = !priced || (price?.sampleSize ?? 0) < 3
    const gate = await getValuePageGate(gameSlug, item.slug, !thin)
    const title = priced
      ? `${item.name} Value — ${theme.name}`
      : `${item.name} — ${theme.name} ${item.rarity ? `${item.rarity} ` : ''}Pet`
    return {
      title,
      description: priced
        ? withAnswer(
            answerSentence({ name: item.name, valueUsd: price!.cheapestUsd, offers: price!.sampleSize, updatedAt: gate.evidence?.priceMovedAt ?? null }),
            `${item.name} sells for about $${price!.cheapestUsd!.toFixed(2)} in ${theme.name}, priced from ${price!.sampleSize} live marketplace listings.`,
          )
        : `${item.name} in ${theme.name}: rarity, area, income and the egg it hatches from. No market price — ${item.name} is not sold directly.`,
      alternates: { canonical: `/${gameSlug}/values/${item.slug}` },
      ...robotsFor(gate),
    }
  }

  if (!hasHubPage(gameSlug, 'values')) return { title: 'Value Not Found' }

  const brainrot = await getBrainrot(itemSlug)
  if (!brainrot) return { title: 'Brainrot Not Found' }

  // Same head phrase as Adopt Me / MM2 (owner, 2026-10-14: the game name was missing).
  const monthYear = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const title = `${brainrot.name} Value in Steal a Brainrot (${monthYear})`
  const gate = await getValuePageGate(SAB_GAME, brainrot.slug, true)
  const description = withAnswer(
    answerSentence({ name: brainrot.name, valueUsd: gate.evidence?.valueUsd, offers: gate.evidence?.observations ?? 0, updatedAt: gate.evidence?.priceMovedAt ?? null }),
    `${brainrot.name} value guide for Steal a Brainrot. See rarity, base income, mutation income, obtainability, and current DropMarket pricing.`,
  )
  const canonical = `/steal-a-brainrot/values/${brainrot.slug}`

  return {
    title,
    description,
    alternates: { canonical },
    ...robotsFor(gate),
    openGraph: {
      title: socialTitle(title),
      description,
      url: canonical,
      type: 'website',
      images: brainrot.image_url ? [brainrot.image_url] : [],
    },
  }
}
