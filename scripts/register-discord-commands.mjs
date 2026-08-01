#!/usr/bin/env node
/**
 * Register the DropMarket Values slash commands with Discord.
 *
 * Guild-scoped by default: guild commands appear INSTANTLY, while global ones
 * can take up to an hour to propagate, which makes iterating on option names
 * unbearable. Register globally with --global once the shape has settled.
 *
 * Usage:
 *   node scripts/register-discord-commands.mjs            # dev guild, instant
 *   node scripts/register-discord-commands.mjs --global   # everywhere, slow
 *   node scripts/register-discord-commands.mjs --list      # show what's live
 *
 * Requires DISCORD_APP_ID + DISCORD_BOT_TOKEN (and DISCORD_DEV_GUILD_ID unless
 * --global) in .env.local.
 */

import { readFileSync } from "node:fs";

const API = "https://discord.com/api/v10";

// Minimal .env.local loader, matching scripts/sab-db-inspect.mjs.
function loadEnv() {
  try {
    const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
    }
  } catch {
    // Fine — CI supplies these as real environment variables.
  }
}

loadEnv();

const OPTION_STRING = 3;
const OPTION_INTEGER = 4;

/**
 * Installation contexts. USER_INSTALL is the important one: it lets a trader
 * add the bot to their own account and run /value in ANY server or DM, even
 * where the bot itself was never invited. Every trader becomes a distribution
 * point, which is the whole growth mechanism.
 */
const INTEGRATION_TYPES = [
  0, // GUILD_INSTALL
  1, // USER_INSTALL
];

/** Guild, bot DM, and private/group DM. */
const CONTEXTS = [0, 1, 2];

const RARITIES = [
  "Secret",
  "Brainrot God",
  "Mythic",
  "Legendary",
  "Epic",
  "Rare",
  "Common",
  "OG",
];

const COMMANDS = [
  {
    name: "value",
    type: 1,
    description: "Live market value for a Steal a Brainrot item",
    integration_types: INTEGRATION_TYPES,
    contexts: CONTEXTS,
    options: [
      {
        name: "brainrot",
        description: "Which Brainrot? Start typing for suggestions",
        type: OPTION_STRING,
        required: true,
        autocomplete: true,
      },
      {
        name: "mutation",
        description: "Mutation (defaults to no mutation)",
        type: OPTION_STRING,
        required: false,
        autocomplete: true,
      },
    ],
  },
  {
    name: "wfl",
    type: 1,
    description: "Win, Fair or Loss? Check a trade against live market values",
    integration_types: INTEGRATION_TYPES,
    contexts: CONTEXTS,
    options: [
      {
        name: "you",
        description: "What you give, comma separated (e.g. garama, skibidi toilet)",
        type: OPTION_STRING,
        required: true,
      },
      {
        name: "them",
        description: "What you get, comma separated (e.g. tralalero diamond)",
        type: OPTION_STRING,
        required: true,
      },
    ],
  },
  {
    name: "top",
    type: 1,
    description: "Highest-value Brainrots right now",
    integration_types: INTEGRATION_TYPES,
    contexts: CONTEXTS,
    options: [
      {
        name: "rarity",
        description: "Limit to one rarity",
        type: OPTION_STRING,
        required: false,
        choices: RARITIES.map((rarity) => ({ name: rarity, value: rarity })),
      },
      {
        name: "limit",
        description: "How many to show (1-25, default 10)",
        type: OPTION_INTEGER,
        required: false,
        min_value: 1,
        max_value: 25,
      },
    ],
  },
];

async function discord(path, init = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      "content-type": "application/json",
      ...init.headers,
    },
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Discord API ${response.status} on ${path}\n${text.slice(0, 2000)}`,
    );
  }

  return text ? JSON.parse(text) : null;
}

async function main() {
  const argv = process.argv.slice(2);
  const global = argv.includes("--global");
  const list = argv.includes("--list");

  const appId = process.env.DISCORD_APP_ID;
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_DEV_GUILD_ID;

  if (!appId || !token) {
    throw new Error(
      "DISCORD_APP_ID and DISCORD_BOT_TOKEN are required (add them to .env.local)",
    );
  }

  if (!global && !guildId) {
    throw new Error(
      "DISCORD_DEV_GUILD_ID is required for guild registration. Use --global to register everywhere instead.",
    );
  }

  const path = global
    ? `/applications/${appId}/commands`
    : `/applications/${appId}/guilds/${guildId}/commands`;

  if (list) {
    const existing = await discord(path);
    console.log(
      `${existing.length} command(s) registered ${global ? "globally" : `in guild ${guildId}`}:`,
    );
    for (const command of existing) {
      console.log(`  /${command.name} — ${command.description}`);
    }
    return;
  }

  // PUT replaces the whole set, so removing a command here removes it upstream.
  const result = await discord(path, {
    method: "PUT",
    body: JSON.stringify(COMMANDS),
  });

  console.log(
    `Registered ${result.length} command(s) ${global ? "globally" : `in guild ${guildId}`}:`,
  );
  for (const command of result) {
    console.log(`  /${command.name}`);
  }

  if (global) {
    console.log("\nGlobal commands can take up to an hour to appear.");
  } else {
    console.log("\nGuild commands are live immediately.");
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
