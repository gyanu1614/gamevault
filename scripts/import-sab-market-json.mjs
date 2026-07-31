import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const DEFAULT_ENDPOINT =
  "https://cserfvellsliylifjkos.supabase.co/functions/v1/sab-market-import";

const SUPPORTED_SOURCES = new Set([
  "ebay",
  "eldorado",
  "itemku",
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
const SIGNAL_STRING_FIELDS = ["seller_reference", "collector_version"];
const SIGNAL_NUMBER_FIELDS = ["seller_rating", "seller_sales_count"];
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

  const records = flattened.map(
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

  for (const [sourceSlug, listings] of groups) {
    for (
      let batchStart = 0;
      batchStart < listings.length;
      batchStart += 500
    ) {
      const batch = listings.slice(
        batchStart,
        batchStart + 500,
      );

      const response = await sendBatch({
        endpoint,
        secret,
        sourceSlug,
        listings: batch,
      });

      console.log(
        `\n${sourceSlug} batch ${
          Math.floor(batchStart / 500) + 1
        }:`,
      );

      console.log(
        JSON.stringify(
          response.result,
          null,
          2,
        ),
      );

      if (response.publication) {
        console.log(
          "Publication:",
          JSON.stringify(
            response.publication,
            null,
            2,
          ),
        );
      }

      if (response.revalidation) {
        console.log(
          "Revalidation:",
          JSON.stringify(
            response.revalidation,
            null,
            2,
          ),
        );
      }
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
