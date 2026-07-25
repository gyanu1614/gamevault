import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

const SOURCE_SLUG = "eldorado";
const BASE_URL = "https://www.eldorado.gg";
const CATEGORY_ID = "259";
const DEFAULT_OUTPUT = "data/sab-market-feeds/eldorado-api-latest.json";
const DEFAULT_PROGRESS = "data/sab-market-feeds/eldorado-api-progress.json";
const COLLECTOR_VERSION = 6;

function parseArgs(argv) {
  const options = {
    maxBrainrots: Number(process.env.ELDORADO_MAX_BRAINROTS ?? 5),
    samplesPerVariant: Number(process.env.ELDORADO_SAMPLES_PER_VARIANT ?? 8),
    delayMs: Number(process.env.ELDORADO_DELAY_MS ?? 2500),
    outputPath: DEFAULT_OUTPUT,
    progressPath: DEFAULT_PROGRESS,
    brainrot: null,
    headed: false,
    send: false,
    resetProgress: false,
    saveApi: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--headed") options.headed = true;
    else if (argument === "--send") options.send = true;
    else if (argument === "--reset-progress") options.resetProgress = true;
    else if (argument === "--save-api") options.saveApi = true;
    else {
      const value = argv[index + 1];
      if (!value) throw new Error(`Missing value for ${argument}`);
      if (argument === "--max-brainrots") options.maxBrainrots = Number(value);
      else if (argument === "--samples-per-variant") options.samplesPerVariant = Number(value);
      else if (argument === "--delay-ms") options.delayMs = Number(value);
      else if (argument === "--output") options.outputPath = value;
      else if (argument === "--progress") options.progressPath = value;
      else if (argument === "--brainrot") options.brainrot = value.trim();
      else throw new Error(`Unknown argument: ${argument}`);
      index += 1;
    }
  }

  if (!Number.isInteger(options.maxBrainrots) || options.maxBrainrots < 1 || options.maxBrainrots > 250) {
    throw new Error("--max-brainrots must be an integer from 1 to 250");
  }
  if (!Number.isInteger(options.samplesPerVariant) || options.samplesPerVariant < 5 || options.samplesPerVariant > 25) {
    throw new Error("--samples-per-variant must be an integer from 5 to 25");
  }
  if (!Number.isInteger(options.delayMs) || options.delayMs < 1000 || options.delayMs > 60000) {
    throw new Error("--delay-ms must be from 1000 to 60000");
  }

  options.outputPath = resolve(process.cwd(), options.outputPath);
  options.progressPath = resolve(process.cwd(), options.progressPath);
  return options;
}


const compact = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const comparable = (value) => compact(value)
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();
const sleep = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds));
const hash = (value) => createHash("sha256").update(value).digest("hex").slice(0, 24);

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function supabaseRows(table, select, order) {
  const base = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const url = new URL(`/rest/v1/${table}`, base);
  url.searchParams.set("select", select);
  if (order) url.searchParams.set("order", order);
  const response = await fetch(url, {
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Supabase ${table} query failed (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

async function buildQueue(requestedName) {
  const [brainrots, prices, mutations, calculatorRows] = await Promise.all([
    supabaseRows(
      "sab_brainrot_catalog",
      "id,name,slug,rarity,base_income_per_second",
      "name.asc",
    ),
    supabaseRows("sab_public_price_catalog", "brainrot_id,mutation_slug,confidence_label,external_sample_size,source_count"),
    supabaseRows("sab_mutation_catalog", "id,name,slug,income_multiplier", "income_multiplier.asc"),
    supabaseRows(
      "sab_brainrot_mutation_calculator",
      "brainrot_id,mutation_id,calculated_income_per_second,is_verified_variant",
    ),
  ]);

  const defaultPrices = new Map(
    prices
      .filter((row) => row.mutation_slug === "default")
      .map((row) => [row.brainrot_id, row]),
  );

  let queue = brainrots.map((brainrot) => {
    const price = defaultPrices.get(brainrot.id);
    const confidence = price?.confidence_label ?? "missing";
    return {
      ...brainrot,
      current_confidence: confidence,
      current_sample_size: Number(price?.external_sample_size ?? 0),
      current_source_count: Number(price?.source_count ?? 0),
      priority: confidence === "missing" ? 0 : confidence === "low" ? 1 : 2,
    };
  });

  if (requestedName) {
    const requested = comparable(requestedName);
    queue = queue.filter((row) =>
      comparable(row.name) === requested || comparable(row.slug) === requested,
    );
    if (!queue.length) throw new Error(`Brainrot not found: ${requestedName}`);
  } else {
    queue = queue.filter((row) => row.priority < 2);
  }

  queue.sort((left, right) =>
    left.priority - right.priority ||
    left.name.localeCompare(right.name, "en", { sensitivity: "base" }),
  );

  const verifiedIncomeByVariant = new Map(
    calculatorRows
      .filter((row) => row.is_verified_variant === true)
      .map((row) => [
        `${row.brainrot_id}:${row.mutation_id}`,
        Number(row.calculated_income_per_second),
      ])
      .filter(([, income]) => Number.isFinite(income) && income > 0),
  );

  const expectedIncomeByVariant = new Map();

  for (const brainrot of brainrots) {
    const baseIncome = Number(brainrot.base_income_per_second);
    if (!Number.isFinite(baseIncome) || baseIncome <= 0) continue;

    for (const mutation of mutations) {
      const key = `${brainrot.id}:${mutation.id}`;
      const verifiedIncome = verifiedIncomeByVariant.get(key);
      const multiplier = Number(mutation.income_multiplier);
      const calculatedIncome = verifiedIncome ?? (
        Number.isFinite(multiplier) && multiplier > 0
          ? baseIncome * multiplier
          : null
      );

      if (Number.isFinite(calculatedIncome) && calculatedIncome > 0) {
        expectedIncomeByVariant.set(key, calculatedIncome);
      }
    }
  }

  return {
    queue,
    mutations,
    expectedIncomeByVariant,
    totals: {
      catalog: brainrots.length,
      public_price_rows: prices.length,
      missing_default_prices: queue.filter((row) => row.current_confidence === "missing").length,
      low_default_prices: queue.filter((row) => row.current_confidence === "low").length,
    },
  };
}

async function readProgress(path, reset) {
  if (reset || !existsSync(path)) {
    return { version: 1, updated_at: new Date().toISOString(), attempts: {} };
  }
  const parsed = JSON.parse(await readFile(path, "utf8"));
  return { version: 1, updated_at: parsed.updated_at, attempts: parsed.attempts ?? {} };
}

async function writeProgress(path, progress) {
  progress.updated_at = new Date().toISOString();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(progress, null, 2)}\n`, "utf8");
}

function dedicatedPageUrl(brainrot) {
  return `${BASE_URL}/${brainrot.slug}-for-sale/i/${CATEGORY_ID}`;
}

function parseMoney(value) {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== "string") return null;
  const match = value.match(/(?:USD\s*|\$\s*)?([0-9][0-9,]*(?:\.[0-9]{1,4})?)/i);
  if (!match) return null;
  const parsed = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function flattenLeaves(value, path = [], output = [], depth = 0) {
  if (depth > 8 || output.length > 2000) return output;
  if (Array.isArray(value)) {
    value.slice(0, 30).forEach((entry, index) =>
      flattenLeaves(entry, [...path, String(index)], output, depth + 1),
    );
    return output;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      flattenLeaves(entry, [...path, key], output, depth + 1);
    }
    return output;
  }
  output.push({ path: path.join("."), value });
  return output;
}

function selectOfferId(leaves) {
  const candidates = leaves
    .filter(({ value }) =>
      (typeof value === "string" || typeof value === "number") &&
      /^[0-9a-f-]{8,}$/i.test(String(value)),
    )
    .map((leaf) => {
      const path = leaf.path.toLowerCase();
      let score = 50;
      if (/offer(id|identifier|uuid)?$/.test(path.replace(/\./g, ""))) score = 0;
      else if (/(^|\.)offer(id|identifier|uuid)$/.test(path)) score = 1;
      else if (/(^|\.)id$/.test(path) && path.split(".").length <= 3) score = 8;
      else if (/seller|user|game|image|delivery|rating/.test(path)) score = 100;
      return { ...leaf, score };
    })
    .filter((leaf) => leaf.score < 100)
    .sort((left, right) => left.score - right.score || left.path.length - right.path.length);
  return candidates[0] ? String(candidates[0].value) : null;
}

function selectPrice(leaves) {
  const priorities = [
    /priceperunit/i,
    /unitprice/i,
    /offerprice/i,
    /minimumpurchaseprice/i,
    /purchaseprice/i,
    /(^|\.)price(\.|$)/i,
    /amount/i,
  ];
  const candidates = [];
  for (const leaf of leaves) {
    const path = leaf.path;
    if (!/price|amount/i.test(path)) continue;
    if (/median|fee|count|rating|score|discount|delivery|withdraw/i.test(path)) continue;
    const value = parseMoney(leaf.value);
    if (value == null) continue;
    let priority = priorities.findIndex((pattern) => pattern.test(path));
    if (priority < 0) priority = priorities.length;
    candidates.push({ value, path, priority });
  }
  candidates.sort((left, right) => left.priority - right.priority || left.path.length - right.path.length);
  return candidates[0] ?? null;
}

function objectText(leaves) {
  return compact(
    leaves
      .filter(({ value, path }) =>
        typeof value === "string" &&
        value.length <= 500 &&
        !/^https?:/i.test(value) &&
        !/image|avatar|location|currency|locale|created|updated/i.test(path),
      )
      .map(({ value }) => value)
      .join(" "),
  ).slice(0, 1800);
}

const INCOME_UNIT_MULTIPLIERS = {
  k: 1_000,
  m: 1_000_000,
  b: 1_000_000_000,
  t: 1_000_000_000_000,
};

function parseIncomeRanges(text) {
  const ranges = [];
  const normalized = compact(text);
  const rangePattern = /\b([0-9]+(?:\.[0-9]+)?)\s*-\s*([0-9]+(?:\.[0-9]+)?)\s*([KMBT])\s*\/s\b/gi;
  const singlePattern = /\b([0-9]+(?:\.[0-9]+)?)\s*([KMBT])\s*\/s\b/gi;

  for (const match of normalized.matchAll(rangePattern)) {
    const multiplier = INCOME_UNIT_MULTIPLIERS[match[3].toLowerCase()];
    ranges.push({
      lower: Number(match[1]) * multiplier,
      upper: Number(match[2]) * multiplier,
      label: match[0],
      kind: "range",
    });
  }

  if (ranges.length > 0) return ranges;

  for (const match of normalized.matchAll(singlePattern)) {
    const multiplier = INCOME_UNIT_MULTIPLIERS[match[2].toLowerCase()];
    const value = Number(match[1]) * multiplier;
    ranges.push({
      lower: value * 0.9,
      upper: value * 1.1,
      label: match[0],
      kind: "single",
    });
  }

  return ranges;
}

function incomeMatchesExpected(ranges, expectedIncome) {
  if (!Number.isFinite(expectedIncome) || expectedIncome <= 0) return false;
  const epsilon = Math.max(expectedIncome * 0.005, 1);
  return ranges.some((range) =>
    expectedIncome + epsilon >= range.lower &&
    expectedIncome - epsilon <= range.upper,
  );
}

function detectMutation(text, mutations) {
  const normalized = comparable(text).replace(/_/g, " ");
  const defaultMutation = mutations.find((row) => row.slug === "default") ?? {
    id: null,
    name: "None",
    slug: "default",
  };
  if (/(^|\s)(none|default|no mutation)(\s|$)/.test(normalized)) return defaultMutation;

  const sorted = mutations
    .filter((row) => row.slug !== "default")
    .sort((left, right) => right.name.length - left.name.length);
  return sorted.find((row) => {
    const name = comparable(row.name);
    return normalized.includes(` ${name} `) || normalized.startsWith(`${name} `) || normalized.endsWith(` ${name}`);
  }) ?? null;
}

function findOfferObjects(payload, expectedName) {
  const results = [];
  const seen = new WeakSet();
  const expected = comparable(expectedName);

  function visit(value, depth = 0) {
    if (!value || typeof value !== "object" || depth > 9 || seen.has(value)) return;
    seen.add(value);

    if (!Array.isArray(value)) {
      const leaves = flattenLeaves(value);
      const id = selectOfferId(leaves);
      const price = selectPrice(leaves);
      const text = objectText(leaves);
      const normalizedText = comparable(text);
      const hasOfferSignals = /seller|delivery|tradeenvironment|attribute|title|description|offer/i.test(
        leaves.map((leaf) => leaf.path).join(" "),
      );
      if (
        id &&
        price &&
        hasOfferSignals &&
        normalizedText.includes(expected)
      ) {
        results.push({
          id,
          price: price.value,
          price_path: price.path,
          text,
          raw: value,
        });
      }
    }

    const entries = Array.isArray(value) ? value : Object.values(value);
    for (const entry of entries) visit(entry, depth + 1);
  }

  visit(payload);
  const bestById = new Map();
  for (const result of results) {
    const current = bestById.get(result.id);
    if (!current || result.text.length > current.text.length) bestById.set(result.id, result);
  }
  return [...bestById.values()];
}

function bodyTextOffers(bodyText, brainrot, mutations) {
  const marker = `Brainrot ${brainrot.rarity} ${brainrot.name}`;
  const pieces = bodyText.split(/(?=Brainrot\s)/i);
  const rows = [];
  for (const piece of pieces) {
    const text = compact(piece).slice(0, 1000);
    if (!comparable(text).includes(comparable(marker)) || !/\$\s*[0-9]/.test(text)) continue;
    const priceMatches = [...text.matchAll(/\$\s*([0-9][0-9,]*(?:\.[0-9]{1,4})?)/g)];
    const price = priceMatches.length ? parseMoney(priceMatches.at(-1)[1]) : null;
    const mutation = detectMutation(text, mutations);
    if (!price || !mutation) continue;
    rows.push({
      id: hash(`${brainrot.id}:${mutation.slug}:${text}`),
      price,
      text,
      mutation,
      source: "body_text",
    });
  }
  return rows;
}

async function fetchEldoradoJson(url, { optional = false } = {}) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "accept-language": "en-US,en;q=0.9",
      referer: `${BASE_URL}/`,
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/136.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(60000),
  });

  if ([403, 429].includes(response.status)) {
    throw new Error(
      `Eldorado returned HTTP ${response.status}; stopped without bypassing the block.`,
    );
  }

  if (optional && response.status === 404) return null;

  if (!response.ok) {
    throw new Error(
      `Eldorado API returned HTTP ${response.status} for ${url}`,
    );
  }

  return response.json();
}

function generatedTradeEnvironmentValue(value) {
  return compact(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

async function resolveEldoradoOfferQueries(brainrot) {
  const candidates = [];
  const seen = new Set();

  const addCandidate = (value, source, mappingUrl = null) => {
    const normalized = compact(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push({
      trade_environment_value_2: normalized,
      source,
      mapping_url: mappingUrl,
    });
  };

  const mappingUrl = new URL(
    "/api/library/seoAliasMappings",
    BASE_URL,
  );
  mappingUrl.searchParams.set(
    "seoAlias",
    `${brainrot.slug}-for-sale`,
  );
  mappingUrl.searchParams.set("category", "CustomItem");
  mappingUrl.searchParams.set("gameId", CATEGORY_ID);
  mappingUrl.searchParams.set("locale", "en-US");

  const mapping = await fetchEldoradoJson(
    mappingUrl,
    { optional: true },
  );

  if (mapping?.query) {
    const query = new URLSearchParams(
      String(mapping.query).replace(/^\?/, ""),
    );
    addCandidate(
      query.get("te_v2"),
      "seo_mapping",
      mappingUrl.toString(),
    );
  }

  // Less-popular Brainrots often have no dedicated SEO page, while the
  // offers API still accepts the enum-like trade-environment value.
  addCandidate(
    generatedTradeEnvironmentValue(brainrot.name),
    "generated_from_name",
  );
  addCandidate(
    generatedTradeEnvironmentValue(brainrot.slug),
    "generated_from_slug",
  );

  return candidates;
}

function offersApiUrl(tradeEnvironmentValue2) {
  const url = new URL(
    "/api/v1/item-management/offers",
    BASE_URL,
  );
  url.searchParams.set("gameId", CATEGORY_ID);
  url.searchParams.set("category", "CustomItem");
  url.searchParams.set(
    "tradeEnvironmentValue2",
    tradeEnvironmentValue2,
  );
  url.searchParams.set("pageIndex", "1");
  url.searchParams.set("pageSize", "24");
  url.searchParams.set("useMinPurchasePrice", "false");
  url.searchParams.set(
    "numericAttributeFilters[0].attributeId",
    "steal-a-brainrot-ms-numeric",
  );
  url.searchParams.set("useOfferAttributeSearch", "false");
  url.searchParams.set("usePopularItems", "false");
  url.searchParams.set("includeDeliveryMedians", "true");
  url.searchParams.set("usePerGameScore", "true");
  return url;
}

function searchOffersApiUrl(searchQuery) {
  const url = new URL(
    "/api/v1/item-management/offers",
    BASE_URL,
  );
  url.searchParams.set("gameId", CATEGORY_ID);
  url.searchParams.set("category", "CustomItem");
  url.searchParams.set("searchQuery", searchQuery);
  url.searchParams.set("pageIndex", "1");
  url.searchParams.set("pageSize", "24");
  url.searchParams.set("useMinPurchasePrice", "false");
  url.searchParams.set(
    "numericAttributeFilters[0].attributeId",
    "steal-a-brainrot-ms-numeric",
  );
  url.searchParams.set("useOfferAttributeSearch", "true");
  url.searchParams.set("usePopularItems", "false");
  url.searchParams.set("includeDeliveryMedians", "true");
  url.searchParams.set("usePerGameScore", "true");
  return url;
}

async function collectOne({
  brainrot,
  mutations,
  expectedIncomeByVariant,
  samplesPerVariant,
  observedAt,
  saveApi,
}) {
  const pageUrl = dedicatedPageUrl(brainrot);
  const resolvedQueries = await resolveEldoradoOfferQueries(brainrot);
  const queryAttempts = [];

  let selectedQuery = null;
  let apiUrl = null;
  let payload = null;
  let apiCandidates = [];

  for (const resolvedQuery of resolvedQueries) {
    const candidateApiUrl = offersApiUrl(
      resolvedQuery.trade_environment_value_2,
    );

    try {
      const candidatePayload = await fetchEldoradoJson(
        candidateApiUrl,
      );
      const candidateOffers = findOfferObjects(
        candidatePayload,
        brainrot.name,
      );

      queryAttempts.push({
        source: resolvedQuery.source,
        trade_environment_value_2:
          resolvedQuery.trade_environment_value_2,
        api_url: candidateApiUrl.toString(),
        exact_offer_candidates: candidateOffers.length,
      });

      if (candidateOffers.length > 0) {
        selectedQuery = resolvedQuery;
        apiUrl = candidateApiUrl;
        payload = candidatePayload;
        apiCandidates = candidateOffers;
        break;
      }

      // Preserve the last successful empty response for diagnostics.
      selectedQuery = resolvedQuery;
      apiUrl = candidateApiUrl;
      payload = candidatePayload;
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : String(error);

      queryAttempts.push({
        source: resolvedQuery.source,
        trade_environment_value_2:
          resolvedQuery.trade_environment_value_2,
        api_url: candidateApiUrl.toString(),
        error: message,
      });

      if (/HTTP (403|429)/.test(message)) throw error;
    }
  }


  // Some Eldorado items are discoverable only through the site's Search
  // Items field, not through tradeEnvironmentValue2. Use the same public API
  // request as the site, then keep only exact-name offers.
  if (apiCandidates.length === 0) {
    const candidateApiUrl = searchOffersApiUrl(brainrot.name);

    try {
      const candidatePayload = await fetchEldoradoJson(
        candidateApiUrl,
      );
      const candidateOffers = findOfferObjects(
        candidatePayload,
        brainrot.name,
      );

      queryAttempts.push({
        source: "search_query",
        search_query: brainrot.name,
        api_url: candidateApiUrl.toString(),
        exact_offer_candidates: candidateOffers.length,
      });

      if (candidateOffers.length > 0) {
        selectedQuery = {
          source: "search_query",
          search_query: brainrot.name,
          trade_environment_value_2: null,
        };
        apiUrl = candidateApiUrl;
        payload = candidatePayload;
        apiCandidates = candidateOffers;
      } else {
        selectedQuery = {
          source: "search_query",
          search_query: brainrot.name,
          trade_environment_value_2: null,
        };
        apiUrl = candidateApiUrl;
        payload = candidatePayload;
      }
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : String(error);

      queryAttempts.push({
        source: "search_query",
        search_query: brainrot.name,
        api_url: candidateApiUrl.toString(),
        error: message,
      });

      if (/HTTP (403|429)/.test(message)) throw error;
    }
  }

  if (!payload || apiCandidates.length === 0) {
    return {
      requested_url: pageUrl,
      final_url: pageUrl,
      api_url: apiUrl?.toString() ?? null,
      api_candidates: 0,
      body_candidates: 0,
      income_filtered_candidates: 0,
      missing_income_range_candidates: 0,
      selected_income_bands: {},
      listings: [],
      variants: {},
      body_preview: "",
      skip_reason:
        "no_exact_offers_for_trade_environment_or_search_candidates",
      trade_environment_attempts: queryAttempts,
    };
  }

  const bodyText = "";
  const bodyCandidates = bodyTextOffers(bodyText, brainrot, mutations);
  const candidateRows = [];

  let incomeFilteredCount = 0;
  let missingIncomeRangeCount = 0;

  const rawCandidates = apiCandidates.length > 0
    ? apiCandidates.map((candidate) => ({ ...candidate, source: "api" }))
    : bodyCandidates;

  for (const candidate of rawCandidates) {
    const mutation = candidate.mutation ?? detectMutation(candidate.text, mutations);
    if (!mutation?.id) continue;

    const incomeRanges = parseIncomeRanges(candidate.text);
    if (incomeRanges.length === 0) {
      missingIncomeRangeCount += 1;
      continue;
    }

    const expectedIncome = expectedIncomeByVariant.get(
      `${brainrot.id}:${mutation.id}`,
    );
    const incomeRange = incomeRanges[0];

    candidateRows.push({
      ...candidate,
      mutation,
      expected_income_per_second: expectedIncome,
      income_range: incomeRange,
      income_band_key: `${incomeRange.lower}:${incomeRange.upper}`,
    });
  }

  // Eldorado offers the same mutation at many income tiers. Prefer the tier
  // containing the calculator's canonical income when available; otherwise
  // use the most populated tier so a few high-income listings cannot distort
  // the normal market value.
  const selectedCandidates = [];
  const selectedIncomeBands = {};
  const candidatesByMutation = new Map();

  for (const candidate of candidateRows) {
    const rows = candidatesByMutation.get(candidate.mutation.slug) ?? [];
    rows.push(candidate);
    candidatesByMutation.set(candidate.mutation.slug, rows);
  }

  for (const [mutationSlug, rows] of candidatesByMutation) {
    const bands = new Map();
    for (const row of rows) {
      const bandRows = bands.get(row.income_band_key) ?? [];
      bandRows.push(row);
      bands.set(row.income_band_key, bandRows);
    }

    const expectedIncome = rows[0]?.expected_income_per_second;
    const rankedBands = [...bands.entries()].map(([key, bandRows]) => ({
      key,
      rows: bandRows,
      matchesExpected: incomeMatchesExpected(
        [bandRows[0].income_range],
        expectedIncome,
      ),
    })).sort((left, right) =>
      Number(right.matchesExpected) - Number(left.matchesExpected) ||
      right.rows.length - left.rows.length ||
      left.rows[0].income_range.lower - right.rows[0].income_range.lower,
    );

    const hasExpectedIncome =
      Number.isFinite(expectedIncome) && expectedIncome > 0;
    const eligibleBands = hasExpectedIncome
      ? rankedBands.filter((band) => band.matchesExpected)
      : rankedBands;
    const chosen = eligibleBands[0];

    if (!chosen) {
      incomeFilteredCount += rows.length;
      selectedIncomeBands[mutationSlug] = {
        skipped: true,
        reason: "no_income_band_matches_expected",
        expected_income_per_second: expectedIncome,
        candidate_bands: rankedBands.map((band) => ({
          label: band.rows[0].income_range.label,
          sample_count: band.rows.length,
        })),
      };
      continue;
    }

    selectedCandidates.push(...chosen.rows);
    incomeFilteredCount += rows.length - chosen.rows.length;
    selectedIncomeBands[mutationSlug] = {
      label: chosen.rows[0].income_range.label,
      lower: chosen.rows[0].income_range.lower,
      upper: chosen.rows[0].income_range.upper,
      sample_count: chosen.rows.length,
      matched_expected_income: chosen.matchesExpected,
      expected_income_per_second: hasExpectedIncome
        ? expectedIncome
        : null,
    };
  }

  const sellerCounts = new Map();
  const byVariant = new Map();
  for (const candidate of selectedCandidates) {
    const variantRows = byVariant.get(candidate.mutation.slug) ?? [];
    if (variantRows.length >= samplesPerVariant) continue;
    const sellerMatch = candidate.text.match(/([A-Za-z0-9_.#-]{2,40})\s+\d{2,3}(?:\.\d+)?%\s*\([0-9,]+\)/);
    const seller = sellerMatch?.[1]?.toLowerCase() ?? null;
    if (seller) {
      const sellerKey = `${candidate.mutation.slug}:${seller}`;
      if ((sellerCounts.get(sellerKey) ?? 0) >= 2) continue;
      sellerCounts.set(sellerKey, (sellerCounts.get(sellerKey) ?? 0) + 1);
    }

    const externalId = String(candidate.id);
    if (variantRows.some((row) => row.external_listing_id === externalId)) continue;
    const title = compact(
      `${brainrot.name} ${candidate.mutation.name} Brainrot`,
    ).slice(0, 100);
    variantRows.push({
      external_listing_id: externalId,
      listing_url: /^[0-9a-f-]{36}$/i.test(externalId)
        ? `${BASE_URL}/steal-a-brainrot-brainrots/oi/${externalId}`
        : `${pageUrl}#offer-${externalId}`,
      listing_type: "active_listing",
      listing_status: "active",
      title,
      currency: "USD",
      listed_price: candidate.price,
      shipping_price: 0,
      quantity: 1,
      total_price_usd: candidate.price,
      observed_at: observedAt,
    });
    byVariant.set(candidate.mutation.slug, variantRows);
  }

  if (saveApi) {
    const debugDirectory = resolve(process.cwd(), "data/sab-market-feeds/eldorado-debug");
    await mkdir(debugDirectory, { recursive: true });
    await writeFile(
      resolve(debugDirectory, `${brainrot.slug}-offers-api.json`),
      `${JSON.stringify(payload, null, 2)}\n`,
      "utf8",
    );
  }

  return {
    requested_url: pageUrl,
    final_url: selectedQuery.search_query
      ? `${BASE_URL}/steal-a-brainrot-brainrots/i/${CATEGORY_ID}?searchQuery=${encodeURIComponent(
          selectedQuery.search_query,
        )}`
      : `${pageUrl}?te_v2=${encodeURIComponent(
          selectedQuery.trade_environment_value_2,
        )}`,
    api_url: apiUrl.toString(),
    trade_environment_attempts: queryAttempts,
    api_candidates: apiCandidates.length,
    body_candidates: bodyCandidates.length,
    income_filtered_candidates: incomeFilteredCount,
    missing_income_range_candidates: missingIncomeRangeCount,
    selected_income_bands: selectedIncomeBands,
    listings: [...byVariant.values()].flat(),
    variants: Object.fromEntries([...byVariant].map(([slug, rows]) => [slug, rows.length])),
    body_preview: bodyText.slice(0, 1200),
  };
}

function runImporter(outputPath) {
  return new Promise((resolveImport, rejectImport) => {
    const child = spawn(
      process.execPath,
      ["scripts/import-sab-market-json.mjs", outputPath, "--send"],
      { cwd: process.cwd(), env: process.env, stdio: "inherit" },
    );
    child.once("error", rejectImport);
    child.once("exit", (code) => {
      if (code === 0) resolveImport();
      else rejectImport(new Error(`Bulk importer exited with code ${code}`));
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const observedAt = new Date().toISOString();
  const {
    queue,
    mutations,
    expectedIncomeByVariant,
    totals,
  } = await buildQueue(options.brainrot);
  const progress = await readProgress(options.progressPath, options.resetProgress);
  const targets = queue
    .filter((row) => {
      const attempt = progress.attempts[row.id];
      if (!attempt) return true;

      // Retry old empty results once because v6 adds Eldorado Search Items
      // fallback. Collected rows and v6 empties remain completed.
      return (
        attempt.status === "empty" &&
        attempt.collector_version !== COLLECTOR_VERSION
      );
    })
    .slice(0, options.maxBrainrots);

  console.log("Eldorado API-first Brainrot queue");
  console.log(`  catalog: ${totals.catalog}`);
  console.log(`  missing default prices: ${totals.missing_default_prices}`);
  console.log(`  low-confidence default prices: ${totals.low_default_prices}`);
  console.log(`  selected this run: ${targets.length}`);

  if (!targets.length) {
    console.log("No eligible targets remain. Use --reset-progress to retry prior attempts.");
    return;
  }

  console.log("Using Eldorado public JSON API directly (no browser)");
  const listingsById = new Map();
  const summaries = [];

  for (let index = 0; index < targets.length; index += 1) {
      const brainrot = targets[index];
      if (index) await sleep(options.delayMs);
      console.log(`\n[${index + 1}/${targets.length}] ${brainrot.name} (${brainrot.current_confidence}, ${brainrot.current_sample_size} samples)`);
      try {
        const result = await collectOne({
          brainrot,
          mutations,
          expectedIncomeByVariant,
          samplesPerVariant: options.samplesPerVariant,
          observedAt,
          saveApi: options.saveApi,
        });
        for (const listing of result.listings) {
          listingsById.set(`${SOURCE_SLUG}:${listing.external_listing_id}`, listing);
        }
        const status = result.listings.length ? "collected" : "empty";
        const summary = {
          brainrot_id: brainrot.id,
          brainrot_name: brainrot.name,
          brainrot_slug: brainrot.slug,
          prior_confidence: brainrot.current_confidence,
          prior_sample_size: brainrot.current_sample_size,
          status,
          listing_count: result.listings.length,
          variants: result.variants,
          requested_url: result.requested_url,
          final_url: result.final_url,
          api_url: result.api_url,
          api_candidates: result.api_candidates,
          body_candidates: result.body_candidates,
          income_filtered_candidates: result.income_filtered_candidates,
          missing_income_range_candidates: result.missing_income_range_candidates,
          selected_income_bands: result.selected_income_bands,
          skip_reason: result.skip_reason ?? null,
          trade_environment_attempts:
            result.trade_environment_attempts ?? [],
          body_preview: result.body_preview,
        };
        summaries.push(summary);
        progress.attempts[brainrot.id] = {
          brainrot_name: brainrot.name,
          status,
          attempted_at: new Date().toISOString(),
          listing_count: result.listings.length,
          variants: result.variants,
          final_url: result.final_url,
          collector_version: COLLECTOR_VERSION,
        };
        await writeProgress(options.progressPath, progress);
        console.log(`  API candidates: ${result.api_candidates}; body candidates: ${result.body_candidates}`);
        console.log(
          `  income-filtered: ${result.income_filtered_candidates}; missing income range: ${result.missing_income_range_candidates}`,
        );
        if (result.skip_reason) {
          console.log(`  skip: ${result.skip_reason}`);
        }
        console.log(`  ${status}: ${result.listings.length} listing(s) across ${Object.keys(result.variants).length} variant(s)`);
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : String(error);
        progress.attempts[brainrot.id] = {
          brainrot_name: brainrot.name,
          status: "error",
          attempted_at: new Date().toISOString(),
          error: message,
          collector_version: COLLECTOR_VERSION,
        };
        summaries.push({
          brainrot_id: brainrot.id,
          brainrot_name: brainrot.name,
          brainrot_slug: brainrot.slug,
          prior_confidence: brainrot.current_confidence,
          prior_sample_size: brainrot.current_sample_size,
          status: "error",
          listing_count: 0,
          variants: {},
          error: message,
        });
        await writeProgress(options.progressPath, progress);
        console.log(`  error: ${message}`);

        if (/HTTP (403|429)/.test(message)) throw error;
      }
  }

  const listings = [...listingsById.values()].sort((left, right) =>
    left.external_listing_id.localeCompare(right.external_listing_id),
  );
  const output = {
    source_slug: SOURCE_SLUG,
    collected_at: observedAt,
    strategy: "eldorado_direct_api_v6_search_fallback_brainrot_first_missing_then_low",
    collector_version: COLLECTOR_VERSION,
    samples_per_variant: options.samplesPerVariant,
    queue_totals: totals,
    targets_requested: targets.length,
    targets_collected: summaries.filter((row) => row.status === "collected").length,
    listing_count: listings.length,
    target_summaries: summaries,
    listings,
  };

  await mkdir(dirname(options.outputPath), { recursive: true });
  await writeFile(options.outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`\nSaved ${listings.length} listing(s) to ${options.outputPath}`);
  console.log(`Progress saved to ${options.progressPath}`);

  if (!listings.length) {
    if (options.send) {
      throw new Error("No Eldorado listings parsed; nothing was imported.");
    }
    console.log("\nNo listings collected. Review target_summaries for skipped or unavailable Eldorado mappings.");
    return;
  }
  if (!options.send) {
    console.log("\nDry run only. Review the JSON, then add --send to import it.");
    return;
  }
  if (!process.env.SAB_MARKET_IMPORT_SECRET) {
    throw new Error("SAB_MARKET_IMPORT_SECRET is required with --send");
  }
  await runImporter(options.outputPath);
}

main().catch((error) => {
  console.error(`\nEldorado collection failed: ${error.message}`);
  process.exitCode = 1;
});
