/**
 * The one way a SAB crawl hands its feed to the bulk importer.
 *
 * Every crawl imports with --no-publish: the runner's reprice step
 * (`pnpm reprice --game=sab`) is the single publisher. Publishing from the
 * G2G import too ran the heavy SAB recompute chain (estimates, evidence
 * rebuild, price display) twice a day (2026-10-20 usage audit, C2).
 */
import { spawn } from "node:child_process";

export function sabImporterArgs(outputPath) {
  return ["scripts/import-sab-market-json.mjs", outputPath, "--send", "--no-publish"];
}

export function runSabImporter(outputPath, { spawnFn = spawn } = {}) {
  return new Promise((resolveImport, rejectImport) => {
    const child = spawnFn(process.execPath, sabImporterArgs(outputPath), {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", rejectImport);
    child.once("exit", (code) => {
      if (code === 0) resolveImport();
      else rejectImport(new Error(`Bulk importer exited with code ${code}`));
    });
  });
}
