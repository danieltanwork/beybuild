import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { z } from "zod";
import { uploadBuffer } from "@/lib/storage";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Reading a short name is easy for any tier; reading a dense multi-block
// numeric stats table accurately needs a stronger model — Haiku mixed up
// which number belonged to which block on a real test box.
const model = process.env.VISION_MODEL || "claude-sonnet-5";

const nullableInt = z.number().int().nullable();

// A raw bar-chart block as printed on the box, BEFORE we know which part
// (blade/ratchet/bit) it belongs to. Asking the model to only transcribe
// each block's own bars — rather than also reason about which named part it
// belongs to — turned out to be far more reliable: in testing, the model's
// raw number-reading was consistently accurate even in runs where it
// mislabeled which part a block belonged to. So classification into
// blade/ratchet/bit happens deterministically in code (see classifyBlocks),
// purely from which stats a block contains — never from its position
// relative to a label, which varies from box to box and isn't reliable.
const imageBoxSchema = z.object({
  photoIndex: z.number().int(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

const blockSchema = z.object({
  attack: nullableInt,
  defense: nullableInt,
  stamina: nullableInt,
  height: nullableInt, // present only on a ratchet's block
  dash: nullableInt, // present only on a bit's block
  burstResistance: nullableInt, // present only on a bit's block
  // Second (Low Mode) numbers, only on a mode-change blade's own block.
  attackLow: nullableInt,
  defenseLow: nullableInt,
  staminaLow: nullableInt,
  // Bounding box of this block's own small part illustration (the picture
  // grouped with it), used to auto-crop a part photo. Null if no picture is
  // clearly grouped with this block. Travels with the block through
  // classifyBlocks, so it needs no separate blade/ratchet/bit reasoning.
  imageBox: imageBoxSchema.nullable(),
});

const rawBeySchema = z.object({
  name: z.string().nullable(),
  bladeName: z.string().nullable(),
  ratchetName: z.string().nullable(),
  bitName: z.string().nullable(),
  // True for a "ratchet-integrated blade" (e.g. Hellsnether) — blade and
  // ratchet are one fused part, so this bey has no separate ratchet.
  bladeIsIntegrated: z.boolean().nullable(),
  blocks: z.array(blockSchema),
});

const boxAnalysisSchema = z.object({
  boxCode: z.string().nullable(),
  boxName: z.string().nullable(),
  beys: z.array(rawBeySchema),
});

// Public, flat shape the rest of the app consumes (inventory actions, the
// add-box form, the analyze-box API route) — unchanged by the internal
// block-based extraction above.
export type BeyAnalysis = {
  name: string | null;
  bladeName: string | null;
  ratchetName: string | null;
  bitName: string | null;
  bladeIsIntegrated: boolean | null;
  bladeAttack: number | null;
  bladeDefense: number | null;
  bladeStamina: number | null;
  bladeAttackLow: number | null;
  bladeDefenseLow: number | null;
  bladeStaminaLow: number | null;
  ratchetAttack: number | null;
  ratchetDefense: number | null;
  ratchetStamina: number | null;
  ratchetHeight: number | null;
  bitAttack: number | null;
  bitDefense: number | null;
  bitStamina: number | null;
  bitDash: number | null;
  bitBurstResistance: number | null;
  // Auto-cropped from the box photo(s), null if no picture was found for
  // that part. The add-box form uses these as starting photos the player
  // can still override by tapping to take a real one.
  bladePhotoUrl: string | null;
  ratchetPhotoUrl: string | null;
  bitPhotoUrl: string | null;
};

export type BoxAnalysis = {
  boxCode: string | null;
  boxName: string | null;
  beys: BeyAnalysis[];
};

const PROMPT = `You are looking at photos of a Beyblade X toy box (front and/or back, possibly a Japanese-market box with Japanese text elsewhere on it).

Some boxes ("Starter" or "Booster" sets) contain ONE beyblade. Others ("Deck Sets") contain THREE complete beyblades, each with its own name and its own stats blocks — look for three separate bey renders on the front and three separate named stat sections on the back (e.g. "SHARKSCALE 4-50UF", "TYRANNOROAR 1-70L", "HELLSBRAVE J3-60GF") before assuming there's only one. Return one entry in the "beys" array per beyblade actually in the box, in the order they're printed — most boxes need exactly one entry, deck sets need three.

Beyblade X sets are identified by a short overall product code like "BX-23", "UX-14", or "UX-15", printed once for the whole box — put that in boxCode, and the box's own title (e.g. "Sharkscale Deck Set", or for a single-bey box just its bey name) in boxName.

Each beyblade's own name is normally one printed string that encodes three parts, e.g. "Phoenix Wing 9-60GF" or "Scorpiospear 0-70Z" = Blade name + Ratchet code (a short number, a dash, then a 2-digit number, e.g. "9-60", "0-70") + Bit code ("GF", "Z" — 1-3 letters). Some blade names end in their own letter, e.g. "Hellsbrave J" — that letter belongs to the BLADE, not the ratchet, even though it sits right before the ratchet number (so "Hellsbrave J3-60GF" is Blade "Hellsbrave J" + Ratchet "3-60" + Bit "GF"); don't assume a leading letter before a ratchet number is part of the ratchet code. Put the full string in that bey's "name" field. The back of the box usually prints each part's name separately and explicitly in its own labeled block (e.g. a Japanese box labels them ブレード/Blade, ラチェット/Ratchet, ビット/Bit) — always prefer reading bladeName/ratchetName/bitName directly from those labeled blocks over splitting the combined name string yourself, and fill in all three whenever you can read them. The single most reliable source for the combined "name" field is usually a colored banner in plain Latin characters, even on an otherwise Japanese box — prefer that over piecing together fragments elsewhere, and prefer it over Japanese/katakana text. Ratchet codes are small print and easy to misread a digit in — look carefully and don't duplicate a digit (e.g. "0-70" is not "70-70").

Some blades are printed as "ラチェット一体型ブレード" ("ratchet-integrated blade") — the blade and ratchet are ONE fused physical part, so that bey has no separate ratchet at all. You'll see this from the part being labeled "ラチェット一体型ブレード/[name]" instead of a plain "ブレード/[name]", and the bey's printed name itself will have no ratchet-code segment (e.g. just "Hellsnether-Z" = Blade "Hellsnether" + Bit "Z", nothing in between). When you see this, set bladeIsIntegrated to true and put the blade's name in bladeName as usual.

The back of the box prints, for each beyblade, several distinct bar-chart blocks of numbers (攻撃 = Attack, 防御 = Defense, 持久 = Stamina, 高さ = Height, ダッシュ = Dash, バースト耐性 = Burst Resistance), each grouped with its own picture and description. One of these three blocks — the blade's — is often positioned next to a quoted special-technique name in "" marks (e.g. "ディープブレイク") rather than next to a plain "ブレード/[name]" label; don't skip it just because there's no plain blade label right there — it's a real block and still counts as one of this beyblade's three. For each beyblade, find every one of these blocks and add one entry to that beyblade's "blocks" array per block, in the order they're printed. For each block, just faithfully transcribe exactly the bars THAT block shows — do NOT try to figure out whether a block is the blade's, ratchet's, or bit's; that gets worked out afterward automatically from which bars it has. Concretely:
- If a block shows only attack/defense/stamina, fill in those three fields and leave height/dash/burstResistance null.
- If a block also shows a 高さ/Height bar, fill that in too.
- If a block also shows ダッシュ/Dash and/or バースト耐性/Burst Resistance bars, fill those in too.
- If a block shows TWO numbers per stat instead of one (a blade with a manual height-change gimmick — look for "ノーマルモード"/Normal Mode vs "ローモード"/Low Mode labels, usually color-coded orange/yellow vs blue), put the first/orange number in attack/defense/stamina and the second/blue number in attackLow/defenseLow/staminaLow.
- Read every bar actually grouped in a block's panel before moving on — a block can have more than three bars, don't stop early.
Most beyblades have exactly 3 blocks (blade, ratchet, bit). A ratchet-integrated blade (bladeIsIntegrated = true) has only 2, since it has no separate ratchet — don't invent a third block for it. Work through one beyblade's blocks completely before starting the next one, and never let a number drift from one beyblade's block into another's.

Each block on the back of the box is grouped with its own small picture of just that one part — a single product icon of the blade alone, the ratchet alone, or the bit alone, always shown on a plain black background right next to that block's bars and description. This is different from the OTHER pictures on the box, which you must NOT use for imageBox: don't use the character/person portrait (has a face and a name tag, usually near the top of the column), and don't use the larger motion-blurred action shot of the fully-assembled beyblade (also usually near the top, above the technique name). Only the small single-part icon on a black background, positioned right beside its own block's numbers, counts.

For each block, give that icon's location as imageBox: which photo it's in (photoIndex — the photos are given to you in order starting at 0), and a bounding box as fractions of that photo's full width/height (x, y = top-left corner of the icon, where 0,0 is the photo's top-left corner and 1,1 is its bottom-right corner; width, height = how much of the photo's total width/height the icon spans, typically quite small since it's one icon among many on a busy box — think carefully before writing width/height, since guessing too large will crop in neighboring text or other parts' icons instead). Look again at exactly where the icon's edges are before answering; don't estimate the block's whole panel as the box, only the icon itself. If you can't find a clear standalone icon for a block, leave imageBox null rather than guessing.

Read the box and record what you can actually see. Only fill in a field if you can read it in the photo(s) — never guess or invent a plausible-sounding value; leave it null instead.`;

const IMAGE_BOX_SCHEMA = {
  type: "object",
  properties: {
    photoIndex: { type: "integer", description: "Which photo this picture is in, 0 for the first photo given, 1 for the second, etc." },
    x: { type: "number", description: "Left edge of the picture, as a fraction of that photo's width (0 = left edge, 1 = right edge)." },
    y: { type: "number", description: "Top edge of the picture, as a fraction of that photo's height (0 = top edge, 1 = bottom edge)." },
    width: { type: "number", description: "Width of the picture, as a fraction of that photo's width." },
    height: { type: "number", description: "Height of the picture, as a fraction of that photo's height." },
  },
  required: ["photoIndex", "x", "y", "width", "height"],
} as const;

const BLOCK_SCHEMA = {
  type: "object",
  properties: {
    attack: { type: ["integer", "null"], description: "This block's printed Attack stat." },
    defense: { type: ["integer", "null"], description: "This block's printed Defense stat." },
    stamina: { type: ["integer", "null"], description: "This block's printed Stamina stat." },
    height: { type: ["integer", "null"], description: "This block's printed Height stat, only if this block actually shows a Height bar (only a ratchet's block does)." },
    dash: { type: ["integer", "null"], description: "This block's printed Dash stat, only if this block actually shows a Dash bar (only a bit's block does)." },
    burstResistance: { type: ["integer", "null"], description: "This block's printed Burst Resistance stat, only if this block actually shows a Burst Resistance bar (only a bit's block does)." },
    attackLow: { type: ["integer", "null"], description: "Second (Low Mode) Attack number, only if this block shows two numbers per stat." },
    defenseLow: { type: ["integer", "null"], description: "Second (Low Mode) Defense number, only if this block shows two numbers per stat." },
    staminaLow: { type: ["integer", "null"], description: "Second (Low Mode) Stamina number, only if this block shows two numbers per stat." },
    imageBox: {
      anyOf: [IMAGE_BOX_SCHEMA, { type: "null" }],
      description: "Bounding box of this block's own small part picture. Null if no clear standalone picture is grouped with this block.",
    },
  },
  required: ["attack", "defense", "stamina", "height", "dash", "burstResistance", "attackLow", "defenseLow", "staminaLow", "imageBox"],
} as const;

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
      description: 'Just the ratchet\'s code, e.g. "4-50". Null if you can\'t confidently split it out, or if bladeIsIntegrated is true.',
    },
    bitName: {
      type: ["string", "null"],
      description: 'Just the bit\'s code, e.g. "UF". Null if you can\'t confidently split it out.',
    },
    bladeIsIntegrated: {
      type: ["boolean", "null"],
      description: "True if this is a \"ratchet-integrated blade\" (labeled ラチェット一体型ブレード) with no separate ratchet part. Null/false otherwise.",
    },
    blocks: {
      type: "array",
      description: "One entry per distinct bar-chart stats block printed for this beyblade, in the order printed. Normally 3 (blade, ratchet, bit); 2 for a ratchet-integrated blade.",
      items: BLOCK_SCHEMA,
    },
  },
  required: ["name", "bladeName", "ratchetName", "bitName", "bladeIsIntegrated", "blocks"],
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

type RawBlock = z.infer<typeof blockSchema>;

// Classify each raw block by the stats it actually contains — a block with
// a Height reading can only be the ratchet's, a block with Dash and/or
// Burst Resistance can only be the bit's, and a block with neither (just
// attack/defense/stamina, possibly doubled for a mode-change blade) is the
// blade's. This is deterministic and independent of block order or label
// position, which is what made the model's own type-assignment unreliable.
function classifyBlocks(blocks: RawBlock[]) {
  let blade: RawBlock | null = null;
  let ratchet: RawBlock | null = null;
  let bit: RawBlock | null = null;
  for (const b of blocks) {
    if (b.height != null && !ratchet) {
      ratchet = b;
    } else if ((b.dash != null || b.burstResistance != null) && !bit) {
      bit = b;
    } else if (!blade) {
      blade = b;
    }
  }
  return { blade, ratchet, bit };
}

type ImageBox = z.infer<typeof imageBoxSchema>;

async function fetchImageBuffer(url: string, cache: Map<string, Buffer>): Promise<Buffer> {
  const cached = cache.get(url);
  if (cached) return cached;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch photo: ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  cache.set(url, buffer);
  return buffer;
}

// Crops a part's picture out of one of the box photos and uploads it as its
// own image. Never throws — a bad or out-of-range box just means no
// auto-cropped photo, not a broken analysis.
async function cropPartImage(
  photoUrls: string[],
  box: ImageBox,
  bufferCache: Map<string, Buffer>,
): Promise<string | null> {
  const url = photoUrls[box.photoIndex];
  if (!url) return null;

  try {
    const buffer = await fetchImageBuffer(url, bufferCache);
    const meta = await sharp(buffer).metadata();
    if (!meta.width || !meta.height) return null;

    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    const pad = 0.08; // small margin around the model's box, so a tight crop isn't cutting the part off
    const x0 = clamp(box.x - box.width * pad);
    const y0 = clamp(box.y - box.height * pad);
    const x1 = clamp(box.x + box.width * (1 + pad));
    const y1 = clamp(box.y + box.height * (1 + pad));

    const left = Math.round(x0 * meta.width);
    const top = Math.round(y0 * meta.height);
    const width = Math.round((x1 - x0) * meta.width);
    const height = Math.round((y1 - y0) * meta.height);
    if (width < 20 || height < 20) return null; // degenerate box, not worth cropping

    const cropped = await sharp(buffer)
      .extract({ left, top, width, height })
      .jpeg({ quality: 90 })
      .toBuffer();

    return await uploadBuffer(cropped, "image/jpeg");
  } catch {
    return null;
  }
}

async function requestExtraction(photoUrls: string[]) {
  const response = await anthropic.messages.create({
    model,
    max_tokens: 4000,
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
  if (!toolUse || toolUse.type !== "tool_use") return null;

  const parsed = boxAnalysisSchema.safeParse(toolUse.input);
  return parsed.success ? parsed.data : null;
}

export async function analyzeBoxPhotos(
  photoUrls: string[],
): Promise<BoxAnalysis> {
  // The model occasionally returns a tool call that doesn't match the
  // schema (a missing field, wrong type) even though the same box photo
  // parses fine most of the time — one retry clears up that flake without
  // making the player re-take photos or fill everything in by hand.
  let data = await requestExtraction(photoUrls);
  if (!data) data = await requestExtraction(photoUrls);
  if (!data) throw new Error("Couldn't read a valid response from the vision model — try again");

  const bufferCache = new Map<string, Buffer>();

  const beys: BeyAnalysis[] = await Promise.all(
    data.beys.map(async (raw) => {
      const { blade, ratchet, bit } = classifyBlocks(raw.blocks);

      let bladeName = raw.bladeName;
      let ratchetName = raw.ratchetName;
      let bitName = raw.bitName;
      // Trust the model's own direct per-part name reads first — it can see
      // labeled breakdowns on the box (e.g. a blade name with its own letter
      // suffix, like "Hellsbrave J", distinct from a ratchet code) that a
      // blind regex split of the combined name field can't distinguish. Only
      // fall back to splitting the combined name when a direct field is missing.
      if (!raw.bladeIsIntegrated && !(bladeName && ratchetName && bitName)) {
        const derived = deriveFromBeyName(raw.name);
        if (derived) {
          bladeName = bladeName ?? derived.bladeName;
          ratchetName = ratchetName ?? derived.ratchetName;
          bitName = bitName ?? derived.bitName;
        }
      }

      const [bladePhotoUrl, ratchetPhotoUrl, bitPhotoUrl] = await Promise.all([
        blade?.imageBox ? cropPartImage(photoUrls, blade.imageBox, bufferCache) : null,
        ratchet?.imageBox ? cropPartImage(photoUrls, ratchet.imageBox, bufferCache) : null,
        bit?.imageBox ? cropPartImage(photoUrls, bit.imageBox, bufferCache) : null,
      ]);

      return {
        name: raw.name,
        bladeName,
        ratchetName: raw.bladeIsIntegrated ? null : ratchetName,
        bitName,
        bladeIsIntegrated: raw.bladeIsIntegrated,
        bladeAttack: blade?.attack ?? null,
        bladeDefense: blade?.defense ?? null,
        bladeStamina: blade?.stamina ?? null,
        bladeAttackLow: blade?.attackLow ?? null,
        bladeDefenseLow: blade?.defenseLow ?? null,
        bladeStaminaLow: blade?.staminaLow ?? null,
        ratchetAttack: ratchet?.attack ?? null,
        ratchetDefense: ratchet?.defense ?? null,
        ratchetStamina: ratchet?.stamina ?? null,
        ratchetHeight: ratchet?.height ?? null,
        bitAttack: bit?.attack ?? null,
        bitDefense: bit?.defense ?? null,
        bitStamina: bit?.stamina ?? null,
        bitDash: bit?.dash ?? null,
        bitBurstResistance: bit?.burstResistance ?? null,
        bladePhotoUrl,
        ratchetPhotoUrl: raw.bladeIsIntegrated ? null : ratchetPhotoUrl,
        bitPhotoUrl,
      };
    }),
  );

  return { boxCode: data.boxCode, boxName: data.boxName, beys };
}
