"use client";

import { useState, useTransition } from "react";
import { PhotoCapture } from "@/components/photo-capture";
import { addBoxToInventory } from "@/app/inventory/actions";

type PartOption = { id: string; name: string };

export function AddBoxForm({
  bladeOptions,
  ratchetOptions,
  bitOptions,
}: {
  bladeOptions: PartOption[];
  ratchetOptions: PartOption[];
  bitOptions: PartOption[];
}) {
  const [boxCode, setBoxCode] = useState("");
  const [boxName, setBoxName] = useState("");
  const [bladeName, setBladeName] = useState("");
  const [ratchetName, setRatchetName] = useState("");
  const [bitName, setBitName] = useState("");

  const [boxPhotoUrl, setBoxPhotoUrl] = useState<string | null>(null);
  const [bladePhotoUrl, setBladePhotoUrl] = useState<string | null>(null);
  const [ratchetPhotoUrl, setRatchetPhotoUrl] = useState<string | null>(null);
  const [bitPhotoUrl, setBitPhotoUrl] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("boxCode", boxCode);
    fd.set("boxName", boxName);
    if (boxPhotoUrl) fd.set("boxPhotoUrl", boxPhotoUrl);
    fd.set("bladeName", bladeName);
    fd.set("ratchetName", ratchetName);
    fd.set("bitName", bitName);
    if (bladePhotoUrl) fd.set("bladePhotoUrl", bladePhotoUrl);
    if (ratchetPhotoUrl) fd.set("ratchetPhotoUrl", ratchetPhotoUrl);
    if (bitPhotoUrl) fd.set("bitPhotoUrl", bitPhotoUrl);

    startTransition(() => {
      addBoxToInventory(fd);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 pb-10">
      <PhotoCapture label="Box photo (optional)" onUploaded={setBoxPhotoUrl} />

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
      />
      <PartField
        label="Ratchet"
        value={ratchetName}
        onChange={setRatchetName}
        options={ratchetOptions}
        onPhotoUploaded={setRatchetPhotoUrl}
      />
      <PartField
        label="Bit"
        value={bitName}
        onChange={setBitName}
        options={bitOptions}
        onPhotoUploaded={setBitPhotoUrl}
      />

      <button
        type="submit"
        disabled={isPending || !bladeName || !ratchetName || !bitName}
        className="rounded-2xl bg-zinc-950 px-5 py-4 text-center text-base font-semibold text-white disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-950"
      >
        {isPending ? "Saving…" : "Save to inventory"}
      </button>
    </form>
  );
}

function PartField({
  label,
  value,
  onChange,
  options,
  onPhotoUploaded,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: PartOption[];
  onPhotoUploaded: (url: string) => void;
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
      <PhotoCapture label={`${label} photo`} onUploaded={onPhotoUploaded} />
    </div>
  );
}
