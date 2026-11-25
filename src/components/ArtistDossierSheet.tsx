import React, { useEffect, useRef, useState } from "react";
import { Drawer } from "vaul";
import {
  IconX,
  IconPlayerPlay,
  IconPlayerPause,
  IconExternalLink,
  IconPhotoEdit,
  IconCheck,
  IconFilter,
  IconMapPin,
  IconCalendarEvent,
  IconStarFilled,
  IconMusic,
  IconEdit,
  IconPhoto,
  IconArrowUpRight,
} from "@tabler/icons-react";
import {
  ResolvedArtist,
  fetchArtistImageCandidates,
  saveArtistPhotoOverride,
} from "../lib/artistResolver";
import { supabase } from "../lib/supabase";
import type { Concert, EventMeta } from "../types";
import {
  ConcertKind,
  detectConcertKind,
  loadTypeOverrides,
  saveConcertKindLocal,
} from "./StartView";

interface ArtistDossierSheetProps {
  artistName: string | null;
  onClose: () => void;
  concerts: any[];
  artistMeta?: ResolvedArtist;
  artistsCache: Record<string, ResolvedArtist>;
  onUpdateCache: (next: Record<string, ResolvedArtist>) => void;
  onSelectArtistFilter?: (artist: string) => void;
  onOpenOtherArtist?: (artist: string) => void;
  streamingPlatform?: string;
  eventsMeta?: Record<string, EventMeta>;
  onEditConcert?: (c: Concert) => void;
  onUploadEventPhotos?: (eventKey: string, files: File[]) => Promise<void>;
  onOpenEvent?: (eventKey: string) => void;
  onConcertSaved?: () => void;
}

interface RelatedArtistItem {
  name: string;
  score: number;
  sharedEvent?: string;
}

const LOCAL_EVENT_PHOTOS_KEY = "festlife_local_event_photos_v1";

function loadLocalEventPhotos(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(LOCAL_EVENT_PHOTOS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export const ArtistDossierSheet: React.FC<ArtistDossierSheetProps> = ({
  artistName,
  onClose,
  concerts,
  artistMeta,
  artistsCache,
  onUpdateCache,
  onSelectArtistFilter,
  onOpenOtherArtist,
  streamingPlatform = "spotify",
  eventsMeta = {},
  onEditConcert,
  onUploadEventPhotos,
  onOpenEvent,
  onConcertSaved,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [typeOverrides, setTypeOverrides] = useState<Record<string, ConcertKind>>(() =>
    loadTypeOverrides()
  );

  // Stany szybkiej edycji koncertu i zdjęć wydarzenia wewnątrz historii koncertowej
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<any>(null);
  const [savingRow, setSavingRow] = useState(false);

  const [expandedEventConcertId, setExpandedEventConcertId] = useState<string | null>(null);
  const [uploadingPhotoForKey, setUploadingPhotoForKey] = useState<string | null>(null);
  const [localPhotosMap, setLocalPhotosMap] = useState<Record<string, string[]>>(() =>
    loadLocalEventPhotos()
  );
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const eventPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const targetEventKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setPhotoPickerOpen(false);
    setCandidates([]);
    setCustomUrl("");
    setIsPlaying(false);
    setEditingRowId(null);
    setEditDraft(null);
    setExpandedEventConcertId(null);
    setLightboxUrl(null);
    setTypeOverrides(loadTypeOverrides());
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, [artistName]);

  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  if (!artistName) return null;

  const key = artistName.trim().toLowerCase();
  const meta = artistMeta || artistsCache[key];
  const artistConcerts = concerts
    .filter((c) => (c.artysta || "").trim().toLowerCase() === key)
    .sort((a, b) => String(b.data || b.rok || "").localeCompare(String(a.data || a.rok || "")));

  const ratings = artistConcerts.map((c) => Number(c.ocena)).filter((n) => n > 0);
  const avgRating = ratings.length
    ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
    : null;

  const cities = Array.from(new Set(artistConcerts.map((c) => c.miasto).filter(Boolean)));
  const eventsSet = new Set(artistConcerts.map((c) => c.event).filter(Boolean));
  const genresSet = new Set(artistConcerts.map((c) => c.gatunek || c.genre).filter(Boolean));

  const relatedMap = new Map<string, RelatedArtistItem>();
  for (const c of concerts) {
    const other = (c.artysta || "").trim();
    if (!other || other.toLowerCase() === key) continue;
    const sameEvent = Boolean(c.event && eventsSet.has(c.event));
    const sameGenre = Boolean((c.gatunek || c.genre) && genresSet.has(c.gatunek || c.genre));
    if (sameEvent || sameGenre) {
      const prev: RelatedArtistItem = relatedMap.get(other.toLowerCase()) || {
        name: other,
        score: 0,
      };
      prev.score += sameEvent ? 3 : 1;
      if (sameEvent && !prev.sharedEvent) prev.sharedEvent = String(c.event);
      relatedMap.set(other.toLowerCase(), prev);
    }
  }
  const relatedArtists = Array.from(relatedMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const handleSetConcertKind = async (concert: any, nextKind: ConcertKind) => {
    const nextMap = saveConcertKindLocal(concert, nextKind);
    setTypeOverrides(nextMap);
    if (concert.id !== undefined && concert.id !== null) {
      await supabase
        .from("concerts")
        .update({ typ: nextKind } as any)
        .eq("id", concert.id);
    }
  };

  const startInlineEdit = (c: any, rowKey: string) => {
    setExpandedEventConcertId(null);
    setEditingRowId(rowKey);
    setEditDraft({
      event: c.event || "",
      data: c.data || "",
      godzina: c.godzina || "",
      scena: c.scena || "",
      miejsce: c.miejsce || "",
      miasto: c.miasto || "",
      kraj: c.kraj || "Polska",
      gatunek: c.gatunek || "",
      z_kim: c.z_kim || "",
      ocena: Number(c.ocena) || 0,
      cena: c.cena != null ? String(c.cena) : "",
      uwagi: c.uwagi || "",
      kind: detectConcertKind(c, typeOverrides),
    });
  };

  const handleSaveInlineEdit = async (c: any) => {
    if (!editDraft) return;
    setSavingRow(true);
    const parsedYear = editDraft.data ? parseInt(editDraft.data.slice(0, 4), 10) : c.rok;
    const updates: any = {
      event: editDraft.event.trim(),
      rok: parsedYear || c.rok || null,
      data: editDraft.data || null,
      godzina: editDraft.godzina.trim(),
      scena: editDraft.scena.trim(),
      miejsce: editDraft.miejsce.trim(),
      miasto: editDraft.miasto.trim(),
      kraj: editDraft.kraj.trim(),
      gatunek: editDraft.gatunek.trim(),
      z_kim: editDraft.z_kim.trim(),
      ocena: Number(editDraft.ocena) || 0,
      cena: editDraft.cena !== "" ? Number(editDraft.cena) : null,
      uwagi: editDraft.uwagi.trim(),
    };

    const nextMap = saveConcertKindLocal({ ...c, ...updates }, editDraft.kind);
    setTypeOverrides(nextMap);

    if (c.id !== undefined && c.id !== null) {
      await supabase.from("concerts").update(updates).eq("id", c.id);
      await supabase
        .from("concerts")
        .update({ typ: editDraft.kind } as any)
        .eq("id", c.id);
      Object.assign(c, updates);
    }

    setSavingRow(false);
    setEditingRowId(null);
    setEditDraft(null);
    window.dispatchEvent(new Event("festlife:concert-updated"));
    onConcertSaved?.();
  };

  const handleEventPhotosSelected = async (files: File[]) => {
    const eventKey = targetEventKeyRef.current;
    if (!files.length || !eventKey) return;
    setUploadingPhotoForKey(eventKey);

    try {
      if (onUploadEventPhotos) {
        await onUploadEventPhotos(eventKey, files);
      } else {
        // Fallback: bezpośredni upload do Supabase Storage lub lokalny podgląd DataURL
        const uploadedUrls: string[] = [];
        for (const file of files) {
          const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
          const path = `events/${encodeURIComponent(eventKey)}/${safeName}`;
          const { error } = await supabase.storage
            .from("event-photos")
            .upload(path, file, { upsert: true });

          if (!error) {
            const { data } = supabase.storage.from("event-photos").getPublicUrl(path);
            if (data?.publicUrl) uploadedUrls.push(data.publicUrl);
          } else {
            const dataUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result || ""));
              reader.readAsDataURL(file);
            });
            if (dataUrl) uploadedUrls.push(dataUrl);
          }
        }

        if (uploadedUrls.length) {
          const prev = localPhotosMap[eventKey] || [];
          const next = { ...localPhotosMap, [eventKey]: [...prev, ...uploadedUrls] };
          setLocalPhotosMap(next);
          try {
            localStorage.setItem(LOCAL_EVENT_PHOTOS_KEY, JSON.stringify(next));
          } catch {
            // ignore quota
          }
        }
      }
    } finally {
      setUploadingPhotoForKey(null);
    }
  };

  const handleGoToEventCard = (eventKey: string) => {
    try {
      sessionStorage.setItem("festlife_focus_event", eventKey);
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent("festlife:open-event", { detail: eventKey }));
    onOpenEvent?.(eventKey);
    onClose();
  };

  const toggleAudio = () => {
    if (!meta?.preview_url) return;
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }
    const audio = new Audio(meta.preview_url);
    audioRef.current = audio;
    audio.onended = () => setIsPlaying(false);
    audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  };

  const handleOpenPhotoPicker = async () => {
    const nextState = !photoPickerOpen;
    setPhotoPickerOpen(nextState);
    if (nextState && !candidates.length) {
      setLoadingCandidates(true);
      const found = await fetchArtistImageCandidates(artistName);
      setCandidates(found);
      setLoadingCandidates(false);
    }
  };

  const handleApplyPhoto = async (url: string) => {
    if (!url.trim()) return;
    setSavingPhoto(true);
    const nextCache = await saveArtistPhotoOverride(artistName, url, artistsCache);
    onUpdateCache(nextCache);
    setSavingPhoto(false);
    setPhotoPickerOpen(false);
  };

  const streamUrl =
    streamingPlatform === "apple" && meta?.apple_music_url
      ? meta.apple_music_url
      : streamingPlatform === "youtube"
      ? `https://music.youtube.com/search?q=${encodeURIComponent(artistName)}`
      : streamingPlatform === "tidal"
      ? `https://listen.tidal.com/search?q=${encodeURIComponent(artistName)}`
      : meta?.spotify_url || `https://open.spotify.com/search/${encodeURIComponent(artistName)}`;

  return (
    <Drawer.Root open={!!artistName} onOpenChange={(o: boolean) => !o && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90vh] max-w-2xl flex-col rounded-t-3xl border-t border-[var(--border)] bg-[var(--surface,#15151b)] text-[var(--text,#f5f5f7)] outline-none">
          <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-white/20" />

          <input
            ref={eventPhotoInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={async (e) => {
              const files = Array.from(e.target.files || []);
              await handleEventPhotosSelected(files);
              e.target.value = "";
            }}
          />

          <div className="overflow-y-auto px-5 pb-8 pt-4">
            {/* Nagłówek Artysty */}
            <div className="flex items-start gap-4">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]">
                {meta?.image_url ? (
                  <img
                    src={meta.image_url}
                    alt={artistName}
                    className="artist-portrait h-full w-full"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl font-bold opacity-50">
                    {artistName.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="truncate font-display text-2xl font-bold leading-tight">
                    {artistName}
                  </h2>
                  <button
                    onClick={onClose}
                    className="rounded-full p-1.5 opacity-70 hover:bg-white/10 hover:opacity-100"
                    aria-label="Zamknij"
                  >
                    <IconX size={20} stroke={1.75} />
                  </button>
                </div>

                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  {meta?.genres?.length
                    ? meta.genres.slice(0, 3).join(" · ")
                    : Array.from(genresSet).join(" · ") || "Artyści na żywo"}
                </p>

                {/* Akcje */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {meta?.preview_url && (
                    <button
                      onClick={toggleAudio}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-xs font-semibold text-[var(--accent-ink,#fff)]"
                    >
                      {isPlaying ? (
                        <>
                          <IconPlayerPause size={15} stroke={2} /> Pauza 30s
                        </>
                      ) : (
                        <>
                          <IconPlayerPlay size={15} stroke={2} /> Odsłuch 30s
                        </>
                      )}
                    </button>
                  )}

                  <a
                    href={streamUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface-2)]"
                  >
                    <IconExternalLink size={14} stroke={1.75} /> Profil
                  </a>

                  <button
                    onClick={handleOpenPhotoPicker}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-3 py-1.5 text-xs font-medium opacity-85 hover:opacity-100"
                  >
                    <IconPhotoEdit size={14} stroke={1.75} /> Zmień zdjęcie
                  </button>
                </div>
              </div>
            </div>

            {/* Ręczny selektor zdjęcia artysty */}
            {photoPickerOpen && (
              <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                <p className="text-xs font-medium opacity-80">
                  Wybierz zdjęcie z Deezer / TheAudioDB / Wikipedii lub wklej własny link:
                </p>
                {loadingCandidates ? (
                  <p className="mt-3 text-xs opacity-60">Szukanie zdjęć...</p>
                ) : (
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {candidates.map((url) => (
                      <button
                        key={url}
                        onClick={() => handleApplyPhoto(url)}
                        disabled={savingPhoto}
                        className="group relative aspect-square overflow-hidden rounded-xl border border-[var(--border-strong)] hover:border-[var(--accent)]"
                      >
                        <img src={url} alt="" className="artist-portrait h-full w-full" />
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <input
                    type="url"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://... (wklej bezpośredni adres zdjęcia)"
                    className="fl-input min-w-0 flex-1 !py-1.5 text-xs"
                  />
                  <button
                    onClick={() => handleApplyPhoto(customUrl)}
                    disabled={savingPhoto || !customUrl.trim()}
                    className="fl-btn fl-btn-primary !py-1.5 !text-xs disabled:opacity-40"
                  >
                    <IconCheck size={15} /> Zapisz
                  </button>
                </div>
              </div>
            )}

            {/* Statystyki w pigułce */}
            <div className="mt-5 grid grid-cols-3 gap-2.5">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <div className="text-xs text-[var(--text-muted)]">Na żywo</div>
                <div className="tabular-nums mt-0.5 font-display text-xl font-bold">
                  {artistConcerts.length}×
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <div className="text-xs text-[var(--text-muted)]">Miasta</div>
                <div className="tabular-nums mt-0.5 font-display text-xl font-bold">
                  {cities.length}
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <div className="text-xs text-[var(--text-muted)]">Śr. ocena</div>
                <div className="tabular-nums mt-0.5 flex items-center gap-1 font-display text-xl font-bold">
                  {avgRating ? (
                    <>
                      {avgRating} <IconStarFilled size={15} className="text-amber-400" />
                    </>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
            </div>

            {/* Oś wspólnych koncertów z edycją wydarzenia i dodawaniem zdjęć */}
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-semibold">
                  Twoja historia koncertowa ({artistConcerts.length})
                </h3>
                {onSelectArtistFilter && (
                  <button
                    onClick={() => {
                      onSelectArtistFilter(artistName);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline"
                  >
                    <IconFilter size={14} /> Filtruj cały raport
                  </button>
                )}
              </div>

              <div className="mt-3 space-y-2.5">
                {artistConcerts.map((c, idx) => {
                  const rowKey = String(c.id ?? `${idx}_${c.data}`);
                  const kind = detectConcertKind(c, typeOverrides);
                  const eventKey = `${c.event || "Koncert"}|${c.rok || "?"}`;
                  const evMeta = eventsMeta[eventKey];
                  const mergedPhotos = [
                    ...(evMeta?.photos?.map((p) => p.url) || []),
                    ...(localPhotosMap[eventKey] || []),
                  ];
                  const isEditingThis = editingRowId === rowKey;
                  const isEventExpanded = expandedEventConcertId === rowKey;

                  return (
                    <div
                      key={rowKey}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">
                            {c.event || c.miejsce || "Koncert solowy"}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--text-muted)]">
                            <span className="inline-flex items-center gap-1">
                              <IconCalendarEvent size={13} /> {c.data || c.rok}
                            </span>
                            {c.miasto && (
                              <span className="inline-flex items-center gap-1">
                                <IconMapPin size={13} /> {c.miasto}
                              </span>
                            )}
                            {Number(c.ocena) > 0 && (
                              <span className="inline-flex items-center gap-0.5 font-semibold text-[var(--text)]">
                                {c.ocena} <IconStarFilled size={11} className="text-amber-400" />
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Przełącznik: Koncert solowy / Festiwal */}
                        <div className="flex shrink-0 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] p-0.5 text-[11px]">
                          <button
                            type="button"
                            onClick={() => handleSetConcertKind(c, "solowy")}
                            title="Koncert dedykowany jednemu artyście"
                            className={`rounded-md px-2 py-0.5 font-semibold ${
                              kind === "solowy"
                                ? "bg-[var(--accent)] text-[var(--accent-ink,#fff)]"
                                : "text-[var(--text-muted)] hover:text-[var(--text)]"
                            }`}
                          >
                            Solowy
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetConcertKind(c, "festiwal")}
                            title="Występ w ramach festiwalu"
                            className={`rounded-md px-2 py-0.5 font-semibold ${
                              kind === "festiwal"
                                ? "bg-[#38bdf8] text-slate-950"
                                : "text-[var(--text-muted)] hover:text-[var(--text)]"
                            }`}
                          >
                            Festiwal
                          </button>
                        </div>
                      </div>

                      {/* Pasek akcji: Wejdź w wydarzenie & Zdjęcia | Edytuj koncert */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-[var(--border)] pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRowId(null);
                            setExpandedEventConcertId(isEventExpanded ? null : rowKey);
                          }}
                          className={`fl-btn !px-2.5 !py-1 !text-[11px] ${
                            isEventExpanded ? "fl-btn-primary" : ""
                          }`}
                        >
                          <IconPhoto size={13} />
                          Wydarzenie i zdjęcia
                          {mergedPhotos.length > 0 ? ` (${mergedPhotos.length})` : ""}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            isEditingThis ? setEditingRowId(null) : startInlineEdit(c, rowKey)
                          }
                          className={`fl-btn !px-2.5 !py-1 !text-[11px] ${
                            isEditingThis ? "fl-btn-primary" : ""
                          }`}
                        >
                          <IconEdit size={13} />
                          {isEditingThis ? "Anuluj edycję" : "Edytuj koncert"}
                        </button>

                        {onEditConcert && (
                          <button
                            type="button"
                            onClick={() => {
                              onEditConcert(c);
                              onClose();
                            }}
                            className="fl-btn !px-2.5 !py-1 !text-[11px] text-[var(--text-muted)]"
                            title="Otwórz w pełnym formularzu edycji"
                          >
                            Pełny formularz <IconArrowUpRight size={12} />
                          </button>
                        )}
                      </div>

                      {/* Panel wydarzenia i dodawania zdjęć bezpośrednio w widoku artysty */}
                      {isEventExpanded && (
                        <div className="mt-2.5 space-y-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-xs font-bold">{c.event || "Koncert"} ({c.rok})</div>
                              <div className="text-[11px] text-[var(--text-muted)]">
                                {c.miejsce ? `${c.miejsce} • ` : ""}
                                {c.miasto}
                                {c.z_kim ? ` • Ekipa: ${c.z_kim}` : ""}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                disabled={uploadingPhotoForKey === eventKey}
                                onClick={() => {
                                  targetEventKeyRef.current = eventKey;
                                  eventPhotoInputRef.current?.click();
                                }}
                                className="fl-btn fl-btn-primary !px-2.5 !py-1 !text-[11px]"
                              >
                                <IconPhoto size={13} />
                                {uploadingPhotoForKey === eventKey
                                  ? "Dodawanie..."
                                  : "+ Dodaj zdjęcia"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleGoToEventCard(eventKey)}
                                className="fl-btn !px-2.5 !py-1 !text-[11px]"
                              >
                                Karta wydarzenia <IconArrowUpRight size={12} />
                              </button>
                            </div>
                          </div>

                          {evMeta?.poster && (
                            <div className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-2">
                              <img
                                src={evMeta.poster}
                                alt="Plakat"
                                onClick={() => setLightboxUrl(evMeta.poster!)}
                                className="h-12 w-9 cursor-pointer rounded object-cover"
                              />
                              <div className="text-[11px]">
                                <div className="font-semibold">Plakat wydarzenia</div>
                                <div className="text-[var(--text-muted)]">Kliknij, aby powiększyć</div>
                              </div>
                            </div>
                          )}

                          {mergedPhotos.length > 0 ? (
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {mergedPhotos.map((url, pIdx) => (
                                <img
                                  key={`${url.slice(0, 24)}_${pIdx}`}
                                  src={url}
                                  alt=""
                                  onClick={() => setLightboxUrl(url)}
                                  className="h-16 w-16 shrink-0 cursor-pointer rounded-xl border border-[var(--border)] object-cover"
                                />
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-[var(--text-muted)]">
                              Brak zdjęć dla tego wydarzenia. Kliknij „+ Dodaj zdjęcia”, aby dorzucić wspomnienia.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Formularz szybkiej edycji koncertu */}
                      {isEditingThis && editDraft && (
                        <div className="mt-2.5 space-y-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div>
                              <label className="mb-0.5 block text-[10px] font-bold uppercase text-[var(--text-muted)]">
                                Event / Festiwal
                              </label>
                              <input
                                className="fl-input w-full !py-1.5 text-xs"
                                value={editDraft.event}
                                onChange={(e) =>
                                  setEditDraft({ ...editDraft, event: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <label className="mb-0.5 block text-[10px] font-bold uppercase text-[var(--text-muted)]">
                                Data
                              </label>
                              <input
                                type="date"
                                className="fl-input w-full !py-1.5 text-xs"
                                value={editDraft.data}
                                onChange={(e) =>
                                  setEditDraft({ ...editDraft, data: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <label className="mb-0.5 block text-[10px] font-bold uppercase text-[var(--text-muted)]">
                                Miasto
                              </label>
                              <input
                                className="fl-input w-full !py-1.5 text-xs"
                                value={editDraft.miasto}
                                onChange={(e) =>
                                  setEditDraft({ ...editDraft, miasto: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <label className="mb-0.5 block text-[10px] font-bold uppercase text-[var(--text-muted)]">
                                Miejsce / Klub
                              </label>
                              <input
                                className="fl-input w-full !py-1.5 text-xs"
                                value={editDraft.miejsce}
                                onChange={(e) =>
                                  setEditDraft({ ...editDraft, miejsce: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <label className="mb-0.5 block text-[10px] font-bold uppercase text-[var(--text-muted)]">
                                Gatunek
                              </label>
                              <input
                                className="fl-input w-full !py-1.5 text-xs"
                                value={editDraft.gatunek}
                                onChange={(e) =>
                                  setEditDraft({ ...editDraft, gatunek: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <label className="mb-0.5 block text-[10px] font-bold uppercase text-[var(--text-muted)]">
                                Ocena (1–5)
                              </label>
                              <select
                                className="fl-input w-full !py-1.5 text-xs"
                                value={editDraft.ocena}
                                onChange={(e) =>
                                  setEditDraft({ ...editDraft, ocena: Number(e.target.value) })
                                }
                              >
                                <option value={0}>Brak</option>
                                <option value={5}>5 ★</option>
                                <option value={4}>4 ★</option>
                                <option value={3}>3 ★</option>
                                <option value={2}>2 ★</option>
                                <option value={1}>1 ★</option>
                              </select>
                            </div>
                            <div>
                              <label className="mb-0.5 block text-[10px] font-bold uppercase text-[var(--text-muted)]">
                                Z kim?
                              </label>
                              <input
                                className="fl-input w-full !py-1.5 text-xs"
                                value={editDraft.z_kim}
                                onChange={(e) =>
                                  setEditDraft({ ...editDraft, z_kim: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <label className="mb-0.5 block text-[10px] font-bold uppercase text-[var(--text-muted)]">
                                Uwagi
                              </label>
                              <input
                                className="fl-input w-full !py-1.5 text-xs"
                                value={editDraft.uwagi}
                                onChange={(e) =>
                                  setEditDraft({ ...editDraft, uwagi: e.target.value })
                                }
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingRowId(null)}
                              className="fl-btn !px-2.5 !py-1 !text-xs"
                            >
                              Anuluj
                            </button>
                            <button
                              type="button"
                              disabled={savingRow}
                              onClick={() => handleSaveInlineEdit(c)}
                              className="fl-btn fl-btn-primary !px-3 !py-1 !text-xs"
                            >
                              {savingRow ? "Zapisywanie..." : "Zapisz zmiany"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Powiązani z tych samych wydarzeń */}
            {relatedArtists.length > 0 && (
              <div className="mt-6">
                <h3 className="font-display text-base font-semibold">
                  Powiązani z Twoich wyjazdów
                </h3>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {relatedArtists.map((rel) => {
                    const relMeta = artistsCache[rel.name.toLowerCase()];
                    return (
                      <button
                        key={rel.name}
                        onClick={() => onOpenOtherArtist?.(rel.name)}
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] py-1 pl-1.5 pr-3 text-xs font-medium hover:border-[var(--border-strong)]"
                      >
                        {relMeta?.image_url ? (
                          <img
                            src={relMeta.image_url}
                            alt={rel.name}
                            className="artist-portrait h-6 w-6 rounded-full"
                          />
                        ) : (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10">
                            <IconMusic size={12} />
                          </span>
                        )}
                        <span>{rel.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Podgląd zdjęcia na pełny ekran */}
            {lightboxUrl && (
              <div
                onClick={() => setLightboxUrl(null)}
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
              >
                <img
                  src={lightboxUrl}
                  alt="Podgląd"
                  className="max-h-[85vh] max-w-full rounded-2xl object-contain"
                />
              </div>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};
