import { createClient } from "npm:@supabase/supabase-js@2";

type ImportRequest = {
  source_slug?: unknown;
  listings?: unknown;
};

type RevalidationResult =
  | {
      ok: true;
      skipped: false;
      status: number;
    }
  | {
      // ROUTE-010: every non-ok shape carries an `error`, including the
      // "not configured" case, which previously reported ok:true and hid a
      // pipeline that was never revalidating anything.
      ok: false;
      skipped: boolean;
      status?: number;
      error: string;
    };

const encoder = new TextEncoder();

function constantTimeEqual(
  left: string,
  right: string,
): boolean {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const maxLength = Math.max(
    leftBytes.length,
    rightBytes.length,
  );

  let difference =
    leftBytes.length ^ rightBytes.length;

  for (
    let index = 0;
    index < maxLength;
    index += 1
  ) {
    difference |=
      (leftBytes[index] ?? 0) ^
      (rightBytes[index] ?? 0);
  }

  return difference === 0;
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type":
        "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function revalidateMarketPages():
  Promise<RevalidationResult> {
  const revalidateUrl = Deno.env.get(
    "SAB_MARKET_REVALIDATE_URL",
  );
  const revalidateSecret = Deno.env.get(
    "SAB_MARKET_REVALIDATE_SECRET",
  );
  const vercelBypassSecret = Deno.env.get(
    "VERCEL_AUTOMATION_BYPASS_SECRET",
  );

  // ROUTE-010: missing configuration used to report ok:true/skipped, so a
  // pipeline that never revalidated anything looked healthy. Treat it as the
  // misconfiguration it is.
  if (!revalidateUrl || !revalidateSecret) {
    return {
      ok: false,
      skipped: true,
      error:
        "SAB_MARKET_REVALIDATE_URL or SAB_MARKET_REVALIDATE_SECRET is not configured",
    };
  }

  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-revalidate-secret": revalidateSecret,
    };

    if (vercelBypassSecret) {
      headers["x-vercel-protection-bypass"] =
        vercelBypassSecret;
    }

    const response = await fetch(revalidateUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        reason: "sab-market-import",
      }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      const responseText = await response.text();

      return {
        ok: false,
        skipped: false,
        status: response.status,
        error:
          responseText ||
          `Revalidation returned HTTP ${response.status}`,
      };
    }

    return {
      ok: true,
      skipped: false,
      status: response.status,
    };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown revalidation error",
    };
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        error: "Method not allowed",
      },
      405,
    );
  }

  const expectedSecret = Deno.env.get(
    "SAB_MARKET_IMPORT_SECRET",
  );

  if (!expectedSecret) {
    console.error(
      "SAB_MARKET_IMPORT_SECRET is not configured",
    );

    return jsonResponse(
      {
        ok: false,
        error: "Server is not configured",
      },
      500,
    );
  }

  const suppliedSecret =
    request.headers.get("x-import-secret") ?? "";

  if (
    !constantTimeEqual(
      suppliedSecret,
      expectedSecret,
    )
  ) {
    return jsonResponse(
      {
        ok: false,
        error: "Unauthorized",
      },
      401,
    );
  }

  let body: ImportRequest;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      {
        ok: false,
        error: "Invalid JSON body",
      },
      400,
    );
  }

  const sourceSlug =
    typeof body.source_slug === "string"
      ? body.source_slug.trim().toLowerCase()
      : "";

  // Whether to recompute + republish market estimates after this insert.
  // sab_publish_market_estimates() re-aggregates over ALL listings, so running
  // it on every 500-listing batch means dozens of full recomputes per crawl —
  // which intermittently trips the Postgres statement timeout (57014). A multi-
  // batch importer sends publish:false on every batch and then makes ONE final
  // publish:true call. Defaults to true so existing single-call clients are
  // unaffected.
  const shouldPublish = body.publish !== false;

  if (!sourceSlug) {
    return jsonResponse(
      {
        ok: false,
        error: "source_slug is required",
      },
      400,
    );
  }

  if (!Array.isArray(body.listings)) {
    return jsonResponse(
      {
        ok: false,
        error: "listings must be an array",
      },
      400,
    );
  }

  if (
    body.listings.length === 0 ||
    body.listings.length > 500
  ) {
    return jsonResponse(
      {
        ok: false,
        error:
          "Each request must contain 1–500 listings",
      },
      400,
    );
  }

  const supabaseUrl = Deno.env.get(
    "SUPABASE_URL",
  );
  const serviceRoleKey = Deno.env.get(
    "SUPABASE_SERVICE_ROLE_KEY",
  );

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "Supabase environment is not configured",
      },
      500,
    );
  }

  try {
    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const {
      data: importData,
      error: importError,
    } = await supabaseAdmin.rpc(
      "sab_import_market_listings",
      {
        p_source_slug: sourceSlug,
        p_listings: body.listings,
      },
    );

    if (importError) {
      console.error(
        "Market import failed:",
        importError,
      );

      return jsonResponse(
        {
          ok: false,
          error: "Market import failed",
          details: importError.message,
        },
        500,
      );
    }

    const importResult = Array.isArray(importData)
      ? importData[0] ?? null
      : importData;

    // Skip the heavy full-dataset republish for intermediate batches — the
    // caller runs it exactly once after the final batch (publish:true).
    if (!shouldPublish) {
      return jsonResponse({
        ok: true,
        result: importResult,
        publication: {
          ok: true,
          skipped: true,
          published_rows: 0,
        },
      });
    }

    const {
      data: publishedRows,
      error: publishError,
    } = await supabaseAdmin.rpc(
      "sab_publish_market_estimates",
    );

    if (publishError) {
      console.error(
        "Listings imported but estimate publication failed:",
        publishError,
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Listings imported but price publication failed",
          details: publishError.message,
          result: importResult,
        },
        500,
      );
    }

    // ROUTE-014: refresh the evidence snapshot FIRST. sab_price_display is
    // derived from the estimates chain, which now reads
    // sab_market_evidence_display — so refreshing the display table before the
    // evidence would materialize prices from the PREVIOUS crawl's evidence.
    // Order here is load-bearing: publish -> evidence -> display.
    //
    // Hard failure: publishing estimates that the correction pipeline will then
    // read from a stale snapshot is the silent-staleness failure mode that hid a
    // month of frozen prices (ROUTE-010). A failed refresh leaves the previous
    // snapshot intact, so returning 500 keeps the last good state rather than a
    // half-updated one.
    const {
      data: evidenceRows,
      error: evidenceError,
    } = await supabaseAdmin.rpc(
      "sab_refresh_evidence_display",
    );

    if (evidenceError) {
      console.error(
        "Estimates published but sab_market_evidence_display refresh failed:",
        evidenceError,
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Listings imported but evidence snapshot refresh failed",
          details: evidenceError.message,
          result: importResult,
          publication: {
            ok: true,
            published_rows: publishedRows ?? 0,
          },
        },
        500,
      );
    }

    // ROUTE-010: materialize sab_price_display from the freshly published
    // estimates. Every price page reads that table for its values AND for the
    // "Updated …" timestamp, and until now its ONLY writer was the daily
    // correct-prices cron (runSabCorrection). A crawl could publish estimates
    // perfectly and still never reach the page, which is exactly why the values
    // pages sat at "Aug 13" while crawls kept passing. Refreshing here closes
    // that gap so a successful crawl is visible without waiting for the cron.
    const {
      data: displayRows,
      error: displayError,
    } = await supabaseAdmin.rpc(
      "sab_refresh_price_display",
    );

    if (displayError) {
      console.error(
        "Estimates published but sab_price_display refresh failed:",
        displayError,
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Listings imported but price display refresh failed",
          details: displayError.message,
          result: importResult,
          publication: {
            ok: true,
            published_rows: publishedRows ?? 0,
          },
        },
        500,
      );
    }

    const revalidation =
      await revalidateMarketPages();

    // ROUTE-010: a failed revalidation means fresh prices are in the database
    // but the public pages keep serving the cached old ones — silent staleness,
    // which is the failure mode that hid a stale deployment URL (HTTP 410 GONE)
    // for weeks. Surface it as a hard failure so the workflow goes red.
    if (!revalidation.ok) {
      console.error(
        "Market pages were not revalidated:",
        revalidation,
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Prices published but market pages were not revalidated",
          details:
            revalidation.error ??
            `Revalidation failed with HTTP ${revalidation.status ?? "unknown"}`,
          result: importResult,
          publication: {
            ok: true,
            published_rows: publishedRows ?? 0,
          },
          display_refreshed: Number(displayRows ?? 0),
          revalidation,
        },
        502,
      );
    }

    return jsonResponse({
      ok: true,
      result: importResult,
      publication: {
        ok: true,
        published_rows: publishedRows ?? 0,
      },
      evidence_refreshed: Number(evidenceRows ?? 0),
      display_refreshed: Number(displayRows ?? 0),
      revalidation,
    });
  } catch (error) {
    console.error(
      "Unexpected market import error:",
      error,
    );

    return jsonResponse(
      {
        ok: false,
        error: "Unexpected server error",
      },
      500,
    );
  }
});
