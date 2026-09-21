"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { inventory, parts } from "@/db/schema";
import { stackServerApp } from "@/lib/stack";

type PartType = "blade" | "ratchet" | "bit";
type PartStats = Partial<{
  attack: number;
  defense: number;
  stamina: number;
  height: number;
  dash: number;
  burstResistance: number;
}>;

type BeyFormEntry = {
  bladeName: string;
  ratchetName: string;
  bitName: string;
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
  for (const key of ["attack", "defense", "stamina", "height", "dash", "burstResistance"] as const) {
    const value = raw[key];
    if (typeof value === "string" && value.trim() !== "") {
      const n = Number(value);
      if (Number.isFinite(n)) stats[key] = n;
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
    if (!b.bladeName?.trim() || !b.ratchetName?.trim() || !b.bitName?.trim()) {
      throw new Error("Every beyblade needs a blade, ratchet, and bit name");
    }
  }

  const beys = await Promise.all(
    beysRaw.map(async (b) => {
      const [bladeId, ratchetId, bitId] = await Promise.all([
        findOrCreatePart("blade", b.bladeName, b.bladePhotoUrl, toStats(b.bladeStats)),
        findOrCreatePart("ratchet", b.ratchetName, b.ratchetPhotoUrl, toStats(b.ratchetStats)),
        findOrCreatePart("bit", b.bitName, b.bitPhotoUrl, toStats(b.bitStats)),
      ]);
      return {
        blade: { partId: bladeId, photoUrl: b.bladePhotoUrl },
        ratchet: { partId: ratchetId, photoUrl: b.ratchetPhotoUrl },
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
  return resolved.beys.flatMap((bey) =>
    (["blade", "ratchet", "bit"] as const).map((type) => ({
      userId,
      partId: bey[type].partId,
      boxId,
      boxCode: resolved.boxCode,
      boxName: resolved.boxName,
      boxPhotoFrontUrl: resolved.boxPhotoFrontUrl,
      boxPhotoBackUrl: resolved.boxPhotoBackUrl,
      partPhotoUrl: bey[type].photoUrl,
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
