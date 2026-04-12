import dynamic from "next/dynamic";

const Map = dynamic(() => import("@/components/Map"), {
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
      <h1 className="text-2xl font-semibold mb-4">Simple Maps</h1>
      <div className="h-150 w-full rounded-xl overflow-hidden shadow-lg">
        <Map />
      </div>
    </main>
  );
}