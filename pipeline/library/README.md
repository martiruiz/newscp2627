# Content Library pipeline

How posts get into the SCP Content Library (Supabase) and how the best ones get a deep breakdown.

```
Bright Data / Metricool / any export
        │  JSON
        ▼
node library/ingest.mjs <files>      → accounts + posts (upsert, no duplicates) → refresh_outliers()
        │
        ▼
posts.outlier_score / labels         → "Overperforming" = ≥ 2x the account's median (views, or interactions)
        │
        ▼  daily scheduled task "SCP anàlisi posts destacats" (Claude Code subscription)
node library/analysis.mjs next 15    → top outliers without analysis
node library/frames.mjs <url>        → video → contact sheets → Claude "watches" the post
node library/analysis.mjs save …     → hook, format, angle, scroll stoppers, why it works, how to adapt
                                       + labels top_pick / replicable, sport, competition, entities, topics
```

## Setup

1. Supabase SQL Editor: run `supabase/library.sql` (after `supabase/schema.sql`).
2. Create `pipeline/.env` (gitignored, never commit it):
   ```
   SUPABASE_URL=https://wppdbomtiliutpxsimtp.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<secret key from Supabase → Project Settings → API>
   ```
3. `cd pipeline && npm install`

## Loading posts

```bash
node library/ingest.mjs data/brightdata-2026-10-15.json --source brightdata
node library/ingest.mjs data/ --dry-run        # check what would be loaded
```

Each input file is a JSON array (or `{ "posts": [...] }`). Recognised fields per item (first match wins):

| SCP column | Accepted keys |
|---|---|
| url (required) | `url`, `permalink`, `post_url`, `platform_url` |
| account_handle (required) | `account_handle`, `creator`, `handle`, `username`, `ownerUsername`, `user_posted`, `account` |
| posted_at | `posted_at`, `postedAt`, `timestamp`, `date_posted`, `published_at`, `taken_at`, `date` |
| format | `format`, `type`, `media_type`, `product_type`, `content_type` |
| caption | `caption`, `description`, `text`, `content` |
| thumbnail_url | `thumbnail_url`, `cover`, `thumbnail`, `displayUrl`, `image_url`, `imageUrl` |
| views / likes / comments / shares / saves | `views`, `video_view_count`, `videoPlayCount`, `play_count`, `view_count` / `likes`, `likesCount`, `like_count`, `num_likes` / … |

Numbers like `1.2M`, `379K`, `379 mil` or `1,234` are understood. Unknown numbers stay empty (never 0).
When we have a real Bright Data export, check it with `--dry-run` and add any missing keys in `adapters.mjs`.

## Outlier score

`refresh_outliers()` (in `library.sql`) compares each post with the median of the account's last 30 posts
(last 120 days). It uses views when the account has them, otherwise likes + comments. Posts with over 20K views
and under 1.5 likes per 1,000 views are flagged `suspicious` (reach without engagement, often paid) and don't get
the label. Logic adapted from instagram-research-tool (MIT, Manthan Patel).

## Thumbnails

Instagram and TikTok thumbnail URLs expire after a few days. Before going live, copy thumbnails to our own storage
(Cloudflare R2 or Supabase Storage) during ingest and store that URL instead.
