import Link from "next/link";
import { stackServerApp } from "@/lib/stack";
import { getAllPartsByType } from "@/db/queries";
import { AddBoxForm } from "@/components/add-box-form";

export default async function AddInventoryPage() {
  await stackServerApp.getUser({ or: "redirect" });

  const [bladeOptions, ratchetOptions, bitOptions] = await Promise.all([
    getAllPartsByType(["blade", "blade_ratchet"]),
    getAllPartsByType("ratchet"),
    getAllPartsByType("bit"),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 pt-8">
      <div className="flex items-center gap-2">
        <Link href="/inventory" className="text-sm text-neon-cyan">
          ← Inventory
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-foreground">Add a box</h1>
      <p className="text-sm text-muted-foreground">
        Snap the box back and each part, or just type the names — start typing
        to match parts you&apos;ve already logged.
      </p>
      <AddBoxForm
        bladeOptions={bladeOptions}
        ratchetOptions={ratchetOptions}
        bitOptions={bitOptions}
      />
    </main>
  );
}
