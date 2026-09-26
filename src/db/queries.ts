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

// One row per blade, picking whichever of that blade's scraped combos ranks
// best (highest win rate, falling back to pick rate when win rate is
// missing). Used to surface a "meta pick" ratchet+bit suggestion on the
// Build page once the player has selected a blade.
export async function getTopMetaComboPerBlade() {
  return db
    .selectDistinctOn([metaCombos.bladeName])
    .from(metaCombos)
    .orderBy(
      metaCombos.bladeName,
      sql`${metaCombos.winRate} desc nulls last`,
      sql`${metaCombos.pickRate} desc nulls last`,
    );
}

// Upserts scraped combos keyed on (source, comboName) — a re-scrape updates
// that combo's stats in place rather than accumulating duplicate rows.
// Combos with no comboName (couldn't be read as one piece) are just
// inserted fresh each time, since there's no stable key to upsert on.
export async function upsertMetaCombos(
  source: string,
  combos: {
    bladeName: string;
    ratchetName: string | null;
    bitName: string | null;
    comboName: string | null;
    winRate: number | null;
    pickRate: number | null;
    tier: string | null;
  }[],
) {
  if (combos.length === 0) return;

  const rows = combos.map((c) => ({
    bladeName: c.bladeName,
    ratchetName: c.ratchetName,
    bitName: c.bitName,
    comboName: c.comboName,
    winRate: c.winRate?.toString() ?? null,
    pickRate: c.pickRate?.toString() ?? null,
    tier: c.tier,
    source,
  }));

  const withComboName = rows.filter((r) => r.comboName != null);
  const withoutComboName = rows.filter((r) => r.comboName == null);

  if (withComboName.length > 0) {
    await db
      .insert(metaCombos)
      .values(withComboName)
      .onConflictDoUpdate({
        target: [metaCombos.source, metaCombos.comboName],
        set: {
          bladeName: sql`excluded.blade_name`,
          ratchetName: sql`excluded.ratchet_name`,
          bitName: sql`excluded.bit_name`,
          winRate: sql`excluded.win_rate`,
          pickRate: sql`excluded.pick_rate`,
          tier: sql`excluded.tier`,
          scrapedAt: sql`now()`,
        },
      });
  }
  if (withoutComboName.length > 0) {
    await db.insert(metaCombos).values(withoutComboName);
  }
}
