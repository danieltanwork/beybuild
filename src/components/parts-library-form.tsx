"use client";

import { useState } from "react";
import { PhotoCapture } from "@/components/photo-capture";
import { savePartSheetPhotos } from "@/app/inventory/actions";

type PartType = "blade" | "ratchet" | "bit";

type SheetItem = {
  code: string;
  croppedPhotoUrl: string;
  matched: boolean;
  selected: boolean;
};

const partTypeLabel: Record<PartType, string> = {
  blade: "Blade",
  ratchet: "Ratchet",
  bit: "Bit",
};

export function PartsLibraryForm() {
  const [partType, setPartType] = useState<PartType>("ratchet");
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const [items, setItems] = useState<SheetItem[]>([]);
  const [status, setStatus] = useState<
    "idle" | "detecting" | "detected" | "error" | "saving" | "saved"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleDetect() {
    if (!sheetUrl) return;
    setStatus("detecting");
    setError(null);
    try {
      const res = await fetch("/api/analyze-part-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetUrl, partType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't read the sheet");

      const detected: SheetItem[] = (data.items ?? []).map(
        (item: { code: string; croppedPhotoUrl: string; matched: boolean }) => ({
          ...item,
          selected: item.matched,
        }),
      );
      setItems(detected);
      setStatus("detected");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function toggleItem(code: string) {
    setItems((prev) =>
      prev.map((it) => (it.code === code ? { ...it, selected: !it.selected } : it)),
    );
  }

  async function handleSave() {
    const selected = items.filter((it) => it.selected && it.matched);
    if (selected.length === 0) return;
    setStatus("saving");
    try {
      await savePartSheetPhotos(
        partType,
        selected.map(({ code, croppedPhotoUrl }) => ({ code, croppedPhotoUrl })),
      );
      setStatus("saved");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Couldn't save these photos");
    }
  }

  const selectedCount = items.filter((it) => it.selected && it.matched).length;

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="neon-card flex flex-col gap-3 rounded-2xl p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-muted-foreground">Part type on this sheet</span>
          <select
            value={partType}
            onChange={(e) => {
              setPartType(e.target.value as PartType);
              setItems([]);
              setStatus("idle");
            }}
            className="rounded-lg border border-border bg-background-elevated px-3 py-2 text-foreground focus:border-neon-cyan focus:outline-none"
          >
            <option value="blade">Blade</option>
            <option value="ratchet">Ratchet</option>
            <option value="bit">Bit</option>
          </select>
        </label>

        <PhotoCapture label="Reference sheet photo" onUploaded={setSheetUrl} />

        <button
          type="button"
          onClick={handleDetect}
          disabled={!sheetUrl || status === "detecting"}
          className="glow-fuchsia rounded-xl bg-gradient-to-r from-neon-fuchsia to-neon-violet px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
        >
          {status === "detecting" ? "Reading sheet…" : "✨ Detect parts"}
        </button>
        {status === "error" && (
          <p className="text-xs text-neon-red">{error ?? "Something went wrong"}</p>
        )}
      </div>

      {items.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Found {items.length} {partTypeLabel[partType].toLowerCase()} icon
            {items.length === 1 ? "" : "s"}. Review each crop before saving — uncheck
            anything that doesn&rsquo;t look right. Codes not already in your parts
            catalog are shown but can&rsquo;t be saved.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {items.map((item) => (
              <label
                key={item.code}
                className={`flex flex-col items-center gap-1 rounded-xl border p-2 ${
                  item.matched
                    ? "border-border"
                    : "border-dashed border-muted-foreground/40 opacity-60"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.croppedPhotoUrl}
                  alt={item.code}
                  className="aspect-square w-full rounded-lg border border-border object-cover"
                />
                <span className="text-xs font-semibold text-foreground">{item.code}</span>
                {item.matched ? (
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={() => toggleItem(item.code)}
                    className="h-4 w-4 accent-neon-cyan"
                  />
                ) : (
                  <span className="text-center text-[10px] text-muted-foreground">
                    Not in catalog
                  </span>
                )}
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={selectedCount === 0 || status === "saving"}
            className="glow-cyan rounded-2xl bg-gradient-to-r from-neon-cyan to-neon-violet px-5 py-4 text-center text-base font-bold text-background disabled:opacity-40"
          >
            {status === "saving"
              ? "Saving…"
              : `Save ${selectedCount} photo${selectedCount === 1 ? "" : "s"} to library`}
          </button>
          {status === "saved" && (
            <p className="text-center text-xs text-neon-lime">
              Saved — these now show up everywhere that part appears.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
