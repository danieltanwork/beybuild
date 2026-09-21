"use client";

import { useMemo, useState, useTransition } from "react";
import { createBuild } from "@/app/build/actions";

type Part = {
  id: string;
  name: string;
  type: "blade" | "ratchet" | "bit";
  imageUrl: string | null;
  attack: number | null;
  defense: number | null;
  stamina: number | null;
};

export function BuildPicker({
  blades,
  ratchets,
  bits,
}: {
  blades: Part[];
  ratchets: Part[];
  bits: Part[];
}) {
  const [bladeId, setBladeId] = useState<string | null>(null);
  const [ratchetId, setRatchetId] = useState<string | null>(null);
  const [bitId, setBitId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  const selected = useMemo(
    () => ({
      blade: blades.find((p) => p.id === bladeId),
      ratchet: ratchets.find((p) => p.id === ratchetId),
      bit: bits.find((p) => p.id === bitId),
    }),
    [bladeId, ratchetId, bitId, blades, ratchets, bits],
  );

  const totals = useMemo(() => {
    const parts = [selected.blade, selected.ratchet, selected.bit];
    return {
      attack: parts.reduce((s, p) => s + (p?.attack ?? 0), 0),
      defense: parts.reduce((s, p) => s + (p?.defense ?? 0), 0),
      stamina: parts.reduce((s, p) => s + (p?.stamina ?? 0), 0),
    };
  }, [selected]);

  const ready = bladeId && ratchetId && bitId;

  function handleSave() {
    if (!ready) return;
    const fd = new FormData();
    fd.set("bladePartId", bladeId!);
    fd.set("ratchetPartId", ratchetId!);
    fd.set("bitPartId", bitId!);
    fd.set("name", name);
    startTransition(() => {
      createBuild(fd);
      setName("");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <PreviewSlot part={selected.blade} placeholder="Blade" />
        <span className="text-zinc-300">+</span>
        <PreviewSlot part={selected.ratchet} placeholder="Ratchet" />
        <span className="text-zinc-300">+</span>
        <PreviewSlot part={selected.bit} placeholder="Bit" />
      </div>

      {ready && (
        <div className="grid grid-cols-3 gap-3 text-center text-sm">
          <Stat label="Attack" value={totals.attack} />
          <Stat label="Defense" value={totals.defense} />
          <Stat label="Stamina" value={totals.stamina} />
        </div>
      )}

      <PartGrid title="Blade" parts={blades} selectedId={bladeId} onSelect={setBladeId} />
      <PartGrid title="Ratchet" parts={ratchets} selectedId={ratchetId} onSelect={setRatchetId} />
      <PartGrid title="Bit" parts={bits} selectedId={bitId} onSelect={setBitId} />

      {ready && (
        <div className="sticky bottom-16 flex gap-2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name this build (optional)"
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-950"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}

function PreviewSlot({ part, placeholder }: { part?: Part; placeholder: string }) {
  return (
    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-zinc-100 text-[10px] text-zinc-400 dark:bg-zinc-800">
      {part?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={part.imageUrl} alt={part.name} className="h-full w-full object-cover" />
      ) : (
        placeholder
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 py-2 dark:border-zinc-800">
      <p className="text-lg font-bold text-zinc-950 dark:text-zinc-50">{value}</p>
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{label}</p>
    </div>
  );
}

function PartGrid({
  title,
  parts,
  selectedId,
  onSelect,
}: {
  title: string;
  parts: Part[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (parts.length === 0) {
    return (
      <div>
        <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          {title}
        </h2>
        <p className="text-xs text-zinc-400">
          No {title.toLowerCase()}s in your inventory yet.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        {title}
      </h2>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {parts.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={`flex w-20 shrink-0 flex-col items-center gap-1 rounded-xl border-2 p-1.5 ${
              selectedId === p.id
                ? "border-zinc-950 dark:border-zinc-50"
                : "border-transparent"
            }`}
          >
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-[10px] text-zinc-400">No photo</span>
              )}
            </div>
            <span className="line-clamp-2 text-center text-[11px] leading-tight text-zinc-700 dark:text-zinc-300">
              {p.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
