"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";

/**
 * FlyTo — imperative view control inside MapContainer
 *
 * Usage: place inside <Map> as a child
 *   <Map>
 *     <FlyTo target={[13.75, 100.5]} zoom={15} />
 *   </Map>
 *
 * target changes trigger map.flyTo() — never mutate MapContainer props directly.
 */
export default function FlyTo({
  target,
  zoom = 15,
}: {
  target?: [number, number];
  zoom?: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, zoom);
  }, [map, target, zoom]);
  return null;
}