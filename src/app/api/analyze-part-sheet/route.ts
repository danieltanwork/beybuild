import { NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { parts } from "@/db/schema";
import { stackServerApp } from "@/lib/stack";
import { extractPartSheetIcons, deriveBitAbbreviation } from "@/lib/vision";

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

    // A bit reference sheet prints each bit's full descriptive name (e.g.
    // "Gear Flat"), but the catalog stores bits by the short abbreviation
    // that actually appears on a box (e.g. "GF") — so bits need converting
    // before they can be matched against parts.name. Blades and ratchets
    // are already stored by exactly what's printed, so their code passes
    // through unchanged.
    const catalogCodes = icons.map((icon) =>
      partType === "bit" ? deriveBitAbbreviation(icon.code) : icon.code,
    );

    const existing = catalogCodes.length
      ? await db
          .select({ name: parts.name, imageUrl: parts.imageUrl })
          .from(parts)
          .where(and(eq(parts.type, partType), inArray(parts.name, catalogCodes)))
      : [];
    // Map of code -> whether that part already has a photo, so a re-run of
    // this import (e.g. the same sheet uploaded again later) defaults to
    // skipping parts it already filled in, rather than silently overwriting
    // them — this is meant as a one-time catalog backfill, not an ongoing sync.
    const knownCodes = new Map(existing.map((p) => [p.name, !!p.imageUrl]));

    const items = icons.map((icon, i) => ({
      label: icon.code,
      code: catalogCodes[i],
      croppedPhotoUrl: icon.croppedPhotoUrl,
      matched: knownCodes.has(catalogCodes[i]),
      hasPhoto: knownCodes.get(catalogCodes[i]) ?? false,
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
