import Link from "next/link";
import { stackServerApp } from "@/lib/stack";
import { getBuildsCount, getInventoryCount } from "@/db/queries";

export default async function Home() {
  const user = await stackServerApp.getUser({ or: "redirect" });
  const [inventoryCount, buildsCount] = await Promise.all([
    getInventoryCount(user.id),
    getBuildsCount(user.id),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 pt-8">
      <div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Welcome back</p>
        <h1 className="text-2xl font-bold text-zinc-950 dark:text-zinc-50">
          {user.displayName ?? "Blader"}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/inventory"
          className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <p className="text-3xl font-bold text-zinc-950 dark:text-zinc-50">
            {inventoryCount}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Parts owned</p>
        </Link>
        <Link
          href="/build"
          className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <p className="text-3xl font-bold text-zinc-950 dark:text-zinc-50">
            {buildsCount}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Saved builds</p>
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        <Link
          href="/inventory/add"
          className="rounded-2xl bg-zinc-950 px-5 py-4 text-center text-base font-semibold text-white dark:bg-zinc-50 dark:text-zinc-950"
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
