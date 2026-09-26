"use client";

import { useRef, useState } from "react";

export function PhotoCapture({
  label,
  onUploaded,
  initialUrl,
}: {
  label: string;
  onUploaded: (url: string) => void;
  initialUrl?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(initialUrl ?? null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">(
    "idle",
  );

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    setStatus("uploading");
    try {
      const res = await fetch("/api/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      if (!res.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, publicUrl } = await res.json();

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("Upload failed");

      onUploaded(publicUrl);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative flex aspect-square w-full max-w-[200px] items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-neon-cyan/40 bg-background-elevated-2 text-sm text-muted-foreground"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={label} className="h-full w-full object-cover" />
        ) : (
          <span>📷 Tap to take photo</span>
        )}
        {status === "uploading" && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs font-medium text-neon-cyan">
            Uploading…
          </span>
        )}
        {status === "error" && (
          <span className="absolute inset-x-0 bottom-0 bg-neon-red py-1 text-center text-xs text-white">
            Upload failed, tap to retry
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
