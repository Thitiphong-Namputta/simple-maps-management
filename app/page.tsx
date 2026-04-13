"use client";

import dynamic from "next/dynamic";
import LayerImport from "@/components/LayerImport";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-gray-100 animate-pulse rounded-xl flex items-center justify-center">
      <p className="text-gray-400 text-sm">กำลังโหลดแผนที่...</p>
    </div>
  ),
});

export default function Home() {
  return (
    <main className="p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Simple Maps</h1>
        <LayerImport />
      </div>
      <div className="h-150 w-full rounded-xl overflow-hidden shadow-lg">
        <MapView />
      </div>
    </main>
  );
}