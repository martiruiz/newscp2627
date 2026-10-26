# Monthly SCP carousel ("6 content ideas for <Month>")
1. Pick 6 ideas (see configs/2026-11.json for the shape) and 2 library posts each (`content_ideas.id`, `cover_url`; unavailable_at is null, club_only is not true, not in content_hidden/content_removals).
2. Download covers to a folder as `<id>.jpg`.
3. `python3 tools/social/monthly.py tools/social/configs/YYYY-MM.json <covers_dir> <out_dir>` -> monthly-01..09.png
4. Convert to JPG into `assets/social/YYYY-MM/`, push, create Metricool draft (never publish).
