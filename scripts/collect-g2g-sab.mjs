/**
 * G2G Steal a Brainrot market collector.
 *
 * The SECOND price source (alongside Eldorado). Its whole point is to break
 * single-sourcing: `sab_market_variant_price_estimates` blends per-source
 * medians, and an independent second source keeps a single bad Eldorado
 * outlier from dragging a variant's price. As a no-review marketplace, G2G
 * can only VALIDATE/TIGHTEN — it never sets the headline below Eldorado's
 * verified reputable-seller price.
 *
 * Unlike the Eldorado collector this needs NO browser at runtime: G2G exposes a
 * public, no-auth JSON API (`sls.g2g.com/v3/offer/search`) that returns clean
 * structured offers. Playwright was only used to reverse-engineer the request;
 * see the sab-third-source-research memory for the full decode.
 *
 * Discovery model: G2G's filter taxonomy nests every Brainrot under its rarity,
 * each with a stable `dataset_id` filter code. A rarity-only filter returns
 * zero results (G2G requires the item attribute), so we iterate Brainrots. The
 * taxonomy is snapshotted to data/sab-market-feeds/g2g-taxonomy.json; pass
 * --refresh-taxonomy to re-pull it live.
 *
 * The emitted feed matches the Eldorado shape exactly (including the Track-B
 * seller/signal fields), so the existing importer + edge function + RPC ingest
 * it unchanged.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

const SOURCE_SLUG = "g2g";
const COLLECTOR_VERSION = 1;

const SEARCH_ENDPOINT = "https://sls.g2g.com/v3/offer/search";
const TAXONOMY_ENDPOINT =
  "https://sls.g2g.com/offer/keyword_relation/attributes/search";

// Discovered 2026-07-31. The game filter is constant; item-type "Brainrot" and
// each Brainrot live under the rarity collection cc192142.
const GAME_FA = "b08c318c:7840f705"; // Steal a Brainrot
const ITEM_TYPE_GROUP = "90579639"; // Item Type
const ITEM_TYPE_BRAINROT = "c5311a6a"; // Item Type → Brainrot
const RARITY_GROUP = "cc192142"; // Rarity → (nested Brainrots)
const SERVICE_ID = "0765978e-3fdf-48b4-bed3-184823aa439e"; // Roblox items
const BRAND_ID = "lgc_game_24733"; // Steal a Brainrot

const DEFAULT_OUTPUT = "data/sab-market-feeds/g2g-api-latest.json";
const DEFAULT_PROGRESS = "data/sab-market-feeds/g2g-api-progress.json";
const TAXONOMY_PATH = "data/sab-market-feeds/g2g-taxonomy.json";

// G2G ships prices with sub-cent precision (e.g. 2.710442); nobody actually
// transacts below a cent, and the pipeline compares against whole-cent
// estimates, so round on the way in.
const INCOME_UNIT_MULTIPLIERS = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 };

const REQUEST_HEADERS = {
  Accept: "application/json",
  Origin: "https://www.g2g.com",
  Referer: "https://www.g2g.com/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

function parseArgs(argv) {
  const options = {
    maxBrainrots: Number(process.env.G2G_MAX_BRAINROTS ?? 60),
    maxPagesPerBrainrot: Number(process.env.G2G_MAX_PAGES ?? 3),
    pageSize: 48,
    delayMs: Number(process.env.G2G_DELAY_MS ?? 1500),
    outputPath: DEFAULT_OUTPUT,
    progressPath: DEFAULT_PROGRESS,
    brainrot: null,
    send: false,
    resetProgress: false,
    refreshTaxonomy: false,
    // Same panel-refresh idea as the Eldorado collector: eligibility from real
    // shared state (here, the progress file's own timestamps) so daily runs
    // re-crawl rather than only backfilling.
    refreshAfterHours: Number(process.env.G2G_REFRESH_AFTER_HOURS ?? 0),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--send") options.send = true;
    else if (argument === "--reset-progress") options.resetProgress = true;
    else if (argument === "--refresh-taxonomy") options.refreshTaxonomy = true;
    else {
      const value = argv[index + 1];
      if (!value) throw new Error(`Missing value for ${argument}`);
      if (argument === "--max-brainrots") options.maxBrainrots = Number(value);
      else if (argument === "--max-pages") options.maxPagesPerBrainrot = Number(value);
      else if (argument === "--delay-ms") options.delayMs = Number(value);
      else if (argument === "--output") options.outputPath = value;
      else if (argument === "--progress") options.progressPath = value;
      else if (argument === "--brainrot") options.brainrot = value.trim();
      else if (argument === "--refresh-after-hours") options.refreshAfterHours = Number(value);
      else throw new Error(`Unknown argument: ${argument}`);
      index += 1;
    }
  }

  if (!Number.isInteger(options.maxBrainrots) || options.maxBrainrots < 1 || options.maxBrainrots > 500) {
    throw new Error("--max-brainrots must be an integer from 1 to 500");
  }
  if (!Number.isInteger(options.maxPagesPerBrainrot) || options.maxPagesPerBrainrot < 1 || options.maxPagesPerBrainrot > 20) {
    throw new Error("--max-pages must be an integer from 1 to 20");
  }
  if (!Number.isFinite(options.refreshAfterHours) || options.refreshAfterHours < 0 || options.refreshAfterHours > 720) {
    throw new Error("--refresh-after-hours must be a number from 0 to 720");
  }

  return options;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function hash(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 24);
}

/** Collapse whitespace; the API occasionally pads titles. */
function compact(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

/** Lowercase alphanumerics + single spaces — matches the parser's comparison. */
function comparable(text) {
  return compact(text).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * ROUTE-016: newest MATCHED G2G raw listing per Brainrot — the collector's real
 * "when did we last actually look at this item" signal, and the only value in
 * the system that differs BETWEEN items and therefore makes the staleness sort
 * rotate.
 *
 * Scoped to the G2G source on purpose. Eldorado's equivalent lookup is
 * source-agnostic, which is right for Eldorado, but reusing that here would let
 * Eldorado's own 3-hourly crawls mark every Brainrot "recently seen" and G2G
 * would then re-crawl nothing at all — a fresh freeze with the opposite sign.
 * This must answer "when did *G2G* last see it".
 *
 * The parse_status=matched filter is not cosmetic: it makes the query use the
 * partial index (brainrot_id, mutation_id, observed_at DESC)
 * WHERE parse_status = 'matched'. ROUTE-012 measured the unfiltered form
 * intermittently exceeding the statement timeout on this same table.
 *
 * Keyed by NAME, not id: the queue comes from G2G's taxonomy, whose `fa` codes
 * are G2G's own and have no relation to sab_brainrots.id, so names are the only
 * join available. Matched through comparable() — the same normalisation the
 * parser uses — so punctuation and casing differences do not silently drop an
 * item into "never crawled".
 *
 * Requires the service role: anon is denied sab_market_raw_listings. When the
 * key is absent (local runs, or before the workflow secret is wired) this
 * returns an empty map and every item reads as never-crawled — which selects the
 * rarity-weighted head, i.e. no worse than the previous behaviour, and never
 * fails the crawl.
 */
async function fetchNewestG2GListingByName(names) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const newest = new Map();

  if (!base || !serviceKey || !names.length) {
    if (!serviceKey) {
      console.warn(
        "  SUPABASE_SERVICE_ROLE_KEY absent — cannot read per-item crawl " +
          "freshness; treating every Brainrot as never-crawled (rarity order).",
      );
    }
    return newest;
  }

  const headers = {
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`,
    accept: "application/json",
  };

  // Resolve the G2G source id once. Without it the listing query would span
  // every source and answer the wrong question (see the note above).
  let sourceId = null;
  try {
    const sourceUrl = new URL("/rest/v1/sab_market_sources", base);
    sourceUrl.searchParams.set("select", "id");
    sourceUrl.searchParams.set("slug", `eq.${SOURCE_SLUG}`);
    sourceUrl.searchParams.set("limit", "1");
    const response = await fetch(sourceUrl, { headers });
    if (response.ok) sourceId = (await response.json())?.[0]?.id ?? null;
  } catch {
    // fall through — handled below
  }

  if (!sourceId) {
    console.warn(
      `  could not resolve the '${SOURCE_SLUG}' market source; treating every ` +
        "Brainrot as never-crawled (rarity order).",
    );
    return newest;
  }

  // Map catalog names → ids so the per-item lookups can filter on brainrot_id
  // (indexed) rather than joining through the catalog on every request.
  const idsByName = new Map();
  try {
    for (let offset = 0; ; offset += 1000) {
      const catalogUrl = new URL("/rest/v1/sab_brainrot_catalog", base);
      catalogUrl.searchParams.set("select", "id,name");
      catalogUrl.searchParams.set("order", "name.asc");
      catalogUrl.searchParams.set("offset", String(offset));
      catalogUrl.searchParams.set("limit", "1000");
      const response = await fetch(catalogUrl, { headers });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const rows = await response.json();
      for (const row of rows) idsByName.set(comparable(row.name), row.id);
      if (rows.length < 1000) break;
    }
  } catch (error) {
    console.warn(
      `  brainrot catalog read failed (${error.message}); treating every ` +
        "Brainrot as never-crawled (rarity order).",
    );
    return newest;
  }

  const CONCURRENCY = 8;
  let failures = 0;
  let unmatched = 0;

  const targets = names
    .map((name) => ({ name, id: idsByName.get(comparable(name)) }))
    .filter((row) => {
      if (!row.id) unmatched += 1;
      return Boolean(row.id);
    });

  for (let index = 0; index < targets.length; index += CONCURRENCY) {
    const batch = targets.slice(index, index + CONCURRENCY);

    await Promise.all(
      batch.map(async ({ name, id }) => {
        const url = new URL("/rest/v1/sab_market_raw_listings", base);
        url.searchParams.set("select", "observed_at");
        url.searchParams.set("source_id", `eq.${sourceId}`);
        url.searchParams.set("brainrot_id", `eq.${id}`);
        url.searchParams.set("parse_status", "eq.matched");
        url.searchParams.set("order", "observed_at.desc");
        url.searchParams.set("limit", "1");

        for (let attempt = 1; attempt <= 3; attempt += 1) {
          try {
            const response = await fetch(url, { headers });
            if (response.ok) {
              const observedAt = (await response.json())?.[0]?.observed_at ?? null;
              if (observedAt) newest.set(comparable(name), observedAt);
              return;
            }
          } catch {
            // fall through to the retry
          }
          if (attempt < 3) await sleep(400 * attempt);
        }
        failures += 1;
      }),
    );
  }

  if (unmatched) {
    console.warn(
      `  ${unmatched} G2G taxonomy name(s) have no sab_brainrot_catalog match; ` +
        "treated as never-crawled (they sort to the head, which is correct — " +
        "we have no evidence we ever looked at them).",
    );
  }
  if (failures) {
    console.warn(
      `  crawl-freshness lookup failed for ${failures} Brainrot(s); ` +
        "they are treated as never-crawled (max staleness).",
    );
  }

  return newest;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: REQUEST_HEADERS });
  if (response.status === 429) {
    throw new Error("G2G returned HTTP 429 (rate limited); stopping politely.");
  }
  if (!response.ok) {
    throw new Error(`G2G API returned HTTP ${response.status} for ${url}`);
  }
  const body = await response.json();
  // G2G wraps everything in {code, messages, payload}; 2000 is success.
  if (body.code && body.code !== 2000) {
    const message = body.messages?.[0]?.text ?? `code ${body.code}`;
    throw new Error(`G2G API error: ${message}`);
  }
  return body.payload ?? {};
}

/**
 * The Brainrot list, each with its rarity and G2G filter code.
 *
 * Prefer the on-disk snapshot (stable, fast, no dependency on the taxonomy
 * endpoint staying up mid-run); refresh live only when asked.
 */
async function loadTaxonomy(refresh) {
  if (!refresh) {
    try {
      const raw = await readFile(resolve(process.cwd(), TAXONOMY_PATH), "utf8");
      const parsed = JSON.parse(raw);
      if (parsed?.rarities?.length) return parsed;
    } catch {
      // Fall through to a live pull.
    }
  }

  console.log("Refreshing G2G taxonomy from the attributes endpoint…");
  const url = `${TAXONOMY_ENDPOINT}?brand_id=${BRAND_ID}&service_id=${SERVICE_ID}&include_searchable_only=0`;
  const payload = await fetchJson(url);
  const collections = payload.results ?? payload ?? [];
  const rarityCollection = collections.find(
    (collection) => collection.collection_id === RARITY_GROUP,
  );

  if (!rarityCollection) {
    throw new Error("Could not find the rarity collection in G2G taxonomy");
  }

  const taxonomy = {
    service_id: SERVICE_ID,
    brand_id: BRAND_ID,
    item_type_brainrot: ITEM_TYPE_BRAINROT,
    rarities: (rarityCollection.children ?? []).map((rarity) => ({
      name: rarity.value,
      fa: rarity.dataset_id,
      brainrots: (rarity.children ?? []).map((brainrot) => ({
        name: brainrot.value,
        fa: brainrot.dataset_id,
      })),
    })),
  };

  await mkdir(dirname(resolve(process.cwd(), TAXONOMY_PATH)), { recursive: true });
  await writeFile(
    resolve(process.cwd(), TAXONOMY_PATH),
    `${JSON.stringify(taxonomy, null, 1)}\n`,
    "utf8",
  );

  return taxonomy;
}

/**
 * Flatten the taxonomy into a single Brainrot queue.
 *
 * ROUTE-016: this no longer decides the ORDER. It used to sort by
 * (rarity_weight, name) and that was the whole ordering — both keys constant
 * across runs, so the queue was a fixed permutation and everything past
 * --max-brainrots was unreachable forever. Ordering now lives in
 * selectEligible(), which weights staleness by rarity so the queue rotates.
 * `newestByName` supplies the per-item staleness signal.
 */
export function buildQueue(taxonomy, requestedName, newestByName = new Map()) {
  const rarityWeight = (rarity) => {
    const r = String(rarity ?? "").toLowerCase();
    if (r.includes("og")) return 5;
    if (r.includes("secret")) return 4;
    if (r.includes("god")) return 4;
    if (r.includes("mythic")) return 3;
    if (r.includes("legendary")) return 2;
    return 1;
  };

  let queue = [];
  for (const rarity of taxonomy.rarities) {
    for (const brainrot of rarity.brainrots) {
      queue.push({
        id: brainrot.fa,
        name: brainrot.name,
        rarity: rarity.name,
        rarity_fa: rarity.fa,
        brainrot_fa: brainrot.fa,
        rarity_weight: rarityWeight(rarity.name),

        // When G2G last saw this Brainrot. Null = never → maximum (finite)
        // staleness, so a brand-new Brainrot is picked up on the next run.
        last_crawled_at: newestByName.get(comparable(brainrot.name)) ?? null,
      });
    }
  }

  if (requestedName) {
    const wanted = comparable(requestedName);
    queue = queue.filter((row) => comparable(row.name) === wanted);
    if (!queue.length) throw new Error(`Brainrot not found in G2G taxonomy: ${requestedName}`);
  }

  // Deliberately NOT sorted here — see the note above. selectEligible() orders
  // by staleness * rarity_weight, which is what lets the queue rotate.
  return queue;
}

function buildFilterAttr(brainrotFa) {
  // Order mirrors what the site sends: item-type | game | rarity-brainrot.
  return [
    `${ITEM_TYPE_GROUP}:${ITEM_TYPE_BRAINROT}`,
    GAME_FA,
    `${RARITY_GROUP}:${brainrotFa}`,
  ].join("|");
}

function searchUrl(brainrotFa, page, pageSize) {
  const params = new URLSearchParams({
    filter_attr: buildFilterAttr(brainrotFa),
    seo_term: "rbl-item",
    page_size: String(pageSize),
    page: String(page),
    group: "0",
    currency: "USD",
    country: "US",
    v: "v2",
  });
  return `${SEARCH_ENDPOINT}?${params.toString()}`;
}

/** Parse "50-99 M/s" / "1+ B/s" style income out of a title, if present. */
function parseIncomeBand(title) {
  const text = compact(title);
  const range = text.match(/([0-9]+(?:\.[0-9]+)?)\s*-\s*([0-9]+(?:\.[0-9]+)?)\s*([KMBT])\s*\/?s/i);
  if (range) {
    const unit = INCOME_UNIT_MULTIPLIERS[range[3].toLowerCase()];
    return { label: range[0], lower: Number(range[1]) * unit, upper: Number(range[2]) * unit };
  }
  const plus = text.match(/([0-9]+(?:\.[0-9]+)?)\s*\+?\s*([KMBT])\s*\/?s/i);
  if (plus) {
    const unit = INCOME_UNIT_MULTIPLIERS[plus[2].toLowerCase()];
    const value = Number(plus[1]) * unit;
    return { label: plus[0], lower: value, upper: value };
  }
  return null;
}

/**
 * One offer → the feed listing shape the importer expects. Returns null for
 * anything that isn't a straightforward priced single-item offer (bundles,
 * accounts, zero prices) so noise never reaches the parser.
 */
function toListing(offer, brainrot, observedAt) {
  const price = Number(offer.converted_unit_price ?? offer.unit_price);
  if (!Number.isFinite(price) || price <= 0) return null;

  const title = compact(offer.title ?? offer.offer_title ?? "");
  if (!title || !/brainrot/i.test(title)) return null;

  const externalId = String(offer.offer_id ?? offer.relation_id ?? hash(title + price));

  return {
    external_listing_id: externalId,
    listing_url: `https://www.g2g.com/categories/rbl-item/offer/${externalId}`,
    listing_type: "active_listing",
    listing_status: "active",
    title: title.slice(0, 100),
    currency: "USD",
    listed_price: Math.round(price * 100) / 100,
    shipping_price: 0,
    quantity: 1,
    total_price_usd: Math.round(price * 100) / 100,
    observed_at: observedAt,

    // Track-B signal fields, same names the Eldorado collector emits, so they
    // ride through raw_payload without any importer change. G2G's offer-search
    // does NOT return a seller rating or completed-sale count (those live on
    // the seller profile), so seller_sales_count stays null rather than being
    // faked from total_offer (which counts product groups, not sales).
    seller_reference: offer.username ?? null,
    seller_sales_count: null,
    source_signals: {
      available_qty: offer.available_qty ?? null,
      total_offer: offer.total_offer ?? null,
      g2g_offer_id: externalId,
    },
    income_band: parseIncomeBand(title),
    collector_version: COLLECTOR_VERSION,
  };
}

async function collectBrainrot(brainrot, options, observedAt) {
  const listings = new Map();
  let totalOffer = null;

  for (let page = 1; page <= options.maxPagesPerBrainrot; page += 1) {
    if (page > 1) await sleep(options.delayMs);

    const payload = await fetchJson(
      searchUrl(brainrot.brainrot_fa, page, options.pageSize),
    );
    const results = payload.results ?? [];
    if (page === 1) totalOffer = results[0]?.total_offer ?? results.length;

    for (const offer of results) {
      const listing = toListing(offer, brainrot, observedAt);
      if (listing) listings.set(listing.external_listing_id, listing);
    }

    // G2G returns a full page when more exist; a short page means we're done.
    if (results.length < options.pageSize) break;
  }

  return { listings: [...listings.values()], total_offer: totalOffer };
}

async function readProgress(path, reset) {
  if (reset) return { attempts: {} };
  try {
    const raw = await readFile(resolve(process.cwd(), path), "utf8");
    const parsed = JSON.parse(raw);
    return parsed?.attempts ? parsed : { attempts: {} };
  } catch {
    return { attempts: {} };
  }
}

async function writeProgress(path, progress) {
  await mkdir(dirname(resolve(process.cwd(), path)), { recursive: true });
  await writeFile(
    resolve(process.cwd(), path),
    `${JSON.stringify(progress, null, 1)}\n`,
    "utf8",
  );
}

/**
 * ROUTE-016: a never-crawled Brainrot is the stalest thing there is, but it must
 * stay a FINITE number. Infinity * rarity_weight is Infinity for every rarity,
 * which collapses the weighting and sorts the never-crawled block
 * alphabetically — so Epics would be collected ahead of Secrets, the exact
 * opposite of the priority we want.
 */
export const NEVER_CRAWLED_STALENESS_HOURS = 24 * 365;

/** Hours since we last observed this item on G2G, capped. `now` is injectable. */
export function stalenessHours(row, now = Date.now()) {
  const lastSeen = Date.parse(row.last_crawled_at ?? "");
  if (!Number.isFinite(lastSeen)) return NEVER_CRAWLED_STALENESS_HOURS;
  return Math.min(
    NEVER_CRAWLED_STALENESS_HOURS,
    (now - lastSeen) / (60 * 60 * 1000),
  );
}

/**
 * ROUTE-016: eligibility + ordering for the G2G queue.
 *
 * TWO defects fixed here, and the second is the one that actually froze the
 * queue.
 *
 * (1) ELIGIBILITY read the progress FILE. `attempted_at` lives in
 * data/sab-market-feeds/g2g-api-progress.json, which is committed to the repo
 * and which this workflow never commits back — so every scheduled run starts
 * from the same frozen snapshot (one entry, 2026-07-31, from a single-Brainrot
 * test run). Nothing a run learns survives it. The workflow header claimed the
 * refresh was "DB-driven ... mirrors the Eldorado job"; it was not, and this is
 * the same inert-fix trap ROUTE-012 found on the Eldorado side, where the DB
 * signal the header advertised was never actually read.
 *
 * (2) ORDERING never considered staleness at all. buildQueue() sorted ONCE by
 * rarity_weight then name.localeCompare, and selectTargets only filtered. Both
 * keys are constant across runs, so the order is a fixed permutation: all OGs
 * alphabetically, then Secrets, and so on. `--max-brainrots 120` against a
 * 385-Brainrot taxonomy therefore takes the SAME 120 every run and the other 265
 * are unreachable — 78 Secrets and 26 Brainrot Gods among them, the tiers cash
 * buyers actually convert on. Note this is strictly worse than Eldorado's bug:
 * there, a rotating signal existed and was merely unread, so the sort merely
 * degenerated; here staleness was not in the comparator at all.
 *
 * The fix is Eldorado's: sort by stalenessHours * rarity_weight, descending,
 * fed by a genuinely PER-ITEM signal (newest matched G2G raw listing). Rarity
 * still dominates among equally-stale items, so high-value tiers come due
 * sooner, but nothing can be starved forever because staleness grows without
 * bound while rarity_weight is a small constant.
 */
export function selectEligible(
  queue,
  { usePanelRefresh, refreshAfterMs, progress, now = Date.now() },
) {
  const eligible = queue.filter((row) => {
    if (usePanelRefresh) {
      // DB-driven: "have we looked at this item recently", not "does a committed
      // file remember an attempt".
      const lastSeen = Date.parse(row.last_crawled_at ?? "");
      return !Number.isFinite(lastSeen) || now - lastSeen >= refreshAfterMs;
    }

    // Backfill mode keeps the progress-file behaviour: only never-attempted
    // items. This mode is for local one-shot use, not the scheduled run.
    return !progress?.attempts?.[row.id];
  });

  if (usePanelRefresh) {
    eligible.sort(
      (left, right) =>
        stalenessHours(right, now) * right.rarity_weight -
          stalenessHours(left, now) * left.rarity_weight ||
        left.name.localeCompare(right.name, "en", { sensitivity: "base" }),
    );
  }

  return eligible;
}

function selectTargets(queue, progress, options) {
  const refreshAfterMs = options.refreshAfterHours * 60 * 60 * 1000;
  const usePanelRefresh = options.refreshAfterHours > 0;

  const eligible = selectEligible(queue, {
    usePanelRefresh,
    refreshAfterMs,
    progress,
  });

  return { eligible, usePanelRefresh };
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

  const taxonomy = await loadTaxonomy(options.refreshTaxonomy);

  // ROUTE-016: per-item crawl freshness from the DB, so the queue rotates
  // instead of re-taking the same rarity-ordered head every run.
  const taxonomyNames = taxonomy.rarities.flatMap((rarity) =>
    rarity.brainrots.map((brainrot) => brainrot.name),
  );
  const newestByName = await fetchNewestG2GListingByName(taxonomyNames);

  const queue = buildQueue(taxonomy, options.brainrot, newestByName);
  const progress = await readProgress(options.progressPath, options.resetProgress);
  const { eligible, usePanelRefresh } = selectTargets(queue, progress, options);
  const targets = eligible.slice(0, options.maxBrainrots);

  console.log("G2G Steal a Brainrot collection");
  console.log(`  catalog (G2G taxonomy): ${queue.length} brainrots`);
  console.log(
    `  mode: ${usePanelRefresh ? `panel refresh (>${options.refreshAfterHours}h)` : "backfill (new only)"}`,
  );
  console.log(`  eligible: ${eligible.length} | selected this run: ${targets.length}`);

  // ROUTE-016: print the staleness spread. This is the number that proves the
  // queue can rotate — 1 distinct value means the sort has collapsed to its name
  // tiebreaker and the tail is being starved, which is the bug this replaced.
  if (usePanelRefresh) {
    const distinct = new Set(queue.map((row) => row.last_crawled_at ?? "never")).size;
    const neverCrawled = queue.filter((row) => !row.last_crawled_at).length;
    console.log(
      `  crawl-freshness signal: ${distinct} distinct value(s) across ` +
        `${queue.length} brainrots (${neverCrawled} never crawled)`,
    );
    if (distinct <= 1 && queue.length > 1) {
      console.warn(
        "  ⚠️  the freshness signal is constant — the queue cannot rotate and " +
          "everything past --max-brainrots will be starved (see ROUTE-016).",
      );
    }
  }

  if (!targets.length) {
    console.log("No eligible targets. Use --reset-progress or --refresh-after-hours to re-crawl.");
    return;
  }

  const listingsById = new Map();
  const summaries = [];

  for (const [index, brainrot] of targets.entries()) {
    if (index > 0) await sleep(options.delayMs);
    console.log(`\n[${index + 1}/${targets.length}] ${brainrot.name} (${brainrot.rarity})`);

    try {
      const result = await collectBrainrot(brainrot, options, observedAt);
      for (const listing of result.listings) {
        listingsById.set(`${SOURCE_SLUG}:${listing.external_listing_id}`, listing);
      }
      const status = result.listings.length ? "collected" : "empty";
      summaries.push({
        brainrot_name: brainrot.name,
        rarity: brainrot.rarity,
        status,
        listing_count: result.listings.length,
        total_offer: result.total_offer,
      });
      progress.attempts[brainrot.id] = {
        brainrot_name: brainrot.name,
        status,
        attempted_at: new Date().toISOString(),
        listing_count: result.listings.length,
        collector_version: COLLECTOR_VERSION,
      };
      console.log(`  ${status}: ${result.listings.length} listing(s)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summaries.push({ brainrot_name: brainrot.name, status: "error", error: message });
      progress.attempts[brainrot.id] = {
        brainrot_name: brainrot.name,
        status: "error",
        attempted_at: new Date().toISOString(),
        error: message,
        collector_version: COLLECTOR_VERSION,
      };
      console.log(`  error: ${message}`);
      // A rate-limit or hard block should stop the run, not hammer on.
      if (/429|blocked/i.test(message)) break;
    }

    await writeProgress(options.progressPath, progress);
  }

  const listings = [...listingsById.values()].sort((left, right) =>
    left.external_listing_id.localeCompare(right.external_listing_id),
  );

  const output = {
    source_slug: SOURCE_SLUG,
    collected_at: observedAt,
    strategy: "g2g_public_offer_search_v3_by_brainrot",
    collector_version: COLLECTOR_VERSION,
    targets_requested: targets.length,
    targets_collected: summaries.filter((row) => row.status === "collected").length,
    listing_count: listings.length,
    target_summaries: summaries,
    listings,
  };

  await mkdir(dirname(resolve(process.cwd(), options.outputPath)), { recursive: true });
  await writeFile(
    resolve(process.cwd(), options.outputPath),
    `${JSON.stringify(output, null, 2)}\n`,
    "utf8",
  );
  console.log(`\nSaved ${listings.length} listing(s) to ${options.outputPath}`);

  if (!listings.length) {
    if (options.send) throw new Error("No G2G listings parsed; nothing was imported.");
    console.log("\nNo listings collected. Review target_summaries.");
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

// ROUTE-016: only run when invoked as a script, so the queue-ordering helpers
// above can be unit-tested by importing this module without starting a crawl.
const invokedDirectly =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((error) => {
    console.error(`\nG2G collection failed: ${error.message}`);
    process.exitCode = 1;
  });
}
