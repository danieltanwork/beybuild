import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "./index";
import { builds, inventory, metaCombos, parts } from "./schema";

type PartTypeFilter = "blade" | "ratchet" | "bit" | "blade_ratchet";

const bladeParts = alias(parts, "blade_parts");
const ratchetParts = alias(parts, "ratchet_parts");
const bitParts = alias(parts, "bit_parts");

export type PartRow = typeof parts.$inferSelect;
export type InventoryRow = typeof inventory.$inferSelect;
export type BuildRow = typeof builds.$inferSelect;
export type MetaComboRow = typeof metaCombos.$inferSelect;

export async function getInventoryCount(userId: string) {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(inventory)
    .where(eq(inventory.userId, userId));
  return Number(rows[0]?.count ?? 0);
}

export async function getBuildsCount(userId: string) {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(builds)
    .where(eq(builds.userId, userId));
  return Number(rows[0]?.count ?? 0);
}

export async function getBoxCount(userId: string) {
  const rows = await db
    .select({ count: sql<number>`count(distinct ${inventory.boxId})` })
    .from(inventory)
    .where(eq(inventory.userId, userId));
  return Number(rows[0]?.count ?? 0);
}

export async function getUniquePartCount(userId: string) {
  const rows = await db
    .select({ count: sql<number>`count(distinct ${inventory.partId})` })
    .from(inventory)
    .where(eq(inventory.userId, userId));
  return Number(rows[0]?.count ?? 0);
}

export async function getInventoryWithParts(userId: string) {
  return db
    .select({ inventory, part: parts })
    .from(inventory)
    .innerJoin(parts, eq(inventory.partId, parts.id))
    .where(eq(inventory.userId, userId))
    .orderBy(inventory.createdAt);
}

export async function getOwnedPartsByType(
  userId: string,
  type: PartTypeFilter | PartTypeFilter[],
) {
  const types = Array.isArray(type) ? type : [type];
  return db
    .select({ part: parts, quantity: inventory.quantity })
    .from(inventory)
    .innerJoin(parts, eq(inventory.partId, parts.id))
    .where(and(eq(inventory.userId, userId), inArray(parts.type, types)))
    .orderBy(parts.name);
}

export async function getAllPartsByType(type: PartTypeFilter | PartTypeFilter[]) {
  const types = Array.isArray(type) ? type : [type];
  return db.select().from(parts).where(inArray(parts.type, types)).orderBy(parts.name);
}

export async function getPartById(id: string) {
  const rows = await db.select().from(parts).where(eq(parts.id, id)).limit(1);
  return rows[0];
}

export async function getBoxById(userId: string, boxId: string) {
  const rows = await db
    .select({ inventory, part: parts })
    .from(inventory)
    .innerJoin(parts, eq(inventory.partId, parts.id))
    .where(and(eq(inventory.boxId, boxId), eq(inventory.userId, userId)));
  return rows;
}

export async function getLatestBuild(userId: string) {
  const rows = await db
    .select({
      build: builds,
      blade: bladeParts,
      ratchet: ratchetParts,
      bit: bitParts,
    })
    .from(builds)
    .innerJoin(bladeParts, eq(builds.bladePartId, bladeParts.id))
    .leftJoin(ratchetParts, eq(builds.ratchetPartId, ratchetParts.id))
    .innerJoin(bitParts, eq(builds.bitPartId, bitParts.id))
    .where(eq(builds.userId, userId))
    .orderBy(desc(builds.createdAt))
    .limit(1);
  return rows[0];
}

export async function getBuildsWithParts(userId: string) {
  return db
    .select({
      build: builds,
      blade: bladeParts,
      ratchet: ratchetParts,
      bit: bitParts,
    })
    .from(builds)
    .innerJoin(bladeParts, eq(builds.bladePartId, bladeParts.id))
    .leftJoin(ratchetParts, eq(builds.ratchetPartId, ratchetParts.id))
    .innerJoin(bitParts, eq(builds.bitPartId, bitParts.id))
    .where(eq(builds.userId, userId))
    .orderBy(builds.createdAt);
}

export async function getMetaCombosByScore() {
  return db
    .select()
    .from(metaCombos)
    .orderBy(sql`${metaCombos.placementScore} desc nulls last`);
}

// Each refresh recomputes the whole recent window, so the source's rows are
// swapped wholesale (one atomic batch) rather than upserted — combos that
// dropped out of the window must disappear too.
export async function replaceMetaCombos(
  source: string,
  combos: {
    bladeName: string;
    ratchetName: string | null;
    bitName: string;
    comboName: string;
    placementScore: number;
    topFinishes: number;
    lastSeen: string;
  }[],
) {
  const rows = combos.map((c) => ({ ...c, source }));
  const CHUNK = 500;
  const inserts = [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    inserts.push(db.insert(metaCombos).values(rows.slice(i, i + CHUNK)));
  }
  await db.batch([db.delete(metaCombos).where(eq(metaCombos.source, source)), ...inserts]);
}
