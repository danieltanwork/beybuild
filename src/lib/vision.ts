import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Reading a short name is easy for any tier; reading a dense multi-block
// numeric stats table accurately needs a stronger model — Haiku mixed up
// which number belonged to which block on a real test box.
const model = process.env.VISION_MODEL || "claude-sonnet-5";

const nullableInt = z.number().int().nullable();

const beySchema = z.object({
  name: z.string().nullable(),
  bladeName: z.string().nullable(),
  ratchetName: z.string().nullable(),
  bitName: z.string().nullable(),
  bladeAttack: nullableInt,
  bladeDefense: nullableInt,
  bladeStamina: nullableInt,
  ratchetAttack: nullableInt,
  ratchetDefense: nullableInt,
  ratchetStamina: nullableInt,
  ratchetHeight: nullableInt,
  bitAttack: nullableInt,
  bitDefense: nullableInt,
  bitStamina: nullableInt,
  bitDash: nullableInt,
  bitBurstResistance: nullableInt,
});

const boxAnalysisSchema = z.object({
  boxCode: z.string().nullable(),
  boxName: z.string().nullable(),
  beys: z.array(beySchema),
});

export type BeyAnalysis = z.infer<typeof beySchema>;
export type BoxAnalysis = z.infer<typeof boxAnalysisSchema>;

const PROMPT = `You are looking at photos of a Beyblade X toy box (front and/or back, possibly a Japanese-market box with Japanese text elsewhere on it).

Some boxes ("Starter" or "Booster" sets) contain ONE beyblade. Others ("Deck Sets") contain THREE complete beyblades, each with its own name and its own stats block — look for three separate bey renders on the front and three separate named stat sections on the back (e.g. "SHARKSCALE 4-50UF", "TYRANNOROAR 1-70L", "HELLSBRAVE J3-60GF") before assuming there's only one. Return one entry in the "beys" array per beyblade actually in the box, in the order they're printed — most boxes need exactly one entry, deck sets need three.

Beyblade X sets are identified by a short overall product code like "BX-23", "UX-14", or "UX-15", printed once for the whole box — put that in boxCode, and the box's own title (e.g. "Sharkscale Deck Set", or for a single-bey box just its bey name) in boxName.

Each beyblade's own name is one printed string that encodes three parts, e.g. "Phoenix Wing 9-60GF" or "Scorpiospear 0-70Z" = Blade name + Ratchet code (a short number, a dash, then a 2-digit number, e.g. "9-60", "0-70") + Bit code ("GF", "Z" — 1-3 letters). Some blade names end in their own letter, e.g. "Hellsbrave J" — that letter belongs to the BLADE, not the ratchet, even though it sits right before the ratchet number (so "Hellsbrave J3-60GF" is Blade "Hellsbrave J" + Ratchet "3-60" + Bit "GF"); don't assume a leading letter before a ratchet number is part of the ratchet code. Put the full string in that bey's "name" field. The back of the box usually prints each part's name separately and explicitly in its own labeled block (e.g. a Japanese box labels them ブレード/Blade, ラチェット/Ratchet, ビット/Bit) — always prefer reading bladeName/ratchetName/bitName directly from those labeled blocks over splitting the combined name string yourself, and fill in all three whenever you can read them. The single most reliable source for the combined "name" field is usually a colored banner in plain Latin characters, even on an otherwise Japanese box — prefer that over piecing together fragments elsewhere, and prefer it over Japanese/katakana text. Ratchet codes are small print and easy to misread a digit in — look carefully and don't duplicate a digit (e.g. "0-70" is not "70-70").

The back of the box has a printed stats table with a separate block per part per beyblade (Blade, then Ratchet, then Bit — repeated for each beyblade in the box), each showing numeric bars, often in Japanese: 攻撃 = Attack, 防御 = Defense, 持久 = Stamina, 高さ = Height (ratchet block only), ダッシュ = Dash (bit block only), バースト耐性 = Burst Resistance (bit block only). If a blade has a "Dash Change" gimmick showing two numbers joined by an arrow (e.g. "25→55"), record only the first/base number, not the second.

Each block's numbers belong ONLY to that block, for that specific beyblade — never reuse or copy a number from one block into another, and never mix up which beyblade a block belongs to. Before calling the tool, first write out in plain text exactly what you see in each block, one line per block, labeled with which beyblade it belongs to (e.g. "Sharkscale Blade: Attack 12, Defense 13, Stamina 5" / "Sharkscale Ratchet: Attack 55, Defense 5, Stamina 5, Height 50" / "Sharkscale Bit: ..." then the same for the next beyblade). Then call extract_box_info using exactly those transcribed values — do not let numbers drift between blocks or between beyblades.

Read the box and record what you can actually see. Only fill in a field if you can read it in the photo(s) — never guess or invent a plausible-sounding value; leave it null instead.`;

const BEY_ITEM_SCHEMA = {
  type: "object",
  properties: {
    name: {
      type: ["string", "null"],
      description: 'This beyblade\'s full name as printed, e.g. "Sharkscale 4-50UF". Null if not visible.',
    },
    bladeName: {
      type: ["string", "null"],
      description: 'Just the blade\'s name, e.g. "Sharkscale". Null if you can\'t confidently split it out.',
    },
    ratchetName: {
      type: ["string", "null"],
      description: 'Just the ratchet\'s code, e.g. "4-50". Null if you can\'t confidently split it out.',
    },
    bitName: {
      type: ["string", "null"],
      description: 'Just the bit\'s code, e.g. "UF". Null if you can\'t confidently split it out.',
    },
    bladeAttack: { type: ["integer", "null"], description: "This beyblade's blade printed Attack stat." },
    bladeDefense: { type: ["integer", "null"], description: "This beyblade's blade printed Defense stat." },
    bladeStamina: { type: ["integer", "null"], description: "This beyblade's blade printed Stamina stat." },
    ratchetAttack: { type: ["integer", "null"], description: "This beyblade's ratchet printed Attack stat." },
    ratchetDefense: { type: ["integer", "null"], description: "This beyblade's ratchet printed Defense stat." },
    ratchetStamina: { type: ["integer", "null"], description: "This beyblade's ratchet printed Stamina stat." },
    ratchetHeight: { type: ["integer", "null"], description: "This beyblade's ratchet printed Height stat." },
    bitAttack: { type: ["integer", "null"], description: "This beyblade's bit printed Attack stat." },
    bitDefense: { type: ["integer", "null"], description: "This beyblade's bit printed Defense stat." },
    bitStamina: { type: ["integer", "null"], description: "This beyblade's bit printed Stamina stat." },
    bitDash: { type: ["integer", "null"], description: "This beyblade's bit printed Dash stat." },
    bitBurstResistance: { type: ["integer", "null"], description: "This beyblade's bit printed Burst Resistance stat." },
  },
  required: [
    "name", "bladeName", "ratchetName", "bitName",
    "bladeAttack", "bladeDefense", "bladeStamina",
    "ratchetAttack", "ratchetDefense", "ratchetStamina", "ratchetHeight",
    "bitAttack", "bitDefense", "bitStamina", "bitDash", "bitBurstResistance",
  ],
} as const;

const EXTRACT_TOOL: Anthropic.Tool = {
  name: "extract_box_info",
  description: "Record the overall product code/box title, and one entry per beyblade actually contained in the box (usually 1, sometimes 3 for a Deck Set).",
  input_schema: {
    type: "object",
    properties: {
      boxCode: {
        type: ["string", "null"],
        description: 'The overall product code, e.g. "UX-15". Null if not visible.',
      },
      boxName: {
        type: ["string", "null"],
        description: 'The box\'s own title, e.g. "Sharkscale Deck Set", or the single bey\'s name for a one-bey box. Null if not visible.',
      },
      beys: {
        type: "array",
        description: "One entry per beyblade actually in the box — one for a Starter/Booster, three for a Deck Set.",
        items: BEY_ITEM_SCHEMA,
      },
    },
    required: ["boxCode", "boxName", "beys"],
  },
};

// A Beyblade X bey name is one printed string that encodes all three parts,
// e.g. "Scorpiospear 0-70Z" -> Blade "Scorpiospear" + Ratchet "0-70" + Bit "Z".
// This is only a fallback for when the model couldn't read bladeName/
// ratchetName/bitName directly from the box's own labeled per-part blocks
// (see analyzeBoxPhotos) — a blind regex split can't tell a blade name's own
// trailing letter (e.g. "Hellsbrave J") apart from a ratchet-code prefix, so
// the model's direct reads take priority whenever all three are present.
const BEY_NAME_PATTERN = /^(.+?)\s+([A-Za-z]?\d{1,2}-\d{2})([A-Za-z]{1,3})$/;

function deriveFromBeyName(name: string | null) {
  if (!name) return null;
  const match = name.trim().match(BEY_NAME_PATTERN);
  if (!match) return null;
  return {
    bladeName: match[1].trim(),
    ratchetName: match[2],
    bitName: match[3],
  };
}

export async function analyzeBoxPhotos(
  photoUrls: string[],
): Promise<BoxAnalysis> {
  const response = await anthropic.messages.create({
    model,
    max_tokens: 3000,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "any" },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          ...photoUrls.map(
            (url) =>
              ({ type: "image", source: { type: "url", url } }) as const,
          ),
        ],
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("No structured response from vision model");
  }

  const parsed = boxAnalysisSchema.safeParse(toolUse.input);
  if (!parsed.success) throw new Error("Vision model returned unexpected shape");

  const beys = parsed.data.beys.map((bey) => {
    // Trust the model's own direct per-part reads first — it can see labeled
    // breakdowns on the box (e.g. a blade name with its own letter suffix,
    // like "Hellsbrave J", distinct from a ratchet code) that a blind regex
    // split of the combined name field can't distinguish. Only fall back to
    // splitting the combined name when a direct field is missing.
    if (bey.bladeName && bey.ratchetName && bey.bitName) return bey;
    const derived = deriveFromBeyName(bey.name);
    return derived
      ? {
          ...bey,
          bladeName: bey.bladeName ?? derived.bladeName,
          ratchetName: bey.ratchetName ?? derived.ratchetName,
          bitName: bey.bitName ?? derived.bitName,
        }
      : bey;
  });

  return { ...parsed.data, beys };
}
