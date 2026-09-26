"use client";

import { useMemo, useState, useTransition } from "react";
import { createBuild } from "@/app/build/actions";

type Part = {
  id: string;
  name: string;
  type: "blade" | "ratchet" | "bit" | "blade_ratchet";
  imageUrl: string | null;
  attack: number | null;
  defense: number | null;
  stamina: number | null;
  height: number | null;
  dash: number | null;
  burstResistance: number | null;
  attackLow: number | null;
  defenseLow: number | null;
  staminaLow: number | null;
};

const STAT_LABELS = {
  attack: "ATK",
  defense: "DEF",
  stamina: "STA",
  height: "Height",
  dash: "Dash",
  burstResistance: "Burst",
} as const;

const STAT_ACCENTS = [
  "text-neon-cyan",
  "text-neon-fuchsia",
  "text-neon-lime",
  "text-neon-violet",
  "text-neon-cyan",
  "text-neon-fuchsia",
] as const;

export type MetaCombo = {
  ratchetName: string | null;
  bitName: string | null;
  topFinishes: number;
};

// Tournament data won't always match the catalog's spelling/case exactly
// (e.g. "NR" vs "Nr") — compare on a normalized form.
function normalize(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Fixed locale + UTC so server and client render the same string.
function formatDay(isoDay: string) {
  return new Date(`${isoDay}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function BuildPicker({
  blades,
  ratchets,
  bits,
  metaByBlade = {},
  metaAsOf = null,
}: {
  blades: Part[];
  ratchets: Part[];
  bits: Part[];
  metaByBlade?: Record<string, MetaCombo[]>;
  metaAsOf?: string | null;
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

  const metaPicks = useMemo(() => {
    if (!selected.blade) return [];
    return (metaByBlade[selected.blade.id] ?? []).map((combo) => {
      const ratchet = combo.ratchetName
        ? ratchets.find((p) => normalize(p.name) === normalize(combo.ratchetName!))
        : undefined;
      const bit = combo.bitName
        ? bits.find((p) => normalize(p.name) === normalize(combo.bitName!))
        : undefined;
      const missing = [
        combo.ratchetName && !ratchet ? combo.ratchetName : null,
        combo.bitName && !bit ? combo.bitName : null,
      ].filter((m): m is string => m !== null);
      return { combo, ratchet, bit, missing };
    });
  }, [selected.blade, metaByBlade, ratchets, bits]);

  // A ratchet-integrated blade's own stats already include the ratchet's
  // contribution, so it has no separate ratchet part and needs one either.
  const isIntegrated = selected.blade?.type === "blade_ratchet";

  const totals = useMemo(() => {
    const parts = [selected.blade, isIntegrated ? undefined : selected.ratchet, selected.bit];
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
  }, [selected, isIntegrated]);

  const ready = bladeId && (ratchetId || isIntegrated) && bitId;

  function handleSave() {
    if (!ready) return;
    const fd = new FormData();
    fd.set("bladePartId", bladeId!);
    if (!isIntegrated) fd.set("ratchetPartId", ratchetId!);
    fd.set("bitPartId", bitId!);
    fd.set("name", name);
    startTransition(() => {
      createBuild(fd);
      setName("");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="glow-fuchsia neon-card flex items-center justify-center gap-3 rounded-2xl p-4">
        <PreviewSlot part={selected.blade} placeholder="Blade" />
        <span className="text-neon-fuchsia">+</span>
        {isIntegrated ? (
          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-border text-center text-[9px] text-muted-foreground">
            Built into blade
          </div>
        ) : (
          <PreviewSlot part={selected.ratchet} placeholder="Ratchet" />
        )}
        <span className="text-neon-fuchsia">+</span>
        <PreviewSlot part={selected.bit} placeholder="Bit" />
      </div>

      {ready && (
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STAT_LABELS) as (keyof typeof STAT_LABELS)[]).map((key, i) => (
            <StatPill
              key={key}
              label={STAT_LABELS[key]}
              value={totals[key]}
              accent={STAT_ACCENTS[i]}
            />
          ))}
        </div>
      )}

      {metaPicks.length > 0 && (
        <div className="neon-card flex flex-col gap-3 rounded-2xl border border-neon-lime/40 p-4">
          <div>
            <span className="rounded-full bg-neon-lime px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-background">
              Meta picks
            </span>
            <p className="mt-2 text-xs text-muted-foreground">
              The ratchet + bit players most often won with using{" "}
              <span className="font-semibold text-foreground">{selected.blade?.name}</span>{" "}
              at WBO tournaments in the last 90 days
              {metaAsOf ? ` (to ${formatDay(metaAsOf)})` : ""}.
            </p>
          </div>
          {metaPicks.map(({ combo, ratchet, bit, missing }, i) => (
            <div
              key={`${combo.ratchetName}-${combo.bitName}`}
              className="flex items-center justify-between gap-3 border-t border-border pt-3"
            >
              <div className="flex items-start gap-3">
                <span className="text-lg font-bold text-neon-lime">#{i + 1}</span>
                <div>
                  <p className="text-sm text-foreground">
                    {combo.ratchetName && (
                      <>
                        <span className="font-semibold">{combo.ratchetName}</span>{" "}
                        <span className="text-muted-foreground">ratchet + </span>
                      </>
                    )}
                    <span className="font-semibold">{combo.bitName}</span>{" "}
                    <span className="text-muted-foreground">bit</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {combo.topFinishes} top-3 {combo.topFinishes === 1 ? "finish" : "finishes"}
                  </p>
                  {missing.length > 0 ? (
                    <p className="text-[11px] text-neon-red">
                      You don&rsquo;t own {missing.join(" or ")}
                    </p>
                  ) : (
                    <p className="text-[11px] text-neon-lime">You own these parts</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (ratchet) setRatchetId(ratchet.id);
                  if (bit) setBitId(bit.id);
                }}
                disabled={missing.length > 0}
                className="shrink-0 rounded-lg bg-neon-lime px-3 py-1.5 text-xs font-bold text-background disabled:opacity-40"
              >
                Use
              </button>
            </div>
          ))}
        </div>
      )}

      <PartCarousel title="Blade" parts={blades} selectedId={bladeId} onSelect={setBladeId} />
      {isIntegrated ? (
        <div className="neon-card rounded-2xl p-4">
          <span className="rounded-full bg-gradient-to-r from-neon-cyan to-neon-violet px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-background">
            Ratchet
          </span>
          <p className="mt-2 text-xs text-muted-foreground">
            {selected.blade?.name} is a ratchet-integrated blade — no
            separate ratchet needed.
          </p>
        </div>
      ) : (
        <PartCarousel title="Ratchet" parts={ratchets} selectedId={ratchetId} onSelect={setRatchetId} />
      )}
      <PartCarousel title="Bit" parts={bits} selectedId={bitId} onSelect={setBitId} />

      {ready && (
        <div className="glow-cyan neon-card sticky bottom-16 flex gap-2 rounded-2xl p-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name this build (optional)"
            className="flex-1 rounded-lg border border-border bg-background-elevated-2 px-3 py-2 text-sm text-foreground focus:border-neon-cyan focus:outline-none"
          />
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded-lg bg-gradient-to-r from-neon-cyan to-neon-violet px-4 py-2 text-sm font-bold text-background disabled:opacity-40"
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
    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-border bg-background-elevated-2 text-[10px] text-muted-foreground">
      {part?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={part.imageUrl} alt={part.name} className="h-full w-full object-cover" />
      ) : (
        placeholder
      )}
    </div>
  );
}

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border bg-background-elevated py-1.5 pl-3 pr-2.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={`text-xs font-bold ${accent}`}>{value}</span>
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
        <h2 className="mb-2 text-sm font-semibold text-neon-fuchsia">{title}</h2>
        <p className="text-xs text-muted-foreground">
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
    <div className="neon-card rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full bg-gradient-to-r from-neon-cyan to-neon-violet px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-background">
          {title}
        </span>
        {parts.length > 1 && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-xs font-medium text-neon-cyan underline"
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
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neon-cyan/40 text-lg text-neon-cyan disabled:opacity-30"
          >
            ‹
          </button>

          <div className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border border-border bg-background-elevated-2">
              {current?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={current.imageUrl}
                  alt={current.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xs text-muted-foreground">No photo</span>
              )}
            </div>
            <p className="text-center text-sm font-semibold text-foreground">
              {current?.name}
            </p>
            {current?.attackLow != null && (
              <p className="text-center text-[10px] text-neon-cyan">
                Low Mode: {current.attackLow}/{current.defenseLow}/{current.staminaLow}
              </p>
            )}
            {parts.length > 1 && (
              <p className="text-[11px] text-muted-foreground">
                {index + 1} / {parts.length}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => step(1)}
            disabled={parts.length < 2}
            aria-label={`Next ${title.toLowerCase()}`}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neon-cyan/40 text-lg text-neon-cyan disabled:opacity-30"
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
                    ? "glow-lime ring-neon-lime"
                    : "ring-transparent hover:ring-border"
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
                    <span className="text-[10px] text-muted-foreground">No photo</span>
                  )}
                  {isSelected && (
                    <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-neon-lime text-[11px] font-bold text-background">
                      ✓
                    </span>
                  )}
                </div>
                <p
                  className={`truncate px-1.5 py-1.5 text-center text-[11px] font-medium ${
                    isSelected
                      ? "bg-neon-lime text-background"
                      : "bg-background-elevated-2 text-muted-foreground"
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
