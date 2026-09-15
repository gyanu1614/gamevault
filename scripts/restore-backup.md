# Restoring a database backup

The `Database Backup` workflow (`.github/workflows/db-backup.yml`) publishes one
artifact per run: `dump-<timestamp>.sql.gz.age`. It is a gzipped SQL dump of the
`public` and `auth` schemas (schema + data), encrypted to an **age public key**.

Only the holder of the matching **private key** can decrypt it. The private key
is deliberately not in GitHub — CI can create backups but cannot read them.

---

## 0. One-time: generate the age keypair

Run this **on your own machine**, not in CI:

```bash
age-keygen -o backup-age-key.txt
```

Output looks like:

```
# created: 2026-09-14T12:00:00Z
# public key: age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p
AGE-SECRET-KEY-1QYQSZQGPQYQSZQGPQYQSZQGPQYQSZQGPQYQSZQGPQYQSZQGPQYQSZQGPQ
```

- The `age1...` line is the **public** key → goes in the repo secret.
- The `AGE-SECRET-KEY-1...` line is the **private** key → **never** goes in
  GitHub. Store it in a password manager (and one offline copy). If you lose it,
  every backup ever produced becomes permanently unreadable.

Keep the file itself safe too:

```bash
chmod 600 backup-age-key.txt
```

Install `age` if you don't have it: `brew install age` (macOS) or
`apt install age` (Debian/Ubuntu).

---

## 1. Required repository secrets

Add both under **Settings → Secrets and variables → Actions → New repository
secret**:

| Secret | Value | Notes |
| --- | --- | --- |
| `SUPABASE_DB_URL` | The production Postgres connection string | Supabase Dashboard → Project Settings → Database → Connection string → **URI**. Use the direct connection (port `5432`), not the pooler. Any special characters in the password must be percent-encoded — the Supabase CLI requires it. |
| `BACKUP_AGE_PUBLIC_KEY` | The `age1...` public key from step 0 | Public key only. The workflow refuses to run if this does not start with `age1`. |

That is the complete list — the workflow needs nothing else.

---

## 2. Download the backup

From the GitHub UI: **Actions → Database Backup →** pick a run **→ Artifacts →**
`db-backup-<timestamp>`.

Or with the CLI:

```bash
gh run list --workflow db-backup.yml --limit 10
gh run download <run-id> --dir ./restore
```

GitHub wraps artifacts in a zip, so unzip first if needed:

```bash
cd restore && unzip -o '*.zip'
```

---

## 3. Decrypt and decompress

```bash
age --decrypt --identity backup-age-key.txt \
  --output dump.sql.gz dump-<timestamp>.sql.gz.age

gunzip dump.sql.gz
```

You now have `dump.sql`. Sanity-check it before restoring:

```bash
head -40 dump.sql
grep -c 'CREATE TABLE' dump.sql
```

---

## 4. Restore into a fresh Supabase project

**Restore into a NEW project, not over a live one.** The dump contains
`CREATE`/`INSERT` statements and will collide with existing objects.

1. Create a new project in the Supabase dashboard. Wait for provisioning.
2. Copy its direct connection URI (Project Settings → Database, port `5432`).
3. Restore:

```bash
psql "postgresql://postgres:<password>@<host>:5432/postgres" \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file dump.sql
```

`ON_ERROR_STOP=1` plus `--single-transaction` means a failure rolls the whole
thing back rather than leaving a half-restored database.

If you hit ownership/role errors (the dump references roles the new project has
not created yet), restore the cluster roles first:

```bash
supabase db dump --db-url "$OLD_DB_URL" -f roles.sql --role-only
psql "$NEW_DB_URL" --variable ON_ERROR_STOP=1 --file roles.sql
```

### Verify

```sql
select count(*) from auth.users;
select count(*) from public.orders;
select table_name from information_schema.tables where table_schema = 'public';
```

Compare against production before pointing anything at the restored project.

---

## 5. After a real restore

The dump covers the `public` and `auth` schemas only. These are **not** in it and
must be reconfigured on the new project:

- Storage buckets and their objects.
- Edge Functions and their secrets.
- Auth provider config and email templates (set in the dashboard, not the DB).
- Every environment variable that points at the old project: `NEXT_PUBLIC_SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, and the anon key — in Vercel and in the repo secrets
  used by the other workflows.
- Cron/webhook endpoints registered with external providers.

---

## Testing the backup

A backup you have never restored is a hypothesis. Once a quarter: trigger the
workflow by hand (**Actions → Database Backup → Run workflow**), restore it into
a throwaway project by following this document end to end, and delete the
project afterwards.
