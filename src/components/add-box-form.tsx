"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PhotoCapture } from "@/components/photo-capture";
import { addBoxToInventory, deleteBox, updateBoxInventory } from "@/app/inventory/actions";

type PartOption = { id: string; name: string };
type StatField = { key: string; label: string };
type Stats = Record<string, string>;

const BLADE_STAT_FIELDS: StatField[] = [
  { key: "attack", label: "ATK" },
  { key: "defense", label: "DEF" },
  { key: "stamina", label: "STA" },
];
const BLADE_LOW_STAT_FIELDS: StatField[] = [
  { key: "attackLow", label: "ATK (Low)" },
  { key: "defenseLow", label: "DEF (Low)" },
  { key: "staminaLow", label: "STA (Low)" },
];
const RATCHET_STAT_FIELDS: StatField[] = [
  ...BLADE_STAT_FIELDS,
  { key: "height", label: "Height" },
];
const BIT_STAT_FIELDS: StatField[] = [
  ...BLADE_STAT_FIELDS,
  { key: "dash", label: "Dash" },
  { key: "burstResistance", label: "Burst" },
];

type BeyState = {
  bladeName: string;
  ratchetName: string;
  bitName: string;
  // True for a ratchet-integrated blade (e.g. Hellsnether) — blade and
  // ratchet are one fused part, so this bey has no separate ratchet.
  bladeIsIntegrated: boolean;
  bladeStats: Stats;
  ratchetStats: Stats;
  bitStats: Stats;
  bladePhotoUrl: string | null;
  ratchetPhotoUrl: string | null;
  bitPhotoUrl: string | null;
};

function emptyBey(): BeyState {
  return {
    bladeName: "",
    ratchetName: "",
    bitName: "",
    bladeIsIntegrated: false,
    bladeStats: {},
    ratchetStats: {},
    bitStats: {},
    bladePhotoUrl: null,
    ratchetPhotoUrl: null,
    bitPhotoUrl: null,
  };
}

function statsFromAnalysisBey(bey: Record<string, unknown>, prefix: string, fields: StatField[]): Stats {
  const stats: Stats = {};
  for (const f of fields) {
    const raw = bey[`${prefix}${f.key[0].toUpperCase()}${f.key.slice(1)}`];
    stats[f.key] = typeof raw === "number" ? String(raw) : "";
  }
  return stats;
}

type BeyInitial = {
  blade: { name: string; photoUrl: string | null; stats: Stats; isIntegrated: boolean };
  ratchet: { name: string; photoUrl: string | null; stats: Stats };
  bit: { name: string; photoUrl: string | null; stats: Stats };
};

function beyFromInitial(b: BeyInitial): BeyState {
  return {
    bladeName: b.blade.name,
    ratchetName: b.ratchet.name,
    bitName: b.bit.name,
    bladeIsIntegrated: b.blade.isIntegrated,
    bladeStats: b.blade.stats,
    ratchetStats: b.ratchet.stats,
    bitStats: b.bit.stats,
    bladePhotoUrl: b.blade.photoUrl,
    ratchetPhotoUrl: b.ratchet.photoUrl,
    bitPhotoUrl: b.bit.photoUrl,
  };
}

export function AddBoxForm({
  bladeOptions,
  ratchetOptions,
  bitOptions,
  boxId,
  initial,
}: {
  bladeOptions: PartOption[];
  ratchetOptions: PartOption[];
  bitOptions: PartOption[];
  boxId?: string;
  initial?: {
    boxCode: string;
    boxName: string;
    boxPhotoFrontUrl: string | null;
    boxPhotoBackUrl: string | null;
    beys: BeyInitial[];
  };
}) {
  const isEdit = !!boxId;
  const router = useRouter();

  const [boxCode, setBoxCode] = useState(initial?.boxCode ?? "");
  const [boxName, setBoxName] = useState(initial?.boxName ?? "");
  const [beys, setBeys] = useState<BeyState[]>(
    initial?.beys.length ? initial.beys.map(beyFromInitial) : [emptyBey()],
  );

  const [boxPhotoFrontUrl, setBoxPhotoFrontUrl] = useState<string | null>(
    initial?.boxPhotoFrontUrl ?? null,
  );
  const [boxPhotoBackUrl, setBoxPhotoBackUrl] = useState<string | null>(
    initial?.boxPhotoBackUrl ?? null,
  );

  const [analyzeStatus, setAnalyzeStatus] = useState<
    "idle" | "analyzing" | "done" | "error"
  >("idle");
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  // Bumped whenever photo analysis fills in auto-cropped part photos, so the
  // PhotoCapture previews below (which only read their initial photo once,
  // on mount) remount and pick up the new URLs.
  const [photosVersion, setPhotosVersion] = useState(0);

  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();

  function updateBey(index: number, patch: Partial<BeyState>) {
    setBeys((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  }

  function updateBeyStat(index: number, group: "bladeStats" | "ratchetStats" | "bitStats", key: string, value: string) {
    setBeys((prev) =>
      prev.map((b, i) => (i === index ? { ...b, [group]: { ...b[group], [key]: value } } : b)),
    );
  }

  async function handleAnalyze() {
    const photoUrls = [boxPhotoFrontUrl, boxPhotoBackUrl].filter(
      (u): u is string => !!u,
    );
    if (photoUrls.length === 0) return;

    setAnalyzeStatus("analyzing");
    setAnalyzeError(null);
    try {
      const res = await fetch("/api/analyze-box", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrls }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't analyze the photos");

      if (data.boxCode) setBoxCode(data.boxCode);
      if (data.boxName) setBoxName(data.boxName);

      const analyzedBeys = Array.isArray(data.beys) ? data.beys : [];
      if (analyzedBeys.length > 0) {
        setBeys(
          analyzedBeys.map((bey: Record<string, unknown>) => ({
            bladeName: typeof bey.bladeName === "string" ? bey.bladeName : "",
            ratchetName: typeof bey.ratchetName === "string" ? bey.ratchetName : "",
            bitName: typeof bey.bitName === "string" ? bey.bitName : "",
            bladeIsIntegrated: bey.bladeIsIntegrated === true,
            bladeStats: statsFromAnalysisBey(bey, "blade", [...BLADE_STAT_FIELDS, ...BLADE_LOW_STAT_FIELDS]),
            ratchetStats: statsFromAnalysisBey(bey, "ratchet", RATCHET_STAT_FIELDS),
            bitStats: statsFromAnalysisBey(bey, "bit", BIT_STAT_FIELDS),
            bladePhotoUrl: typeof bey.bladePhotoUrl === "string" ? bey.bladePhotoUrl : null,
            ratchetPhotoUrl: typeof bey.ratchetPhotoUrl === "string" ? bey.ratchetPhotoUrl : null,
            bitPhotoUrl: typeof bey.bitPhotoUrl === "string" ? bey.bitPhotoUrl : null,
          })),
        );
        setPhotosVersion((v) => v + 1);
      }
      setAnalyzeStatus("done");
    } catch (err) {
      setAnalyzeStatus("error");
      setAnalyzeError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("boxCode", boxCode);
    fd.set("boxName", boxName);
    if (boxPhotoFrontUrl) fd.set("boxPhotoFrontUrl", boxPhotoFrontUrl);
    if (boxPhotoBackUrl) fd.set("boxPhotoBackUrl", boxPhotoBackUrl);
    fd.set("beysJson", JSON.stringify(beys));

    startTransition(() => {
      if (isEdit) {
        updateBoxInventory(boxId!, fd);
      } else {
        addBoxToInventory(fd);
      }
    });
  }

  function handleDelete() {
    if (!boxId) return;
    if (!window.confirm("Remove this box and its parts from your inventory?")) return;
    startDeleteTransition(() => {
      deleteBox(boxId);
    });
  }

  const canAnalyze = (boxPhotoFrontUrl || boxPhotoBackUrl) && analyzeStatus !== "analyzing";
  const allValid = beys.every(
    (b) => b.bladeName.trim() && b.bitName.trim() && (b.bladeIsIntegrated || b.ratchetName.trim()),
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 pb-10">
      <div className="neon-card flex flex-col gap-3 rounded-2xl p-4">
        <div className="grid grid-cols-2 gap-3">
          <PhotoCapture
            label="Box photo — front"
            onUploaded={setBoxPhotoFrontUrl}
            initialUrl={initial?.boxPhotoFrontUrl}
          />
          <PhotoCapture
            label="Box photo — back"
            onUploaded={setBoxPhotoBackUrl}
            initialUrl={initial?.boxPhotoBackUrl}
          />
        </div>

        <button
          type="button"
          onClick={handleAnalyze}
          disabled={!canAnalyze}
          className="glow-fuchsia rounded-xl bg-gradient-to-r from-neon-fuchsia to-neon-violet px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
        >
          {analyzeStatus === "analyzing"
            ? "Reading box photos…"
            : "✨ Fill in from photos"}
        </button>
        {analyzeStatus === "done" && (
          <p className="text-xs text-neon-lime">
            Filled in what we could read below — double check before saving.
            {beys.length > 1 && ` Found ${beys.length} beyblades in this box.`}
          </p>
        )}
        {analyzeStatus === "error" && (
          <p className="text-xs text-neon-red">
            {analyzeError ?? "Couldn't read the photos"} — fill in the fields
            manually below.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-muted-foreground">
            Product code
          </span>
          <input
            value={boxCode}
            onChange={(e) => setBoxCode(e.target.value)}
            placeholder="BX-23"
            className="rounded-lg border border-border bg-background-elevated px-3 py-2 text-foreground focus:border-neon-cyan focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-muted-foreground">Box title</span>
          <input
            value={boxName}
            onChange={(e) => setBoxName(e.target.value)}
            placeholder="Phoenix Wing 9-60GF"
            className="rounded-lg border border-border bg-background-elevated px-3 py-2 text-foreground focus:border-neon-cyan focus:outline-none"
          />
        </label>
      </div>

      {beys.map((bey, i) => (
        <div key={i} className="flex flex-col gap-4">
          {beys.length > 1 && (
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-neon-cyan">
                Beyblade {i + 1}
                {bey.bladeName && (bey.bladeIsIntegrated || bey.ratchetName) && bey.bitName
                  ? ` — ${bey.bladeName} ${bey.bladeIsIntegrated ? "" : bey.ratchetName}${bey.bitName}`
                  : ""}
              </h2>
              <button
                type="button"
                onClick={() => setBeys((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-xs text-neon-red"
              >
                Remove
              </button>
            </div>
          )}
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={bey.bladeIsIntegrated}
              onChange={(e) => updateBey(i, { bladeIsIntegrated: e.target.checked })}
              className="h-4 w-4 accent-neon-cyan"
            />
            Ratchet-integrated blade (blade and ratchet are one fused part, e.g. Hellsnether)
          </label>
          <PartField
            key={`blade-${photosVersion}`}
            label="Blade"
            value={bey.bladeName}
            onChange={(v) => updateBey(i, { bladeName: v })}
            options={bladeOptions}
            onPhotoUploaded={(url) => updateBey(i, { bladePhotoUrl: url })}
            initialPhotoUrl={bey.bladePhotoUrl}
            statFields={bey.bladeIsIntegrated ? [...BLADE_STAT_FIELDS, ...BLADE_LOW_STAT_FIELDS] : BLADE_STAT_FIELDS}
            stats={bey.bladeStats}
            onStatChange={(key, value) => updateBeyStat(i, "bladeStats", key, value)}
          />
          {!bey.bladeIsIntegrated && (
            <PartField
              key={`ratchet-${photosVersion}`}
              label="Ratchet"
              value={bey.ratchetName}
              onChange={(v) => updateBey(i, { ratchetName: v })}
              options={ratchetOptions}
              onPhotoUploaded={(url) => updateBey(i, { ratchetPhotoUrl: url })}
              initialPhotoUrl={bey.ratchetPhotoUrl}
              statFields={RATCHET_STAT_FIELDS}
              stats={bey.ratchetStats}
              onStatChange={(key, value) => updateBeyStat(i, "ratchetStats", key, value)}
            />
          )}
          <PartField
            key={`bit-${photosVersion}`}
            label="Bit"
            value={bey.bitName}
            onChange={(v) => updateBey(i, { bitName: v })}
            options={bitOptions}
            onPhotoUploaded={(url) => updateBey(i, { bitPhotoUrl: url })}
            initialPhotoUrl={bey.bitPhotoUrl}
            statFields={BIT_STAT_FIELDS}
            stats={bey.bitStats}
            onStatChange={(key, value) => updateBeyStat(i, "bitStats", key, value)}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={() => setBeys((prev) => [...prev, emptyBey()])}
        className="rounded-2xl border border-dashed border-neon-cyan/40 px-5 py-3 text-center text-sm font-semibold text-neon-cyan"
      >
        + Add another beyblade in this box
      </button>

      <button
        type="submit"
        disabled={isPending || !allValid}
        className="glow-cyan rounded-2xl bg-gradient-to-r from-neon-cyan to-neon-violet px-5 py-4 text-center text-base font-bold text-background disabled:opacity-40"
      >
        {isPending ? "Saving…" : isEdit ? "Save changes" : "Save to inventory"}
      </button>

      {isEdit && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="rounded-2xl border border-neon-red/40 px-5 py-3 text-center text-sm font-semibold text-neon-red disabled:opacity-40"
        >
          {isDeleting ? "Removing…" : "Delete this box"}
        </button>
      )}
      {isEdit && (
        <button
          type="button"
          onClick={() => router.push("/inventory")}
          className="text-center text-sm text-muted-foreground"
        >
          Cancel
        </button>
      )}
    </form>
  );
}

function PartField({
  label,
  value,
  onChange,
  options,
  onPhotoUploaded,
  initialPhotoUrl,
  statFields,
  stats,
  onStatChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: PartOption[];
  onPhotoUploaded: (url: string) => void;
  initialPhotoUrl?: string | null;
  statFields: StatField[];
  stats: Stats;
  onStatChange: (key: string, value: string) => void;
}) {
  const uid = useId();
  const listId = `${label.toLowerCase()}-options-${uid}`;
  return (
    <div className="neon-card flex flex-col gap-3 rounded-2xl p-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neon-fuchsia">{label} name</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          list={listId}
          placeholder={`e.g. ${label === "Blade" ? "Phoenix Wing" : label === "Ratchet" ? "9-60" : "GF"}`}
          className="rounded-lg border border-border bg-background-elevated-2 px-3 py-2 text-foreground focus:border-neon-cyan focus:outline-none"
          required
        />
        <datalist id={listId}>
          {options.map((o) => (
            <option key={o.id} value={o.name} />
          ))}
        </datalist>
      </label>

      <div className="flex flex-wrap gap-2">
        {statFields.map((f) => (
          <label key={f.key} className="flex flex-col gap-0.5 text-xs">
            <span className="text-muted-foreground">{f.label}</span>
            <input
              type="number"
              inputMode="numeric"
              value={stats[f.key] ?? ""}
              onChange={(e) => onStatChange(f.key, e.target.value)}
              className="w-16 rounded-lg border border-border bg-background-elevated-2 px-2 py-1.5 text-sm text-foreground focus:border-neon-cyan focus:outline-none"
            />
          </label>
        ))}
      </div>

      <PhotoCapture
        label={`${label} photo`}
        onUploaded={onPhotoUploaded}
        initialUrl={initialPhotoUrl}
      />
    </div>
  );
}
