import { parse } from "csv-parse/sync";
import { parse as parseStream } from "csv-parse";

export interface CSVRow {
  external_id: string;
  published_at: string;
  embed: string;
  url: string;
  format: string;
  title: string;
  sport: string;
  competition: string;
  club: string;
  platform: string;
  entity: string;
  trend: string;
  campaign: string;
}

const COLUMN_ALIASES: Record<string, string> = {
  id: "external_id",
  date: "published_at",
  trend: "trend",
  campaign: "campaign",
};

// Strip bare \r (carriage returns not followed by \n) that appear inside
// quoted CSV fields (e.g. Instagram captions scraped with Windows line endings
// mixed into field content). Without this, csv-parse treats \r as a record
// delimiter even with record_delimiter set, corrupting column alignment.
function stripBareCR(text: string): string {
  return text.replace(/\r(?!\n)/g, "");
}

function fixMalformedQuotes(content: string): string {
  // Remove invalid closing quotes followed by + (e.g. "text"+"more" → "text+more")
  let result = "";
  let inQuote = false;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (ch === '"') {
      if (!inQuote) {
        inQuote = true;
        result += ch;
      } else {
        const next = content[i + 1];
        if (next === "+" || next === "&") {
          // Skip invalid closing quote — field continues
          continue;
        }
        inQuote = false;
        result += ch;
      }
    } else {
      result += ch;
    }
  }
  return result;
}

const BASE_PARSE_OPTS = {
  columns: true,
  skip_empty_lines: true,
  trim: true,
  relax_column_count: true,
  // Only treat \r\n and \n as row delimiters — bare \r inside quoted fields
  // (e.g. Instagram captions) is stripped by stripBareCR before this runs.
  record_delimiter: ["\r\n", "\n"],
  // Skip rows with malformed quotes (e.g. scraped titles that contain an
  // unescaped " character) rather than falling back to quote:false which
  // would break all properly-quoted fields across the entire file.
  skip_records_with_error: true,
} as const;

function tryParse(cleaned: string): Record<string, string>[] {
  // 1st attempt: standard
  try {
    return parse(cleaned, BASE_PARSE_OPTS) as Record<string, string>[];
  } catch {
    // 2nd attempt: fix malformed quotes then retry
    try {
      return parse(fixMalformedQuotes(cleaned), BASE_PARSE_OPTS) as Record<string, string>[];
    } catch {
      // 3rd attempt: disable quote handling entirely
      return parse(cleaned, { ...BASE_PARSE_OPTS, quote: false }) as Record<string, string>[];
    }
  }
}

export function parseCSV(content: string): { rows: CSVRow[]; headers: string[]; error?: string } {
  const cleaned = stripBareCR(content.replace(/^﻿/, ""));

  try {
    const records = tryParse(cleaned);

    if (records.length === 0) {
      return { rows: [], headers: [], error: "CSV file is empty" };
    }

    const rawHeaders = Object.keys(records[0]).map((h) => h.trim().toLowerCase());

    const normalizedHeaders = rawHeaders.map((h) => COLUMN_ALIASES[h] || h);

    const hasId = normalizedHeaders.includes("external_id") || normalizedHeaders.includes("embed") || normalizedHeaders.includes("url");
    if (!hasId) {
      return { rows: [], headers: rawHeaders, error: "Missing required column: external_id, url or embed" };
    }

    const rows: CSVRow[] = records.map((record) => normalizeRecord(record));
    return { rows, headers: rawHeaders };
  } catch (e) {
    return { rows: [], headers: [], error: `CSV parsing error: ${(e as Error).message}` };
  }
}

function normalizeRecord(record: Record<string, string>): CSVRow {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    const normKey = COLUMN_ALIASES[key.trim().toLowerCase()] || key.trim().toLowerCase();
    normalized[normKey] = (value || "").trim();
  }
  return {
    external_id: normalized.external_id || normalized.id || "",
    published_at: normalized.published_at || normalized.date || "",
    embed: normalized.embed || "",
    url: normalized.url || "",
    format: normalized.format || "",
    title: normalized.title || "",
    sport: normalized.sport || "",
    competition: normalized.competition || "",
    club: normalized.club || "",
    platform: normalized.platform || "",
    entity: normalized.entity || "",
    trend: normalized.trend || "",
    campaign: normalized.campaign || "",
  };
}

function runStreamParser(
  content: string,
  opts: Parameters<typeof parseStream>[0],
  onChunk: (rows: CSVRow[]) => Promise<void>,
  chunkSize: number,
): Promise<{ totalRows: number; headers: string[]; error?: string }> {
  return new Promise((resolve) => {
    const parser = parseStream(opts);
    let headers: string[] = [];
    let totalRows = 0;
    let chunk: CSVRow[] = [];
    let headersSet = false;
    let processingPromise = Promise.resolve();

    parser.on("readable", () => {
      let record: Record<string, string> | null;
      while ((record = parser.read()) !== null) {
        if (!headersSet) {
          headers = Object.keys(record).map((h) => h.trim().toLowerCase());
          const normalizedHeaders = headers.map((h) => COLUMN_ALIASES[h] || h);
          const hasId = normalizedHeaders.includes("external_id") || normalizedHeaders.includes("embed") || normalizedHeaders.includes("url");
          if (!hasId) {
            parser.destroy(new Error("Missing required column: external_id, url or embed"));
            return;
          }
          headersSet = true;
        }
        chunk.push(normalizeRecord(record));
        totalRows++;
        if (chunk.length >= chunkSize) {
          const batch = chunk;
          chunk = [];
          processingPromise = processingPromise.then(() => onChunk(batch));
        }
      }
    });

    parser.on("error", (err) => resolve({ totalRows, headers, error: err.message }));

    parser.on("end", async () => {
      if (chunk.length > 0) processingPromise = processingPromise.then(() => onChunk(chunk));
      await processingPromise;
      resolve({ totalRows, headers });
    });

    parser.write(content);
    parser.end();
  });
}

export async function parseCSVStream(
  text: string,
  onChunk: (rows: CSVRow[]) => Promise<void>,
  chunkSize = 500,
): Promise<{ totalRows: number; headers: string[]; error?: string }> {
  const cleaned = stripBareCR(text.replace(/^﻿/, ""));

  // Determine which content/opts to use by doing a quick sync test-parse of the first 10 rows
  let content = cleaned;
  let opts: Parameters<typeof parseStream>[0] = BASE_PARSE_OPTS;

  try {
    parse(cleaned, { ...BASE_PARSE_OPTS, to: 10 });
  } catch {
    try {
      const fixed = fixMalformedQuotes(cleaned);
      parse(fixed, { ...BASE_PARSE_OPTS, to: 10 });
      content = fixed;
    } catch {
      opts = { ...BASE_PARSE_OPTS, quote: false };
    }
  }

  return runStreamParser(content, opts, onChunk, chunkSize);
}

export function countCSVRows(text: string): number {
  let count = 0;
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    if (ch === 34) inQuote = !inQuote;
    else if (ch === 10 && !inQuote) count++;
  }
  return Math.max(0, count - 1);
}

export function parseCSVPreview(content: string, maxRows = 5000): { rows: CSVRow[]; headers: string[]; totalRows: number; error?: string } {
  const cleaned = stripBareCR(content.replace(/^﻿/, ""));
  const totalRows = countCSVRows(cleaned);

  try {
    let records: Record<string, string>[];
    try {
      records = parse(cleaned, { ...BASE_PARSE_OPTS, to: maxRows }) as Record<string, string>[];
    } catch {
      try {
        records = parse(fixMalformedQuotes(cleaned), { ...BASE_PARSE_OPTS, to: maxRows }) as Record<string, string>[];
      } catch {
        records = parse(cleaned, { ...BASE_PARSE_OPTS, quote: false, to: maxRows }) as Record<string, string>[];
      }
    }

    if (records.length === 0) {
      return { rows: [], headers: [], totalRows: 0, error: "CSV file is empty" };
    }

    const rawHeaders = Object.keys(records[0]).map((h) => h.trim().toLowerCase());
    const normalizedHeaders = rawHeaders.map((h) => COLUMN_ALIASES[h] || h);

    const hasId = normalizedHeaders.includes("external_id") || normalizedHeaders.includes("embed") || normalizedHeaders.includes("url");
    if (!hasId) {
      return { rows: [], headers: rawHeaders, totalRows: 0, error: "Missing required column: external_id, url or embed" };
    }

    const rows = records.map((record) => normalizeRecord(record));
    return { rows, headers: rawHeaders, totalRows };
  } catch (e) {
    return { rows: [], headers: [], totalRows: 0, error: `CSV parsing error: ${(e as Error).message}` };
  }
}

export function extractPostId(embed: string, platform: string): string | null {
  const platformLower = platform.toLowerCase();

  if (platformLower === "instagram") {
    return extractInstagramShortcode(embed);
  }
  if (platformLower === "youtube") {
    const match = embed.match(/youtube\.com\/embed\/([A-Za-z0-9_-]+)/);
    return match ? match[1] : null;
  }
  if (platformLower === "tiktok") {
    const match = embed.match(/tiktok\.com\/embed\/v2\/(\d+)/) || embed.match(/tiktok\.com\/.*?\/video\/(\d+)/);
    return match ? match[1] : null;
  }
  if (platformLower === "x" || platformLower === "twitter") {
    const match = embed.match(/(?:twitter|x)\.com\/\w+\/status\/(\d+)/);
    return match ? match[1] : null;
  }
  if (platformLower === "facebook") {
    const match = embed.match(/facebook\.com\/plugins\/(?:post|video)\.php\?href=([^&"]+)/);
    if (match) {
      try { return decodeURIComponent(match[1]); } catch { return match[1]; }
    }
    const fbMatch = embed.match(/facebook\.com\/[^/]+\/(?:posts|videos)\/([A-Za-z0-9_-]+)/);
    return fbMatch ? fbMatch[1] : null;
  }
  if (platformLower === "linkedin") {
    const match = embed.match(/linkedin\.com\/embed\/feed\/update\/([^?"]+)/);
    return match ? match[1] : null;
  }

  return null;
}

function extractInstagramShortcode(embed: string): string | null {
  const permalinkMatch = embed.match(/data-instgrm-permalink="(https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[A-Za-z0-9_-]+\/?[^"]*)"/);
  if (permalinkMatch) {
    const scMatch = permalinkMatch[1].match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
    return scMatch ? scMatch[1] : null;
  }
  const blockquoteMatch = embed.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return blockquoteMatch ? blockquoteMatch[1] : null;
}

export function extractInstagramPermalink(embed: string): string | null {
  const match = embed.match(/data-instgrm-permalink="(https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[A-Za-z0-9_-]+\/?[^"]*)"/);
  return match ? match[1] : null;
}

export function extractShortcodeFromUrl(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

export function extractUsernameFromTitle(title: string): string | null {
  const match = title.match(/^(.+?)[''']s profile picture$/i);
  return match ? match[1].trim() : null;
}

export function buildCanonicalUrl(postId: string, platform: string): string {
  switch (platform.toLowerCase()) {
    case "instagram":
      return `https://www.instagram.com/p/${postId}/`;
    case "youtube":
      return `https://www.youtube.com/watch?v=${postId}`;
    case "tiktok":
      return `https://www.tiktok.com/video/${postId}`;
    case "x":
    case "twitter":
      return `https://x.com/i/status/${postId}`;
    case "facebook":
      return postId.startsWith("http") ? postId : `https://www.facebook.com/${postId}`;
    case "linkedin":
      return `https://www.linkedin.com/feed/update/${postId}`;
    default:
      return postId;
  }
}

export function buildEmbedUrl(postId: string, platform: string): string {
  switch (platform.toLowerCase()) {
    case "instagram":
      return `https://www.instagram.com/p/${postId}/`;
    case "youtube":
      return `https://www.youtube.com/embed/${postId}`;
    case "tiktok":
      return `https://www.tiktok.com/embed/v2/${postId}`;
    default:
      return buildCanonicalUrl(postId, platform);
  }
}

export function normalizeEntityType(entity: string): string {
  const map: Record<string, string> = {
    clubs: "Clubs",
    club: "Clubs",
    player: "Players",
    players: "Players",
    competitions: "Competitions",
    competition: "Competitions",
    "content creators": "Content Creators",
    "content creator": "Content Creators",
    media: "Media",
    meme: "Meme",
    memes: "Meme",
    brand: "Brands",
    brands: "Brands",
  };
  return map[entity.toLowerCase().trim()] || entity.trim();
}

export function normalizeSport(sport: string): string {
  const map: Record<string, string> = {
    waterpolo: "Water Polo",
    "water polo": "Water Polo",
    football: "Football",
    basketball: "Basketball",
    motor: "Motor",
    handball: "Handball",
    baseball: "Baseball",
    cycling: "Cycling",
    "ice hockey": "Ice Hockey",
    "american football": "American Football",
    tennis: "Tennis",
    golf: "Golf",
    rugby: "Rugby",
    volleyball: "Volleyball",
    swimming: "Swimming",
    athletics: "Athletics",
    boxing: "Boxing",
    mma: "MMA",
    esports: "Esports",
    cricket: "Cricket",
    skiing: "Skiing",
    surfing: "Surfing",
    "figure skating": "Figure Skating",
    gymnastics: "Gymnastics",
    padel: "Padel",
  };
  const key = sport.toLowerCase().trim();
  if (map[key]) return map[key];
  return sport.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function normalizeFormat(format: string): string {
  const raw = format.split(",")[0].trim();
  const map: Record<string, string> = {
    images: "Image",
    image: "Image",
    carousel: "Carousel",
    reel: "Reel",
    reels: "Reel",
    video: "Video",
    videos: "Video",
    story: "Story",
    stories: "Story",
  };
  return map[raw.toLowerCase()] || raw;
}

export function normalizePlatform(platform: string): string {
  const map: Record<string, string> = {
    instagram: "Instagram",
    tiktok: "TikTok",
    twitter: "Twitter",
    x: "X",
    facebook: "Facebook",
    youtube: "YouTube",
    linkedin: "LinkedIn",
  };
  return map[platform.toLowerCase().trim()] || platform.trim();
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export interface ValidationResult {
  valid: boolean;
  postId: string;
  canonicalUrl: string;
  embedUrl: string;
  accountUsername: string | null;
  warnings: string[];
  errors: string[];
}

export function validateRow(row: CSVRow): ValidationResult {
  const result: ValidationResult = {
    valid: false,
    postId: "",
    canonicalUrl: "",
    embedUrl: "",
    accountUsername: null,
    warnings: [],
    errors: [],
  };

  const platform = normalizePlatform(row.platform || "Instagram");

  let postId = row.external_id?.trim() || "";

  if (!postId && row.embed) {
    const extracted = extractPostId(row.embed, platform);
    if (extracted) postId = extracted;
  }

  if (!postId && row.url) {
    const extracted = extractPostId(row.url, platform);
    if (extracted) postId = extracted;
  }

  if (!postId) {
    result.errors.push("No valid post ID found");
    return result;
  }

  result.postId = postId;
  result.canonicalUrl = buildCanonicalUrl(postId, platform);
  result.embedUrl = buildEmbedUrl(postId, platform);
  result.valid = true;

  if (row.title) {
    result.accountUsername = extractUsernameFromTitle(row.title);
  }
  if (!result.accountUsername && row.club) {
    result.accountUsername = row.club;
  }

  return result;
}
