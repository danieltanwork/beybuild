"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { builds } from "@/db/schema";
import { stackServerApp } from "@/lib/stack";

export async function createBuild(formData: FormData) {
  const user = await stackServerApp.getUser({ or: "redirect" });

  const bladePartId = formData.get("bladePartId") as string;
  const ratchetPartId = formData.get("ratchetPartId") as string;
  const bitPartId = formData.get("bitPartId") as string;
  const name = ((formData.get("name") as string) || "").trim();

  if (!bladePartId || !ratchetPartId || !bitPartId) {
    throw new Error("Pick a blade, ratchet, and bit first");
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
