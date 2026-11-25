import type { Concert } from "../types";

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const r = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(r(lat2 - lat1) / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getCityCoords(
  city: string | undefined | null,
  coordsMap: Record<string, [number, number]>
): [number, number] | null {
  if (!city) return null;
  if (coordsMap[city]) return coordsMap[city];
  const found = Object.keys(coordsMap).find((k) => k.toLowerCase() === city.toLowerCase());
  return found ? coordsMap[found] : null;
}

export async function geocodeCityOnline(
  city: string,
  country = ""
): Promise<[number, number] | null> {
  if (!city) return null;
  try {
    const q = encodeURIComponent(city + (country ? `, ${country}` : ""));
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`);
    const data = await res.json();
    if (data?.[0]) {
      return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    }
  } catch (_) {}
  return null;
}

export function computeDistances(
  list: Concert[],
  homeCoords: [number, number],
  coordsMap: Record<string, [number, number]>
) {
  const seenTrips = new Set<string>();
  const artistKm: Record<string, number> = {};
  const artistSeen: Record<string, Set<string>> = {};
  let totalKm = 0;
  let farthest = { city: "—", country: "", artist: "", km: 0 };

  list.forEach((c) => {
    const coords = getCityCoords(c.miasto, coordsMap);
    if (!coords) return;
    const d = haversineKm(homeCoords[0], homeCoords[1], coords[0], coords[1]);
    if (d > farthest.km) {
      farthest = {
        city: c.miasto,
        country: c.kraj || "",
        artist: c.artysta || "",
        km: Math.round(d)
      };
    }
    const tk = `${c.rok}|${c.event}|${c.miasto}`;
    if (!seenTrips.has(tk) && d > 15) {
      seenTrips.add(tk);
      totalKm += d * 2;
    }
    if (c.artysta && d > 15) {
      if (!artistSeen[c.artysta]) artistSeen[c.artysta] = new Set();
      if (!artistSeen[c.artysta].has(tk)) {
        artistSeen[c.artysta].add(tk);
        artistKm[c.artysta] = (artistKm[c.artysta] || 0) + Math.round(d * 2);
      }
    }
  });

  return {
    totalKm: Math.round(totalKm),
    farthest,
    artistKmSorted: Object.entries(artistKm).sort((a, b) => b[1] - a[1])
  };
}

export function buildArcPoints(
  from: [number, number],
  to: [number, number],
  steps = 28
): [number, number][] {
  const [lat1, lng1] = from;
  const [lat2, lng2] = to;
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  const bend = Math.min(14, Math.hypot(dLat, dLng) * 0.22);
  const midLat = (lat1 + lat2) / 2 + bend * 0.55;
  const midLng = (lng1 + lng2) / 2 - dLat * 0.12;
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push([
      (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * midLat + t * t * lat2,
      (1 - t) * (1 - t) * lng1 + 2 * (1 - t) * t * midLng + t * t * lng2
    ]);
  }
  return pts;
}

export function interpolateColor(ratio: number, stops: [number, string][]): string {
  const hexToRgb = (h: string) => {
    const c = h.replace("#", "");
    return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
  };
  const t = Math.max(0, Math.min(1, ratio));
  for (let i = 0; i < stops.length - 1; i++) {
    const [p1, c1] = stops[i];
    const [p2, c2] = stops[i + 1];
    if (t >= p1 && t <= p2) {
      const l = p2 === p1 ? 0 : (t - p1) / (p2 - p1);
      const [r1, g1, b1] = hexToRgb(c1);
      const [r2, g2, b2] = hexToRgb(c2);
      return `rgb(${Math.round(r1 + (r2 - r1) * l)},${Math.round(g1 + (g2 - g1) * l)},${Math.round(b1 + (b2 - b1) * l)})`;
    }
  }
  return stops[stops.length - 1][1];
}

export function topEntry(obj: Record<string, number>): [string, number] {
  return Object.entries(obj).sort((a, b) => b[1] - a[1])[0] || ["—", 0];
}

export function sanitizeSlug(s: string): string {
  return String(s || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

export function setlistSearchUrl(c: Partial<Concert>): string {
  const q = encodeURIComponent(`${c.artysta || ""} ${c.miasto || ""} ${c.rok || ""}`.trim());
  return `https://www.setlist.fm/search?query=${q}`;
}

export function artistInitials(name: string): string {
  return String(name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase();
}
