import { stackServerApp } from "@/lib/stack";
import { getOwnedPartsByType, getBuildsWithParts, getMetaCombosByScore } from "@/db/queries";
import { metaCombosForBlade } from "@/lib/meta";
import { BuildPicker, type MetaCombo } from "@/components/build-picker";
import { deleteBuild } from "./actions";

export default async function BuildPage() {
  const user = await stackServerApp.getUser({ or: "redirect" });

  const [bladeRows, ratchetRows, bitRows, savedBuilds, metaCombos] = await Promise.all([
    getOwnedPartsByType(user.id, ["blade", "blade_ratchet"]),
    getOwnedPartsByType(user.id, "ratchet"),
    getOwnedPartsByType(user.id, "bit"),
    getBuildsWithParts(user.id),
    getMetaCombosByScore(),
  ]);

  const blades = bladeRows.map((r) => r.part);
  const ratchets = ratchetRows.map((r) => r.part);
  const bits = bitRows.map((r) => r.part);

  const metaByBlade: Record<string, MetaCombo[]> = {};
  for (const blade of blades) {
    metaByBlade[blade.id] = metaCombosForBlade(blade.name, metaCombos, 3).map((c) => ({
      ratchetName: c.ratchetName,
      bitName: c.bitName,
      topFinishes: c.topFinishes ?? 0,
    }));
  }
  const metaAsOf = metaCombos.reduce<string | null>(
    (max, c) => (c.lastSeen && (!max || c.lastSeen > max) ? c.lastSeen : max),
    null,
  );

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 pt-8">
      <h1 className="text-2xl font-bold text-foreground">Build</h1>

      {blades.length === 0 || bits.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add at least one blade and bit to your inventory to start building
          combos.
        </p>
      ) : (
        <BuildPicker
          blades={blades}
          ratchets={ratchets}
          bits={bits}
          metaByBlade={metaByBlade}
          metaAsOf={metaAsOf}
        />
      )}

      {savedBuilds.length > 0 && (
        <div className="flex flex-col gap-2 pb-10">
          <h2 className="text-sm font-semibold text-neon-fuchsia">
            Saved builds
          </h2>
          {savedBuilds.map(({ build, blade, ratchet, bit }) => (
            <div
              key={build.id}
              className="neon-card flex items-center justify-between rounded-xl px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-foreground">
                  {build.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {blade.name}
                  {ratchet ? ` + ${ratchet.name}` : ""} + {bit.name}
                </p>
              </div>
              <form action={deleteBuild}>
                <input type="hidden" name="id" value={build.id} />
                <button type="submit" className="text-xs text-neon-red hover:underline">
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
