import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const SOURCE_SLUG = "itemku";
const DEFAULT_START_URL =
  "https://www.itemku.com/en/g/steal-a-brainrot/item";
const DEFAULT_OUTPUT =
  "data/sab-market-feeds/itemku-latest.json";

const MAC_BROWSER_CHANNELS = [
  {
    channel: "chrome",
    path:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  },
  {
    channel: "chrome-canary",
    path:
      "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  },
  {
    channel: "msedge",
    path:
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  },
];

function parseArguments(argv) {
  const options = {
    startUrl: DEFAULT_START_URL,
    outputPath: DEFAULT_OUTPUT,
    maxPages: Number(
      process.env.ITEMKU_MAX_PAGES ?? 60,
    ),
    delayMs: Number(
      process.env.ITEMKU_DELAY_MS ?? 2500,
    ),
    send: false,
    headed: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--send") {
      options.send = true;
      continue;
    }

    if (argument === "--headed") {
      options.headed = true;
      continue;
    }

    const value = argv[index + 1];

    if (argument === "--max-pages" && value) {
      options.maxPages = Number(value);
      index += 1;
      continue;
    }

    if (argument === "--delay-ms" && value) {
      options.delayMs = Number(value);
      index += 1;
      continue;
    }

    if (argument === "--start-url" && value) {
      options.startUrl = value;
      index += 1;
      continue;
    }

    if (argument === "--output" && value) {
      options.outputPath = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown or incomplete argument: ${argument}`);
  }

  if (
    !Number.isInteger(options.maxPages) ||
    options.maxPages < 1 ||
    options.maxPages > 200
  ) {
    throw new Error(
      "--max-pages must be an integer from 1 to 200",
    );
  }

  if (
    !Number.isInteger(options.delayMs) ||
    options.delayMs < 1000 ||
    options.delayMs > 60000
  ) {
    throw new Error(
      "--delay-ms must be from 1000 to 60000",
    );
  }

  const startUrl = new URL(options.startUrl);

  if (
    startUrl.protocol !== "https:" ||
    !["itemku.com", "www.itemku.com"].includes(
      startUrl.hostname.toLowerCase(),
    )
  ) {
    throw new Error(
      "--start-url must be an HTTPS Itemku URL",
    );
  }

  return {
    ...options,
    startUrl: startUrl.toString(),
    outputPath: resolve(
      process.cwd(),
      options.outputPath,
    ),
  };
}

function getLaunchOptions(headed) {
  const requestedChannel =
    process.env.ITEMKU_BROWSER_CHANNEL?.trim();

  if (requestedChannel) {
    return {
      headless: !headed,
      channel: requestedChannel,
    };
  }

  if (process.platform === "darwin") {
    const installedBrowser =
      MAC_BROWSER_CHANNELS.find((browser) =>
        existsSync(browser.path),
      );

    if (!installedBrowser) {
      throw new Error(
        "No supported system Chrome or Edge installation was found in /Applications.",
      );
    }

    console.log(
      `Using installed browser: ${installedBrowser.channel}`,
    );

    return {
      headless: !headed,
      channel: installedBrowser.channel,
    };
  }

  return {
    headless: !headed,
  };
}

function sleep(milliseconds) {
  return new Promise((resolvePromise) =>
    setTimeout(resolvePromise, milliseconds),
  );
}

function buildPageUrl(startUrl, pageNumber) {
  const url = new URL(startUrl);

  if (pageNumber === 1) {
    url.searchParams.delete("page");
  } else {
    url.searchParams.set("page", String(pageNumber));
  }

  return url.toString();
}

function compactWhitespace(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractProductId(url) {
  return (
    new URL(url).pathname.match(
      /\/product\/[^/]+\/(\d+)\/?$/i,
    )?.[1] ?? null
  );
}

function parseCardText(rawText) {
  const text = compactWhitespace(rawText);
  const priceMatch = text.match(
    /(?:\bUSD|\$)\s*([0-9][0-9.,]*)/i,
  );

  if (!priceMatch || priceMatch.index == null) {
    return null;
  }

  const price = Number(
    priceMatch[1].replace(/,/g, ""),
  );

  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }

  const title = text
    .slice(0, priceMatch.index)
    .replace(/^Offer from \d+ sellers?\s+/i, "")
    .replace(/^Ad\s+/i, "")
    .replace(
      /\s+(?:Item(?:\s+Wholesale)?|Wholesale)\s*$/i,
      "",
    )
    .trim();

  if (title.length < 3) return null;

  return {
    title,
    price,
  };
}

async function collectPage(
  page,
  pageUrl,
  observedAt,
) {
  const response = await page.goto(pageUrl, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });

  if (!response) {
    throw new Error(
      `No navigation response for ${pageUrl}`,
    );
  }

  const status = response.status();

  if (status === 403 || status === 429) {
    throw new Error(
      `Itemku returned HTTP ${status}; collection stopped.`,
    );
  }

  if (status >= 400) {
    throw new Error(
      `Itemku returned HTTP ${status} for ${pageUrl}`,
    );
  }

  try {
    await page.waitForSelector(
      'a[href*="/product/"]',
      {
        state: "attached",
        timeout: 20000,
      },
    );
  } catch {
    await page.waitForTimeout(3000);
  }

  const extracted = await page.evaluate(() => {
    const compact = (value) =>
      String(value ?? "")
        .replace(/\s+/g, " ")
        .trim();

    const bodyText = compact(
      document.body?.innerText,
    );

    const rows = Array.from(
      document.querySelectorAll(
        'a[href*="/product/"]',
      ),
    ).map((anchor) => {
      const candidateTexts = [];
      let node = anchor;

      for (
        let depth = 0;
        node && depth < 8;
        depth += 1
      ) {
        const text = compact(node.innerText);

        if (text) candidateTexts.push(text);

        if (
          /(?:\bUSD|\$)\s*[0-9]/i.test(text)
        ) {
          break;
        }

        node = node.parentElement;
      }

      return {
        href: anchor.href,
        text:
          candidateTexts.find((candidate) =>
            /(?:\bUSD|\$)\s*[0-9]/i.test(
              candidate,
            ),
          ) ??
          candidateTexts[0] ??
          "",
      };
    });

    const resultCountMatch = bodyText.match(
      /results found:\s*([0-9,]+)\s*products?/i,
    );

    return {
      rows,
      bodyText,
      resultCount: resultCountMatch
        ? Number(
            resultCountMatch[1].replace(/,/g, ""),
          )
        : null,
    };
  });

  const listings = new Map();

  for (const row of extracted.rows) {
    let listingUrl;

    try {
      listingUrl = new URL(row.href);
    } catch {
      continue;
    }

    if (
      !["itemku.com", "www.itemku.com"].includes(
        listingUrl.hostname.toLowerCase(),
      )
    ) {
      continue;
    }

    const productId = extractProductId(
      listingUrl.toString(),
    );
    const parsed = parseCardText(row.text);

    if (!productId || !parsed) continue;

    listingUrl.search = "";
    listingUrl.hash = "";

    listings.set(productId, {
      external_listing_id: productId,
      listing_url: listingUrl.toString(),
      listing_type: "active_listing",
      listing_status: "active",
      title: parsed.title,
      currency: "USD",
      listed_price: parsed.price,
      shipping_price: 0,
      quantity: 1,
      total_price_usd: parsed.price,
      observed_at: observedAt,
    });
  }

  return {
    listings: [...listings.values()],
    productAnchorCount: extracted.rows.length,
    resultCount: extracted.resultCount,
    bodyPreview: extracted.bodyText.slice(0, 500),
    finalUrl: page.url(),
  };
}

function runImporter(outputPath) {
  return new Promise(
    (resolvePromise, rejectPromise) => {
      const child = spawn(
        process.execPath,
        [
          "scripts/import-sab-market-json.mjs",
          outputPath,
          "--send",
        ],
        {
          cwd: process.cwd(),
          env: process.env,
          stdio: "inherit",
        },
      );

      child.once("error", rejectPromise);
      child.once("exit", (code) => {
        if (code === 0) {
          resolvePromise();
          return;
        }

        rejectPromise(
          new Error(
            `Bulk importer exited with code ${code}`,
          ),
        );
      });
    },
  );
}

async function main() {
  const options = parseArguments(
    process.argv.slice(2),
  );
  const observedAt = new Date().toISOString();
  const listingsById = new Map();
  const pageSummaries = [];
  let expectedResultCount = null;
  let emptyPageCount = 0;

  const browser = await chromium.launch(
    getLaunchOptions(options.headed),
  );

  const context = await browser.newContext({
    locale: "en-US",
    viewport: {
      width: 1440,
      height: 1000,
    },
  });
  const page = await context.newPage();

  try {
    console.log(
      `Collecting Itemku SAB listings from ${options.startUrl}`,
    );

    for (
      let pageNumber = 1;
      pageNumber <= options.maxPages;
      pageNumber += 1
    ) {
      if (pageNumber > 1) {
        await sleep(options.delayMs);
      }

      const pageUrl = buildPageUrl(
        options.startUrl,
        pageNumber,
      );

      console.log(
        `Page ${pageNumber}: ${pageUrl}`,
      );

      const result = await collectPage(
        page,
        pageUrl,
        observedAt,
      );

      if (
        pageNumber === 1 &&
        result.resultCount != null
      ) {
        expectedResultCount = result.resultCount;
      }

      let newListingCount = 0;

      for (const listing of result.listings) {
        if (
          !listingsById.has(
            listing.external_listing_id,
          )
        ) {
          newListingCount += 1;
        }

        listingsById.set(
          listing.external_listing_id,
          listing,
        );
      }

      pageSummaries.push({
        page: pageNumber,
        requested_url: pageUrl,
        final_url: result.finalUrl,
        product_anchors:
          result.productAnchorCount,
        parsed: result.listings.length,
        new_listings: newListingCount,
      });

      console.log(
        `  anchors ${result.productAnchorCount}, parsed ${result.listings.length}, new ${newListingCount}, total ${listingsById.size}`,
      );

      if (
        pageNumber === 1 &&
        result.productAnchorCount === 0
      ) {
        console.log(
          `  page preview: ${result.bodyPreview}`,
        );

        await mkdir(
          "data/sab-market-feeds",
          {
            recursive: true,
          },
        );
        await page.screenshot({
          path:
            "data/sab-market-feeds/itemku-debug.png",
          fullPage: true,
        });
        console.log(
          "  saved data/sab-market-feeds/itemku-debug.png",
        );
      }

      emptyPageCount =
        newListingCount === 0
          ? emptyPageCount + 1
          : 0;

      if (emptyPageCount >= 2) {
        console.log(
          "Stopping after two pages with no new product IDs.",
        );
        break;
      }

      if (
        expectedResultCount != null &&
        listingsById.size >=
          expectedResultCount
      ) {
        break;
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  if (listingsById.size === 0) {
    throw new Error(
      "No Itemku product listings were parsed. Run with --headed and inspect itemku-debug.png.",
    );
  }

  const listings = [
    ...listingsById.values(),
  ].sort((left, right) =>
    left.external_listing_id.localeCompare(
      right.external_listing_id,
    ),
  );

  const output = {
    source_slug: SOURCE_SLUG,
    collected_at: observedAt,
    start_url: options.startUrl,
    expected_result_count:
      expectedResultCount,
    pages_requested: pageSummaries.length,
    listing_count: listings.length,
    page_summaries: pageSummaries,
    listings,
  };

  await mkdir(dirname(options.outputPath), {
    recursive: true,
  });
  await writeFile(
    options.outputPath,
    `${JSON.stringify(output, null, 2)}\n`,
    "utf8",
  );

  console.log(
    `\nSaved ${listings.length.toLocaleString()} listings to ${options.outputPath}`,
  );

  if (!options.send) {
    console.log(
      "\nDry run only. Add --send to validate and import the feed.",
    );
    return;
  }

  if (
    !process.env.SAB_MARKET_IMPORT_SECRET
  ) {
    throw new Error(
      "SAB_MARKET_IMPORT_SECRET is required with --send",
    );
  }

  await runImporter(options.outputPath);
}

main().catch((error) => {
  console.error(
    `\nItemku collection failed: ${error.message}`,
  );
  process.exitCode = 1;
});
