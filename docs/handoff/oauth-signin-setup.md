# Google + Discord sign-in — setup guide (owner steps)

Project ref (prod Supabase): `cserfvellsliylifjkos` (from supabase/.temp/project-ref)
Prod callback URL: `https://cserfvellsliylifjkos.supabase.co/auth/v1/callback`
Local callback URLs: `http://127.0.0.1:54321/auth/v1/callback` (main checkout stack) and `http://127.0.0.1:57721/auth/v1/callback` (this worktree's stack, slot 34)
Vercel preview pattern: `https://gamevault-*-gyanendra-pandeys-projects-373de02f.vercel.app`
Dev server for this chat: http://localhost:3025

## A. Google Cloud (console.cloud.google.com)
1. Top bar project picker → **New project** → name `DropMarket` → Create → select it.
2. Left menu **APIs & Services → OAuth consent screen** (new console calls it **Google Auth Platform → Branding**). Click **Get started**.
3. App information: App name `DropMarket`, User support email = `support@dropmarket.gg` (must be a Google account you own or a Google Group you manage; if not, use your own Gmail for now).
4. Audience: **External** → Next.
5. Contact information: your email → Next → agree → **Create**.
6. **Branding** page: App name `DropMarket`, App home page `https://dropmarket.gg`, Privacy policy `https://dropmarket.gg/privacy`, Terms `https://dropmarket.gg/terms`, Authorized domains → add `dropmarket.gg`. **Do NOT upload a logo yet**: a logo puts the app into brand verification (Google quotes 2–3 business days, forum reports show weeks stuck). Sign-in works without it; the consent screen just shows no logo. Add the logo later as a separate step.
7. **Data access** (Scopes): Add or remove scopes → tick `.../auth/userinfo.email`, `.../auth/userinfo.profile`, and `openid` → Update → Save. These are non-sensitive: no app verification needed.
8. **Audience** page → **Publish app** → Confirm. (Publishing with only non-sensitive scopes needs no review and removes the 100-test-user cap.)
9. **Clients** → **Create client** → Application type **Web application** → Name `DropMarket web`.
   - Authorized JavaScript origins: `https://dropmarket.gg`, `http://localhost:3025`, `http://localhost:3000`
   - Authorized redirect URIs (exact, one per line):
     - `https://cserfvellsliylifjkos.supabase.co/auth/v1/callback`
     - `http://127.0.0.1:54321/auth/v1/callback`
     - `http://127.0.0.1:57721/auth/v1/callback`
   - Create. Keep the **Client ID** and **Client secret** in your password manager (the secret is shown once; you can download the JSON).
10. Note: the consent screen will say "to continue to cserfvellsliylifjkos.supabase.co". That is how Supabase works without an Auth custom domain (a paid add-on). Fine for launch.

## B. Discord Developer Portal (discord.com/developers/applications)
1. **New Application** → name `DropMarket` → tick the terms → Create. (A separate app from the price-check bot keeps the login secret away from the bot token. Reusing the bot app also works if you prefer one app.)
2. Left menu **OAuth2**. Under **Redirects** click **Add Redirect** three times and paste:
   - `https://cserfvellsliylifjkos.supabase.co/auth/v1/callback`
   - `http://127.0.0.1:54321/auth/v1/callback`
   - `http://127.0.0.1:57721/auth/v1/callback`
   → **Save Changes**.
3. Same page, **Client information**: copy **Client ID**; click **Reset Secret** → copy the **Client Secret** (shown once).
4. Nothing to tick for scopes: Supabase requests `identify` + `email` itself on every login.
5. Optional: **General Information** → upload the DropMarket icon and set description; this is what users see on the Discord authorize screen. No review needed.

## C. Supabase dashboard (prod project cserfvellsliylifjkos)
1. **Authentication → Sign In / Providers** (older UI: Providers).
   - **Google**: Enable → paste Client ID + Client Secret → leave "Skip nonce check" OFF → Save.
   - **Discord**: Enable → paste Client ID + Client Secret → Save.
   - **Email**: confirm **"Confirm email" is ON** and stays ON. This matters: with it OFF, Supabase treats every provider email as verified and would auto-link an unverified Discord email to an existing account (pre-account takeover). With it ON, only provider-verified emails link (Google always verified; Discord only when the user verified their email with Discord).
   - Leave **"Allow manual linking"** OFF (default). We only use automatic linking.
2. **Authentication → URL Configuration**:
   - Site URL: `https://dropmarket.gg`
   - Redirect URLs (add each):
     - `https://dropmarket.gg/auth/callback`
     - `https://www.dropmarket.gg/auth/callback` (only if www serves the site rather than redirecting)
     - `https://gamevault-*-gyanendra-pandeys-projects-373de02f.vercel.app/auth/callback`
     - `http://localhost:3000/auth/callback`
     - `http://localhost:3025/auth/callback`
   The existing `.../auth/callback` entry from the email-confirm fix should already be there; keep it.
3. No SQL to run. No migration in this feature (the password flag lives in auth app_metadata; the Discord username is read from the auth identity via `lookupDiscordHandle`, no profile column).

## D. Local (this worktree)
1. Committed `supabase/config.toml` (no port or project_id edits) carries `[auth.external.google]` / `[auth.external.discord]` with all four values as `env(SUPABASE_AUTH_EXTERNAL_<PROVIDER>_{CLIENT_ID,SECRET})`, plus `http://localhost:*/auth/callback` and `http://127.0.0.1:*/auth/callback` in `additional_redirect_urls`.
2. The four values go in the gitignored **`supabase/.env`** of the worktree, **BELOW** the `# <<< local-stack <<<` line — anything between the `>>>`/`<<<` markers is rewritten by every `pnpm db:up` (that wipe is what produced Google's `invalid_client` on 2026-10-08).
   ```
   SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=
   SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=
   SUPABASE_AUTH_EXTERNAL_DISCORD_CLIENT_ID=
   SUPABASE_AUTH_EXTERNAL_DISCORD_SECRET=
   ```
   Then `pnpm db:down` + `pnpm db:up`. Check: `docker inspect supabase_auth_gamevault-<worktree>` env must show real values, not `env(...)`.
3. App env: nothing new. `NEXT_PUBLIC_APP_URL=http://localhost:3025` in this worktree's `.env.local` (I set that).
4. Empty secrets are OK until you fill them: with `enabled = true` and a blank id the local GoTrue just refuses that provider with "provider not enabled".

## Redirect allow-list gotcha (found 2026-10-09)
Supabase matches `redirectTo` against the allow-list as a glob; an exact entry like `https://dropmarket.gg/auth/callback` does NOT match `…/auth/callback?next=/founding`, and Supabase then silently falls back to the Site URL. The OAuth buttons therefore return to the BARE callback URL and carry `next` in a 10-minute same-site cookie (`dm_oauth_next`), so the exact entries work as they are. The email links (`?type=signup&next=…`) still put `next` on the URL: to make them land on `next` instead of the homepage, change the prod entries to `https://dropmarket.gg/auth/callback**` (and the Vercel preview one the same way). That is a pre-existing gap, not introduced here.

## Rollout order (later, before deploy)
1. C.1 + C.2 done in the dashboard (safe before deploy: nothing in the live app calls the providers yet).
2. Merge + release. No `db push` needed unless the plan adds a migration.
