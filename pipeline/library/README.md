# Content Library pipeline

The Content Library shows the posts imported from the admin (Admin → Import, CSV → table `content_ideas`).
These scripts keep them healthy and give them a deep breakdown.

```
Admin → Import (CSV)                 → content_ideas + filter values (sport, competition, club, entity, format, platform…)
        │
        ▼  GitHub Action "Check library posts" (daily)
node library/check-embeds.mjs        → hides posts removed / made private on Instagram (unavailable_at)
                                       + stores each post's shape (media_ratio) so cards keep their real size
        │
        ▼  scheduled task "SCP anàlisi posts destacats" (Claude Code subscription)
node library/analysis.mjs next 20    → newest posts without analysis
node library/frames.mjs <url>        → video → contact sheets → Claude "watches" the post (reels)
node library/analysis.mjs cover <id> → the post's image (photos / carousels)
node library/analysis.mjs save …     → summary, hook, why it works, format, angle, visual breakdown,
                                       scroll stoppers, how to adapt → "View analysis" pop-up in the library
```

`instagram.mjs` reads Instagram's public embed page (no login, no cookies): post status, media shape, image and video URLs.

The older flow below (`ingest.mjs` → `posts` table with outlier scores) is kept for Bright Data / Metricool exports.

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
