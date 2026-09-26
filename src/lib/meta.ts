import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const model = process.env.VISION_MODEL || "claude-sonnet-5";

// WBO's "Winning Combinations at WBO Organized Events" forum thread — plain
// server-rendered forum HTML (no JS rendering needed, unlike metabeys.com
// which turned out to be a client-rendered SPA and only ever returned an
// empty shell). This thread has new tournament results appended as new
// forum posts over time, so it's paginated (MyBB-style `?page=N` links) and
// the latest results are always on the LAST page — hardcoding a page number
// would go stale, so we fetch page 1 first, scan its pagination links for
// the highest page number, then fetch that page for the actual extraction
// content.
const THREAD_BASE_URL =
  "https://worldbeyblade.org/Thread-Winning-Combinations-at-WBO-Organized-Events-Beyblade-X-BBX";
const SOURCE = "worldbeyblade.org";

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
    "Extract every distinct Beyblade X competitive combo (blade+ratchet+bit) mentioned as a tournament-winning or placing result on this forum page.",
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
            comboName: { type: ["string", "null"], description: 'The full combo string as printed, if shown as one piece, e.g. "Shark Scale 4-50UF". Null if the post only lists parts separately.' },
            winRate: { type: ["number", "null"], description: "Win rate as a plain percentage number, only if this page actually states one (rare for this source — most posts are just placement results, not aggregated stats). Null otherwise." },
            pickRate: { type: ["number", "null"], description: "Pick/usage rate as a plain percentage number, only if this page actually states one. Null otherwise." },
            tier: { type: ["string", "null"], description: 'Tier label if shown. Null if not shown (this source usually doesn\'t have one).' },
          },
          required: ["bladeName", "ratchetName", "bitName", "comboName", "winRate", "pickRate", "tier"],
        },
      },
    },
    required: ["combos"],
  },
};

function buildPrompt(pageContent: string) {
  return `The following is the raw HTML of a page from the World Beyblade Organization (WBO) forum thread "Winning Combinations at WBO Organized Events". Each forum post in this thread reports the winning (and sometimes runner-up) combo(s) from a specific real-world tournament, formatted roughly like "1st: Blade Name Ratchet-BitCode" or "Winner: Blade Name 4-50UF" alongside a tournament name/date. Ignore forum chrome — navigation, avatars, signatures, ads, quoted replies, and unrelated discussion — and focus only on the reported winning/placing combos.

A Beyblade X combo's full name usually encodes three parts: Blade name + Ratchet code (a number, a dash, a 2-digit number, e.g. "4-50") + Bit code (1-3 letters, e.g. "UF"). If a post gives the ratchet/bit as part of one combined string, split them out into bladeName/ratchetName/bitName as best you can and also keep the original full string in comboName. Extract every distinct combo mentioned as a tournament result. This source generally does NOT include aggregated win-rate/pick-rate percentages or tier rankings (those come from a different kind of site) — only fill winRate/pickRate/tier in if a number or label is actually printed on the page; otherwise use null. It's normal and expected for those three fields to be null for every combo from this source.

--- PAGE CONTENT ---
${pageContent}`;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BeyBuildMetaBot/1.0; +https://beybuild.vercel.app)" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// MyBB-style pagination links look like
// ".../Thread-...?page=88" (or "&page=88" alongside other query params).
// Scan for every page number mentioned and take the max — the thread only
// grows, so the highest number seen is the latest page.
function findLatestPage(html: string): number | null {
  const matches = [...html.matchAll(/[?&]page=(\d+)/g)].map((m) => parseInt(m[1], 10));
  if (matches.length === 0) return null;
  return Math.max(...matches);
}

export async function fetchMetaCombos(): Promise<{
  combos: ScrapedCombo[];
  source: string;
  fetchedLength: number;
} | null> {
  const firstPageHtml = await fetchHtml(THREAD_BASE_URL);
  if (firstPageHtml === null) return null;
  if (!firstPageHtml.trim()) return { combos: [], source: SOURCE, fetchedLength: 0 };

  const latestPage = findLatestPage(firstPageHtml);
  const targetUrl = latestPage && latestPage > 1 ? `${THREAD_BASE_URL}?page=${latestPage}` : THREAD_BASE_URL;

  const html = targetUrl === THREAD_BASE_URL ? firstPageHtml : await fetchHtml(targetUrl);
  if (html === null) return null;
  if (!html.trim()) return { combos: [], source: SOURCE, fetchedLength: 0 };

  // Truncate rather than send the whole page — plenty for a page's worth of
  // forum posts, and keeps the call cheap. Adjust if real pages turn out to
  // bury the data further down than this reaches.
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
