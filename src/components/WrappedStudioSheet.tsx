import React, { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Text, Group, Image as KonvaImage, Transformer, Circle } from "react-konva";
import type Konva from "konva";
import { IconDownload, IconPhoto, IconTrash, IconVideo, IconRefresh } from "@tabler/icons-react";
import { toast } from "sonner";
import type { Concert, ThemeId, UserSettings } from "../types";
import { THEME_PROFILES } from "../lib/themes";
import { computeDistances, topEntry } from "../lib/geo";
import { BottomSheet } from "./ui/BottomSheet";

interface WrappedStudioSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allConcerts: Concert[];
  settings: UserSettings;
  cityCoords: Record<string, [number, number]>;
  theme: ThemeId;
}

interface TileItem {
  id: string;
  on: boolean;
  lbl: string;
  val: string;
  sub: string;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

const LOGICAL_W = 1080;
const LOGICAL_H = 1920;
const PREVIEW_W = 300;
const PREVIEW_SCALE = PREVIEW_W / LOGICAL_W;
const PREVIEW_H = Math.round(LOGICAL_H * PREVIEW_SCALE);

export const WrappedStudioSheet: React.FC<WrappedStudioSheetProps> = ({
  open,
  onOpenChange,
  allConcerts,
  settings,
  cityCoords,
  theme
}) => {
  const years = useMemo(
    () => [...new Set(allConcerts.map((c) => c.rok).filter(Boolean) as number[])].sort((a, b) => b - a),
    [allConcerts]
  );

  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [title, setTitle] = useState("FEST LIFE");
  const [subtitle, setSubtitle] = useState("WRAPPED • CAŁA HISTORIA");
  const [footer, setFooter] = useState("FEST LIFE • damianodk.github.io/festivals-life");
  const [dimPct, setDimPct] = useState(42);
  const [tileOp, setTileOp] = useState(86);

  const [bgType, setBgType] = useState<"none" | "image" | "video">("none");
  const [bgImageEl, setBgImageEl] = useState<HTMLImageElement | null>(null);
  const [bgVideoEl, setBgVideoEl] = useState<HTMLVideoElement | null>(null);
  const bgUrlRef = useRef<string>("");
  const [bgZoom, setBgZoom] = useState(1);
  const [bgPos, setBgPos] = useState({ x: 0, y: 0 });
  const [videoFrameTick, setVideoFrameTick] = useState(0);

  const [tiles, setTiles] = useState<TileItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);

  const stageRef = useRef<Konva.Stage | null>(null);
  const trRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef<Record<string, Konva.Node | null>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const profile = THEME_PROFILES[theme];

  const stats = useMemo(() => {
    const list = selectedYear === "all" ? allConcerts : allConcerts.filter((c) => String(c.rok) === selectedYear);
    const byA: Record<string, number> = {};
    const byC: Record<string, number> = {};
    const byG: Record<string, number> = {};
    const byCr: Record<string, number> = {};
    list.forEach((c) => {
      if (c.artysta) byA[c.artysta] = (byA[c.artysta] || 0) + 1;
      if (c.miasto) byC[c.miasto] = (byC[c.miasto] || 0) + 1;
      if (c.gatunek) byG[c.gatunek] = (byG[c.gatunek] || 0) + 1;
      if (c.z_kim) byCr[c.z_kim] = (byCr[c.z_kim] || 0) + 1;
    });
    const { totalKm, farthest, artistKmSorted } = computeDistances(list, settings.hometown_coords, cityCoords);
    const [tA, tAC] = topEntry(byA);
    const [tC, tCC] = topEntry(byC);
    const [tG] = topEntry(byG);
    const [tCr] = topEntry(byCr);
    const topKm = artistKmSorted[0] || ["—", 0];
    const countries = new Set(list.map((c) => c.kraj).filter(Boolean)).size;
    return { count: list.length, countries, totalKm, farthest, tA, tAC, tC, tCC, tG, tCr, topKm };
  }, [allConcerts, selectedYear, settings.hometown_coords, cityCoords]);

  const buildDefaultTiles = () => {
    const cardW = 442, cardH = 264, gap = 36, startX = 80, startY = 560;
    const raw = [
      { id: "t1", lbl: "TOP ARTYSTA", val: stats.tA, sub: `${stats.tAC}× na żywo` },
      { id: "t2", lbl: "KM ZA ARTYSTĄ", val: String(stats.topKm[0]), sub: `${Number(stats.topKm[1]).toLocaleString("pl-PL")} km` },
      { id: "t3", lbl: "TOP MIASTO", val: stats.tC, sub: `${stats.tCC} koncertów` },
      { id: "t4", lbl: "TOP GATUNEK", val: stats.tG, sub: "ulubione brzmienie" },
      { id: "t5", lbl: "NAJWIERNIEJSZA EKIPA", val: stats.tCr, sub: "wspólne wyjazdy" },
      { id: "t6", lbl: "NAJDALSZA PODRÓŻ", val: stats.farthest.city, sub: `${stats.farthest.km.toLocaleString("pl-PL")} km` }
    ];
    return raw.map((r, i) => ({
      ...r,
      on: true,
      x: startX + (i % 2) * (cardW + gap),
      y: startY + Math.floor(i / 2) * (cardH + gap),
      scaleX: 1,
      scaleY: 1,
      rotation: 0
    }));
  };

  useEffect(() => {
    setSubtitle(selectedYear === "all" ? "WRAPPED • CAŁA HISTORIA" : `WRAPPED • SEZON ${selectedYear}`);
    setTiles(buildDefaultTiles());
    setSelectedId(null);
  }, [selectedYear, stats.count, settings.hometown]);

  // Attach Konva Transformer to selected tile
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    if (selectedId && nodeRefs.current[selectedId]) {
      tr.nodes([nodeRefs.current[selectedId]!]);
      tr.getLayer()?.batchDraw();
    } else {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedId, tiles]);

  // Animation loop when video background is active
  useEffect(() => {
    if (!open || bgType !== "video" || !bgVideoEl) return;
    let raf = 0;
    const step = () => {
      stageRef.current?.batchDraw();
      setVideoFrameTick((t) => (t + 1) % 10000);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [open, bgType, bgVideoEl]);

  const clearMedia = () => {
    if (bgVideoEl) {
      try { bgVideoEl.pause(); } catch (_) {}
    }
    if (bgUrlRef.current) {
      URL.revokeObjectURL(bgUrlRef.current);
      bgUrlRef.current = "";
    }
    setBgVideoEl(null);
    setBgImageEl(null);
    setBgType("none");
    setBgZoom(1);
    setBgPos({ x: 0, y: 0 });
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    clearMedia();
    const url = URL.createObjectURL(file);
    bgUrlRef.current = url;

    if (file.type.startsWith("video/")) {
      const vid = document.createElement("video");
      vid.src = url;
      vid.muted = true;
      vid.loop = true;
      vid.playsInline = true;
      vid.crossOrigin = "anonymous";
      vid.onloadeddata = () => {
        setBgVideoEl(vid);
        setBgType("video");
        vid.play().catch(() => {});
        toast.success("Dodano filmik w tle — możesz przesuwać kafelki palcem!");
      };
    } else {
      const img = new window.Image();
      img.onload = () => {
        setBgImageEl(img);
        setBgType("image");
        toast.success("Dodano zdjęcie w tle — kliknij kafelek, aby przesunąć lub obrócić!");
      };
      img.src = url;
    }
    e.target.value = "";
  };

  const exportPNG = () => {
    setSelectedId(null);
    setTimeout(() => {
      const stage = stageRef.current;
      if (!stage) return;
      const dataUrl = stage.toDataURL({ pixelRatio: 1 / PREVIEW_SCALE });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `Fest_Life_Wrapped_${selectedYear}_9x16.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Zapisano kartę Wrapped 9:16 (1080×1920 HD)!");
    }, 60);
  };

  const exportVideo = async () => {
    if (bgType !== "video" || !bgVideoEl || !stageRef.current) return;
    setSelectedId(null);
    const canvas = stageRef.current.toCanvas({ pixelRatio: 1 / PREVIEW_SCALE });
    const stageCanvas = stageRef.current.container().querySelector("canvas");
    if (!stageCanvas || typeof MediaRecorder === "undefined" || !(stageCanvas as any).captureStream) {
      toast.error("Twoja przeglądarka nie obsługuje nagrywania wideo z canvasu.");
      return;
    }
    void canvas;
    const mime = MediaRecorder.isTypeSupported("video/mp4")
      ? "video/mp4"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const ext = mime.includes("mp4") ? "mp4" : "webm";
    const durMs = Math.min(12000, Math.max(3000, Math.round((bgVideoEl.duration || 6) * 1000)));

    try {
      setRecording(true);
      toast.info(`Nagrywam animowane Stories (${Math.round(durMs / 1000)}s)...`);
      bgVideoEl.currentTime = 0;
      await bgVideoEl.play();
      const stream = (stageCanvas as any).captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6000000 });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (ev) => { if (ev.data.size > 0) chunks.push(ev.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Fest_Life_Wrapped_${selectedYear}_Stories.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        setRecording(false);
        toast.success(`Zapisano wideo Wrapped (.${ext})!`);
      };
      recorder.start();
      setTimeout(() => { if (recorder.state !== "inactive") recorder.stop(); }, durMs);
    } catch (e: any) {
      setRecording(false);
      toast.error("Błąd nagrywania: " + e.message);
    }
  };

  // Compute cover dimensions for bg image/video
  const mediaEl = bgType === "video" ? bgVideoEl : bgType === "image" ? bgImageEl : null;
  let mediaProps = { x: 0, y: 0, width: LOGICAL_W, height: LOGICAL_H };
  if (mediaEl) {
    const mw = (mediaEl as HTMLVideoElement).videoWidth || (mediaEl as HTMLImageElement).naturalWidth || LOGICAL_W;
    const mh = (mediaEl as HTMLVideoElement).videoHeight || (mediaEl as HTMLImageElement).naturalHeight || LOGICAL_H;
    const coverScale = Math.max(LOGICAL_W / mw, LOGICAL_H / mh) * bgZoom;
    const dw = mw * coverScale;
    const dh = mh * coverScale;
    mediaProps = {
      x: (LOGICAL_W - dw) / 2 + bgPos.x,
      y: (LOGICAL_H - dh) / 2 + bgPos.y,
      width: dw,
      height: dh
    };
  }
  void videoFrameTick;

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Wrapped Studio 9:16"
      description="Przesuwaj, skaluj i obracaj kafelki bezpośrednio na karcie — jak w Instagram Stories"
      maxWidthClass="max-w-4xl"
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[310px_1fr]">
        {/* LEFT: Interactive Konva 9:16 Stage */}
        <div className="flex flex-col items-center gap-3">
          <div className="overflow-hidden rounded-[20px] border border-[var(--border-strong)] shadow-2xl">
            <Stage
              ref={stageRef}
              width={PREVIEW_W}
              height={PREVIEW_H}
              scaleX={PREVIEW_SCALE}
              scaleY={PREVIEW_SCALE}
              onMouseDown={(e) => {
                if (e.target === e.target.getStage() || e.target.name() === "bg-layer") {
                  setSelectedId(null);
                }
              }}
              onTouchStart={(e) => {
                if (e.target === e.target.getStage() || e.target.name() === "bg-layer") {
                  setSelectedId(null);
                }
              }}
            >
              <Layer>
                {/* Background Fill */}
                <Rect name="bg-layer" x={0} y={0} width={LOGICAL_W} height={LOGICAL_H} fill={profile.bg} />

                {/* Photo or Video Background (draggable!) */}
                {mediaEl && (
                  <KonvaImage
                    name="bg-layer"
                    image={mediaEl}
                    x={mediaProps.x}
                    y={mediaProps.y}
                    width={mediaProps.width}
                    height={mediaProps.height}
                  />
                )}

                {/* Ambient dim overlay */}
                {mediaEl && (
                  <Rect
                    name="bg-layer"
                    x={0}
                    y={0}
                    width={LOGICAL_W}
                    height={LOGICAL_H}
                    fill="#000000"
                    opacity={dimPct / 100}
                  />
                )}

                {/* Brand Monogram & Header */}
                <Group x={80} y={110} draggable>
                  <Rect
                    width={92}
                    height={92}
                    cornerRadius={24}
                    fill={profile.surface}
                    opacity={0.94}
                    stroke={profile.accent}
                    strokeWidth={3.5}
                  />
                  <Circle x={72} y={22} radius={6} fill={profile.accent} />
                  <Text
                    x={0}
                    y={24}
                    width={92}
                    align="center"
                    text="FL"
                    fontFamily="Syne"
                    fontStyle="800"
                    fontSize={40}
                    fill={profile.text}
                  />
                  <Text
                    x={116}
                    y={10}
                    width={780}
                    text={title}
                    fontFamily="Syne"
                    fontStyle="800"
                    fontSize={52}
                    fill={mediaEl ? "#FFFFFF" : profile.text}
                    ellipsis
                    wrap="none"
                  />
                  <Text
                    x={118}
                    y={68}
                    width={780}
                    text={subtitle}
                    fontFamily="JetBrains Mono"
                    fontStyle="600"
                    fontSize={22}
                    fill={mediaEl ? "rgba(255,255,255,0.82)" : profile.muted}
                    ellipsis
                    wrap="none"
                  />
                </Group>

                {/* Hero Number (draggable) */}
                <Group x={80} y={290} draggable>
                  <Text
                    text={String(stats.count)}
                    fontFamily="Syne"
                    fontStyle="800"
                    fontSize={132}
                    fill={mediaEl ? "#FFFFFF" : profile.text}
                  />
                  <Text
                    y={142}
                    width={920}
                    text={`koncertów w ${stats.countries} krajach • ${stats.totalKm.toLocaleString("pl-PL")} km`}
                    fontFamily="Space Grotesk"
                    fontStyle="600"
                    fontSize={32}
                    fill={mediaEl ? "rgba(255,255,255,0.88)" : profile.muted}
                  />
                </Group>

                {/* Draggable, Resizable, Rotatable Stat Tiles */}
                {tiles
                  .filter((t) => t.on)
                  .map((t) => (
                    <Group
                      key={t.id}
                      ref={(node) => { nodeRefs.current[t.id] = node; }}
                      x={t.x}
                      y={t.y}
                      scaleX={t.scaleX}
                      scaleY={t.scaleY}
                      rotation={t.rotation}
                      draggable
                      onClick={() => setSelectedId(t.id)}
                      onTap={() => setSelectedId(t.id)}
                      onDragEnd={(e) => {
                        setTiles((prev) =>
                          prev.map((item) =>
                            item.id === t.id ? { ...item, x: e.target.x(), y: e.target.y() } : item
                          )
                        );
                      }}
                      onTransformEnd={(e) => {
                        const node = e.target;
                        setTiles((prev) =>
                          prev.map((item) =>
                            item.id === t.id
                              ? {
                                  ...item,
                                  x: node.x(),
                                  y: node.y(),
                                  scaleX: node.scaleX(),
                                  scaleY: node.scaleY(),
                                  rotation: node.rotation()
                                }
                              : item
                          )
                        );
                      }}
                    >
                      <Rect
                        width={442}
                        height={264}
                        cornerRadius={30}
                        fill={profile.surface}
                        opacity={tileOp / 100}
                        stroke={profile.accent}
                        strokeWidth={2}
                      />
                      <Text
                        x={28}
                        y={32}
                        width={386}
                        text={t.lbl}
                        fontFamily="JetBrains Mono"
                        fontStyle="700"
                        fontSize={18}
                        fill={profile.accent2}
                        ellipsis
                        wrap="none"
                      />
                      <Text
                        x={28}
                        y={82}
                        width={386}
                        height={110}
                        text={t.val || "—"}
                        fontFamily="Syne"
                        fontStyle="800"
                        fontSize={t.val.length > 14 ? 30 : 38}
                        lineHeight={1.15}
                        fill={profile.text}
                        ellipsis
                      />
                      <Text
                        x={28}
                        y={204}
                        width={386}
                        text={t.sub}
                        fontFamily="Space Grotesk"
                        fontStyle="500"
                        fontSize={22}
                        fill={profile.muted}
                        ellipsis
                        wrap="none"
                      />
                    </Group>
                  ))}

                {/* Footer */}
                <Text
                  x={80}
                  y={1790}
                  width={920}
                  align="center"
                  text={footer}
                  fontFamily="JetBrains Mono"
                  fontStyle="600"
                  fontSize={24}
                  fill={mediaEl ? "rgba(255,255,255,0.85)" : profile.muted}
                  ellipsis
                  wrap="none"
                />

                <Transformer
                  ref={trRef}
                  rotateEnabled
                  enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
                  borderStroke={profile.accent}
                  anchorStroke={profile.accent}
                  anchorFill="#FFFFFF"
                  anchorSize={16}
                />
              </Layer>
            </Stage>
          </div>

          <div className="flex w-[300px] gap-2">
            <button type="button" onClick={exportPNG} className="fl-btn fl-btn-primary flex-1 !text-xs">
              <IconDownload size={15} stroke={1.75} /> Pobierz PNG (HD)
            </button>
            {bgType === "video" && (
              <button
                type="button"
                disabled={recording}
                onClick={exportVideo}
                className="fl-btn flex-1 !text-xs"
              >
                <IconVideo size={15} stroke={1.75} /> {recording ? "Nagrywam..." : "Wideo"}
              </button>
            )}
          </div>
          <p className="text-center text-[11px] text-[var(--text-muted)]">
            Dotknij dowolny kafelek na podglądzie, aby go przesunąć, powiększyć lub obrócić.
          </p>
        </div>

        {/* RIGHT: Studio Controls */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="fl-input !py-2 !text-xs"
            >
              <option value="all">Cała historia</option>
              {years.map((y) => (
                <option key={y} value={String(y)}>
                  Sezon {y}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="fl-btn fl-btn-primary !text-xs"
            >
              <IconPhoto size={15} stroke={1.75} /> Zdjęcie / Filmik w tle
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleUpload}
              className="hidden"
            />

            {bgType !== "none" && (
              <button type="button" onClick={clearMedia} className="fl-btn fl-btn-danger !text-xs">
                <IconTrash size={14} stroke={1.75} /> Usuń tło
              </button>
            )}

            <button
              type="button"
              onClick={() => { setTiles(buildDefaultTiles()); setSelectedId(null); }}
              className="fl-btn !text-xs"
              title="Resetuj układ kafelków"
            >
              <IconRefresh size={14} stroke={1.75} /> Reset układu
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5 text-xs">
            <label className="flex flex-col gap-1 text-[var(--text-muted)]">
              Przyciemnienie tła: <strong className="text-[var(--text)]">{dimPct}%</strong>
              <input
                type="range"
                min={0}
                max={85}
                value={dimPct}
                onChange={(e) => setDimPct(Number(e.target.value))}
                className="accent-[var(--accent)]"
              />
            </label>
            <label className="flex flex-col gap-1 text-[var(--text-muted)]">
              Widoczność kafelków: <strong className="text-[var(--text)]">{tileOp}%</strong>
              <input
                type="range"
                min={15}
                max={98}
                value={tileOp}
                onChange={(e) => setTileOp(Number(e.target.value))}
                className="accent-[var(--accent)]"
              />
            </label>
            {bgType !== "none" && (
              <>
                <label className="flex flex-col gap-1 text-[var(--text-muted)]">
                  Zoom tła: <strong className="text-[var(--text)]">{Math.round(bgZoom * 100)}%</strong>
                  <input
                    type="range"
                    min={100}
                    max={200}
                    value={Math.round(bgZoom * 100)}
                    onChange={(e) => setBgZoom(Number(e.target.value) / 100)}
                    className="accent-[var(--accent)]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[var(--text-muted)]">
                  Pozycja Y tła: <strong className="text-[var(--text)]">{Math.round(bgPos.y)}px</strong>
                  <input
                    type="range"
                    min={-500}
                    max={500}
                    value={bgPos.y}
                    onChange={(e) => setBgPos((p) => ({ ...p, y: Number(e.target.value) }))}
                    className="accent-[var(--accent)]"
                  />
                </label>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Tytuł
              </label>
              <input className="fl-input w-full !py-1.5 !text-xs" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Podtytuł
              </label>
              <input className="fl-input w-full !py-1.5 !text-xs" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Stopka
              </label>
              <input className="fl-input w-full !py-1.5 !text-xs" value={footer} onChange={(e) => setFooter(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
            <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Edycja kafelków
            </div>
            {tiles.map((t, idx) => (
              <div key={t.id} className="grid grid-cols-[auto_1fr_1fr] items-center gap-2">
                <input
                  type="checkbox"
                  checked={t.on}
                  onChange={(e) =>
                    setTiles((prev) => prev.map((it, i) => (i === idx ? { ...it, on: e.target.checked } : it)))
                  }
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                <input
                  className="fl-input !py-1.5 !text-xs min-w-0"
                  value={t.lbl}
                  onChange={(e) =>
                    setTiles((prev) => prev.map((it, i) => (i === idx ? { ...it, lbl: e.target.value } : it)))
                  }
                />
                <input
                  className="fl-input !py-1.5 !text-xs min-w-0"
                  value={t.val}
                  onChange={(e) =>
                    setTiles((prev) => prev.map((it, i) => (i === idx ? { ...it, val: e.target.value } : it)))
                  }
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
};
