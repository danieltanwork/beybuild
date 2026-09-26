import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const model = process.env.VISION_MODEL || "claude-sonnet-5";

// UNVERIFIED: written without ever seeing metabeys.com's actual HTML (this
// sandbox's network policy blocks it). If the site renders its data
// client-side (a pure SPA with no server-rendered content), a plain fetch()
// here will only see an empty shell and combos will come back as an empty
// array — that's itself the diagnostic signal that a different approach
// (e.g. a headless browser) is needed. Check the /api/meta/refresh response
// after first deploying this before trusting it's actually working.
const SOURCE_URL = "https://www.metabeys.com/home";
const SOURCE = "metabeys.com";

const comboSchema = z.object({
  bladeName: z.string(),
  ratchetName: z.string().nullable(),
  bitName: z.string().nullable(),
  comboName: z.string().nullable(),
  winRate: z.number().nullable(),
  pickRate: z.number().nullable(),
  tier: z.string().nullable(),
});

const resultSchema = z.object({ combos: z.array(comboSchema) });

export type ScrapedCombo = z.infer<typeof comboSchema>;

const EXTRACT_TOOL: Anthropic.Tool = {
  name: "extract_meta_combos",
  description:
    "Extract every distinct Beyblade X competitive combo (blade+ratchet+bit) and its stats from this page.",
  input_schema: {
    type: "object",
    properties: {
      combos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            bladeName: { type: "string", description: 'Just the blade\'s name, e.g. "Shark Scale".' },
            ratchetName: { type: ["string", "null"], description: 'The ratchet\'s code, e.g. "4-50". Null if not shown or not confidently split out.' },
            bitName: { type: ["string", "null"], description: 'The bit\'s code, e.g. "UF". Null if not shown or not confidently split out.' },
            comboName: { type: ["string", "null"], description: 'The full combo string as printed, if shown as one piece, e.g. "Shark Scale 4-50UF". Null if the page only lists parts separately.' },
            winRate: { type: ["number", "null"], description: "Win rate as a plain percentage number (47.1 for 47.1%). Null if not shown." },
            pickRate: { type: ["number", "null"], description: "Pick/usage rate as a plain percentage number. Null if not shown." },
            tier: { type: ["string", "null"], description: 'Tier label if shown (e.g. "S", "A"). Null if not shown.' },
          },
          required: ["bladeName", "ratchetName", "bitName", "comboName", "winRate", "pickRate", "tier"],
        },
      },
    },
    required: ["combos"],
  },
};

function buildPrompt(pageContent: string) {
  return `The following is the raw HTML (or extracted text) of a Beyblade X competitive-meta tracking website's page. It lists blade/ratchet/bit combos along with competitive stats like win rate, pick rate, or tier ranking — ignore navigation, ads, and unrelated boilerplate.

A Beyblade X combo's full name usually encodes three parts: Blade name + Ratchet code (a number, a dash, a 2-digit number, e.g. "4-50") + Bit code (1-3 letters, e.g. "UF"). If the page gives the ratchet/bit as part of one combined string, split them out into bladeName/ratchetName/bitName as best you can and also keep the original full string in comboName. If the page already lists parts separately, use those direct values instead of guessing a split. Extract every distinct combo mentioned, with whatever stats are actually shown for it — only fill in a field the page actually shows; never invent a plausible-sounding number, use null instead.

--- PAGE CONTENT ---
${pageContent}`;
}

export async function fetchMetaCombos(): Promise<{
  combos: ScrapedCombo[];
  source: string;
  fetchedLength: number;
} | null> {
  let html: string;
  try {
    const res = await fetch(SOURCE_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BeyBuildMetaBot/1.0; +https://beybuild.vercel.app)" },
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }

  if (!html.trim()) return { combos: [], source: SOURCE, fetchedLength: 0 };

  // Truncate rather than send the whole page — plenty for a data table/list,
  // and keeps the call cheap. Adjust if real pages turn out to bury the data
  // further down than this reaches.
  const content = html.slice(0, 60000);

  const response = await anthropic.messages.create({
    model,
    max_tokens: 4000,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "any" },
    messages: [{ role: "user", content: buildPrompt(content) }],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return { combos: [], source: SOURCE, fetchedLength: html.length };
  }

  const parsed = resultSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    return { combos: [], source: SOURCE, fetchedLength: html.length };
  }

  return { combos: parsed.data.combos, source: SOURCE, fetchedLength: html.length };
}
