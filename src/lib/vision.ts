import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const model = process.env.VISION_MODEL || "claude-haiku-4-5-20251001";

const boxAnalysisSchema = z.object({
  boxCode: z.string().nullable(),
  boxName: z.string().nullable(),
  bladeName: z.string().nullable(),
  ratchetName: z.string().nullable(),
  bitName: z.string().nullable(),
});

export type BoxAnalysis = z.infer<typeof boxAnalysisSchema>;

const PROMPT = `You are looking at photos of a Beyblade X toy box (front and/or back). Beyblade X sets are identified by a short product code like "BX-23", "UX-08", or "CX-05", and a set name that encodes three parts, e.g. "Phoenix Wing 9-60GF" = Blade "Phoenix Wing" + Ratchet "9-60" + Bit "GF".

Read the box and record what you can actually see. Only fill in a field if you can read it in the photo(s) — never guess or invent a plausible-sounding value; leave it null instead.`;

const EXTRACT_TOOL: Anthropic.Tool = {
  name: "extract_box_info",
  description: "Record the product code, set name, and individual part names read from the box photos.",
  input_schema: {
    type: "object",
    properties: {
      boxCode: {
        type: ["string", "null"],
        description: 'The product code, e.g. "BX-23". Null if not visible.',
      },
      boxName: {
        type: ["string", "null"],
        description: 'The full set name as printed, e.g. "Phoenix Wing 9-60GF". Null if not visible.',
      },
      bladeName: {
        type: ["string", "null"],
        description: 'Just the blade\'s name, e.g. "Phoenix Wing". Null if unreadable.',
      },
      ratchetName: {
        type: ["string", "null"],
        description: 'Just the ratchet\'s code, e.g. "9-60". Null if unreadable.',
      },
      bitName: {
        type: ["string", "null"],
        description: 'Just the bit\'s code, e.g. "GF". Null if unreadable.',
      },
    },
    required: ["boxCode", "boxName", "bladeName", "ratchetName", "bitName"],
  },
};

export async function analyzeBoxPhotos(
  photoUrls: string[],
): Promise<BoxAnalysis> {
  const response = await anthropic.messages.create({
    model,
    max_tokens: 500,
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

  return parsed.data;
}
