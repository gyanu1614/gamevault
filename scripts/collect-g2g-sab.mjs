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

/** Flatten the taxonomy into a single ranked Brainrot queue. */
function buildQueue(taxonomy, requestedName) {
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
      });
    }
  }

  if (requestedName) {
    const wanted = comparable(requestedName);
    queue = queue.filter((row) => comparable(row.name) === wanted);
    if (!queue.length) throw new Error(`Brainrot not found in G2G taxonomy: ${requestedName}`);
  }

  // High-value rarities first — the ones cash buyers convert on.
  queue.sort(
    (left, right) =>
      right.rarity_weight - left.rarity_weight ||
      left.name.localeCompare(right.name, "en", { sensitivity: "base" }),
  );

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

function selectTargets(queue, progress, options) {
  const refreshAfterMs = options.refreshAfterHours * 60 * 60 * 1000;
  const usePanelRefresh = options.refreshAfterHours > 0;

  const eligible = queue.filter((row) => {
    const attempt = progress.attempts[row.id];
    if (!attempt) return true;
    if (!usePanelRefresh) return false;
    const attemptedAt = Date.parse(attempt.attempted_at ?? "");
    return !Number.isFinite(attemptedAt) || Date.now() - attemptedAt >= refreshAfterMs;
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
  const queue = buildQueue(taxonomy, options.brainrot);
  const progress = await readProgress(options.progressPath, options.resetProgress);
  const { eligible, usePanelRefresh } = selectTargets(queue, progress, options);
  const targets = eligible.slice(0, options.maxBrainrots);

  console.log("G2G Steal a Brainrot collection");
  console.log(`  catalog (G2G taxonomy): ${queue.length} brainrots`);
  console.log(
    `  mode: ${usePanelRefresh ? `panel refresh (>${options.refreshAfterHours}h)` : "backfill (new only)"}`,
  );
  console.log(`  eligible: ${eligible.length} | selected this run: ${targets.length}`);

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

main().catch((error) => {
  console.error(`\nG2G collection failed: ${error.message}`);
  process.exitCode = 1;
});
