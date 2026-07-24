import { createClient } from "npm:@supabase/supabase-js@2";

type ImportRequest = {
  source_slug?: unknown;
  listings?: unknown;
};

const encoder = new TextEncoder();

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length);

  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < maxLength; index += 1) {
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
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
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

  if (!constantTimeEqual(suppliedSecret, expectedSecret)) {
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
        error: "Each request must contain 1–500 listings",
      },
      400,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
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
        error: "Supabase environment is not configured",
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

    const { data, error } = await supabaseAdmin.rpc(
      "sab_import_market_listings",
      {
        p_source_slug: sourceSlug,
        p_listings: body.listings,
      },
    );

    if (error) {
      console.error("Market import failed:", error);

      return jsonResponse(
        {
          ok: false,
          error: "Market import failed",
          details: error.message,
        },
        500,
      );
    }

    return jsonResponse({
      ok: true,
      result: Array.isArray(data)
        ? data[0] ?? null
        : data,
    });
  } catch (error) {
    console.error("Unexpected market import error:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Unexpected server error",
      },
      500,
    );
  }
});