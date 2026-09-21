import Link from "next/link";
import { redirect } from "next/navigation";
import { stackServerApp } from "@/lib/stack";
import { getAllPartsByType, getBoxById } from "@/db/queries";
import { AddBoxForm } from "@/components/add-box-form";

const STAT_KEYS_BY_TYPE: Record<string, string[]> = {
  blade: ["attack", "defense", "stamina"],
  ratchet: ["attack", "defense", "stamina", "height"],
  bit: ["attack", "defense", "stamina", "dash", "burstResistance"],
};

function statsFor(part: { attack: number | null; defense: number | null; stamina: number | null; height: number | null; dash: number | null; burstResistance: number | null }, type: string) {
  const keys = STAT_KEYS_BY_TYPE[type] ?? [];
  const stats: Record<string, string> = {};
  for (const key of keys) {
    const value = (part as Record<string, unknown>)[key];
    stats[key] = typeof value === "number" ? String(value) : "";
  }
  return stats;
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
    getAllPartsByType("blade"),
    getAllPartsByType("ratchet"),
    getAllPartsByType("bit"),
  ]);

  if (rows.length === 0) redirect("/inventory");

  const bladeRows = rows.filter((r) => r.part.type === "blade");
  const ratchetRows = rows.filter((r) => r.part.type === "ratchet");
  const bitRows = rows.filter((r) => r.part.type === "bit");

  // A box normally has one blade/ratchet/bit per beyblade it contains (1 for
  // a Starter, 3 for a Deck Set) — pair them up positionally. If the counts
  // don't match (parts removed individually), a group just gets a blank slot
  // for whichever part is missing rather than losing the others.
  const beyCount = Math.max(bladeRows.length, ratchetRows.length, bitRows.length, 1);
  const blank = { name: "", photoUrl: null as string | null, stats: {} as Record<string, string> };
  const beys = Array.from({ length: beyCount }, (_, i) => ({
    blade: bladeRows[i]
      ? {
          name: bladeRows[i].part.name,
          photoUrl: bladeRows[i].inventory.partPhotoUrl,
          stats: statsFor(bladeRows[i].part, "blade"),
        }
      : blank,
    ratchet: ratchetRows[i]
      ? {
          name: ratchetRows[i].part.name,
          photoUrl: ratchetRows[i].inventory.partPhotoUrl,
          stats: statsFor(ratchetRows[i].part, "ratchet"),
        }
      : blank,
    bit: bitRows[i]
      ? {
          name: bitRows[i].part.name,
          photoUrl: bitRows[i].inventory.partPhotoUrl,
          stats: statsFor(bitRows[i].part, "bit"),
        }
      : blank,
  }));

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
