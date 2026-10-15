# SCP Admin (back-end)

The admin panel to upload, organise and filter the content ideas. It works like the previous back-end
(admin.sportscontentplaybook.com) and runs on the same Supabase project as the website.

| Page | What it does |
|---|---|
| **Content Ideas** | Table with the 8 filters (Trend, Sport, Entity, Competition, Club, Format, Platform, Campaign) in ALL / ANY mode, search by title, external ID and dates. Columns menu, Export CSV, Add, Edit, Detail, select (page or all filtered) → Bulk Edit (add / remove values) or Delete. |
| **Content Library** | Same filters, shown as cards with the live embed. Edit, delete, and remove a filter value with its ×. |
| **Filters** | The catalog of values per category with how many ideas use each one: add, rename, delete. |
| **Import** | CSV wizard: 1. Upload → 2. Analysis (column mapping, duplicates, existing ideas that will be replaced, missing fields, future dates, rows without title, new values, preview) → 3. Results. History with download of the original CSV, errors CSV and **Revert**. |
| **Users** | Admins of the panel. Superadmins add someone by email (they get a login link) or remove their access. |
| **Account** | Your details and password change. |

Address: `https://sportscontentplaybook.com/admin/` (login at `admin/login.html`).

## Setup (once)

1. Supabase → **SQL Editor** → New query → paste and run `supabase/admin.sql`
   (needs `supabase/schema.sql`, which is already in place for the website).
2. Run `supabase/admin-catalog-seed.sql` — loads the 1,037 filter values copied from the previous back-end.
3. Make sure your account is **superadmin** (in `schema.sql`, step 5):
   `update public.profiles set role = 'superadmin' where email = 'YOUR-EMAIL';`
4. Open `/admin/`, log in, and add the rest of the team on **Users**.

Supabase **Storage**: the SQL creates a private bucket called `imports` for the original CSV files. If your project
doesn't allow creating buckets from SQL, create it by hand (Storage → New bucket → `imports`, private).

## Trying it before the website is live (GitHub Pages)

1. The repository owner: GitHub → Settings → Pages → Source **Deploy from a branch** → `main` / `(root)` → Save.
   After a minute the site is at `https://martiruiz.github.io/newscp2627/` and the admin at `…/newscp2627/admin/`.
2. Supabase → Authentication → URL Configuration → Redirect URLs → add `https://martiruiz.github.io/newscp2627/**`
   (needed for the email login links).
3. Do the Setup steps above, sign up once on `…/newscp2627/signup.html` if you don't have an account, and make yourself superadmin.
4. Open `…/newscp2627/admin/`, log in ("Email me a login link instead" if you have no password; set one later on Account)
   and import one of the daily CSVs.

## CSV format

Same columns as the files you already import:

```
external_id,published_at,embed,url,format,title,sport,competition,club,platform,entity
```

- Optional extra columns: `trend`, `campaign`. Unknown columns are ignored.
- **Required**: `external_id`, `published_at`, `embed`. Rows without them are skipped (and listed in the errors CSV).
- Several values in one cell are separated by commas: `"LaLiga,Champions League"`.
- Dates: `2026-10-13T19:04:58.000Z`, `2026-10-13 20:54:20` (UTC) or `13/10/2026 20:54`. Dates in the future block the import.
- An `external_id` that already exists is **replaced** (deleted and recreated). Revert restores the previous version.
- If the same `external_id` appears twice in a file, only the last row is imported.
- Values that don't exist in the catalog are created automatically (matching ignores upper / lower case).

## Notes

- Dates are stored and shown in UTC, like the previous back-end.
- Only accounts with role `admin` or `superadmin` can see or change anything (Supabase Row Level Security).
- Deleting a user only removes their admin access; their website account is kept.
