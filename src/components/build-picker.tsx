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
    <div className="flex flex-col gap-5">
      <div className="glow-fuchsia neon-card flex flex-col gap-4 rounded-2xl p-4">
        <div className="flex items-center justify-center gap-2">
          <PreviewSlot part={selected.blade} placeholder="Blade" accent="fuchsia" />
          <span className="text-lg text-muted-foreground">+</span>
          {isIntegrated ? (
            <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border px-1 text-center text-[9px] text-muted-foreground">
              Built into blade
            </div>
          ) : (
            <PreviewSlot part={selected.ratchet} placeholder="Ratchet" accent="cyan" />
          )}
          <span className="text-lg text-muted-foreground">+</span>
          <PreviewSlot part={selected.bit} placeholder="Bit" accent="violet" />
        </div>

        {ready && (
          <div className="flex flex-wrap justify-center gap-2 border-t border-border pt-4">
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
      </div>

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

      <PartTabs
        blades={blades}
        ratchets={ratchets}
        bits={bits}
        bladeId={bladeId}
        ratchetId={ratchetId}
        bitId={bitId}
        isIntegrated={isIntegrated}
        onSelectBlade={setBladeId}
        onSelectRatchet={setRatchetId}
        onSelectBit={setBitId}
      />

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

const ACCENT_BORDER = {
  fuchsia: "border-neon-fuchsia/50",
  cyan: "border-neon-cyan/50",
  violet: "border-neon-violet/50",
} as const;

function PreviewSlot({
  part,
  placeholder,
  accent,
}: {
  part?: Part;
  placeholder: string;
  accent: keyof typeof ACCENT_BORDER;
}) {
  return (
    <div className="flex w-20 shrink-0 flex-col items-center gap-1">
      <div
        className={`flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border bg-background-elevated-2 text-[10px] text-muted-foreground ${ACCENT_BORDER[accent]}`}
      >
        {part?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={part.imageUrl} alt={part.name} className="h-full w-full object-cover" />
        ) : (
          placeholder
        )}
      </div>
      <p className="w-full truncate text-center text-[11px] font-medium text-foreground">
        {part?.name ?? "—"}
      </p>
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

type TabKey = "blade" | "ratchet" | "bit";

const TAB_ACCENT: Record<
  TabKey,
  { label: string; activePill: string; text: string; border: string }
> = {
  blade: {
    label: "Blade",
    activePill: "bg-neon-fuchsia text-background",
    text: "text-neon-fuchsia",
    border: "border-neon-fuchsia/40",
  },
  ratchet: {
    label: "Ratchet",
    activePill: "bg-neon-cyan text-background",
    text: "text-neon-cyan",
    border: "border-neon-cyan/40",
  },
  bit: {
    label: "Bit",
    activePill: "bg-neon-violet text-background",
    text: "text-neon-violet",
    border: "border-neon-violet/40",
  },
};

function PartTabs({
  blades,
  ratchets,
  bits,
  bladeId,
  ratchetId,
  bitId,
  isIntegrated,
  onSelectBlade,
  onSelectRatchet,
  onSelectBit,
}: {
  blades: Part[];
  ratchets: Part[];
  bits: Part[];
  bladeId: string | null;
  ratchetId: string | null;
  bitId: string | null;
  isIntegrated: boolean;
  onSelectBlade: (id: string) => void;
  onSelectRatchet: (id: string) => void;
  onSelectBit: (id: string) => void;
}) {
  const [tab, setTab] = useState<TabKey>("blade");
  const [expanded, setExpanded] = useState(false);

  function switchTab(next: TabKey) {
    setTab(next);
    setExpanded(false);
  }

  const config: Record<TabKey, { parts: Part[]; selectedId: string | null; onSelect: (id: string) => void; subtitle: string }> = {
    blade: {
      parts: blades,
      selectedId: bladeId,
      onSelect: onSelectBlade,
      subtitle: blades.find((p) => p.id === bladeId)?.name ?? "None yet",
    },
    ratchet: {
      parts: ratchets,
      selectedId: ratchetId,
      onSelect: onSelectRatchet,
      subtitle: isIntegrated ? "Built-in" : ratchets.find((p) => p.id === ratchetId)?.name ?? "None yet",
    },
    bit: {
      parts: bits,
      selectedId: bitId,
      onSelect: onSelectBit,
      subtitle: bits.find((p) => p.id === bitId)?.name ?? "None yet",
    },
  };

  const active = config[tab];

  return (
    <div className="neon-card rounded-2xl p-4">
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(TAB_ACCENT) as TabKey[]).map((key) => {
          const isActive = tab === key;
          const accent = TAB_ACCENT[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => switchTab(key)}
              className={`flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2 transition ${
                isActive ? `${accent.activePill} border-transparent` : `bg-background-elevated-2 ${accent.border} ${accent.text}`
              }`}
            >
              <span className="text-[11px] font-bold uppercase tracking-wide">{accent.label}</span>
              <span
                className={`w-full truncate text-center text-[10px] font-medium ${
                  isActive ? "text-background/80" : "text-muted-foreground"
                }`}
              >
                {config[key].subtitle}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {tab === "ratchet" && isIntegrated ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            This blade has its ratchet built in — no separate part needed.
          </p>
        ) : (
          <PartPickerBody
            tabKey={tab}
            parts={active.parts}
            selectedId={active.selectedId}
            onSelect={active.onSelect}
            expanded={expanded}
            onToggleExpanded={() => setExpanded((e) => !e)}
          />
        )}
      </div>
    </div>
  );
}

function PartPickerBody({
  tabKey,
  parts,
  selectedId,
  onSelect,
  expanded,
  onToggleExpanded,
}: {
  tabKey: TabKey;
  parts: Part[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const accent = TAB_ACCENT[tabKey];

  if (parts.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">
        No {accent.label.toLowerCase()}s in your inventory yet.
      </p>
    );
  }

  const index = Math.max(0, parts.findIndex((p) => p.id === selectedId));
  const current = parts[index];

  function step(delta: number) {
    const next = (index + delta + parts.length) % parts.length;
    onSelect(parts[next].id);
  }

  if (expanded) {
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          {parts.map((p) => {
            const isSelected = selectedId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => onSelect(p.id)}
                className={`overflow-hidden rounded-xl ring-2 transition ${
                  isSelected ? "glow-lime ring-neon-lime" : "ring-transparent hover:ring-border"
                }`}
              >
                <div className="relative flex aspect-square items-center justify-center bg-white">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
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
                    isSelected ? "bg-neon-lime text-background" : "bg-background-elevated-2 text-muted-foreground"
                  }`}
                >
                  {p.name}
                </p>
              </button>
            );
          })}
        </div>
        <button type="button" onClick={onToggleExpanded} className={`text-xs font-medium underline ${accent.text}`}>
          Hide list
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={parts.length < 2}
          aria-label={`Previous ${accent.label.toLowerCase()}`}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-lg disabled:opacity-30 ${accent.border} ${accent.text}`}
        >
          ‹
        </button>

        <div className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border border-border bg-background-elevated-2">
            {current?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.imageUrl} alt={current.name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs text-muted-foreground">No photo</span>
            )}
          </div>
          <p className="text-center text-sm font-semibold text-foreground">{current?.name}</p>
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
          aria-label={`Next ${accent.label.toLowerCase()}`}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-lg disabled:opacity-30 ${accent.border} ${accent.text}`}
        >
          ›
        </button>
      </div>
      {parts.length > 1 && (
        <button type="button" onClick={onToggleExpanded} className={`self-center text-xs font-medium underline ${accent.text}`}>
          Browse all ({parts.length})
        </button>
      )}
    </div>
  );
}
