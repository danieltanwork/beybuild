"use client";

import { useState, useTransition } from "react";
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
const RATCHET_STAT_FIELDS: StatField[] = [
  ...BLADE_STAT_FIELDS,
  { key: "height", label: "Height" },
];
const BIT_STAT_FIELDS: StatField[] = [
  ...BLADE_STAT_FIELDS,
  { key: "dash", label: "Dash" },
  { key: "burstResistance", label: "Burst" },
];

function statsFromAnalysis(data: Record<string, unknown>, prefix: string, fields: StatField[]): Stats {
  const stats: Stats = {};
  for (const f of fields) {
    const raw = data[`${prefix}${f.key[0].toUpperCase()}${f.key.slice(1)}`];
    stats[f.key] = typeof raw === "number" ? String(raw) : "";
  }
  return stats;
}

type PartInitial = { name: string; photoUrl: string | null; stats: Stats };

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
    blade: PartInitial;
    ratchet: PartInitial;
    bit: PartInitial;
  };
}) {
  const isEdit = !!boxId;
  const router = useRouter();

  const [boxCode, setBoxCode] = useState(initial?.boxCode ?? "");
  const [boxName, setBoxName] = useState(initial?.boxName ?? "");
  const [bladeName, setBladeName] = useState(initial?.blade.name ?? "");
  const [ratchetName, setRatchetName] = useState(initial?.ratchet.name ?? "");
  const [bitName, setBitName] = useState(initial?.bit.name ?? "");

  const [bladeStats, setBladeStats] = useState<Stats>(initial?.blade.stats ?? {});
  const [ratchetStats, setRatchetStats] = useState<Stats>(initial?.ratchet.stats ?? {});
  const [bitStats, setBitStats] = useState<Stats>(initial?.bit.stats ?? {});

  const [boxPhotoFrontUrl, setBoxPhotoFrontUrl] = useState<string | null>(
    initial?.boxPhotoFrontUrl ?? null,
  );
  const [boxPhotoBackUrl, setBoxPhotoBackUrl] = useState<string | null>(
    initial?.boxPhotoBackUrl ?? null,
  );
  const [bladePhotoUrl, setBladePhotoUrl] = useState<string | null>(
    initial?.blade.photoUrl ?? null,
  );
  const [ratchetPhotoUrl, setRatchetPhotoUrl] = useState<string | null>(
    initial?.ratchet.photoUrl ?? null,
  );
  const [bitPhotoUrl, setBitPhotoUrl] = useState<string | null>(
    initial?.bit.photoUrl ?? null,
  );

  const [analyzeStatus, setAnalyzeStatus] = useState<
    "idle" | "analyzing" | "done" | "error"
  >("idle");
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();

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
      if (data.bladeName) setBladeName(data.bladeName);
      if (data.ratchetName) setRatchetName(data.ratchetName);
      if (data.bitName) setBitName(data.bitName);
      setBladeStats(statsFromAnalysis(data, "blade", BLADE_STAT_FIELDS));
      setRatchetStats(statsFromAnalysis(data, "ratchet", RATCHET_STAT_FIELDS));
      setBitStats(statsFromAnalysis(data, "bit", BIT_STAT_FIELDS));
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
    fd.set("bladeName", bladeName);
    fd.set("ratchetName", ratchetName);
    fd.set("bitName", bitName);
    if (bladePhotoUrl) fd.set("bladePhotoUrl", bladePhotoUrl);
    if (ratchetPhotoUrl) fd.set("ratchetPhotoUrl", ratchetPhotoUrl);
    if (bitPhotoUrl) fd.set("bitPhotoUrl", bitPhotoUrl);

    for (const [prefix, stats] of [
      ["blade", bladeStats],
      ["ratchet", ratchetStats],
      ["bit", bitStats],
    ] as const) {
      for (const [key, value] of Object.entries(stats)) {
        if (value !== "") fd.set(`${prefix}_${key}`, value);
      }
    }

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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 pb-10">
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
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
          className="rounded-xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-950"
        >
          {analyzeStatus === "analyzing"
            ? "Reading box photos…"
            : "✨ Fill in from photos"}
        </button>
        {analyzeStatus === "done" && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            Filled in what we could read below — double check before saving.
          </p>
        )}
        {analyzeStatus === "error" && (
          <p className="text-xs text-red-500">
            {analyzeError ?? "Couldn't read the photos"} — fill in the fields
            manually below.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            Product code
          </span>
          <input
            value={boxCode}
            onChange={(e) => setBoxCode(e.target.value)}
            placeholder="BX-23"
            className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            Set name
          </span>
          <input
            value={boxName}
            onChange={(e) => setBoxName(e.target.value)}
            placeholder="Phoenix Wing 9-60GF"
            className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>

      <PartField
        label="Blade"
        value={bladeName}
        onChange={setBladeName}
        options={bladeOptions}
        onPhotoUploaded={setBladePhotoUrl}
        initialPhotoUrl={initial?.blade.photoUrl}
        statFields={BLADE_STAT_FIELDS}
        stats={bladeStats}
        onStatChange={(key, value) => setBladeStats((s) => ({ ...s, [key]: value }))}
      />
      <PartField
        label="Ratchet"
        value={ratchetName}
        onChange={setRatchetName}
        options={ratchetOptions}
        onPhotoUploaded={setRatchetPhotoUrl}
        initialPhotoUrl={initial?.ratchet.photoUrl}
        statFields={RATCHET_STAT_FIELDS}
        stats={ratchetStats}
        onStatChange={(key, value) => setRatchetStats((s) => ({ ...s, [key]: value }))}
      />
      <PartField
        label="Bit"
        value={bitName}
        onChange={setBitName}
        options={bitOptions}
        onPhotoUploaded={setBitPhotoUrl}
        initialPhotoUrl={initial?.bit.photoUrl}
        statFields={BIT_STAT_FIELDS}
        stats={bitStats}
        onStatChange={(key, value) => setBitStats((s) => ({ ...s, [key]: value }))}
      />

      <button
        type="submit"
        disabled={isPending || !bladeName || !ratchetName || !bitName}
        className="rounded-2xl bg-zinc-950 px-5 py-4 text-center text-base font-semibold text-white disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-950"
      >
        {isPending ? "Saving…" : isEdit ? "Save changes" : "Save to inventory"}
      </button>

      {isEdit && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="rounded-2xl border border-red-200 px-5 py-3 text-center text-sm font-semibold text-red-600 disabled:opacity-40 dark:border-red-900/50"
        >
          {isDeleting ? "Removing…" : "Delete this box"}
        </button>
      )}
      {isEdit && (
        <button
          type="button"
          onClick={() => router.push("/inventory")}
          className="text-center text-sm text-zinc-500 dark:text-zinc-400"
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
  const listId = `${label.toLowerCase()}-options`;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          {label} name
        </span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          list={listId}
          placeholder={`e.g. ${label === "Blade" ? "Phoenix Wing" : label === "Ratchet" ? "9-60" : "GF"}`}
          className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
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
            <span className="text-zinc-500 dark:text-zinc-400">{f.label}</span>
            <input
              type="number"
              inputMode="numeric"
              value={stats[f.key] ?? ""}
              onChange={(e) => onStatChange(f.key, e.target.value)}
              className="w-16 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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
