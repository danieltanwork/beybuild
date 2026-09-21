"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { builds } from "@/db/schema";
import { getPartById } from "@/db/queries";
import { stackServerApp } from "@/lib/stack";

export async function createBuild(formData: FormData) {
  const user = await stackServerApp.getUser({ or: "redirect" });

  const bladePartId = formData.get("bladePartId") as string;
  const ratchetPartId = (formData.get("ratchetPartId") as string) || null;
  const bitPartId = formData.get("bitPartId") as string;
  const name = ((formData.get("name") as string) || "").trim();

  if (!bladePartId || !bitPartId) {
    throw new Error("Pick a blade and bit first");
  }

  const blade = await getPartById(bladePartId);
  if (!blade) throw new Error("Blade not found");
  if (blade.type !== "blade_ratchet" && !ratchetPartId) {
    throw new Error("Pick a ratchet, or choose a ratchet-integrated blade");
  }

  await db.insert(builds).values({
    userId: user.id,
    name: name || "Untitled build",
    bladePartId,
    ratchetPartId,
    bitPartId,
  });

  revalidatePath("/build");
}

export async function deleteBuild(formData: FormData) {
  const user = await stackServerApp.getUser({ or: "redirect" });
  const id = formData.get("id") as string;

  await db.delete(builds).where(and(eq(builds.id, id), eq(builds.userId, user.id)));

  revalidatePath("/build");
}
