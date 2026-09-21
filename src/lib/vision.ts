import "server-only";
import OpenAI from "openai";
import { z } from "zod";

const client = new OpenAI({
  baseURL: `${process.env.NEON_AI_GATEWAY_BASE_URL}/v1`,
  apiKey: process.env.NEON_AI_GATEWAY_TOKEN,
});

const model = process.env.VISION_MODEL || "anthropic/claude-sonnet-4-5";

const boxAnalysisSchema = z.object({
  boxCode: z.string().nullable(),
  boxName: z.string().nullable(),
  bladeName: z.string().nullable(),
  ratchetName: z.string().nullable(),
  bitName: z.string().nullable(),
});

export type BoxAnalysis = z.infer<typeof boxAnalysisSchema>;

const PROMPT = `You are looking at photos of a Beyblade X toy box (front and/or back). Beyblade X sets are identified by a short product code like "BX-23", "UX-08", or "CX-05", and a set name that encodes three parts, e.g. "Phoenix Wing 9-60GF" = Blade "Phoenix Wing" + Ratchet "9-60" + Bit "GF".

Read the box and extract:
- boxCode: the product code (e.g. "BX-23"), or null if not visible
- boxName: the full set name as printed (e.g. "Phoenix Wing 9-60GF"), or null if not visible
- bladeName: just the blade's name (e.g. "Phoenix Wing"), or null if you can't determine it
- ratchetName: just the ratchet's code (e.g. "9-60"), or null if you can't determine it
- bitName: just the bit's code (e.g. "GF"), or null if you can't determine it

Only fill in a field if you can actually read it in the photo(s) — never guess or invent a plausible-sounding value. Respond with ONLY a JSON object with exactly these five keys, no other text.`;

export async function analyzeBoxPhotos(
  photoUrls: string[],
): Promise<BoxAnalysis> {
  const response = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          ...photoUrls.map(
            (url) =>
              ({ type: "image_url", image_url: { url } }) as const,
          ),
        ],
      },
    ],
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error("No response from vision model");

  const parsed = boxAnalysisSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) throw new Error("Vision model returned unexpected shape");

  return parsed.data;
}
