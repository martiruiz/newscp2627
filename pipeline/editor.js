// Claude: decide relevance, detect platform and rewrite the article for sports digital marketing
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export const PLATFORMS = [
  "instagram", "tiktok", "x", "youtube", "facebook", "linkedin",
  "snapchat", "whatsapp", "pinterest", "threads", "ai", "other",
];

const SYSTEM = `You are the news editor of Sports Content Playbook, a content-intelligence platform for the social media teams of sports clubs, leagues, athletes and sports brands.

You receive one article from an external source (often in Spanish). Your job:

1. Decide if the topic is adaptable to sports digital marketing (social media, content, fan engagement, sponsorship activation, creators/athletes, sports brands, or AI/platform features a sports social team could use). Pure finance, legal, transfer gossip or results with no marketing angle are not relevant.
2. Pick the single platform the news is mainly about: instagram, tiktok, x, youtube, facebook, linkedin, snapchat, whatsapp, pinterest, threads, ai (AI tools, models or AI features in general), or other (sports marketing news not tied to one platform).
3. If relevant, write the news for our readers in English:
   - title: a clear, specific headline (max ~14 words), no emojis, no clickbait.
   - paragraphs: 2 or 3 short paragraphs (40-80 words each). First explain what happened. Then explain what it means for sports social media teams and how a club, league or athlete could use it.
   Write in your own words: do not copy sentences from the source and do not quote more than a few words. Stick to facts that are in the article; never invent figures, dates or quotes.
4. If not relevant, still return the platform and an English title, and an empty paragraphs list.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    relevant: { type: "boolean" },
    platform: { type: "string", enum: PLATFORMS },
    title: { type: "string" },
    paragraphs: { type: "array", items: { type: "string" } },
  },
  required: ["relevant", "platform", "title", "paragraphs"],
};

const Result = z.object({
  relevant: z.boolean(),
  platform: z.enum(PLATFORMS),
  title: z.string().min(1),
  paragraphs: z.array(z.string().min(1)),
});

const client = new Anthropic(); // reads ANTHROPIC_API_KEY

// Running token totals for the cost line at the end of each run
export const usage = { input: 0, output: 0 };

/** Returns { relevant, platform, title, paragraphs } or null if the model declined. */
export async function editArticle(item, sourceName) {
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: SCHEMA },
    },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Source: ${sourceName}\nURL: ${item.url}\nOriginal title: ${item.title}\n\nArticle text:\n${item.body}`,
      },
    ],
  });

  usage.input += response.usage.input_tokens ?? 0;
  usage.output += response.usage.output_tokens ?? 0;

  if (response.stop_reason === "refusal") {
    console.warn(`  ! declined (${response.stop_details?.category ?? "unknown"}): ${item.url}`);
    return null;
  }
  if (response.stop_reason === "max_tokens") {
    console.warn(`  ! output cut off: ${item.url}`);
    return null;
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock) return null;
  const parsed = Result.safeParse(JSON.parse(textBlock.text));
  if (!parsed.success) {
    console.warn(`  ! invalid output for ${item.url}: ${parsed.error.message}`);
    return null;
  }
  const out = parsed.data;
  // A relevant story must have 2-3 paragraphs
  if (out.relevant && (out.paragraphs.length < 2 || out.paragraphs.length > 3)) {
    out.paragraphs = out.paragraphs.slice(0, 3);
    if (out.paragraphs.length < 2) out.relevant = false;
  }
  return out;
}
