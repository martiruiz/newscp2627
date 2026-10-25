// News sources. "rss" reads a feed; "sitemap" reads a sitemap and the article pages it lists.
export const SOURCES = [
  { name: "SponCon Sports", type: "sitemap", url: "https://www.sponconsports.com/sitemap.xml", match: "/p/" },
  { name: "SocialGeek News", type: "sitemap", url: "https://socialgeekpro.beehiiv.com/sitemap.xml", match: "/p/" },
];

// Articles published in the last 48 hours are reviewed (runs are every 30 h; duplicates are skipped by URL)
export const MAX_AGE_HOURS = Number(process.env.NEWS_MAX_AGE_HOURS) || 48;   // NEWS_MAX_AGE_HOURS=720 for a one-off backfill

// Safety cap per source and run (the 24h window is the real limit)
export const ITEMS_PER_SOURCE = Number(process.env.NEWS_ITEMS_PER_SOURCE) || 40;
