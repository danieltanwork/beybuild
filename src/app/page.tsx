import Link from "next/link";
import { stackServerApp } from "@/lib/stack";
import {
  getBoxCount,
  getBuildsCount,
  getInventoryCount,
  getLatestBuild,
  getUniquePartCount,
} from "@/db/queries";

const STAT_ACCENTS = [
  { text: "text-neon-cyan", glow: "glow-cyan" },
  { text: "text-neon-fuchsia", glow: "glow-fuchsia" },
  { text: "text-neon-lime", glow: "glow-lime" },
  { text: "text-neon-violet", glow: "" },
] as const;

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

  const stats = [
    { href: "/inventory", value: boxCount, label: "Boxes logged" },
    { href: "/inventory", value: inventoryCount, label: "Parts owned" },
    { href: "/inventory", value: uniquePartCount, label: "Unique parts" },
    { href: "/build", value: buildsCount, label: "Saved builds" },
  ];

  return (
    <main className="flex flex-1 flex-col gap-5 pt-8">
      <div className="glow-fuchsia mx-5 overflow-hidden rounded-3xl border border-neon-fuchsia/30 bg-gradient-to-br from-background-elevated-2 via-background-elevated to-background">
        <div className="flex items-center justify-between px-5 pt-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-neon-cyan">
              Welcome back
            </p>
            <h1 className="text-xl font-bold text-foreground">
              {user.displayName ?? "Blader"}
            </h1>
          </div>
          {latestBuild && (
            <span className="rounded-full border border-neon-lime/40 bg-neon-lime/10 px-3 py-1 text-[11px] font-semibold text-neon-lime">
              Latest build
            </span>
          )}
        </div>

        <div className="flex flex-col items-center gap-3 px-5 py-7">
          {latestBuild ? (
            <>
              <div className="flex items-center gap-2">
                <HeroSlot part={latestBuild.blade} />
                {latestBuild.ratchet && (
                  <>
                    <span className="text-neon-fuchsia">+</span>
                    <HeroSlot part={latestBuild.ratchet} />
                  </>
                )}
                <span className="text-neon-fuchsia">+</span>
                <HeroSlot part={latestBuild.bit} />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {latestBuild.build.name}
              </p>
            </>
          ) : (
            <>
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-neon-cyan/30 bg-neon-cyan/5 text-3xl">
                🌀
              </div>
              <p className="text-center text-sm text-muted-foreground">
                No builds yet — assemble your first combo
              </p>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-5">
        {stats.map((stat, i) => {
          const accent = STAT_ACCENTS[i % STAT_ACCENTS.length];
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className={`neon-card rounded-2xl p-4 ${accent.glow}`}
            >
              <p className={`text-3xl font-bold ${accent.text}`}>{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 px-5 pb-4">
        <Link
          href="/inventory/add"
          className="glow-cyan rounded-2xl bg-gradient-to-r from-neon-cyan to-neon-violet px-5 py-4 text-center text-base font-bold text-background"
        >
          + Add a box to your inventory
        </Link>
        <Link
          href="/build"
          className="neon-card rounded-2xl px-5 py-4 text-center text-base font-semibold text-foreground"
        >
          Create a build
        </Link>
      </div>
    </main>
  );
}

function HeroSlot({ part }: { part: { name: string; imageUrl: string | null } }) {
  return (
    <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-border bg-background-elevated-2 text-[9px] text-muted-foreground">
      {part.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={part.imageUrl} alt={part.name} className="h-full w-full object-cover" />
      ) : (
        part.name
      )}
    </div>
  );
}
