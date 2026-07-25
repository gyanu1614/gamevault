cd /Users/gyanendra/gamevault-sab-pages

pbpaste > supabase/migrations/20260725045000_sab_public_price_security.sql

git diff --check
git status --short

git add supabase/migrations/20260725045000_sab_public_price_security.sql
git commit -m "Fix SAB public price permissions"
git push origin feature/sab-brainrot-pages