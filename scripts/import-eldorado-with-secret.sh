#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FEED_PATH="${1:-data/sab-market-feeds/eldorado-api-latest.json}"

cd "$ROOT_DIR"

if [ ! -f "$FEED_PATH" ]; then
  echo "Feed file not found: $FEED_PATH" >&2
  exit 1
fi

printf "Enter SAB_MARKET_IMPORT_SECRET: "
IFS= read -r -s IMPORT_SECRET
printf "\n"

if [ -z "$IMPORT_SECRET" ]; then
  echo "Secret cannot be empty." >&2
  exit 1
fi

SAB_MARKET_IMPORT_SECRET="$IMPORT_SECRET" \
  node scripts/import-sab-market-json.mjs \
  "$FEED_PATH" \
  --send

unset IMPORT_SECRET
