import { useState, useEffect, useRef } from "react";
import type { FeatureCollection } from "geojson";
import type { LatLngBounds } from "leaflet";

export function useMapLayers(bounds: LatLngBounds | null) {
  const [places, setPlaces] = useState<FeatureCollection | null>(null);
  const [routes, setRoutes] = useState<FeatureCollection | null>(null);
  const [areas,  setAreas]  = useState<FeatureCollection | null>(null);
  const prevKey             = useRef("");

  useEffect(() => {
    if (!bounds) return;
    const key = bounds.toBBoxString();
    if (key === prevKey.current) return;
    prevKey.current = key;

    const [w, s, e, n] = [
      bounds.getWest(), bounds.getSouth(),
      bounds.getEast(), bounds.getNorth(),
    ];
    const qs = `minLng=${w}&minLat=${s}&maxLng=${e}&maxLat=${n}`;

    Promise.all([
      fetch(`/api/places/viewport?${qs}`).then((r) => r.json()),
      fetch(`/api/routes?${qs}`).then((r) => r.json()),
      fetch(`/api/areas?${qs}`).then((r) => r.json()),
    ]).then(([p, r, a]) => {
      setPlaces(p);
      setRoutes(r);
      setAreas(a);
    });
  }, [bounds]);

  return { places, routes, areas };
}