# Admin back-end tests

Tools used to test the admin back-end without touching the real Supabase project.
None of these files is used by the website.

| File | What it is |
|---|---|
| `supabase-stub.sql` | Minimal stand-in for Supabase (roles, `auth.users`, `auth.uid()`, storage tables) on a plain PostgreSQL 16 |
| `test.sql` | SQL checks: permissions, import, ALL / ANY search, replace + revert, save, bulk edit, admin roles |
| `fake-supabase.mjs` | One local server that serves the site, a test `config.js`, PostgREST (`/rest/v1`), a tiny auth API and disk storage |
| `e2e.mjs` | Browser test (Playwright) of every admin page: login, import, filters, edit, bulk edit, export, library, filters page, revert, users, account, mobile |
| `sample-import.csv` / `mkcsv.py` | 30-row CSV in the real import format, with a duplicate, a missing embed, a broken date and a new club |

## Running them

```bash
# 1. PostgreSQL 16 on port 5433 (socket in /var/tmp), database "scp"
psql -h /var/tmp -p 5433 -U postgres -c 'create database scp'
psql -h /var/tmp -p 5433 -U postgres -d scp -f admin/tests/supabase-stub.sql
psql -h /var/tmp -p 5433 -U postgres -d scp -f supabase/schema.sql
psql -h /var/tmp -p 5433 -U postgres -d scp -f supabase/admin.sql
psql -h /var/tmp -p 5433 -U postgres -d scp -f supabase/admin-catalog-seed.sql
psql -h /var/tmp -p 5433 -U postgres -d scp -f admin/tests/test.sql     # SQL checks

# 2. PostgREST 12 on port 3000 (db-anon-role anon, jwt-secret from fake-supabase.mjs)
# 3. Local server on http://localhost:8790 (users boss@test.com / member@test.com, password Password123)
node admin/tests/fake-supabase.mjs "$(pwd)"
# 4. Browser test (needs playwright, @supabase/supabase-js@2.117.0 and papaparse@5.4.1 in node_modules of the folder passed)
node admin/tests/e2e.mjs <folder-with-node_modules>
```

`test.sql` creates its own users, so run it on a fresh database (not after the browser test).
