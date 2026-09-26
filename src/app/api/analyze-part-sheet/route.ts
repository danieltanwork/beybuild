import { NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { parts } from "@/db/schema";
import { stackServerApp } from "@/lib/stack";
import { extractPartSheetIcons } from "@/lib/vision";

export async function POST(request: Request) {
  const user = await stackServerApp.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sheetUrl, partType } = (await request.json()) as {
    sheetUrl?: string;
    partType?: string;
  };
  if (!sheetUrl) {
    return NextResponse.json({ error: "No sheet photo provided" }, { status: 400 });
  }
  if (partType !== "blade" && partType !== "ratchet" && partType !== "bit") {
    return NextResponse.json({ error: "Invalid part type" }, { status: 400 });
  }

  try {
    const icons = await extractPartSheetIcons(sheetUrl, partType);

    const codes = icons.map((i) => i.code);
    const existing = codes.length
      ? await db
          .select({ name: parts.name })
          .from(parts)
          .where(and(eq(parts.type, partType), inArray(parts.name, codes)))
      : [];
    const knownCodes = new Set(existing.map((p) => p.name));

    const items = icons.map((icon) => ({
      ...icon,
      matched: knownCodes.has(icon.code),
    }));

    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Couldn't read the reference sheet",
      },
      { status: 502 },
    );
  }
}
