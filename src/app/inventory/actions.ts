"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { inventory, parts } from "@/db/schema";
import { stackServerApp } from "@/lib/stack";

type PartType = "blade" | "ratchet" | "bit" | "blade_ratchet";
type PartStats = Partial<{
  attack: number;
  defense: number;
  stamina: number;
  height: number;
  dash: number;
  burstResistance: number;
  attackLow: number;
  defenseLow: number;
  staminaLow: number;
}>;

type BeyFormEntry = {
  bladeName: string;
  ratchetName: string;
  bitName: string;
  // True when blade+ratchet are one fused physical part (no separate
  // ratchet) — e.g. a "ratchet-integrated blade" like Hellsnether.
  bladeIsIntegrated: boolean;
  bladePhotoUrl: string | null;
  ratchetPhotoUrl: string | null;
  bitPhotoUrl: string | null;
  bladeStats: Record<string, string>;
  ratchetStats: Record<string, string>;
  bitStats: Record<string, string>;
};

function toStats(raw: Record<string, string> | undefined): PartStats {
  const stats: PartStats = {};
  if (!raw) return stats;
  for (const key of [
    "attack", "defense", "stamina", "height", "dash", "burstResistance",
    "attackLow", "defenseLow", "staminaLow",
  ] as const) {
    const value = raw[key];
    if (typeof value === "string" && value.trim() !== "") {
      const n = Number(value);
      // The parts table stores these as whole numbers — some parts print a
      // decimal stat (e.g. a ratchet's Defense as 8.5), so round rather than
      // let a fractional value hit the integer column.
      if (Number.isFinite(n)) stats[key] = Math.round(n);
    }
  }
  return stats;
}

async function findOrCreatePart(
  type: PartType,
  name: string,
  photoUrl: string | null,
  stats: PartStats,
) {
  const trimmed = name.trim();
  const existing = await db
    .select()
    .from(parts)
    .where(and(eq(parts.type, type), eq(parts.name, trimmed)))
    .limit(1);

  if (existing[0]) {
    const updates: Record<string, unknown> = { ...stats };
    if (photoUrl && !existing[0].imageUrl) updates.imageUrl = photoUrl;
    if (Object.keys(updates).length > 0) {
      await db.update(parts).set(updates).where(eq(parts.id, existing[0].id));
    }
    return existing[0].id;
  }

  const inserted = await db
    .insert(parts)
    .values({ type, name: trimmed, imageUrl: photoUrl, ...stats })
    .returning({ id: parts.id });
  return inserted[0].id;
}

async function resolveBoxForm(formData: FormData) {
  const boxCode = (formData.get("boxCode") as string)?.trim() || null;
  const boxName = (formData.get("boxName") as string)?.trim() || null;
  const boxPhotoFrontUrl = (formData.get("boxPhotoFrontUrl") as string) || null;
  const boxPhotoBackUrl = (formData.get("boxPhotoBackUrl") as string) || null;

  let beysRaw: BeyFormEntry[];
  try {
    beysRaw = JSON.parse((formData.get("beysJson") as string) || "[]");
  } catch {
    throw new Error("Malformed bey data");
  }

  if (!Array.isArray(beysRaw) || beysRaw.length === 0) {
    throw new Error("Add at least one beyblade (blade, ratchet, and bit)");
  }
  for (const b of beysRaw) {
    if (!b.bladeName?.trim() || !b.bitName?.trim()) {
      throw new Error("Every beyblade needs at least a blade and bit name");
    }
    if (!b.bladeIsIntegrated && !b.ratchetName?.trim()) {
      throw new Error("Every beyblade needs a blade, ratchet, and bit name");
    }
  }

  const beys = await Promise.all(
    beysRaw.map(async (b) => {
      const [bladeId, ratchetId, bitId] = await Promise.all([
        findOrCreatePart(
          b.bladeIsIntegrated ? "blade_ratchet" : "blade",
          b.bladeName,
          b.bladePhotoUrl,
          toStats(b.bladeStats),
        ),
        b.bladeIsIntegrated
          ? Promise.resolve(null)
          : findOrCreatePart("ratchet", b.ratchetName, b.ratchetPhotoUrl, toStats(b.ratchetStats)),
        findOrCreatePart("bit", b.bitName, b.bitPhotoUrl, toStats(b.bitStats)),
      ]);
      return {
        blade: { partId: bladeId, photoUrl: b.bladePhotoUrl },
        ratchet: ratchetId ? { partId: ratchetId, photoUrl: b.ratchetPhotoUrl } : null,
        bit: { partId: bitId, photoUrl: b.bitPhotoUrl },
      };
    }),
  );

  return { boxCode, boxName, boxPhotoFrontUrl, boxPhotoBackUrl, beys };
}

function toInventoryRows(
  userId: string,
  boxId: string,
  resolved: Awaited<ReturnType<typeof resolveBoxForm>>,
) {
  return resolved.beys.flatMap((bey, beyIndex) =>
    ([bey.blade, bey.ratchet, bey.bit] as const)
      .filter((entry): entry is { partId: string; photoUrl: string | null } => entry !== null)
      .map((entry) => ({
        userId,
        partId: entry.partId,
        boxId,
        beyIndex,
        boxCode: resolved.boxCode,
        boxName: resolved.boxName,
        boxPhotoFrontUrl: resolved.boxPhotoFrontUrl,
        boxPhotoBackUrl: resolved.boxPhotoBackUrl,
        partPhotoUrl: entry.photoUrl,
      })),
  );
}

export async function addBoxToInventory(formData: FormData) {
  const user = await stackServerApp.getUser({ or: "redirect" });
  const resolved = await resolveBoxForm(formData);
  const boxId = randomUUID();

  await db.insert(inventory).values(toInventoryRows(user.id, boxId, resolved));

  revalidatePath("/inventory");
  redirect("/inventory");
}

export async function updateBoxInventory(boxId: string, formData: FormData) {
  const user = await stackServerApp.getUser({ or: "redirect" });
  const resolved = await resolveBoxForm(formData);

  const existing = await db
    .select({ id: inventory.id })
    .from(inventory)
    .where(and(eq(inventory.boxId, boxId), eq(inventory.userId, user.id)));

  if (existing.length === 0) {
    throw new Error("Box not found");
  }

  // Replace all of this box's rows rather than trying to match old rows to
  // the new bey list — the bey count itself can change on edit (e.g. someone
  // fixes a box that was logged as a single bey but is actually a deck set).
  await db
    .delete(inventory)
    .where(and(eq(inventory.boxId, boxId), eq(inventory.userId, user.id)));

  await db.insert(inventory).values(toInventoryRows(user.id, boxId, resolved));

  revalidatePath("/inventory");
  redirect("/inventory");
}

export async function deleteBox(boxId: string) {
  const user = await stackServerApp.getUser({ or: "redirect" });

  await db
    .delete(inventory)
    .where(and(eq(inventory.boxId, boxId), eq(inventory.userId, user.id)));

  revalidatePath("/inventory");
  redirect("/inventory");
}

export async function deleteInventoryItem(formData: FormData) {
  const user = await stackServerApp.getUser({ or: "redirect" });
  const id = formData.get("id") as string;

  await db
    .delete(inventory)
    .where(and(eq(inventory.id, id), eq(inventory.userId, user.id)));

  revalidatePath("/inventory");
}

// Writes reviewed reference-sheet crops into the shared parts catalog, so
// they show up for every inventory item using that part (past and future),
// not just the ones already logged. Only ever called for a specific part
// that already exists in the catalog (see the review step in the part
// library page) — this never creates a new part.
export async function savePartSheetPhotos(
  partType: "blade" | "ratchet" | "bit",
  items: { code: string; croppedPhotoUrl: string }[],
) {
  await stackServerApp.getUser({ or: "redirect" });

  await Promise.all(
    items.map(({ code, croppedPhotoUrl }) =>
      db
        .update(parts)
        .set({ imageUrl: croppedPhotoUrl })
        .where(and(eq(parts.type, partType), eq(parts.name, code))),
    ),
  );

  revalidatePath("/inventory");
}
