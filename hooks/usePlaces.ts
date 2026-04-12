import { useState, useEffect, useRef, useCallback } from "react";
import type { FeatureCollection } from "geojson";

interface Options {
  lat: number;
  lng: number;
  radius?: number;
  category?: string;
  enabled?: boolean;
}

export function usePlaces({
  lat, lng, radius = 1000, category, enabled = true,
}: Options) {
  const [data, setData]       = useState<FeatureCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const abortRef              = useRef<AbortController>(undefined);
  const timerRef              = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetch_ = useCallback(async () => {
    if (!enabled) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);

    const qs = new URLSearchParams({
      lat: String(lat), lng: String(lng), radius: String(radius),
      ...(category && { category }),
    });
    try {
      const res = await fetch(`/api/places/nearby?${qs}`, {
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [lat, lng, radius, category, enabled]);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(fetch_, 300);
    return () => clearTimeout(timerRef.current);
  }, [fetch_]);

  return { data, loading, error, refetch: fetch_ };
}