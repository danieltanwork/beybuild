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

function readStats(formData: FormData, prefix: string): PartStats {
  const stats: PartStats = {};
  for (const key of ["attack", "defense", "stamina", "height", "dash", "burstResistance"] as const) {
    const raw = formData.get(`${prefix}_${key}`);
    if (raw && typeof raw === "string" && raw.trim() !== "") {
      const n = Number(raw);
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

export async function addBoxToInventory(formData: FormData) {
  const user = await stackServerApp.getUser({ or: "redirect" });

  const boxCode = (formData.get("boxCode") as string)?.trim() || null;
  const boxName = (formData.get("boxName") as string)?.trim() || null;
  const boxPhotoFrontUrl = (formData.get("boxPhotoFrontUrl") as string) || null;
  const boxPhotoBackUrl = (formData.get("boxPhotoBackUrl") as string) || null;

  const bladeName = formData.get("bladeName") as string;
  const ratchetName = formData.get("ratchetName") as string;
  const bitName = formData.get("bitName") as string;

  const bladePhotoUrl = (formData.get("bladePhotoUrl") as string) || null;
  const ratchetPhotoUrl = (formData.get("ratchetPhotoUrl") as string) || null;
  const bitPhotoUrl = (formData.get("bitPhotoUrl") as string) || null;

  if (!bladeName || !ratchetName || !bitName) {
    throw new Error("Blade, ratchet, and bit names are required");
  }

  const [bladeId, ratchetId, bitId] = await Promise.all([
    findOrCreatePart("blade", bladeName, bladePhotoUrl, readStats(formData, "blade")),
    findOrCreatePart("ratchet", ratchetName, ratchetPhotoUrl, readStats(formData, "ratchet")),
    findOrCreatePart("bit", bitName, bitPhotoUrl, readStats(formData, "bit")),
  ]);

  const rows = [
    { partId: bladeId, photoUrl: bladePhotoUrl },
    { partId: ratchetId, photoUrl: ratchetPhotoUrl },
    { partId: bitId, photoUrl: bitPhotoUrl },
  ];

  const boxId = randomUUID();

  await db.insert(inventory).values(
    rows.map((r) => ({
      userId: user.id,
      partId: r.partId,
      boxId,
      boxCode,
      boxName,
      boxPhotoFrontUrl,
      boxPhotoBackUrl,
      partPhotoUrl: r.photoUrl,
    })),
  );

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
