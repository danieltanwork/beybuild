import Link from "next/link";
import { stackServerApp } from "@/lib/stack";
import { getInventoryWithParts } from "@/db/queries";
import { deleteInventoryItem } from "./actions";

const typeLabel: Record<string, string> = {
  blade: "Blade",
  ratchet: "Ratchet",
  bit: "Bit",
};

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
            <div className="grid grid-cols-3 gap-2">
              {box.items.map(({ inventory: item, part }) => (
                <div key={item.id} className="flex flex-col items-center gap-1">
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
                      {typeLabel[part.type]}
                    </span>
                    {part.name}
                  </p>
                  <form action={deleteInventoryItem}>
                    <input type="hidden" name="id" value={item.id} />
                    <button
                      type="submit"
                      className="text-[11px] text-neon-red hover:underline"
                    >
                      Remove
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
