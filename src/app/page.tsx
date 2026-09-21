import Link from "next/link";
import { stackServerApp } from "@/lib/stack";
import {
  getBoxCount,
  getBuildsCount,
  getInventoryCount,
  getLatestBuild,
  getUniquePartCount,
} from "@/db/queries";

export default async function Home() {
  const user = await stackServerApp.getUser({ or: "redirect" });
  const [boxCount, inventoryCount, uniquePartCount, buildsCount, latestBuild] =
    await Promise.all([
      getBoxCount(user.id),
      getInventoryCount(user.id),
      getUniquePartCount(user.id),
      getBuildsCount(user.id),
      getLatestBuild(user.id),
    ]);

  return (
    <main className="flex flex-1 flex-col gap-5 pt-8">
      <div className="mx-5 overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-800 via-zinc-900 to-black">
        <div className="flex items-center justify-between px-5 pt-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-400">
              Welcome back
            </p>
            <h1 className="text-xl font-bold text-white">
              {user.displayName ?? "Blader"}
            </h1>
          </div>
          {latestBuild && (
            <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white/80">
              Latest build
            </span>
          )}
        </div>

        <div className="flex flex-col items-center gap-3 px-5 py-6">
          {latestBuild ? (
            <>
              <div className="flex items-center gap-2">
                <HeroSlot part={latestBuild.blade} />
                <span className="text-white/30">+</span>
                <HeroSlot part={latestBuild.ratchet} />
                <span className="text-white/30">+</span>
                <HeroSlot part={latestBuild.bit} />
              </div>
              <p className="text-sm font-semibold text-white">
                {latestBuild.build.name}
              </p>
            </>
          ) : (
            <>
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 text-3xl">
                🌀
              </div>
              <p className="text-center text-sm text-white/70">
                No builds yet — assemble your first combo
              </p>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-5">
        <StatCard href="/inventory" value={boxCount} label="Boxes logged" />
        <StatCard href="/inventory" value={inventoryCount} label="Parts owned" />
        <StatCard href="/inventory" value={uniquePartCount} label="Unique parts" />
        <StatCard href="/build" value={buildsCount} label="Saved builds" />
      </div>

      <div className="flex flex-col gap-3 px-5 pb-4">
        <Link
          href="/inventory/add"
          className="rounded-2xl bg-emerald-500 px-5 py-4 text-center text-base font-semibold text-white"
        >
          + Add a box to your inventory
        </Link>
        <Link
          href="/build"
          className="rounded-2xl border border-zinc-200 px-5 py-4 text-center text-base font-semibold text-zinc-950 dark:border-zinc-800 dark:text-zinc-50"
        >
          Create a build
        </Link>
      </div>
    </main>
  );
}

function HeroSlot({ part }: { part: { name: string; imageUrl: string | null } }) {
  return (
    <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-white/10 text-[9px] text-white/50">
      {part.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={part.imageUrl} alt={part.name} className="h-full w-full object-cover" />
      ) : (
        part.name
      )}
    </div>
  );
}

function StatCard({
  href,
  value,
  label,
}: {
  href: string;
  value: number;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <p className="text-3xl font-bold text-emerald-500">{value}</p>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
    </Link>
  );
}
