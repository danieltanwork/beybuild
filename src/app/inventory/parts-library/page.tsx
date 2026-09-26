import { stackServerApp } from "@/lib/stack";
import { PartsLibraryForm } from "@/components/parts-library-form";

export default async function PartsLibraryPage() {
  await stackServerApp.getUser({ or: "redirect" });

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 pt-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Import part photos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a reference sheet (a grid of part icons with their codes printed
          underneath) to fill in photos across your whole parts catalog at once.
        </p>
      </div>
      <PartsLibraryForm />
    </main>
  );
}
