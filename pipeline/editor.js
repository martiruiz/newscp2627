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
4. If not relevant, still return the platform and an English title, and an empty paragraphs list.

Return a list of stories. Usually the article is one news item: return one story. When the user message says the source is a newsletter with several news items, return one story per separate news item, up to the number it allows, best ones first.`;

const STORY = {
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
const SCHEMA = { type: "object", additionalProperties: false, properties: { stories: { type: "array", items: STORY } }, required: ["stories"] };

const Story = z.object({
  relevant: z.boolean(),
  platform: z.enum(PLATFORMS),
  title: z.string().min(1),
  paragraphs: z.array(z.string().min(1)),
});
const Result = z.object({ stories: z.array(Story).min(1) });

const client = new Anthropic(); // reads ANTHROPIC_API_KEY

// Running token totals for the cost line at the end of each run (triage: the cheap first pass)
export const usage = { input: 0, output: 0, triageInput: 0, triageOutput: 0 };

// Cheap first pass for high-volume feeds: title + start of the text → could this matter to a sports social media team?
export async function worthEditing(item) {
  const response = await client.messages.create({
    model: "claude-haiku-5-5",
    max_tokens: 200,
    output_config: { format: { type: "json_schema", schema: { type: "object", additionalProperties: false, properties: { keep: { type: "boolean" } }, required: ["keep"] } } },
    system: "You screen news for Sports Content Playbook, read by the social media teams of sports clubs, leagues, athletes and sports brands. keep = true only if the story is about social media platforms (features, algorithms, policies), content, creators, fan engagement, sports sponsorship or brand activations, or AI tools a social team could use. Results, transfers, betting odds, finance, legal and pure business news: keep = false.",
    messages: [{ role: "user", content: `Title: ${item.title}\n\n${item.body.slice(0, 1200)}` }],
  });
  usage.triageInput += response.usage.input_tokens ?? 0;
  usage.triageOutput += response.usage.output_tokens ?? 0;
  const t = response.content.find((b) => b.type === "text");
  try { return t ? JSON.parse(t.text).keep === true : false; } catch { return false; }
}

/** Returns [{ relevant, platform, title, paragraphs }] (one per news item, up to `stories`) or null if the model declined. */
export async function editArticle(item, sourceName, stories = 1) {
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
        content: `Source: ${sourceName}${stories > 1 ? ` (a newsletter with several news items: up to ${stories} stories)` : " (one story)"}\nURL: ${item.url}\nOriginal title: ${item.title}\n\nArticle text:\n${item.body}`,
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
  // A relevant story must have 2-3 paragraphs
  return parsed.data.stories.slice(0, stories).map((out) => {
    if (out.relevant && (out.paragraphs.length < 2 || out.paragraphs.length > 3)) {
      out.paragraphs = out.paragraphs.slice(0, 3);
      if (out.paragraphs.length < 2) out.relevant = false;
    }
    return out;
  });
}
