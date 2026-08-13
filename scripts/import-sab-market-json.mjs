import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const DEFAULT_ENDPOINT =
  "https://cserfvellsliylifjkos.supabase.co/functions/v1/sab-market-import";

const SUPPORTED_SOURCES = new Set([
  "ebay",
  "eldorado",
  "g2g",
  "u7buy",
  "zeusx",
]);

function parseArgs(argv) {
  const send = argv.includes("--send");
  const input = argv.find(
    (argument) => !argument.startsWith("--"),
  );

  if (!input) {
    throw new Error("A JSON feed path is required");
  }

  return {
    send,
    inputPath: resolve(process.cwd(), input),
  };
}

function requiredString(value, field, context) {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    throw new Error(`${context}: ${field} is required`);
  }

  return value.trim();
}

function optionalNumber(
  value,
  fallback,
  field,
  context,
) {
  if (value == null || value === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(
      `${context}: ${field} must be numeric`,
    );
  }

  return parsed;
}

function normalizeListing(
  raw,
  inheritedSource,
  index,
) {
  const context = `Listing ${index + 1}`;

  const sourceSlug = String(
    raw.source_slug ?? inheritedSource ?? "",
  )
    .trim()
    .toLowerCase();

  if (!SUPPORTED_SOURCES.has(sourceSlug)) {
    throw new Error(
      `${context}: unsupported source_slug "${sourceSlug}"`,
    );
  }

  const listingType = requiredString(
    raw.listing_type,
    "listing_type",
    context,
  ).toLowerCase();

  const listingStatus = requiredString(
    raw.listing_status,
    "listing_status",
    context,
  ).toLowerCase();

  if (
    listingType !== "active_listing" &&
    listingType !== "completed_sale"
  ) {
    throw new Error(
      `${context}: listing_type must be active_listing or completed_sale`,
    );
  }

  if (
    listingType === "active_listing" &&
    listingStatus !== "active"
  ) {
    throw new Error(
      `${context}: active listings must have status active`,
    );
  }

  if (
    listingType === "completed_sale" &&
    !["sold", "ended"].includes(listingStatus)
  ) {
    throw new Error(
      `${context}: completed sales must have status sold or ended`,
    );
  }

  const listingUrl = new URL(
    requiredString(
      raw.listing_url,
      "listing_url",
      context,
    ),
  );

  if (listingUrl.protocol !== "https:") {
    throw new Error(
      `${context}: listing_url must use HTTPS`,
    );
  }

  const listedPrice = optionalNumber(
    raw.listed_price,
    null,
    "listed_price",
    context,
  );

  if (
    listedPrice == null ||
    listedPrice <= 0
  ) {
    throw new Error(
      `${context}: listed_price must be greater than zero`,
    );
  }

  const shippingPrice = optionalNumber(
    raw.shipping_price,
    0,
    "shipping_price",
    context,
  );

  const quantity = optionalNumber(
    raw.quantity,
    1,
    "quantity",
    context,
  );

  if (
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    throw new Error(
      `${context}: quantity must be a positive whole number`,
    );
  }

  const totalPriceUsd = optionalNumber(
    raw.total_price_usd,
    listedPrice + shippingPrice,
    "total_price_usd",
    context,
  );

  if (totalPriceUsd <= 0) {
    throw new Error(
      `${context}: total_price_usd must be greater than zero`,
    );
  }

  const observedAt = new Date(
    requiredString(
      raw.observed_at,
      "observed_at",
      context,
    ),
  );

  if (Number.isNaN(observedAt.getTime())) {
    throw new Error(
      `${context}: observed_at must be a valid ISO timestamp`,
    );
  }

  return {
    sourceSlug,
    listing: {
      external_listing_id: requiredString(
        raw.external_listing_id,
        "external_listing_id",
        context,
      ),
      listing_url: listingUrl.toString(),
      listing_type: listingType,
      listing_status: listingStatus,
      title: requiredString(
        raw.title,
        "title",
        context,
      ),
      currency: String(raw.currency ?? "USD")
        .trim()
        .toUpperCase(),
      listed_price: listedPrice,
      shipping_price: shippingPrice,
      quantity,
      total_price_usd: totalPriceUsd,
      observed_at: observedAt.toISOString(),

      ...optionalSignals(raw),
    },
  };
}

/**
 * Optional collector-supplied enrichment, passed through to the listing.
 *
 * The listing above is a strict whitelist, which is why seller data never
 * reached the database even though the collector was already parsing it — the
 * fields were silently dropped here. These are the sanctioned extras. They
 * land in sab_market_raw_listings.raw_payload, which the import RPC fills with
 * the whole incoming item, so no database change is needed to store them.
 *
 * Still whitelisted and bounded rather than spread wholesale: a feed is
 * untrusted input, and the point of this function is to widen the gate by
 * exactly four fields, not to remove it.
 */
const SIGNAL_STRING_FIELDS = [
  "seller_reference",
  "collector_version",
  // Seller trust identity (point 4): who is selling and how old the account is.
  "seller_id",
  "seller_username",
  "seller_created_date",
];
const SIGNAL_NUMBER_FIELDS = [
  "seller_rating",
  "seller_sales_count",
  "seller_account_age_days",
];
const MAX_SIGNAL_STRING_LENGTH = 80;

function optionalSignals(raw) {
  const signals = {};

  for (const field of SIGNAL_STRING_FIELDS) {
    const value = raw[field];
    if (typeof value === "string" && value.trim()) {
      signals[field] = value.trim().slice(0, MAX_SIGNAL_STRING_LENGTH);
    }
  }

  for (const field of SIGNAL_NUMBER_FIELDS) {
    if (raw[field] == null) continue;
    const value = Number(raw[field]);
    if (Number.isFinite(value) && value >= 0) signals[field] = value;
  }

  for (const field of ["source_signals", "income_band"]) {
    const value = raw[field];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      signals[field] = value;
    }
  }

  return signals;
}

/**
 * Title-quality reject list (points 2 + 3).
 *
 * Applied to every source in the importer, so it protects the whole pipeline
 * regardless of which collector produced the feed. A rejected listing is
 * DROPPED, not fatal — one toy or scam title must not abort a 10k-row import.
 *
 * Returns a rejection reason string, or null if the title is clean.
 */
const REJECT_PATTERNS = [
  // Point 2: toys / merch / non-item listings named after the Brainrot.
  { reason: "toy_or_merch", re: /\b(plush(ie)?|toy|figure|figurine|keychain|sticker|poster|mug|shirt|hoodie|merch)\b/i },
  // Point 2: bundles / accounts / multi-item — not a single-item price.
  { reason: "bundle_or_account", re: /\b(bundle|pack|combo|lot|account|acc\b|full\s+game|starter|mega|giant\s+set|all\s+brainrots)\b/i },
  // Point 2: age/stage listings (leftover from other games' schemas).
  { reason: "age_or_stage", re: /\b(newborn|junior|pre.?teen|full.?grown|mega.?neon|neon)\b/i },
  // Point 3: scam "add me in-game" bait.
  { reason: "scam_add_me", re: /\b(add\s+me|you\s+need\s+to\s+add|friend\s+request|friend\s+me|dm\s+me\s+first|dm\s+first|message\s+me\s+first|read\s+desc|check\s+desc|go\s+first)\b/i },
];

function titleRejectReason(title) {
  const text = String(title ?? "");
  for (const { reason, re } of REJECT_PATTERNS) {
    if (re.test(text)) return reason;
  }
  return null;
}

function flattenFeed(payload) {
  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    Array.isArray(payload.listings)
  ) {
    return payload.listings.map((listing) => ({
      raw: listing,
      sourceSlug: payload.source_slug,
    }));
  }

  if (!Array.isArray(payload)) {
    throw new Error(
      "Feed must be an object with listings or an array",
    );
  }

  const rows = [];

  for (const entry of payload) {
    if (
      entry &&
      typeof entry === "object" &&
      Array.isArray(entry.listings)
    ) {
      for (const listing of entry.listings) {
        rows.push({
          raw: listing,
          sourceSlug: entry.source_slug,
        });
      }
    } else {
      rows.push({
        raw: entry,
        sourceSlug: entry?.source_slug,
      });
    }
  }

  return rows;
}

function groupBySource(records) {
  const groups = new Map();

  for (const record of records) {
    const listings =
      groups.get(record.sourceSlug) ?? [];

    listings.push(record.listing);
    groups.set(record.sourceSlug, listings);
  }

  return groups;
}

async function sendBatch({
  endpoint,
  secret,
  sourceSlug,
  listings,
  // When false, the server inserts the listings but skips the heavy full-dataset
  // republish. We publish exactly once after the final batch. Defaults to true.
  publish = true,
}) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-import-secret": secret,
    },
    body: JSON.stringify({
      source_slug: sourceSlug,
      listings,
      publish,
    }),
  });

  const responseText = await response.text();
  let responseBody;

  try {
    responseBody = JSON.parse(responseText);
  } catch {
    responseBody = {
      ok: false,
      error:
        responseText ||
        `HTTP ${response.status}`,
    };
  }

  if (
    !response.ok ||
    responseBody.ok !== true
  ) {
    throw new Error(
      `${sourceSlug} import failed: ${
        responseBody.details ??
        responseBody.error ??
        `HTTP ${response.status}`
      }`,
    );
  }

  return responseBody;
}

async function main() {
  const { send, inputPath } = parseArgs(
    process.argv.slice(2),
  );

  const payload = JSON.parse(
    await readFile(inputPath, "utf8"),
  );

  const flattened = flattenFeed(payload);

  if (flattened.length === 0) {
    throw new Error("Feed contains no listings");
  }

  // Drop toy/bundle/scam titles before validation (points 2 + 3). Counted, not
  // fatal — noise gets skipped, the rest of the feed imports normally.
  const rejectCounts = {};
  const cleaned = flattened.filter(({ raw }) => {
    const reason = titleRejectReason(raw?.title);
    if (reason) {
      rejectCounts[reason] = (rejectCounts[reason] ?? 0) + 1;
      return false;
    }
    return true;
  });

  const rejectedTotal = flattened.length - cleaned.length;
  if (rejectedTotal > 0) {
    console.log(
      `Dropped ${rejectedTotal} listing(s) on title quality: ${JSON.stringify(rejectCounts)}`,
    );
  }

  const records = cleaned.map(
    ({ raw, sourceSlug }, index) =>
      normalizeListing(
        raw,
        sourceSlug,
        index,
      ),
  );

  const duplicateKeys = new Set();

  for (const record of records) {
    const key =
      `${record.sourceSlug}:` +
      record.listing.external_listing_id;

    if (duplicateKeys.has(key)) {
      throw new Error(
        `Duplicate source/listing key: ${key}`,
      );
    }

    duplicateKeys.add(key);
  }

  const groups = groupBySource(records);

  console.log(
    `Validated ${records.length.toLocaleString()} listing(s).`,
  );

  for (const [sourceSlug, listings] of groups) {
    console.log(
      `${sourceSlug}: ${listings.length.toLocaleString()} listing(s)`,
    );
  }

  if (!send) {
    console.log(
      "\nDry run complete. Nothing was imported. Add --send to upload.",
    );
    return;
  }

  const secret =
    process.env.SAB_MARKET_IMPORT_SECRET;

  if (!secret) {
    throw new Error(
      "SAB_MARKET_IMPORT_SECRET is required with --send",
    );
  }

  const endpoint =
    process.env.SAB_MARKET_IMPORT_URL ??
    DEFAULT_ENDPOINT;

  // Insert every batch WITHOUT publishing — the server's publish step re-runs a
  // full-dataset aggregation, so publishing on each 500-row batch means dozens
  // of full recomputes per crawl and intermittently trips the Postgres
  // statement timeout (57014). We insert everything first, then publish ONCE at
  // the end. We still track the last (source, listings) batch to publish on:
  // an empty final publish would be a wasted recompute, so we publish by
  // re-sending the final batch with publish:true (idempotent upsert).
  const batchPlan = [];
  for (const [sourceSlug, listings] of groups) {
    for (
      let batchStart = 0;
      batchStart < listings.length;
      batchStart += 500
    ) {
      batchPlan.push({
        sourceSlug,
        batch: listings.slice(batchStart, batchStart + 500),
        label: `${sourceSlug} batch ${Math.floor(batchStart / 500) + 1}`,
      });
    }
  }

  for (let i = 0; i < batchPlan.length; i += 1) {
    const { sourceSlug, batch, label } = batchPlan[i];
    // Publish only on the very last batch of the whole import.
    const isFinal = i === batchPlan.length - 1;

    const response = await sendBatch({
      endpoint,
      secret,
      sourceSlug,
      listings: batch,
      publish: isFinal,
    });

    console.log(`\n${label}${isFinal ? " (final — publishing)" : ""}:`);
    console.log(JSON.stringify(response.result, null, 2));

    if (response.publication) {
      console.log(
        "Publication:",
        JSON.stringify(response.publication, null, 2),
      );
    }

    if (response.revalidation) {
      console.log(
        "Revalidation:",
        JSON.stringify(response.revalidation, null, 2),
      );
    }
  }

  console.log(
    "\nBulk import completed successfully.",
  );
}

main().catch((error) => {
  console.error(
    `\nBulk import failed: ${error.message}`,
  );
  process.exitCode = 1;
});
