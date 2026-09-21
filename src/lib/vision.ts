import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const model = process.env.VISION_MODEL || "claude-haiku-4-5-20251001";

const nullableInt = z.number().int().nullable();

const boxAnalysisSchema = z.object({
  boxCode: z.string().nullable(),
  boxName: z.string().nullable(),
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

export type BoxAnalysis = z.infer<typeof boxAnalysisSchema>;

const PROMPT = `You are looking at photos of a Beyblade X toy box (front and/or back, possibly a Japanese-market box with Japanese text elsewhere on it). Beyblade X sets are identified by a short product code like "BX-23", "UX-14", or "CX-05", and a set name that encodes three parts, printed together as one string, e.g. "Phoenix Wing 9-60GF" or "Scorpiospear 0-70Z" = Blade name + Ratchet code ("9-60", "0-70" — a short number, a dash, then a 2-digit number) + Bit code ("GF", "Z" — 1-3 letters).

The single most reliable source for the name/code is usually a colored banner (often near the bottom of the front of the box) printed in plain Latin characters with the product code and the full set name together, even on an otherwise Japanese box — prefer that over piecing together fragments from elsewhere, and prefer it over any Japanese/katakana text. Ratchet codes are small print and easy to misread a digit in — look carefully and don't duplicate a digit (e.g. "0-70" is not "70-70").

The back of the box usually has a printed stats table with a separate block for each of the three parts (Blade, Ratchet, Bit), each showing numeric bars, often in Japanese: 攻撃 = Attack, 防御 = Defense, 持久 = Stamina, 高さ = Height (ratchet only), ダッシュ = Dash (bit only), バースト耐性 = Burst Resistance (bit only). If a blade has a "Dash Change" gimmick showing two numbers joined by an arrow (e.g. "25→55"), record only the first/base number, not the second.

Read the box and record what you can actually see. Only fill in a field if you can read it in the photo(s) — never guess or invent a plausible-sounding value; leave it null instead.`;

const EXTRACT_TOOL: Anthropic.Tool = {
  name: "extract_box_info",
  description: "Record the product code, set name, part names, and stat numbers read from the box photos.",
  input_schema: {
    type: "object",
    properties: {
      boxCode: {
        type: ["string", "null"],
        description: 'The product code, e.g. "UX-14". Null if not visible.',
      },
      boxName: {
        type: ["string", "null"],
        description: 'The full set name as printed in Latin characters, e.g. "Scorpiospear 0-70Z". Null if not visible.',
      },
      bladeName: {
        type: ["string", "null"],
        description: 'Just the blade\'s name, e.g. "Scorpiospear". Null if unreadable.',
      },
      ratchetName: {
        type: ["string", "null"],
        description: 'Just the ratchet\'s code, e.g. "0-70". Null if unreadable.',
      },
      bitName: {
        type: ["string", "null"],
        description: 'Just the bit\'s code, e.g. "Z". Null if unreadable.',
      },
      bladeAttack: { type: ["integer", "null"], description: "Blade's printed Attack stat. Null if not visible." },
      bladeDefense: { type: ["integer", "null"], description: "Blade's printed Defense stat. Null if not visible." },
      bladeStamina: { type: ["integer", "null"], description: "Blade's printed Stamina stat. Null if not visible." },
      ratchetAttack: { type: ["integer", "null"], description: "Ratchet's printed Attack stat. Null if not visible." },
      ratchetDefense: { type: ["integer", "null"], description: "Ratchet's printed Defense stat. Null if not visible." },
      ratchetStamina: { type: ["integer", "null"], description: "Ratchet's printed Stamina stat. Null if not visible." },
      ratchetHeight: { type: ["integer", "null"], description: "Ratchet's printed Height stat. Null if not visible." },
      bitAttack: { type: ["integer", "null"], description: "Bit's printed Attack stat. Null if not visible." },
      bitDefense: { type: ["integer", "null"], description: "Bit's printed Defense stat. Null if not visible." },
      bitStamina: { type: ["integer", "null"], description: "Bit's printed Stamina stat. Null if not visible." },
      bitDash: { type: ["integer", "null"], description: "Bit's printed Dash stat. Null if not visible." },
      bitBurstResistance: { type: ["integer", "null"], description: "Bit's printed Burst Resistance stat. Null if not visible." },
    },
    required: [
      "boxCode", "boxName", "bladeName", "ratchetName", "bitName",
      "bladeAttack", "bladeDefense", "bladeStamina",
      "ratchetAttack", "ratchetDefense", "ratchetStamina", "ratchetHeight",
      "bitAttack", "bitDefense", "bitStamina", "bitDash", "bitBurstResistance",
    ],
  },
};

// A Beyblade X set name is one printed string that encodes all three parts,
// e.g. "Scorpiospear 0-70Z" -> Blade "Scorpiospear" + Ratchet "0-70" + Bit "Z".
// Reading that single string once and splitting it here is more reliable than
// asking the model to separately re-read the same three fields from smaller,
// easier-to-misread fragments elsewhere on the box.
const BOX_NAME_PATTERN = /^(.+?)\s+(\d{1,2}-\d{2})([A-Za-z]{1,3})$/;

function deriveFromBoxName(boxName: string | null) {
  if (!boxName) return null;
  const match = boxName.trim().match(BOX_NAME_PATTERN);
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
    max_tokens: 800,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "tool", name: "extract_box_info" },
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

  const derived = deriveFromBoxName(parsed.data.boxName);
  if (derived) return { ...parsed.data, ...derived };

  return parsed.data;
}
