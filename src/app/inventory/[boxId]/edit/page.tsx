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

  const bladeRow = rows.find((r) => r.part.type === "blade");
  const ratchetRow = rows.find((r) => r.part.type === "ratchet");
  const bitRow = rows.find((r) => r.part.type === "bit");

  if (!bladeRow || !ratchetRow || !bitRow) redirect("/inventory");

  const first = rows[0].inventory;

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 pt-8">
      <div className="flex items-center gap-2">
        <Link href="/inventory" className="text-sm text-zinc-500">
          ← Inventory
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-zinc-950 dark:text-zinc-50">
        Edit box
      </h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
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
          blade: {
            name: bladeRow.part.name,
            photoUrl: bladeRow.inventory.partPhotoUrl,
            stats: statsFor(bladeRow.part, "blade"),
          },
          ratchet: {
            name: ratchetRow.part.name,
            photoUrl: ratchetRow.inventory.partPhotoUrl,
            stats: statsFor(ratchetRow.part, "ratchet"),
          },
          bit: {
            name: bitRow.part.name,
            photoUrl: bitRow.inventory.partPhotoUrl,
            stats: statsFor(bitRow.part, "bit"),
          },
        }}
      />
    </main>
  );
}
