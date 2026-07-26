// Map the unmatched Itemku titles to the real sab_brainrots catalog.
// Read-only. Helps decide: missing brainrot vs. needs-alias vs. should-reject.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
// Strip mutation words + income-rate + " | steal a brainrot" noise to get the core name.
const MUTATIONS = ["rainbow", "gold", "diamond", "galaxy", "basic", "candy", "lava", "celestial", "bloodrot"];
function core(title) {
  let t = " " + norm(title) + " ";
  t = t.replace(/\s+steal a brainrot\s+/g, " ");
  t = t.replace(/\s+\d[\d.]*\s*[kmb]{1,2}\s*s\s+/g, " "); // income like 11 3m s
  for (const m of MUTATIONS) t = t.replace(new RegExp(`\\s${m}\\s`, "g"), " ");
  return t.trim();
}

const UNMATCHED = [
  "Admin Lucky Blox",
  "La Karkerker Combinasion Diamond 2.4M/s",
  "Los Lucky Blocks",
  "Sammyini Spyderini",
  "The Bros",
  "The Bros # Secret | Steal A Brainrot",
  "THE COMBINATIONS | STEAL A BRAINROT",
  "THE LITTLE SATURN COWS | STEAL A BRAINROT",
  "The Secret Combination 1.8B/s",
  "THE TRALALERITOS | STEAL A BRAINROT",
  "THE TUNGTUNGTUNGCITOS",
  "Tomorrow School # Secret | Steal A Brainrot",
  "Vampire Quesadillo Gold 11.3M/s",
  "Yin Yang The Spaghettis",
];

async function main() {
  const { data, error } = await supabase.from("sab_brainrots").select("name, slug");
  if (error) throw error;
  const names = data.map((r) => ({ name: r.name, slug: r.slug, norm: norm(r.name) }));

  for (const title of UNMATCHED) {
    const c = core(title);
    // Look for catalog names that share significant token overlap with the core.
    const tokens = c.split(" ").filter((w) => w.length > 3);
    const candidates = names
      .map((n) => {
        const overlap = tokens.filter((t) => n.norm.includes(t)).length;
        return { ...n, overlap };
      })
      .filter((n) => n.overlap > 0)
      .sort((a, b) => b.overlap - a.overlap)
      .slice(0, 3);
    console.log(`\n"${title}"`);
    console.log(`   core: "${c}"`);
    if (candidates.length === 0) {
      console.log("   → NO catalog match (missing brainrot, or noise to reject)");
    } else {
      for (const cand of candidates) {
        console.log(`   ~ ${cand.name}  (${cand.slug})  [${cand.overlap} token(s)]`);
      }
    }
  }
}

main().catch((e) => {
  console.error("failed:", e.message ?? e);
  process.exit(1);
});
