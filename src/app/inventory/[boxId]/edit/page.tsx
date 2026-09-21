import Link from "next/link";
import { redirect } from "next/navigation";
import { stackServerApp } from "@/lib/stack";
import { getAllPartsByType, getBoxById, type InventoryRow, type PartRow } from "@/db/queries";
import { AddBoxForm } from "@/components/add-box-form";

const STAT_KEYS_BY_TYPE: Record<string, string[]> = {
  blade: ["attack", "defense", "stamina"],
  blade_ratchet: ["attack", "defense", "stamina", "attackLow", "defenseLow", "staminaLow"],
  ratchet: ["attack", "defense", "stamina", "height"],
  bit: ["attack", "defense", "stamina", "dash", "burstResistance"],
};

function statsFor(part: PartRow, type: string) {
  const keys = STAT_KEYS_BY_TYPE[type] ?? [];
  const stats: Record<string, string> = {};
  for (const key of keys) {
    const value = (part as unknown as Record<string, unknown>)[key];
    stats[key] = typeof value === "number" ? String(value) : "";
  }
  return stats;
}

const blank = { name: "", photoUrl: null as string | null, stats: {} as Record<string, string> };

type ItemRow = { inventory: InventoryRow; part: PartRow };
type BeyGroup = {
  blade: { name: string; photoUrl: string | null; stats: Record<string, string>; isIntegrated: boolean };
  ratchet: { name: string; photoUrl: string | null; stats: Record<string, string> };
  bit: { name: string; photoUrl: string | null; stats: Record<string, string> };
};

function groupToInitialBey(items: ItemRow[]): BeyGroup {
  const blade = items.find((r) => r.part.type === "blade" || r.part.type === "blade_ratchet");
  const ratchet = items.find((r) => r.part.type === "ratchet");
  const bit = items.find((r) => r.part.type === "bit");
  return {
    blade: blade
      ? {
          name: blade.part.name,
          photoUrl: blade.inventory.partPhotoUrl,
          stats: statsFor(blade.part, blade.part.type),
          isIntegrated: blade.part.type === "blade_ratchet",
        }
      : { ...blank, isIntegrated: false },
    ratchet: ratchet
      ? { name: ratchet.part.name, photoUrl: ratchet.inventory.partPhotoUrl, stats: statsFor(ratchet.part, "ratchet") }
      : blank,
    bit: bit
      ? { name: bit.part.name, photoUrl: bit.inventory.partPhotoUrl, stats: statsFor(bit.part, "bit") }
      : blank,
  };
}

export default async function EditBoxPage({
  params,
}: {
  params: Promise<{ boxId: string }>;
}) {
  const { boxId } = await params;
  const user = await stackServerApp.getUser({ or: "redirect" });

  const [rows, bladeOptions, ratchetOptions, bitOptions] = await Promise.all([
    getBoxById(user.id, boxId),
    getAllPartsByType(["blade", "blade_ratchet"]),
    getAllPartsByType("ratchet"),
    getAllPartsByType("bit"),
  ]);

  if (rows.length === 0) redirect("/inventory");

  // New boxes group each beyblade's rows by beyIndex. Older boxes saved
  // before that column existed have it null on every row — fall back to
  // pairing blade/ratchet/bit positionally by type for those.
  const beys: BeyGroup[] = rows.every((r) => r.inventory.beyIndex === null)
    ? (() => {
        const bladeRows = rows.filter((r) => r.part.type === "blade" || r.part.type === "blade_ratchet");
        const ratchetRows = rows.filter((r) => r.part.type === "ratchet");
        const bitRows = rows.filter((r) => r.part.type === "bit");
        const beyCount = Math.max(bladeRows.length, ratchetRows.length, bitRows.length, 1);
        return Array.from({ length: beyCount }, (_, i) =>
          groupToInitialBey(
            [bladeRows[i], ratchetRows[i], bitRows[i]].filter((r): r is ItemRow => !!r),
          ),
        );
      })()
    : (() => {
        const byIndex = new Map<number, ItemRow[]>();
        for (const row of rows) {
          const idx = row.inventory.beyIndex ?? 0;
          if (!byIndex.has(idx)) byIndex.set(idx, []);
          byIndex.get(idx)!.push(row);
        }
        return [...byIndex.entries()]
          .sort(([a], [b]) => a - b)
          .map(([, items]) => groupToInitialBey(items));
      })();

  const first = rows[0].inventory;

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 pt-8">
      <div className="flex items-center gap-2">
        <Link href="/inventory" className="text-sm text-neon-cyan">
          ← Inventory
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-foreground">Edit box</h1>
      <p className="text-sm text-muted-foreground">
        Update details, re-run photo analysis, or replace any photo below.
      </p>
      <AddBoxForm
        boxId={boxId}
        bladeOptions={bladeOptions}
        ratchetOptions={ratchetOptions}
        bitOptions={bitOptions}
        initial={{
          boxCode: first.boxCode ?? "",
          boxName: first.boxName ?? "",
          boxPhotoFrontUrl: first.boxPhotoFrontUrl,
          boxPhotoBackUrl: first.boxPhotoBackUrl,
          beys,
        }}
      />
    </main>
  );
}
