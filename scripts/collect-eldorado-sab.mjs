import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import dotenv from "dotenv";
import { chromium } from "playwright";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

const SOURCE_SLUG = "eldorado";
const BASE_URL = "https://www.eldorado.gg";
const CATEGORY_ID = "259";
const MEDIUM_SAMPLE_TARGET = 5;
const DEFAULT_OUTPUT = "data/sab-market-feeds/eldorado-latest.json";
const DEFAULT_PROGRESS = "data/sab-market-feeds/eldorado-progress.json";
const MAC_BROWSERS = [
  ["chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"],
  ["chrome-canary", "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"],
  ["msedge", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"],
];

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
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--headed") options.headed = true;
    else if (arg === "--send") options.send = true;
    else if (arg === "--reset-progress") options.resetProgress = true;
    else {
      const value = argv[index + 1];
      if (!value) throw new Error(`Missing value for ${arg}`);
      if (arg === "--max-brainrots") options.maxBrainrots = Number(value);
      else if (arg === "--samples-per-variant") options.samplesPerVariant = Number(value);
      else if (arg === "--delay-ms") options.delayMs = Number(value);
      else if (arg === "--output") options.outputPath = value;
      else if (arg === "--progress") options.progressPath = value;
      else if (arg === "--brainrot") options.brainrot = value.trim();
      else throw new Error(`Unknown argument: ${arg}`);
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

function launchOptions(headed) {
  const channel = process.env.ELDORADO_BROWSER_CHANNEL?.trim();
  if (channel) return { headless: !headed, channel };
  if (process.platform !== "darwin") return { headless: !headed };
  const browser = MAC_BROWSERS.find(([, path]) => existsSync(path));
  if (!browser) throw new Error("No supported Chrome or Edge installation found in /Applications.");
  console.log(`Using installed browser: ${browser[0]}`);
  return { headless: !headed, channel: browser[0] };
}

const compact = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const comparable = (value) => compact(value)
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();
const slugify = (value) => comparable(value).replace(/\s+/g, "-");
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
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
    headers: { apikey: key, authorization: `Bearer ${key}`, accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Supabase ${table} query failed (${response.status}): ${await response.text()}`);
  return response.json();
}

async function buildQueue(requestedName) {
  const [brainrots, prices, mutations] = await Promise.all([
    supabaseRows("sab_brainrot_catalog", "id,name,slug,rarity", "name.asc"),
    supabaseRows("sab_public_price_catalog", "brainrot_id,mutation_slug,confidence_label,external_sample_size,source_count"),
    supabaseRows("sab_mutation_catalog", "id,name,slug,income_multiplier", "income_multiplier.asc"),
  ]);
  const defaultPrices = new Map(
    prices.filter((row) => row.mutation_slug === "default").map((row) => [row.brainrot_id, row]),
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
    queue = queue.filter((row) => comparable(row.name) === requested || comparable(row.slug) === requested);
    if (!queue.length) throw new Error(`Brainrot not found: ${requestedName}`);
  } else {
    queue = queue.filter((row) => row.priority < 2);
  }
  queue.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  return {
    queue,
    mutations,
    totals: {
      catalog: brainrots.length,
      public_price_rows: prices.length,
      missing_default_prices: queue.filter((row) => row.current_confidence === "missing").length,
      low_default_prices: queue.filter((row) => row.current_confidence === "low").length,
    },
  };
}

async function readProgress(path, reset) {
  if (reset || !existsSync(path)) return { version: 1, updated_at: new Date().toISOString(), attempts: {} };
  const parsed = JSON.parse(await readFile(path, "utf8"));
  return { version: 1, updated_at: parsed.updated_at, attempts: parsed.attempts ?? {} };
}

async function writeProgress(path, progress) {
  progress.updated_at = new Date().toISOString();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(progress, null, 2)}\n`, "utf8");
}

function pageCandidates(name) {
  const slug = slugify(name);
  return [
    `${BASE_URL}/${slug}-steal-a-brainrot/i/${CATEGORY_ID}`,
    `${BASE_URL}/${slug}/i/${CATEGORY_ID}`,
  ];
}

function parsePrice(text) {
  const matches = [...text.matchAll(/\$\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/g)];
  if (!matches.length) return null;
  const price = Number(matches.at(-1)[1].replace(/,/g, ""));
  return Number.isFinite(price) && price > 0 ? price : null;
}

function detectMutation(text, mutations) {
  const rate = text.match(/\b\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?\s*[KMBT]?\/s\b/i);
  if (!rate || rate.index == null) return null;
  const tail = comparable(text.slice(rate.index + rate[0].length));
  if (tail === "none" || tail.startsWith("none ")) {
    return mutations.find((row) => row.slug === "default") ?? { id: null, name: "None", slug: "default" };
  }
  const sorted = mutations
    .filter((row) => row.slug !== "default")
    .sort((a, b) => b.name.length - a.name.length);
  return sorted.find((row) => {
    const name = comparable(row.name);
    return tail === name || tail.startsWith(`${name} `);
  }) ?? null;
}

function listingId(href, text) {
  if (href) {
    try {
      const url = new URL(href);
      for (const key of ["offerId", "offer_id", "listingId", "listing_id", "itemId", "item_id"]) {
        const value = url.searchParams.get(key);
        if (value) return value;
      }
      const numbers = url.pathname.match(/\d{4,}/g);
      if (numbers?.length) return numbers.at(-1);
    } catch {}
  }
  return hash(text);
}

async function visibleCards(page, brainrotName) {
  return page.evaluate(({ expected }) => {
    const compactText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
    const normalized = (value) => compactText(value)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    const candidate = (element) => {
      const text = compactText(element.innerText);
      return text.length >= 20 && text.length <= 900 &&
        /\$\s*[0-9]/.test(text) &&
        /\b\d{2,3}(?:\.\d+)?%\s*\([0-9,]+\)/.test(text) &&
        /[KMBT]?\/s\b/i.test(text) &&
        normalized(text).includes(expected);
    };
    const all = Array.from(document.querySelectorAll("article, li, a, div")).filter(candidate);
    const minimal = all.filter((element) => !Array.from(element.children).some(candidate));
    return {
      rows: minimal.map((element) => {
        const anchors = [
          ...(element.matches("a[href]") ? [element] : []),
          ...element.querySelectorAll("a[href]"),
        ];
        return {
          text: compactText(element.innerText),
          href: anchors.map((anchor) => anchor.href)
            .find((href) => /^https:\/\/(?:www\.)?eldorado\.gg\//i.test(href)) ?? null,
        };
      }),
      title: document.title,
      final_url: window.location.href,
      body_preview: compactText(document.body?.innerText).slice(0, 700),
    };
  }, { expected: comparable(brainrotName) });
}

async function collectOne({ page, brainrot, mutations, samplesPerVariant, observedAt }) {
  const attempts = [];
  for (const requestedUrl of pageCandidates(brainrot.name)) {
    const response = await page.goto(requestedUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    if (!response) {
      attempts.push({ requested_url: requestedUrl, error: "no_navigation_response" });
      continue;
    }
    const status = response.status();
    if (status === 403 || status === 429) {
      throw new Error(`Eldorado returned HTTP ${status}; stopped without bypassing the block.`);
    }
    if (status >= 400) {
      attempts.push({ requested_url: requestedUrl, status });
      continue;
    }
    try {
      await page.waitForFunction(
        (name) => (document.body?.innerText ?? "").toLowerCase().includes(name.toLowerCase()),
        brainrot.name,
        { timeout: 20000 },
      );
    } catch {
      await page.waitForTimeout(3000);
    }

    const extracted = await visibleCards(page, brainrot.name);
    const byVariant = new Map();
    const rejected = [];
    for (const row of extracted.rows) {
      const text = compact(row.text);
      if (!comparable(text).includes(comparable(brainrot.name)) || /\b(account|bundle|inventory|starter pack|random brainrot|mystery)\b/i.test(text)) {
        rejected.push({ reason: "rejected_card", text: text.slice(0, 240) });
        continue;
      }
      const price = parsePrice(text);
      const mutation = detectMutation(text, mutations);
      if (!price || !mutation) {
        rejected.push({ reason: !price ? "price_not_found" : "mutation_not_found", text: text.slice(0, 240) });
        continue;
      }
      const rows = byVariant.get(mutation.slug) ?? [];
      if (rows.length >= samplesPerVariant) continue;
      const id = listingId(row.href, `${brainrot.id}:${mutation.slug}:${text}`);
      if (rows.some((listing) => listing.external_listing_id === id)) continue;
      rows.push({
        external_listing_id: id,
        listing_url: row.href ?? `${extracted.final_url}#listing-${id}`,
        listing_type: "active_listing",
        listing_status: "active",
        title: text.slice(0, 500),
        currency: "USD",
        listed_price: price,
        shipping_price: 0,
        quantity: 1,
        total_price_usd: price,
        observed_at: observedAt,
      });
      byVariant.set(mutation.slug, rows);
    }
    const listings = [...byVariant.values()].flat();
    attempts.push({
      requested_url: requestedUrl,
      status,
      title: extracted.title,
      final_url: extracted.final_url,
      candidate_cards: extracted.rows.length,
      parsed_listings: listings.length,
      rejected_cards: rejected.length,
      body_preview: extracted.body_preview,
    });
    if (listings.length) {
      return {
        page_url: requestedUrl,
        final_url: extracted.final_url,
        listings,
        variants: Object.fromEntries([...byVariant].map(([slug, rows]) => [slug, rows.length])),
        attempts,
        rejected: rejected.slice(0, 20),
      };
    }
  }
  return { page_url: null, final_url: null, listings: [], variants: {}, attempts, rejected: [] };
}

function runImporter(outputPath) {
  return new Promise((resolveImport, rejectImport) => {
    const child = spawn(process.execPath, ["scripts/import-sab-market-json.mjs", outputPath, "--send"], {
      cwd: process.cwd(), env: process.env, stdio: "inherit",
    });
    child.once("error", rejectImport);
    child.once("exit", (code) => code === 0
      ? resolveImport()
      : rejectImport(new Error(`Bulk importer exited with code ${code}`)));
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const observedAt = new Date().toISOString();
  const { queue, mutations, totals } = await buildQueue(options.brainrot);
  const progress = await readProgress(options.progressPath, options.resetProgress);
  const targets = queue.filter((row) => !progress.attempts[row.id]).slice(0, options.maxBrainrots);

  console.log("Eldorado Brainrot-first queue");
  console.log(`  catalog: ${totals.catalog}`);
  console.log(`  missing default prices: ${totals.missing_default_prices}`);
  console.log(`  low-confidence default prices: ${totals.low_default_prices}`);
  console.log(`  selected this run: ${targets.length}`);
  if (!targets.length) {
    console.log("No eligible targets remain. Use --reset-progress to retry prior attempts.");
    return;
  }

  const browser = await chromium.launch(launchOptions(options.headed));
  const context = await browser.newContext({ locale: "en-US", viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  const listings = new Map();
  const summaries = [];

  try {
    for (let index = 0; index < targets.length; index += 1) {
      const brainrot = targets[index];
      if (index) await sleep(options.delayMs);
      console.log(`\n[${index + 1}/${targets.length}] ${brainrot.name} (${brainrot.current_confidence}, ${brainrot.current_sample_size} samples)`);
      let result;
      try {
        result = await collectOne({
          page, brainrot, mutations,
          samplesPerVariant: options.samplesPerVariant,
          observedAt,
        });
      } catch (error) {
        progress.attempts[brainrot.id] = {
          brainrot_name: brainrot.name, status: "error",
          attempted_at: new Date().toISOString(), error: error.message,
        };
        await writeProgress(options.progressPath, progress);
        throw error;
      }
      for (const listing of result.listings) listings.set(`${SOURCE_SLUG}:${listing.external_listing_id}`, listing);
      const status = result.listings.length ? "collected" : "empty";
      const summary = {
        brainrot_id: brainrot.id,
        brainrot_name: brainrot.name,
        brainrot_slug: brainrot.slug,
        prior_confidence: brainrot.current_confidence,
        prior_sample_size: brainrot.current_sample_size,
        page_url: result.page_url,
        final_url: result.final_url,
        status,
        listing_count: result.listings.length,
        variants: result.variants,
        attempts: result.attempts,
        rejected: result.rejected,
      };
      summaries.push(summary);
      progress.attempts[brainrot.id] = {
        brainrot_name: brainrot.name,
        status,
        attempted_at: new Date().toISOString(),
        listing_count: result.listings.length,
        variants: result.variants,
        page_url: result.page_url,
      };
      await writeProgress(options.progressPath, progress);
      console.log(`  ${status}: ${result.listings.length} listing(s) across ${Object.keys(result.variants).length} variant(s)`);
    }
  } finally {
    await context.close();
    await browser.close();
  }

  const rows = [...listings.values()].sort((a, b) => a.external_listing_id.localeCompare(b.external_listing_id));
  const output = {
    source_slug: SOURCE_SLUG,
    collected_at: observedAt,
    strategy: "brainrot_first_missing_then_low_until_medium",
    medium_sample_target: MEDIUM_SAMPLE_TARGET,
    samples_per_variant: options.samplesPerVariant,
    queue_totals: totals,
    targets_requested: targets.length,
    targets_collected: summaries.filter((row) => row.status === "collected").length,
    listing_count: rows.length,
    target_summaries: summaries,
    listings: rows,
  };
  await mkdir(dirname(options.outputPath), { recursive: true });
  await writeFile(options.outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`\nSaved ${rows.length} listing(s) to ${options.outputPath}`);
  console.log(`Progress saved to ${options.progressPath}`);
  if (!rows.length) throw new Error("No Eldorado listings parsed. Retry with --headed --reset-progress and inspect target_summaries.");
  if (!options.send) {
    console.log("\nDry run only. Review the JSON, then add --send to import it.");
    return;
  }
  if (!process.env.SAB_MARKET_IMPORT_SECRET) throw new Error("SAB_MARKET_IMPORT_SECRET is required with --send");
  await runImporter(options.outputPath);
}

main().catch((error) => {
  console.error(`\nEldorado collection failed: ${error.message}`);
  process.exitCode = 1;
});
