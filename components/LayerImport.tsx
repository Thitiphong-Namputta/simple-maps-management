"use client";

import { useRef, useState } from "react";

type Status = "idle" | "loading" | "ok" | "error";

export default function LayerImport({ onImported }: { onImported?: () => void }) {
  const inputRef             = useRef<HTMLInputElement>(null);
  const [status, setStatus]  = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".geojson") && !file.name.endsWith(".json")) {
      setStatus("error");
      setMessage("ต้องเป็นไฟล์ .geojson หรือ .json");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      const res = await fetch("/api/layers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setStatus("ok");
      setMessage(`นำเข้าสำเร็จ ${data.imported ?? 0} features`);
      onImported?.();
    } catch (e) {
      setStatus("error");
      setMessage((e as Error).message);
    }

    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".geojson,.json"
        aria-label="นำเข้าไฟล์ GeoJSON"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={status === "loading"}
        className="text-xs font-medium px-3 py-1.5 rounded-md bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100 disabled:opacity-50 transition-colors"
      >
        {status === "loading" ? "กำลังนำเข้า..." : "นำเข้า GeoJSON"}
      </button>
      {message && (
        <span className={`text-xs ${status === "ok" ? "text-teal-600" : "text-red-500"}`}>
          {message}
        </span>
      )}
    </div>
  );
}