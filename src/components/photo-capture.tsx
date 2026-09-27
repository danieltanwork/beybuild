"use client";

import { useRef, useState } from "react";

export function PhotoCapture({
  label,
  onUploaded,
  initialUrl,
  size = "lg",
}: {
  label: string;
  onUploaded: (url: string) => void;
  initialUrl?: string | null;
  // "sm" is a fixed 80px square with no caption, meant to sit inline next
  // to other fields (e.g. a part's name/stats) instead of stacked above
  // them — "lg" is the original full-width-up-to-200px block with a label.
  size?: "sm" | "lg";
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

  const button = (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      aria-label={label}
      className={
        size === "sm"
          ? "relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-neon-cyan/40 bg-background-elevated-2 text-lg text-muted-foreground"
          : "relative flex aspect-square w-full max-w-[200px] items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-neon-cyan/40 bg-background-elevated-2 text-sm text-muted-foreground"
      }
    >
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt={label} className="h-full w-full object-cover" />
      ) : size === "sm" ? (
        <span>📷</span>
      ) : (
        <span>📷 Tap to take photo</span>
      )}
      {status === "uploading" && (
        <span
          className={`absolute inset-0 flex items-center justify-center bg-black/60 font-medium text-neon-cyan ${size === "sm" ? "text-[9px]" : "text-xs"}`}
        >
          {size === "sm" ? "…" : "Uploading…"}
        </span>
      )}
      {status === "error" && (
        <span
          className={`absolute inset-x-0 bottom-0 bg-neon-red text-center text-white ${size === "sm" ? "py-0.5 text-[8px]" : "py-1 text-xs"}`}
        >
          {size === "sm" ? "Failed" : "Upload failed, tap to retry"}
        </span>
      )}
    </button>
  );

  return (
    <div className={size === "sm" ? "" : "flex flex-col gap-2"}>
      {size === "lg" && (
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      )}
      {button}
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
