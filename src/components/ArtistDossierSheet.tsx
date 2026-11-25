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
} from "@tabler/icons-react";
import {
  ResolvedArtist,
  fetchArtistImageCandidates,
  saveArtistPhotoOverride,
} from "../lib/artistResolver";

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
}

interface RelatedArtistItem {
  name: string;
  score: number;
  sharedEvent?: string;
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
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const [savingPhoto, setSavingPhoto] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setPhotoPickerOpen(false);
    setCandidates([]);
    setCustomUrl("");
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, [artistName]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
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
  const genresSet = new Set(artistConcerts.map((c) => c.gatunek).filter(Boolean));

  // Powiązani artyści (widziani na tych samych festiwalach lub z tego samego gatunku)
  const relatedMap = new Map<string, RelatedArtistItem>();
  for (const c of concerts) {
    const other = (c.artysta || "").trim();
    if (!other || other.toLowerCase() === key) continue;
    const sameEvent = Boolean(c.event && eventsSet.has(c.event));
    const sameGenre = Boolean(c.gatunek && genresSet.has(c.gatunek));
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
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90vh] max-w-2xl flex-col rounded-t-3xl border-t border-white/10 bg-[var(--bg-card,#121216)] text-[var(--text-main,#f5f5f7)] outline-none">
          <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-white/20" />

          <div className="overflow-y-auto px-5 pb-8 pt-4">
            {/* Nagłówek Artysty */}
            <div className="flex items-start gap-4">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
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

                <p className="mt-1 text-sm opacity-70">
                  {meta?.genres?.length
                    ? meta.genres.slice(0, 3).join(" · ")
                    : Array.from(genresSet).join(" · ") || "Artyści na żywo"}
                </p>

                {/* Akcje: Odsłuch 30s, Streaming, Zmień zdjęcie */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {meta?.preview_url && (
                    <button
                      onClick={toggleAudio}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent,#ff4d6d)] px-3.5 py-1.5 text-xs font-semibold text-white"
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
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium hover:bg-white/5"
                  >
                    <IconExternalLink size={14} stroke={1.75} /> Profil
                  </a>

                  <button
                    onClick={handleOpenPhotoPicker}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium opacity-80 hover:opacity-100"
                  >
                    <IconPhotoEdit size={14} stroke={1.75} /> Zmień zdjęcie
                  </button>
                </div>
              </div>
            </div>

            {/* Ręczny selektor zdjęcia */}
            {photoPickerOpen && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-medium opacity-80">
                  Wybierz oficjalne zdjęcie z Deezer / TheAudioDB / Wikipedii lub wklej własny link:
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
                        className="group relative aspect-square overflow-hidden rounded-xl border border-white/15 hover:border-[var(--accent,#ff4d6d)]"
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
                    className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-xs outline-none"
                  />
                  <button
                    onClick={() => handleApplyPhoto(customUrl)}
                    disabled={savingPhoto || !customUrl.trim()}
                    className="inline-flex items-center gap-1 rounded-xl bg-[var(--accent,#ff4d6d)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    <IconCheck size={15} /> Zapisz
                  </button>
                </div>
              </div>
            )}

            {/* Statystyki w pigułce */}
            <div className="mt-5 grid grid-cols-3 gap-2.5">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs opacity-60">Na żywo</div>
                <div className="tabular-nums mt-0.5 font-display text-xl font-bold">
                  {artistConcerts.length}×
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs opacity-60">Miasta</div>
                <div className="tabular-nums mt-0.5 font-display text-xl font-bold">
                  {cities.length}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs opacity-60">Śr. ocena</div>
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

            {/* Oś wspólnych koncertów */}
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
                    className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent,#ff4d6d)] hover:underline"
                  >
                    <IconFilter size={14} /> Filtruj cały raport
                  </button>
                )}
              </div>

              <div className="mt-3 space-y-2">
                {artistConcerts.map((c, idx) => (
                  <div
                    key={c.id || idx}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">
                        {c.event || c.miejsce || "Koncert klubowy"}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs opacity-65">
                        <span className="inline-flex items-center gap-1">
                          <IconCalendarEvent size={13} /> {c.data || c.rok}
                        </span>
                        {c.miasto && (
                          <span className="inline-flex items-center gap-1">
                            <IconMapPin size={13} /> {c.miasto}
                          </span>
                        )}
                      </div>
                    </div>
                    {Number(c.ocena) > 0 && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold">
                        {c.ocena} <IconStarFilled size={12} className="text-amber-400" />
                      </span>
                    )}
                  </div>
                ))}
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
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] py-1 pl-1.5 pr-3 text-xs font-medium hover:border-white/25"
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
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};
