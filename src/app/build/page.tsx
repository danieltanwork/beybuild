import { stackServerApp } from "@/lib/stack";
import { getOwnedPartsByType, getBuildsWithParts } from "@/db/queries";
import { BuildPicker } from "@/components/build-picker";
import { deleteBuild } from "./actions";

export default async function BuildPage() {
  const user = await stackServerApp.getUser({ or: "redirect" });

  const [bladeRows, ratchetRows, bitRows, savedBuilds] = await Promise.all([
    getOwnedPartsByType(user.id, "blade"),
    getOwnedPartsByType(user.id, "ratchet"),
    getOwnedPartsByType(user.id, "bit"),
    getBuildsWithParts(user.id),
  ]);

  const blades = bladeRows.map((r) => r.part);
  const ratchets = ratchetRows.map((r) => r.part);
  const bits = bitRows.map((r) => r.part);

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 pt-8">
      <h1 className="text-2xl font-bold text-zinc-950 dark:text-zinc-50">Build</h1>

      {blades.length === 0 || ratchets.length === 0 || bits.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Add at least one blade, ratchet, and bit to your inventory to start
          building combos.
        </p>
      ) : (
        <BuildPicker blades={blades} ratchets={ratchets} bits={bits} />
      )}

      {savedBuilds.length > 0 && (
        <div className="flex flex-col gap-2 pb-10">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Saved builds
          </h2>
          {savedBuilds.map(({ build, blade, ratchet, bit }) => (
            <div
              key={build.id}
              className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800"
            >
              <div>
                <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                  {build.name}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {blade.name} + {ratchet.name} + {bit.name}
                </p>
              </div>
              <form action={deleteBuild}>
                <input type="hidden" name="id" value={build.id} />
                <button type="submit" className="text-xs text-red-500 hover:underline">
                  Delete
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
