import Link from "next/link";
import { stackServerApp } from "@/lib/stack";
import { getInventoryWithParts, type InventoryRow, type PartRow } from "@/db/queries";
import { deleteInventoryItem } from "./actions";

const typeLabel: Record<string, string> = {
  blade: "Blade",
  ratchet: "Ratchet",
  bit: "Bit",
};

type ItemRow = { inventory: InventoryRow; part: PartRow };

// Group each box's items into per-beyblade groups (one blade + one ratchet +
// one bit), so a normal box renders as one clean 3-column row and a deck-set
// box renders as several. New boxes tag each row with beyIndex so grouping
// is exact even when a bey has no ratchet (a ratchet-integrated blade).
// Older boxes saved before that column existed fall back to pairing
// positionally by type.
function beyGroups(items: ItemRow[]) {
  const oneGroup = (group: ItemRow[]) => ({
    blade: group.find((it) => it.part.type === "blade" || it.part.type === "blade_ratchet"),
    ratchet: group.find((it) => it.part.type === "ratchet"),
    bit: group.find((it) => it.part.type === "bit"),
  });

  if (items.every((it) => it.inventory.beyIndex === null)) {
    const byType = (t: string) => items.filter((it) => it.part.type === t);
    const blades = byType("blade").concat(byType("blade_ratchet"));
    const ratchets = byType("ratchet");
    const bits = byType("bit");
    const count = Math.max(blades.length, ratchets.length, bits.length, 1);
    return Array.from({ length: count }, (_, i) =>
      oneGroup([blades[i], ratchets[i], bits[i]].filter((it): it is ItemRow => !!it)),
    );
  }

  const byIndex = new Map<number, ItemRow[]>();
  for (const item of items) {
    const idx = item.inventory.beyIndex ?? 0;
    if (!byIndex.has(idx)) byIndex.set(idx, []);
    byIndex.get(idx)!.push(item);
  }
  return [...byIndex.entries()].sort(([a], [b]) => a - b).map(([, group]) => oneGroup(group));
}

export default async function InventoryPage() {
  const user = await stackServerApp.getUser({ or: "redirect" });
  const rows = await getInventoryWithParts(user.id);

  const boxes = new Map<
    string,
    {
      boxName: string | null;
      boxCode: string | null;
      boxPhotoFrontUrl: string | null;
      boxPhotoBackUrl: string | null;
      items: typeof rows;
    }
  >();

  for (const row of rows) {
    const key = row.inventory.boxId ?? row.inventory.id;
    if (!boxes.has(key)) {
      boxes.set(key, {
        boxName: row.inventory.boxName,
        boxCode: row.inventory.boxCode,
        boxPhotoFrontUrl: row.inventory.boxPhotoFrontUrl,
        boxPhotoBackUrl: row.inventory.boxPhotoBackUrl,
        items: [],
      });
    }
    boxes.get(key)!.items.push(row);
  }

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 pt-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Inventory</h1>
        <Link
          href="/inventory/add"
          className="glow-cyan rounded-full bg-gradient-to-r from-neon-cyan to-neon-violet px-4 py-2 text-sm font-bold text-background"
        >
          + Add box
        </Link>
      </div>

      {boxes.size === 0 && (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          No boxes yet. Tap &ldquo;Add box&rdquo; to log your first Beyblade X set.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {[...boxes.entries()].map(([boxKey, box]) => (
          <div key={boxKey} className="neon-card rounded-2xl p-4">
            <div className="mb-3 flex items-center gap-3">
              {box.boxPhotoFrontUrl || box.boxPhotoBackUrl ? (
                <div className="flex gap-1">
                  {box.boxPhotoFrontUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={box.boxPhotoFrontUrl}
                      alt={`${box.boxName ?? "Box"} front`}
                      className="h-14 w-14 rounded-lg border border-border object-cover"
                    />
                  )}
                  {box.boxPhotoBackUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={box.boxPhotoBackUrl}
                      alt={`${box.boxName ?? "Box"} back`}
                      className="h-14 w-14 rounded-lg border border-border object-cover"
                    />
                  )}
                </div>
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-background-elevated-2 text-xl">
                  📦
                </div>
              )}
              <div className="flex-1">
                <p className="font-semibold text-foreground">
                  {box.boxName ?? "Unnamed box"}
                </p>
                {box.boxCode && (
                  <p className="text-xs text-neon-cyan">{box.boxCode}</p>
                )}
              </div>
              <Link
                href={`/inventory/${boxKey}/edit`}
                className="rounded-full border border-neon-lime/40 px-3 py-1.5 text-xs font-medium text-neon-lime"
              >
                Edit
              </Link>
            </div>
            {beyGroups(box.items).map((group, i, all) => (
              <div key={i} className="mb-3 last:mb-0">
                {all.length > 1 && (
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-neon-cyan">
                    Beyblade {i + 1}
                  </p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <ItemCell entry={group.blade} label={typeLabel.blade} />
                  {group.blade?.part.type === "blade_ratchet" ? (
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex aspect-square w-full flex-col items-center justify-center rounded-lg border border-dashed border-neon-cyan/40 px-1 text-center text-[9px] text-neon-cyan">
                        Built into blade
                      </div>
                      <p className="text-center text-[10px] uppercase tracking-wide text-muted-foreground">
                        Ratchet
                      </p>
                    </div>
                  ) : (
                    <ItemCell entry={group.ratchet} label={typeLabel.ratchet} />
                  )}
                  <ItemCell entry={group.bit} label={typeLabel.bit} />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}

function ItemCell({ entry, label }: { entry?: ItemRow; label: string }) {
  if (!entry) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-border text-[10px] text-muted-foreground">
          —
        </div>
        <p className="text-center text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </div>
    );
  }

  const { inventory: item, part } = entry;
  return (
    <div className="flex flex-col items-center gap-1">
      {item.partPhotoUrl || part.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.partPhotoUrl ?? part.imageUrl ?? undefined}
          alt={part.name}
          className="aspect-square w-full rounded-lg border border-border object-cover"
        />
      ) : (
        <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-border bg-background-elevated-2 text-xs text-muted-foreground">
          No photo
        </div>
      )}
      <p className="text-center text-[11px] leading-tight text-muted-foreground">
        <span className="block text-[10px] uppercase tracking-wide text-neon-fuchsia">
          {label}
        </span>
        {part.name}
      </p>
      <form action={deleteInventoryItem}>
        <input type="hidden" name="id" value={item.id} />
        <button type="submit" className="text-[11px] text-neon-red hover:underline">
          Remove
        </button>
      </form>
    </div>
  );
}
