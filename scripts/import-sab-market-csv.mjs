import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const DEFAULT_ENDPOINT =
  "https://cserfvellsliylifjkos.supabase.co/functions/v1/sab-market-import";

const SOURCE_DOMAINS = new Map([
  ["ebay", ["ebay.com"]],
  ["eldorado", ["eldorado.gg"]],
  ["itemku", ["itemku.com"]],
  ["g2g", ["g2g.com"]],
  ["u7buy", ["u7buy.com"]],
  ["zeusx", ["zeusx.com"]],
]);

const REQUIRED_COLUMNS = [
  "source_slug",
  "external_listing_id",
  "listing_url",
  "listing_type",
  "listing_status",
  "title",
  "currency",
  "listed_price",
  "shipping_price",
  "quantity",
  "total_price_usd",
  "observed_at",
];

function printUsage() {
  console.log(`
Usage:
  node scripts/import-sab-market-csv.mjs <file.csv>
  node scripts/import-sab-market-csv.mjs <file.csv> --send

Default behavior:
  Validates and previews the CSV without importing anything.

Required environment variable when using --send:
  SAB_MARKET_IMPORT_SECRET

Optional environment variable:
  SAB_MARKET_IMPORT_URL
`);
}

function parseArguments(argv) {
  const send = argv.includes("--send");
  const filePath = argv.find((argument) => !argument.startsWith("--"));

  if (!filePath) {
    printUsage();
    throw new Error("CSV file path is required");
  }

  return {
    filePath: resolve(process.cwd(), filePath),
    send,
  };
}

function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = "";
  let insideQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (insideQuotes) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          insideQuotes = false;
        }
      } else {
        field += character;
      }

      continue;
    }

    if (character === '"') {
      if (field.length !== 0) {
        throw new Error(
          "Invalid CSV: quote appeared in the middle of an unquoted field",
        );
      }

      insideQuotes = true;
      continue;
    }

    if (character === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (character === "\r") {
      continue;
    }

    field += character;
  }

  if (insideQuotes) {
    throw new Error("Invalid CSV: an quoted field was not closed");
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((candidate) =>
    candidate.some((value) => value.trim() !== "")
  );
}

function convertRowsToRecords(rows) {
  if (rows.length < 2) {
    throw new Error(
      "CSV must contain a header and at least one listing",
    );
  }

  const headers = rows[0].map((header, index) => {
    const cleanHeader = index === 0
      ? header.replace(/^\uFEFF/, "")
      : header;

    return cleanHeader.trim();
  });

  const duplicateHeaders = headers.filter(
    (header, index) => headers.indexOf(header) !== index,
  );

  if (duplicateHeaders.length > 0) {
    throw new Error(
      `Duplicate CSV columns: ${[...new Set(duplicateHeaders)].join(", ")}`,
    );
  }

  const missingColumns = REQUIRED_COLUMNS.filter(
    (column) => !headers.includes(column),
  );

  if (missingColumns.length > 0) {
    throw new Error(
      `Missing required columns: ${missingColumns.join(", ")}`,
    );
  }

  return rows.slice(1).map((values, rowIndex) => {
    if (values.length > headers.length) {
      throw new Error(
        `Row ${rowIndex + 2} has more fields than the header`,
      );
    }

    return Object.fromEntries(
      headers.map((header, columnIndex) => [
        header,
        values[columnIndex]?.trim() ?? "",
      ]),
    );
  });
}

function parseRequiredNumber(value, fieldName, rowNumber) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(
      `Row ${rowNumber}: ${fieldName} must be a valid number`,
    );
  }

  return parsed;
}

function hostMatchesDomain(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function validateRecord(record, rowNumber, duplicateKeys) {
  const sourceSlug = record.source_slug.toLowerCase();

  if (!SOURCE_DOMAINS.has(sourceSlug)) {
    throw new Error(
      `Row ${rowNumber}: unsupported source_slug "${record.source_slug}"`,
    );
  }

  if (
    !record.external_listing_id ||
    record.external_listing_id === "replace-with-listing-id"
  ) {
    throw new Error(
      `Row ${rowNumber}: external_listing_id must be the real marketplace listing ID`,
    );
  }

  const duplicateKey =
    `${sourceSlug}:${record.external_listing_id}`;

  if (duplicateKeys.has(duplicateKey)) {
    throw new Error(
      `Row ${rowNumber}: duplicate source/listing ID ${duplicateKey}`,
    );
  }

  duplicateKeys.add(duplicateKey);

  let listingUrl;

  try {
    listingUrl = new URL(record.listing_url);
  } catch {
    throw new Error(
      `Row ${rowNumber}: listing_url is not a valid URL`,
    );
  }

  if (listingUrl.protocol !== "https:") {
    throw new Error(
      `Row ${rowNumber}: listing_url must use HTTPS`,
    );
  }

  const allowedDomains = SOURCE_DOMAINS.get(sourceSlug);
  const validDomain = allowedDomains.some((domain) =>
    hostMatchesDomain(listingUrl.hostname.toLowerCase(), domain)
  );

  if (!validDomain) {
    throw new Error(
      `Row ${rowNumber}: listing_url does not belong to ${sourceSlug}`,
    );
  }

  const listingType = record.listing_type.toLowerCase();
  const listingStatus = record.listing_status.toLowerCase();

  if (
    listingType !== "active_listing" &&
    listingType !== "completed_sale"
  ) {
    throw new Error(
      `Row ${rowNumber}: listing_type must be active_listing or completed_sale`,
    );
  }

  if (
    listingType === "active_listing" &&
    listingStatus !== "active"
  ) {
    throw new Error(
      `Row ${rowNumber}: active listings must have listing_status active`,
    );
  }

  if (
    listingType === "completed_sale" &&
    !["sold", "ended"].includes(listingStatus)
  ) {
    throw new Error(
      `Row ${rowNumber}: completed sales must have listing_status sold or ended`,
    );
  }

  if (record.title.length < 3 || record.title.length > 500) {
    throw new Error(
      `Row ${rowNumber}: title must contain 3–500 characters`,
    );
  }

  const currency = record.currency.toUpperCase();

  if (currency !== "USD") {
    throw new Error(
      `Row ${rowNumber}: only USD listings are currently supported`,
    );
  }

  const listedPrice = parseRequiredNumber(
    record.listed_price,
    "listed_price",
    rowNumber,
  );

  const shippingPrice = record.shipping_price === ""
    ? 0
    : parseRequiredNumber(
        record.shipping_price,
        "shipping_price",
        rowNumber,
      );

  const quantity = record.quantity === ""
    ? 1
    : parseRequiredNumber(
        record.quantity,
        "quantity",
        rowNumber,
      );

  const totalPriceUsd = record.total_price_usd === ""
    ? listedPrice + shippingPrice
    : parseRequiredNumber(
        record.total_price_usd,
        "total_price_usd",
        rowNumber,
      );

  if (listedPrice <= 0) {
    throw new Error(
      `Row ${rowNumber}: listed_price must be greater than zero`,
    );
  }

  if (shippingPrice < 0) {
    throw new Error(
      `Row ${rowNumber}: shipping_price cannot be negative`,
    );
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error(
      `Row ${rowNumber}: quantity must be a positive whole number`,
    );
  }

  if (totalPriceUsd <= 0) {
    throw new Error(
      `Row ${rowNumber}: total_price_usd must be greater than zero`,
    );
  }

  const observedAt = new Date(record.observed_at);

  if (Number.isNaN(observedAt.getTime())) {
    throw new Error(
      `Row ${rowNumber}: observed_at must be a valid ISO timestamp`,
    );
  }

  const tenMinutesFromNow = Date.now() + 10 * 60 * 1000;

  if (observedAt.getTime() > tenMinutesFromNow) {
    throw new Error(
      `Row ${rowNumber}: observed_at cannot be in the future`,
    );
  }

  return {
    sourceSlug,
    listing: {
      external_listing_id: record.external_listing_id,
      listing_url: listingUrl.toString(),
      listing_type: listingType,
      listing_status: listingStatus,
      title: record.title,
      currency,
      listed_price: listedPrice,
      shipping_price: shippingPrice,
      quantity,
      total_price_usd: totalPriceUsd,
      observed_at: observedAt.toISOString(),
    },
  };
}

function groupBySource(validatedRecords) {
  const groups = new Map();

  for (const record of validatedRecords) {
    const listings = groups.get(record.sourceSlug) ?? [];
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
      error: responseText || `HTTP ${response.status}`,
    };
  }

  if (!response.ok || responseBody.ok !== true) {
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
  const { filePath, send } = parseArguments(
    process.argv.slice(2),
  );

  const fileContents = await readFile(filePath, "utf8");
  const rows = parseCsv(fileContents);
  const records = convertRowsToRecords(rows);

  const duplicateKeys = new Set();

  const validatedRecords = records.map((record, index) =>
    validateRecord(record, index + 2, duplicateKeys)
  );

  const groups = groupBySource(validatedRecords);

  console.log(`Validated ${validatedRecords.length} listing(s).`);

  for (const [sourceSlug, listings] of groups) {
    const activeCount = listings.filter(
      (listing) => listing.listing_type === "active_listing",
    ).length;

    const completedCount = listings.filter(
      (listing) => listing.listing_type === "completed_sale",
    ).length;

    console.log(
      `${sourceSlug}: ${listings.length} total, ` +
      `${activeCount} active, ${completedCount} completed`,
    );
  }

  if (!send) {
    console.log(
      "\nDry run complete. Nothing was imported. Add --send to upload.",
    );
    return;
  }

  const secret = process.env.SAB_MARKET_IMPORT_SECRET;

  if (!secret) {
    throw new Error(
      "SAB_MARKET_IMPORT_SECRET is required when using --send",
    );
  }

  const endpoint =
    process.env.SAB_MARKET_IMPORT_URL ?? DEFAULT_ENDPOINT;

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
        `${sourceSlug} batch ${
          Math.floor(batchStart / 500) + 1
        }:`,
      );

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
  }

  console.log("\nImport completed successfully.");
}

main().catch((error) => {
  console.error(`\nImport failed: ${error.message}`);
  process.exitCode = 1;
});
