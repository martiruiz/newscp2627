# Monthly SCP carousel ("6 content ideas for <Month>")
1. Pick 6 ideas (see configs/2026-11.json for the shape) and 2 library posts each (`content_ideas.id`, `cover_url`; unavailable_at is null, club_only is not true, not in content_hidden/content_removals).
2. Download covers to a folder as `<id>.jpg`.
3. `python3 tools/social/monthly.py tools/social/configs/YYYY-MM.json <covers_dir> <out_dir>` -> monthly-01..09.png
4. Convert to JPG into `assets/social/YYYY-MM/`, push, create Metricool draft (never publish).

# Weekly carousels
Setup in a fresh session: `npm i --prefix /tmp/ic @phosphor-icons/core` and `npm i --prefix /tmp/si simple-icons@13` (env PHOSPHOR=…/assets/duotone, PHOSPHOR_FILL=…/assets/fill, SIMPLEICONS=…/icons if installed elsewhere); `pip install pillow playwright` if missing.

## Jobs (Mondays)
`python3 tools/social/jobs_weekly.py <config.json> <logos_dir> <out_dir>` -> jobs-01..NN.png. Config: see configs/jobs-2026-10-26.json
(range label + jobs [id,title,company,location,type full-time|internship,area social|content|design|video|marketing|partnerships,added]).
Logos: download `jobs.logo_url` to `<logos_dir>/<job id>.img`. Source: Supabase `jobs` (published, not expired, created_at in the last 7 days; max 10, varied areas).

## Social News (Fridays)
`python3 tools/social/news_weekly.py <config.json> <out_dir>` -> news-01..(2N+2).png. Config: see configs/news-2026-10-26.json
(label + items [img, brand (simple-icons slug), platform, title with <span class='g'>, para, tip, date]). `img` = one of tiktok|reels|mosseri|facebook|meta, otherwise a generic brand tile is used.
Source: Supabase `news` (relevant, last 14 days). Only facts from the news item; no invented data.

## Anàlisi de contingut d'una gran cita (teardown)
`python3 tools/social/teardown.py <config.json> <out_dir> <prefix>` -> prefix-01..09.png (disseny "post teardown": fons blau amb quadrícula, captures amb cantonades arrodonides i marcadors numerats).
Config: veure configs/2026-10/ballondor-teardown.json (cover amb `imgs` [1-2], point amb `img`+`handle`+`callouts` [{v,l}] màx. 3 i `body`/`tip`, point sense img, club, cta).
Les captures van a assets/social/<data>/src/ i s'arrodoneixen automàticament; després exporta a JPG a assets/social/<data>/.
