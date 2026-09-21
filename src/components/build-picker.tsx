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
  height: number | null;
  dash: number | null;
  burstResistance: number | null;
};

const STAT_LABELS = {
  attack: "ATK",
  defense: "DEF",
  stamina: "STA",
  height: "Height",
  dash: "Dash",
  burstResistance: "Burst",
} as const;

export function BuildPicker({
  blades,
  ratchets,
  bits,
}: {
  blades: Part[];
  ratchets: Part[];
  bits: Part[];
}) {
  // Start with a real combo on screen (first owned part of each type)
  // instead of an empty state the player has to fill in from scratch.
  const [bladeId, setBladeId] = useState<string | null>(blades[0]?.id ?? null);
  const [ratchetId, setRatchetId] = useState<string | null>(ratchets[0]?.id ?? null);
  const [bitId, setBitId] = useState<string | null>(bits[0]?.id ?? null);
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
    const sum = (key: keyof typeof STAT_LABELS) =>
      parts.reduce((s, p) => s + (p?.[key] ?? 0), 0);
    return {
      attack: sum("attack"),
      defense: sum("defense"),
      stamina: sum("stamina"),
      height: sum("height"),
      dash: sum("dash"),
      burstResistance: sum("burstResistance"),
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
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STAT_LABELS) as (keyof typeof STAT_LABELS)[]).map((key) => (
            <StatPill key={key} label={STAT_LABELS[key]} value={totals[key]} />
          ))}
        </div>
      )}

      <PartCarousel title="Blade" parts={blades} selectedId={bladeId} onSelect={setBladeId} />
      <PartCarousel title="Ratchet" parts={ratchets} selectedId={ratchetId} onSelect={setRatchetId} />
      <PartCarousel title="Bit" parts={bits} selectedId={bitId} onSelect={setBitId} />

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

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 py-1.5 pl-3 pr-2.5 dark:border-zinc-800 dark:bg-zinc-900">
      <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <span className="rounded-full bg-zinc-950 px-1.5 py-0.5 text-xs font-bold text-white dark:bg-zinc-50 dark:text-zinc-950">
        {value}
      </span>
    </div>
  );
}

function PartCarousel({
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
  const [expanded, setExpanded] = useState(false);

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

  const index = Math.max(0, parts.findIndex((p) => p.id === selectedId));
  const current = parts[index];

  function step(delta: number) {
    const next = (index + delta + parts.length) % parts.length;
    onSelect(parts[next].id);
  }

  return (
    <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full bg-zinc-950 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white dark:bg-zinc-50 dark:text-zinc-950">
          {title}
        </span>
        {parts.length > 1 && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-xs font-medium text-zinc-500 underline dark:text-zinc-400"
          >
            {expanded ? "Hide list" : `Browse all (${parts.length})`}
          </button>
        )}
      </div>

      {!expanded ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={parts.length < 2}
            aria-label={`Previous ${title.toLowerCase()}`}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-lg text-zinc-500 disabled:opacity-30 dark:border-zinc-800 dark:text-zinc-400"
          >
            ‹
          </button>

          <div className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800">
              {current?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={current.imageUrl}
                  alt={current.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xs text-zinc-400">No photo</span>
              )}
            </div>
            <p className="text-center text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              {current?.name}
            </p>
            {parts.length > 1 && (
              <p className="text-[11px] text-zinc-400">
                {index + 1} / {parts.length}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => step(1)}
            disabled={parts.length < 2}
            aria-label={`Next ${title.toLowerCase()}`}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-lg text-zinc-500 disabled:opacity-30 dark:border-zinc-800 dark:text-zinc-400"
          >
            ›
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {parts.map((p) => {
            const isSelected = selectedId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => {
                  onSelect(p.id);
                  setExpanded(false);
                }}
                className={`overflow-hidden rounded-xl ring-2 transition ${
                  isSelected
                    ? "ring-emerald-500"
                    : "ring-transparent hover:ring-zinc-200 dark:hover:ring-zinc-700"
                }`}
              >
                <div className="relative flex aspect-square items-center justify-center bg-white">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] text-zinc-400">No photo</span>
                  )}
                  {isSelected && (
                    <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">
                      ✓
                    </span>
                  )}
                </div>
                <p
                  className={`truncate px-1.5 py-1.5 text-center text-[11px] font-medium ${
                    isSelected
                      ? "bg-emerald-500 text-white"
                      : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                >
                  {p.name}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
