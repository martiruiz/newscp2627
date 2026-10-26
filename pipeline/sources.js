// News sources. "rss" reads a feed; "sitemap" reads a sitemap and the article pages it lists.
export const SOURCES = [
  { name: "SponCon Sports", type: "sitemap", url: "https://www.sponconsports.com/sitemap.xml", match: "/p/" },
  { name: "SocialGeek News", type: "sitemap", url: "https://socialgeekpro.beehiiv.com/sitemap.xml", match: "/p/", stories: 3 },
  // high-volume feeds: a cheap first pass (triage) keeps only what could matter to a sports social team
  { name: "Social Media Today", type: "rss", url: "https://www.socialmediatoday.com/feeds/news/", triage: true },
  { name: "Front Office Sports", type: "rss", url: "https://frontofficesports.com/feed/", triage: true },
];
// stories: a newsletter covering several news items gives up to this many stories (default 1)

// Articles published in the last 48 hours are reviewed (runs are every 12 h; duplicates are skipped by URL)
export const MAX_AGE_HOURS = Number(process.env.NEWS_MAX_AGE_HOURS) || 48;   // NEWS_MAX_AGE_HOURS=720 for a one-off backfill

// Safety cap per source and run (the 24h window is the real limit)
export const ITEMS_PER_SOURCE = Number(process.env.NEWS_ITEMS_PER_SOURCE) || 40;
