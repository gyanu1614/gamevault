// Read-only inspection of the SAB catalog + pricing pipeline.
// Loads credentials from .env.local (gitignored). SELECT only — no writes.
//
// Usage: node scripts/sab-db-inspect.mjs [command]
//   brainrots   list all sab_brainrots (name, slug)   [default]
//   mutations   list all sab_mutations (name, slug)
//   sources     list sab_market_sources (status, weight)
//   catalog     current public price catalog rows

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Minimal .env.local loader (no dependency on dotenv).
function loadEnv() {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

const command = process.argv[2] ?? "brainrots";

async function main() {
  if (command === "brainrots") {
    const { data, error } = await supabase
      .from("sab_brainrots")
      .select("name, slug, rarity")
      .order("name");
    if (error) throw error;
    console.log(`sab_brainrots: ${data.length} rows\n`);
    for (const r of data) console.log(`${(r.rarity ?? "").padEnd(12)} ${r.name}  (${r.slug})`);
    return;
  }

  if (command === "mutations") {
    const { data, error } = await supabase
      .from("sab_mutations")
      .select("name, slug")
      .order("name");
    if (error) throw error;
    console.log(`sab_mutations: ${data.length} rows\n`);
    for (const r of data) console.log(`${r.name}  (${r.slug})`);
    return;
  }

  if (command === "sources") {
    const { data, error } = await supabase
      .from("sab_market_sources")
      .select("slug, name, status, source_weight, supports_active_listings, supports_completed_sales, last_success_at")
      .order("slug");
    if (error) throw error;
    console.table(data);
    return;
  }

  if (command === "catalog") {
    const { data, error } = await supabase
      .from("sab_public_price_catalog")
      .select("brainrot_name, mutation_name, market_value_usd, confidence_label, external_sample_size, source_count")
      .order("market_value_usd", { ascending: false })
      .limit(50);
    if (error) throw error;
    console.log(`sab_public_price_catalog: showing top ${data.length} by value\n`);
    console.table(data);
    return;
  }

  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

main().catch((e) => {
  console.error("Query failed:", e.message ?? e);
  process.exit(1);
});
