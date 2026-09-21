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
        <h1 className="text-2xl font-bold text-zinc-950 dark:text-zinc-50">
          Inventory
        </h1>
        <Link
          href="/inventory/add"
          className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white dark:bg-zinc-50 dark:text-zinc-950"
        >
          + Add box
        </Link>
      </div>

      {boxes.size === 0 && (
        <p className="mt-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
          No boxes yet. Tap &ldquo;Add box&rdquo; to log your first Beyblade X set.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {[...boxes.entries()].map(([boxKey, box]) => (
          <div
            key={boxKey}
            className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="mb-3 flex items-center gap-3">
              {box.boxPhotoFrontUrl || box.boxPhotoBackUrl ? (
                <div className="flex gap-1">
                  {box.boxPhotoFrontUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={box.boxPhotoFrontUrl}
                      alt={`${box.boxName ?? "Box"} front`}
                      className="h-14 w-14 rounded-lg object-cover"
                    />
                  )}
                  {box.boxPhotoBackUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={box.boxPhotoBackUrl}
                      alt={`${box.boxName ?? "Box"} back`}
                      className="h-14 w-14 rounded-lg object-cover"
                    />
                  )}
                </div>
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-zinc-100 text-xl dark:bg-zinc-800">
                  📦
                </div>
              )}
              <div>
                <p className="font-semibold text-zinc-950 dark:text-zinc-50">
                  {box.boxName ?? "Unnamed box"}
                </p>
                {box.boxCode && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {box.boxCode}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {box.items.map(({ inventory: item, part }) => (
                <div key={item.id} className="flex flex-col items-center gap-1">
                  {item.partPhotoUrl || part.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.partPhotoUrl ?? part.imageUrl ?? undefined}
                      alt={part.name}
                      className="aspect-square w-full rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-800">
                      No photo
                    </div>
                  )}
                  <p className="text-center text-[11px] leading-tight text-zinc-600 dark:text-zinc-400">
                    <span className="block text-[10px] uppercase tracking-wide text-zinc-400">
                      {typeLabel[part.type]}
                    </span>
                    {part.name}
                  </p>
                  <form action={deleteInventoryItem}>
                    <input type="hidden" name="id" value={item.id} />
                    <button
                      type="submit"
                      className="text-[11px] text-red-500 hover:underline"
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
