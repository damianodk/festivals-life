import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import { IconDownload, IconMapPin, IconRoute } from "@tabler/icons-react";
import { toast } from "sonner";
import type { Concert, ThemeId, UserSettings } from "../types";
import { THEME_PROFILES } from "../lib/themes";
import { buildArcPoints, computeDistances, getCityCoords, haversineKm, interpolateColor } from "../lib/geo";

interface MapViewProps {
  concerts: Concert[];
  settings: UserSettings;
  cityCoords: Record<string, [number, number]>;
  theme: ThemeId;
}

export const MapView: React.FC<MapViewProps> = ({ concerts, settings, cityCoords, theme }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseLayersRef = useRef<L.TileLayer[]>([]);
  const heatLayerRef = useRef<any>(null);
  const arcsLayerRef = useRef<L.LayerGroup | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [zoomPreset, setZoomPreset] = useState<"pl" | "eu" | "world">("eu");
  const [mapStyle, setMapStyle] = useState<"auto" | "osm" | "sat">("auto");
  const [heatRadius, setHeatRadius] = useState(44);
  const [heatIntensity, setHeatIntensity] = useState(6);
  const [showMarkers, setShowMarkers] = useState(true);
  const [showArcs, setShowArcs] = useState(true);
  const [exporting, setExporting] = useState(false);

  const profile = THEME_PROFILES[theme];

  const cityGroups = useMemo(() => {
    const groups: Record<string, { city: string; country: string; items: Concert[] }> = {};
    concerts.forEach((c) => {
      if (!c.miasto) return;
      if (!groups[c.miasto]) groups[c.miasto] = { city: c.miasto, country: c.kraj, items: [] };
      groups[c.miasto].items.push(c);
    });
    return Object.values(groups).sort((a, b) => b.items.length - a.items.length);
  }, [concerts]);

  // Init Leaflet map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [50.2, 17.5],
      zoom: 5,
      zoomControl: true,
      minZoom: 2,
      maxZoom: 16
    });
    arcsLayerRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 120);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Basemap tiles
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    baseLayersRef.current.forEach((l) => map.removeLayer(l));
    baseLayersRef.current = [];
    const add = (url: string, opts: L.TileLayerOptions = {}) => {
      const layer = L.tileLayer(url, { crossOrigin: "anonymous", ...opts }).addTo(map);
      baseLayersRef.current.push(layer);
    };
    if (mapStyle === "sat") {
      add("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: "&copy; Esri",
        maxZoom: 18
      });
    } else if (mapStyle === "osm") {
      add("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OSM",
        className: "themed-basemap",
        maxZoom: 18
      });
    } else if (profile.isDarkMap) {
      add("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
        attribution: "&copy; Esri",
        className: "themed-basemap",
        maxZoom: 16
      });
      add("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", {
        attribution: "&copy; Esri",
        className: "themed-basemap",
        opacity: 0.78,
        maxZoom: 16
      });
    } else {
      add("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
        attribution: "&copy; Esri",
        className: "themed-basemap",
        maxZoom: 16
      });
      add("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}", {
        attribution: "&copy; Esri",
        className: "themed-basemap",
        opacity: 0.82,
        maxZoom: 16
      });
    }
  }, [mapStyle, profile.isDarkMap]);

  // Heat, Arcs, Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !arcsLayerRef.current || !markersLayerRef.current) return;
    const sz = map.getSize();
    if (!sz || sz.x === 0 || sz.y === 0) return;

    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }
    arcsLayerRef.current.clearLayers();
    markersLayerRef.current.clearLayers();

    const home = settings.hometown_coords || [52.4064, 16.9252];
    const maxC = cityGroups[0]?.items.length || 1;
    const heatPts: [number, number, number][] = [];

    cityGroups.forEach((g) => {
      const coords = getCityCoords(g.city, cityCoords);
      if (!coords) return;
      const lRatio = maxC > 1 ? g.items.length / maxC : 1;
      const col = interpolateColor(Math.pow(lRatio, 0.72), profile.colorStops);
      const reps = Math.max(1, Math.min(6, Math.round(1 + lRatio * 5)));
      for (let k = 0; k < reps; k++) heatPts.push([coords[0], coords[1], 0.22 + 0.78 * lRatio]);

      const distKm = Math.round(haversineKm(home[0], home[1], coords[0], coords[1]));
      if (showArcs && distKm > 18) {
        L.polyline(buildArcPoints(home, coords), {
          color: col,
          weight: 1.5 + lRatio * 1.4,
          opacity: 0.48,
          dashArray: "5 7"
        })
          .bindTooltip(`${settings.hometown} → ${g.city}: ${distKm.toLocaleString("pl-PL")} km`, { sticky: true })
          .addTo(arcsLayerRef.current!);
      }

      if (showMarkers) {
        const r = Math.round(7 + 20 * lRatio);
        const artistsPreview = [...new Set(g.items.map((i) => i.artysta))].slice(0, 8).join(", ");
        L.circleMarker(coords, {
          radius: r,
          color: profile.markerStroke,
          weight: 2,
          fillColor: col,
          fillOpacity: 0.8
        })
          .bindPopup(
            `<div style="font-family:Syne,sans-serif;font-weight:800;font-size:15px;">${g.city}</div>` +
              `<div style="font-family:'JetBrains Mono',monospace;font-size:12px;color:${col};font-weight:700;margin:2px 0 6px;">${g.items.length} koncertów • ${distKm.toLocaleString("pl-PL")} km</div>` +
              `<div style="font-size:11px;opacity:0.78;">${artistsPreview}</div>`
          )
          .addTo(markersLayerRef.current!);

        if (g.items.length >= 6) {
          L.marker(coords, {
            interactive: false,
            icon: L.divIcon({
              className: "city-count-label",
              html: `<div style="color:${profile.labelTextColor};line-height:${r * 2}px;">${g.items.length}</div>`,
              iconSize: [r * 2, r * 2],
              iconAnchor: [r, r]
            })
          }).addTo(markersLayerRef.current!);
        }
      }
    });

    if ((L as any).heatLayer && heatPts.length) {
      heatLayerRef.current = (L as any)
        .heatLayer(heatPts, {
          radius: heatRadius,
          blur: Math.max(12, Math.round(heatRadius * 0.68)),
          maxZoom: 11,
          max: Math.max(0.45, 5.2 - heatIntensity * 0.46),
          minOpacity: Math.min(0.85, 0.16 + heatIntensity * 0.062),
          gradient: profile.heatGradient
        })
        .addTo(map);
    }
  }, [cityGroups, cityCoords, settings, heatRadius, heatIntensity, showMarkers, showArcs, profile]);

  const applyZoom = (pr: "pl" | "eu" | "world") => {
    setZoomPreset(pr);
    const map = mapRef.current;
    if (!map) return;
    if (pr === "pl") map.flyTo([52.1, 19.0], 6, { duration: 0.75 });
    else if (pr === "eu") map.flyTo([49.8, 17.5], 5, { duration: 0.75 });
    else map.flyTo([30, 52], 3, { duration: 0.85 });
  };

  const exportHeatmapPNG = async () => {
    const map = mapRef.current;
    const mapEl = containerRef.current;
    if (!map || !mapEl) return;
    setExporting(true);
    toast.info("Generuję HeatMapę w jakości HD (Retina PNG)...");

    try {
      const rect = mapEl.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      const scale = Math.min(3, Math.max(2, Math.round(2800 / Math.max(w, 600))));

      const canvas = document.createElement("canvas");
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      const cs = getComputedStyle(document.documentElement);
      const mapBg = (cs.getPropertyValue("--map-bg") || profile.bg).trim();
      const mapFilter = (cs.getPropertyValue("--map-filter") || "none").trim();

      ctx.fillStyle = mapBg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 1. Basemap tiles
      const tileImgs = Array.from(mapEl.querySelectorAll<HTMLImageElement>(".leaflet-tile-pane img.leaflet-tile"));
      ctx.save();
      if (mapStyle !== "sat" && mapFilter && mapFilter !== "none") ctx.filter = mapFilter;
      for (const img of tileImgs) {
        if (!img.complete || img.naturalWidth === 0) continue;
        const tr = img.getBoundingClientRect();
        const layerEl = img.closest(".leaflet-layer");
        const op = layerEl ? parseFloat(getComputedStyle(layerEl).opacity || "1") : 1;
        ctx.globalAlpha = isNaN(op) ? 1 : op;
        try {
          ctx.drawImage(
            img,
            (tr.left - rect.left) * scale,
            (tr.top - rect.top) * scale,
            tr.width * scale,
            tr.height * scale
          );
        } catch (_) {}
      }
      ctx.restore();

      // 2. HeatLayer canvas
      const heatCanvas = mapEl.querySelector<HTMLCanvasElement>("canvas.leaflet-heatmap-layer");
      if (heatCanvas) {
        const hr = heatCanvas.getBoundingClientRect();
        ctx.drawImage(
          heatCanvas,
          (hr.left - rect.left) * scale,
          (hr.top - rect.top) * scale,
          hr.width * scale,
          hr.height * scale
        );
      }

      // 3. Vector Arcs & Markers
      const home = settings.hometown_coords || [52.4064, 16.9252];
      const maxC = cityGroups[0]?.items.length || 1;
      if (showArcs) {
        cityGroups.forEach((g) => {
          const coords = getCityCoords(g.city, cityCoords);
          if (!coords) return;
          const distKm = Math.round(haversineKm(home[0], home[1], coords[0], coords[1]));
          if (distKm <= 18) return;
          const lRatio = maxC > 1 ? g.items.length / maxC : 1;
          const col = interpolateColor(Math.pow(lRatio, 0.72), profile.colorStops);
          const pts = buildArcPoints(home, coords, 32);
          ctx.save();
          ctx.beginPath();
          pts.forEach((ll, i) => {
            const pt = map.latLngToContainerPoint(ll);
            if (i === 0) ctx.moveTo(pt.x * scale, pt.y * scale);
            else ctx.lineTo(pt.x * scale, pt.y * scale);
          });
          ctx.strokeStyle = col;
          ctx.globalAlpha = 0.55;
          ctx.lineWidth = (1.5 + lRatio * 1.4) * scale;
          ctx.setLineDash([5 * scale, 7 * scale]);
          ctx.stroke();
          ctx.restore();
        });
      }

      if (showMarkers) {
        cityGroups.forEach((g) => {
          const coords = getCityCoords(g.city, cityCoords);
          if (!coords) return;
          const pt = map.latLngToContainerPoint(coords);
          const lRatio = maxC > 1 ? g.items.length / maxC : 1;
          const col = interpolateColor(Math.pow(lRatio, 0.72), profile.colorStops);
          const r = Math.round(7 + 20 * lRatio) * scale;

          ctx.save();
          ctx.beginPath();
          ctx.arc(pt.x * scale, pt.y * scale, r, 0, Math.PI * 2);
          ctx.fillStyle = col;
          ctx.globalAlpha = 0.82;
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.lineWidth = 2 * scale;
          ctx.strokeStyle = profile.markerStroke;
          ctx.stroke();

          if (g.items.length >= 6) {
            ctx.fillStyle = profile.labelTextColor;
            ctx.font = `700 ${11 * scale}px "JetBrains Mono", monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(g.items.length), pt.x * scale, pt.y * scale);
          }
          ctx.restore();
        });
      }

      // 4. Crisp Editorial Badge
      const pad = 16 * scale;
      const boxW = Math.min(315 * scale, canvas.width - pad * 2);
      const boxH = 74 * scale;
      const bx = pad;
      const by = canvas.height - boxH - pad;

      ctx.save();
      ctx.fillStyle = profile.surface;
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, boxW, boxH, 14 * scale);
      else ctx.rect(bx, by, boxW, boxH);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1.2 * scale;
      ctx.strokeStyle = profile.accent;
      ctx.stroke();

      const { totalKm } = computeDistances(concerts, home, cityCoords);
      ctx.fillStyle = profile.text;
      ctx.font = `800 ${12 * scale}px "Syne", sans-serif`;
      ctx.fillText("FEST LIFE", bx + 14 * scale, by + 22 * scale);

      ctx.fillStyle = profile.muted;
      ctx.font = `600 ${9.5 * scale}px "JetBrains Mono", monospace`;
      ctx.fillText(
        `${concerts.length} koncertów • ${cityGroups.length} miast • ${totalKm.toLocaleString("pl-PL")} km`,
        bx + 14 * scale,
        by + 39 * scale
      );

      const barX = bx + 14 * scale;
      const barY = by + 51 * scale;
      const barW = boxW - 28 * scale;
      const barH = 7 * scale;
      const grad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
      profile.colorStops.forEach(([stop, color]) => grad.addColorStop(stop, color));
      ctx.fillStyle = grad;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(barX, barY, barW, barH, 4 * scale);
      else ctx.rect(barX, barY, barW, barH);
      ctx.fill();
      ctx.restore();

      const fname = `Fest_Life_HeatMap_${new Date().toISOString().slice(0, 10)}.png`;
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fname;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        toast.success(`Zapisano HeatMapę HD (${canvas.width}×${canvas.height}px)!`);
      }, "image/png");
    } catch (e: any) {
      toast.error("Błąd eksportu mapy: " + e.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-extrabold tracking-tight">HeatMapa Świata</h2>
          <p className="text-xs text-[var(--text-muted)]">Gęstość koncertów i trasy z {settings.hometown}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-0.5 text-xs">
            {(["pl", "eu", "world"] as const).map((pr) => (
              <button
                key={pr}
                type="button"
                onClick={() => applyZoom(pr)}
                className={`rounded-lg px-2.5 py-1.5 font-semibold transition ${
                  zoomPreset === pr ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "text-[var(--text-muted)]"
                }`}
              >
                {pr === "pl" ? "Polska" : pr === "eu" ? "Europa" : "Świat"}
              </button>
            ))}
          </div>

          <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-0.5 text-xs">
            {(["auto", "osm", "sat"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setMapStyle(st)}
                className={`rounded-lg px-2.5 py-1.5 font-semibold transition ${
                  mapStyle === st ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "text-[var(--text-muted)]"
                }`}
              >
                {st === "auto" ? "Auto" : st === "osm" ? "OSM" : "Satelita"}
              </button>
            ))}
          </div>

          <label className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs text-[var(--text-muted)]">
            <span>Promień</span>
            <input
              type="range"
              min={15}
              max={85}
              value={heatRadius}
              onChange={(e) => setHeatRadius(Number(e.target.value))}
              className="w-16 accent-[var(--accent)]"
            />
            <span className="font-mono text-[11px] font-bold text-[var(--text)]">{heatRadius}</span>
          </label>

          <label className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs text-[var(--text-muted)]">
            <span>Moc</span>
            <input
              type="range"
              min={1}
              max={10}
              value={heatIntensity}
              onChange={(e) => setHeatIntensity(Number(e.target.value))}
              className="w-16 accent-[var(--accent)]"
            />
            <span className="font-mono text-[11px] font-bold text-[var(--text)]">{heatIntensity}</span>
          </label>

          <button
            type="button"
            onClick={() => setShowMarkers((v) => !v)}
            className={`fl-btn !text-xs ${showMarkers ? "!border-[var(--border-strong)]" : "opacity-60"}`}
          >
            <IconMapPin size={14} stroke={1.75} /> Punkty: {showMarkers ? "WŁ" : "WYŁ"}
          </button>

          <button
            type="button"
            onClick={() => setShowArcs((v) => !v)}
            className={`fl-btn !text-xs ${showArcs ? "!border-[var(--border-strong)]" : "opacity-60"}`}
          >
            <IconRoute size={14} stroke={1.75} /> Trasy: {showArcs ? "WŁ" : "WYŁ"}
          </button>

          <button
            type="button"
            disabled={exporting}
            onClick={exportHeatmapPNG}
            className="fl-btn fl-btn-primary !text-xs"
          >
            <IconDownload size={14} stroke={1.75} />
            <span>{exporting ? "Generuję..." : "Zapisz PNG (HD)"}</span>
          </button>
        </div>
      </div>

      <div className="relative h-[520px] sm:h-[600px] overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--map-bg)]">
        <div ref={containerRef} className="h-full w-full" />

        {/* Top Cities Overlay */}
        <div className="absolute right-3 top-3 z-[500] hidden w-52 max-h-72 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]/90 p-3 backdrop-blur-md md:block">
          <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            Top Miasta
          </div>
          {cityGroups.slice(0, 10).map((g) => {
            const coords = getCityCoords(g.city, cityCoords);
            return (
              <button
                key={g.city}
                type="button"
                onClick={() => coords && mapRef.current?.flyTo(coords, 9, { duration: 0.75 })}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-[var(--surface-2)]"
              >
                <span className="truncate">{g.city}</span>
                <span className="font-mono text-[11px] font-bold text-[var(--accent)]">{g.items.length}</span>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-[500] min-w-[230px] rounded-xl border border-[var(--border)] bg-[var(--surface)]/90 px-3.5 py-2.5 backdrop-blur-md">
          <div className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            Gęstość koncertów
          </div>
          <div
            className="mb-1.5 h-2 rounded-full"
            style={{
              background: `linear-gradient(90deg, ${profile.colorStops.map((s) => s[1]).join(", ")})`
            }}
          />
          <div className="flex justify-between font-mono text-[10px] text-[var(--text-muted)]">
            <span>1 koncert</span>
            <span>Średnio</span>
            <span>Festiwal</span>
          </div>
        </div>
      </div>
    </div>
  );
};
