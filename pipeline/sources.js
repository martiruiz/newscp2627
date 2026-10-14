// News sources. "rss" reads a feed; "sitemap" reads a sitemap and the article pages it lists.
export const SOURCES = [
  { name: "SponCon Sports", type: "sitemap", url: "https://www.sponconsports.com/sitemap.xml", match: "/p/" },
  { name: "SocialGeek News", type: "sitemap", url: "https://socialgeekpro.beehiiv.com/sitemap.xml", match: "/p/" },
];

// Only articles published in the last 24 hours are reviewed
export const MAX_AGE_HOURS = 24;

// Safety cap per source and run (the 24h window is the real limit)
export const ITEMS_PER_SOURCE = 40;
