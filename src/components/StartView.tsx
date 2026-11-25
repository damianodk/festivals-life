import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  IconPlayerPlay,
  IconPlayerPause,
  IconSparkles,
  IconRefresh,
  IconTrophy,
  IconClockHour4,
  IconArrowUpRight,
  IconCheck,
  IconX,
  IconMusic,
} from "@tabler/icons-react";
import {
  ResolvedArtist,
  loadLocalArtistCache,
  resolveArtistsBatch,
} from "../lib/artistResolver";
import { ArtistDossierSheet } from "./ArtistDossierSheet";

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export const StartView: React.FC<any> = (props) => {
  const {
    concerts = [],
    upcoming = [],
    artistsCache: parentArtistsCache = {},
    citiesCache = {},
    hometown = "Poznań",
    hometownLat = 52.4064,
    hometownLng = 16.9252,
    activeArtist = "",
    hasActiveFilters = false,
    onSelectArtist,
    onOpenWrapped,
    streamingPlatform = "spotify",
  } = props;

  const [localCache, setLocalCache] = useState<Record<string, ResolvedArtist>>(() => ({
    ...loadLocalArtistCache(),
    ...parentArtistsCache,
  }));
  const [dossierArtist, setDossierArtist] = useState<string | null>(null);
  const [playingArtist, setPlayingArtist] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Wehikuł czasu — losowy seed odświeżany przyciskiem
  const [memorySeed, setMemorySeed] = useState<number>(0);

  // Quiz z własnej historii
  const [quizIndex, setQuizIndex] = useState<number>(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState<number>(0);

  useEffect(() => {
    setLocalCache((prev) => ({ ...prev, ...parentArtistsCache }));
  }, [parentArtistsCache]);

  // Automatyczne dociąganie prawdziwych portretów artystów (Deezer + TheAudioDB + Wiki)
  useEffect(() => {
    if (!concerts.length) return;
    const countMap = new Map<string, number>();
    for (const c of concerts) {
      const a = (c.artysta || "").trim();
      if (a) countMap.set(a, (countMap.get(a) || 0) + 1);
    }
    const sortedArtists = Array.from(countMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    resolveArtistsBatch(sortedArtists, localCache, (merged) => {
      setLocalCache(merged);
    });
  }, [concerts.length]);

  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  const togglePreview = (artistName: string, previewUrl?: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!previewUrl) return;
    if (playingArtist === artistName && audioRef.current) {
      audioRef.current.pause();
      setPlayingArtist(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(previewUrl);
    audioRef.current = audio;
    audio.onended = () => setPlayingArtist(null);
    audio
      .play()
      .then(() => setPlayingArtist(artistName))
      .catch(() => setPlayingArtist(null));
  };

  // Agregacje KPI i rankingi
  const stats = useMemo(() => {
    const artistCounts = new Map<string, { name: string; count: number; km: number }>();
    const citySet = new Set<string>();
    const countrySet = new Set<string>();
    const eventSet = new Set<string>();
    const yearCounts = new Map<string, number>();
    const genreCounts = new Map<string, number>();
    let totalKm = 0;

    const hLat = Number(hometown?.lat ?? hometownLat) || 52.4064;
    const hLng = Number(hometown?.lng ?? hometownLng) || 16.9252;

    for (const c of concerts) {
      const art = (c.artysta || "").trim();
      const city = (c.miasto || "").trim();
      const country = (c.kraj || "").trim();
      const yr = String(c.rok || (c.data ? String(c.data).slice(0, 4) : ""));
      const genre = (c.gatunek || "").trim();

      if (city) citySet.add(city);
      if (country) countrySet.add(country);
      if (c.event) eventSet.add(c.event);
      if (yr) yearCounts.set(yr, (yearCounts.get(yr) || 0) + 1);
      if (genre) genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);

      let dist = 0;
      const cityCoords = citiesCache[city] || citiesCache[city.toLowerCase()];
      if (cityCoords && cityCoords.lat && cityCoords.lng) {
        dist = haversineKm(hLat, hLng, Number(cityCoords.lat), Number(cityCoords.lng));
      }
      totalKm += dist;

      if (art) {
        const key = art.toLowerCase();
        const prev = artistCounts.get(key) || { name: art, count: 0, km: 0 };
        prev.count += 1;
        prev.km += dist;
        artistCounts.set(key, prev);
      }
    }

    const topArtists = Array.from(artistCounts.values()).sort((a, b) => b.count - a.count);
    const topKmArtist = [...topArtists].sort((a, b) => b.km - a.km)[0];

    const yearSeries = Array.from(yearCounts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([rok, koncerty]) => ({ rok, koncerty }));

    const genreSeries = Array.from(genreCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([gatunek, liczba]) => ({ gatunek, liczba }));

    return {
      totalConcerts: concerts.length,
      uniqueArtists: artistCounts.size,
      uniqueCities: citySet.size,
      uniqueCountries: countrySet.size,
      uniqueEvents: eventSet.size,
      totalKm,
      topArtists,
      topKmArtist,
      yearSeries,
      genreSeries,
    };
  }, [concerts, citiesCache, hometown, hometownLat, hometownLng]);

  // Pasek postępu do kolejnej odznaki
  const badgeMilestone = useMemo(() => {
    const n = stats.totalConcerts;
    const steps = [10, 25, 50, 100, 150, 200, 250, 300, 500];
    const next = steps.find((s) => s > n) || n + 50;
    const prev = [...steps].reverse().find((s) => s <= n) || 0;
    const pct = Math.min(100, Math.round(((n - prev) / Math.max(1, next - prev)) * 100));
    return { current: n, next, pct, remaining: next - n };
  }, [stats.totalConcerts]);

  // Wehikuł czasu (Wspomnienie z historii)
  const timeMachineConcert = useMemo(() => {
    if (!concerts.length) return null;
    const today = new Date();
    const mmdd = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate()
    ).padStart(2, "0")}`;

    if (memorySeed === 0) {
      const exactDay = concerts.find((c: any) => String(c.data || "").endsWith(mmdd));
      if (exactDay) return { concert: exactDay, isAnniversary: true };
    }
    const idx = Math.abs(today.getDate() * 7 + memorySeed * 13) % concerts.length;
    return { concert: concerts[idx], isAnniversary: false };
  }, [concerts, memorySeed]);

  // Mini-Quiz generowany deterministycznie z własnej historii (0 tokenów AI)
  const quizQuestions = useMemo(() => {
    const qs: { question: string; options: string[]; answer: string }[] = [];
    if (stats.topArtists.length >= 4) {
      const top = stats.topArtists[0];
      const opts = [
        top.name,
        stats.topArtists[1].name,
        stats.topArtists[2].name,
        stats.topArtists[3].name,
      ].sort();
      qs.push({
        question: "Którego artystę widziałeś na żywo najwięcej razy?",
        options: opts,
        answer: top.name,
      });
    }
    if (stats.yearSeries.length >= 4) {
      const bestYear = [...stats.yearSeries].sort((a, b) => b.koncerty - a.koncerty)[0];
      const opts = stats.yearSeries
        .slice(0, 4)
        .map((y) => y.rok);
      if (!opts.includes(bestYear.rok)) opts[0] = bestYear.rok;
      qs.push({
        question: "W którym roku zaliczyłeś swój absolutny rekord koncertowy?",
        options: Array.from(new Set(opts)).sort(),
        answer: bestYear.rok,
      });
    }
    if (stats.topKmArtist && stats.topArtists.length >= 4) {
      const opts = Array.from(
        new Set([
          stats.topKmArtist.name,
          stats.topArtists[0].name,
          stats.topArtists[1].name,
          stats.topArtists[2].name,
          stats.topArtists[3].name,
        ])
      )
        .slice(0, 4)
        .sort();
      qs.push({
        question: "Za którym artystą przejechałeś łącznie najwięcej kilometrów?",
        options: opts,
        answer: stats.topKmArtist.name,
      });
    }
    return qs;
  }, [stats]);

  const currentQuestion = quizQuestions.length
    ? quizQuestions[quizIndex % quizQuestions.length]
    : null;

  const heroArtist = stats.topArtists[0];
  const heroMeta = heroArtist ? localCache[heroArtist.name.toLowerCase()] : undefined;

  const isFiltered = Boolean(activeArtist || hasActiveFilters);

  return (
    <div className="space-y-6 pb-8">
      {/* 1. Asymetryczny Hero Card — Numer #1 + Ranga fana */}
      {heroArtist && (
        <section className="fl-surface relative overflow-hidden rounded-3xl border border-white/10 bg-[var(--bg-card)] p-5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4 sm:gap-5">
              <button
                onClick={() => setDossierArtist(heroArtist.name)}
                className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-white/5 sm:h-28 sm:w-28"
              >
                {heroMeta?.image_url ? (
                  <img
                    src={heroMeta.image_url}
                    alt={heroArtist.name}
                    className="artist-portrait h-full w-full"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-display text-2xl font-bold opacity-50">
                    {heroArtist.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </button>

              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-medium opacity-80">
                  <IconTrophy size={13} className="text-[var(--accent,#ff4d6d)]" />
                  <span>Twój Numer #1 na żywo</span>
                </div>
                <button
                  onClick={() => setDossierArtist(heroArtist.name)}
                  className="mt-1.5 block text-left font-display text-2xl font-extrabold tracking-tight hover:underline sm:text-4xl"
                >
                  {heroArtist.name}
                </button>
                <p className="mt-1 text-sm opacity-75">
                  Widziany <strong className="font-semibold">{heroArtist.count}×</strong>
                  {heroArtist.km > 0 && (
                    <> · <strong className="font-semibold">{heroArtist.km.toLocaleString("pl-PL")} km</strong> trasy</>
                  )}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setDossierArtist(heroArtist.name)}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--accent,#ff4d6d)] px-3.5 py-1.5 text-xs font-semibold text-white"
                  >
                    Profil artysty <IconArrowUpRight size={14} />
                  </button>
                  {heroMeta?.preview_url && (
                    <button
                      onClick={(e) => togglePreview(heroArtist.name, heroMeta.preview_url, e)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium hover:bg-white/5"
                    >
                      {playingArtist === heroArtist.name ? (
                        <>
                          <IconPlayerPause size={14} /> Pauza
                        </>
                      ) : (
                        <>
                          <IconPlayerPlay size={14} /> Posłuchaj 30s
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {onOpenWrapped && (
              <button
                onClick={onOpenWrapped}
                className="self-start rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-left transition hover:bg-white/[0.08] sm:self-center"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent,#ff4d6d)]">
                  <IconSparkles size={15} /> Wrapped Studio 9:16
                </div>
                <div className="mt-0.5 text-xs opacity-70">
                  Stwórz kartę na Stories
                </div>
              </button>
            )}
          </div>
        </section>
      )}

      {/* 2. Skalibrowane KPI (5 kart: 2x2 na mobile + 5. pełna szerokość) */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="fl-surface rounded-2xl border border-white/10 bg-[var(--bg-card)] p-4">
          <div className="text-xs opacity-65">Koncerty</div>
          <div className="tabular-nums mt-1 font-display text-2xl font-extrabold sm:text-3xl">
            {stats.totalConcerts}
          </div>
        </div>
        <div className="fl-surface rounded-2xl border border-white/10 bg-[var(--bg-card)] p-4">
          <div className="text-xs opacity-65">Artyści</div>
          <div className="tabular-nums mt-1 font-display text-2xl font-extrabold sm:text-3xl">
            {stats.uniqueArtists}
          </div>
        </div>
        <div className="fl-surface rounded-2xl border border-white/10 bg-[var(--bg-card)] p-4">
          <div className="text-xs opacity-65">Festiwale i eventy</div>
          <div className="tabular-nums mt-1 font-display text-2xl font-extrabold sm:text-3xl">
            {stats.uniqueEvents}
          </div>
        </div>
        <div className="fl-surface rounded-2xl border border-white/10 bg-[var(--bg-card)] p-4">
          <div className="text-xs opacity-65">Miasta / Kraje</div>
          <div className="tabular-nums mt-1 font-display text-2xl font-extrabold sm:text-3xl">
            {stats.uniqueCities} <span className="text-base font-normal opacity-50">/ {stats.uniqueCountries}</span>
          </div>
        </div>
        <div className="fl-surface col-span-2 rounded-2xl border border-white/10 bg-[var(--bg-card)] p-4 sm:col-span-1">
          <div className="text-xs opacity-65">Muzyczne kilometry</div>
          <div className="tabular-nums mt-1 font-display text-2xl font-extrabold sm:text-3xl">
            {stats.totalKm.toLocaleString("pl-PL")} <span className="text-sm font-normal opacity-60">km</span>
          </div>
        </div>
      </section>

      {/* 3. Pasek postępu do kolejnego kamienia milowego */}
      <section className="fl-surface rounded-2xl border border-white/10 bg-[var(--bg-card)] p-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">
            Kolejny próg: <strong>{badgeMilestone.next} koncertów</strong>
          </span>
          <span className="tabular-nums opacity-70">
            Brakuje {badgeMilestone.remaining} ({badgeMilestone.pct}%)
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[var(--accent,#ff4d6d)] transition-all duration-300"
            style={{ width: `${badgeMilestone.pct}%` }}
          />
        </div>
      </section>

      {/* 4. Galeria Top Artyści (prawdziwe zdjęcia + kliknięcie w Dossier) */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Twoi Top Artyści</h2>
          <span className="text-xs opacity-60">Kliknij kartę, aby otworzyć profil</span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.topArtists.slice(0, 8).map((item, idx) => {
            const meta = localCache[item.name.toLowerCase()];
            const isThisPlaying = playingArtist === item.name;
            return (
              <div
                key={item.name}
                onClick={() => setDossierArtist(item.name)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setDossierArtist(item.name)}
                className="fl-surface group cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-[var(--bg-card)]"
              >
                <div className="relative aspect-square w-full overflow-hidden bg-white/5">
                  {meta?.image_url ? (
                    <img
                      src={meta.image_url}
                      alt={item.name}
                      loading="lazy"
                      className="artist-portrait h-full w-full"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 opacity-45">
                      <IconMusic size={24} stroke={1.5} />
                      <span className="font-display text-lg font-bold">
                        {item.name.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}

                  <span className="tabular-nums absolute left-2.5 top-2.5 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-xs">
                    #{idx + 1}
                  </span>

                  {meta?.preview_url && (
                    <button
                      onClick={(e) => togglePreview(item.name, meta.preview_url, e)}
                      aria-label={`Odsłuchaj ${item.name}`}
                      className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent,#ff4d6d)] text-white shadow-md transition hover:scale-105"
                    >
                      {isThisPlaying ? <IconPlayerPause size={15} /> : <IconPlayerPlay size={15} />}
                    </button>
                  )}
                </div>

                <div className="p-3">
                  <div className="truncate font-display text-sm font-bold">{item.name}</div>
                  <div className="tabular-nums mt-0.5 text-xs opacity-65">
                    {item.count} {item.count === 1 ? "koncert" : item.count < 5 ? "koncerty" : "koncertów"}
                    {item.km > 0 ? ` · ${item.km} km` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Silnik zaangażowania: Wehikuł Czasu + Koncertowy Quiz */}
      {!isFiltered && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Wehikuł czasu */}
          {timeMachineConcert?.concert && (
            <div className="fl-surface flex flex-col justify-between rounded-2xl border border-white/10 bg-[var(--bg-card)] p-5">
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent,#ff4d6d)]">
                    <IconClockHour4 size={15} />
                    {timeMachineConcert.isAnniversary ? "Rocznica koncertowa!" : "Wehikuł czasu"}
                  </span>
                  <button
                    onClick={() => setMemorySeed((s) => s + 1)}
                    className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 text-[11px] opacity-80 hover:opacity-100"
                  >
                    <IconRefresh size={12} /> Losuj
                  </button>
                </div>

                <button
                  onClick={() => setDossierArtist(timeMachineConcert.concert.artysta)}
                  className="mt-3 block text-left font-display text-xl font-bold hover:underline"
                >
                  {timeMachineConcert.concert.artysta}
                </button>
                <p className="mt-1 text-sm opacity-75">
                  {timeMachineConcert.concert.event || timeMachineConcert.concert.miejsce} ·{" "}
                  {timeMachineConcert.concert.miasto}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-xs opacity-65">
                <span>Data: {timeMachineConcert.concert.data || timeMachineConcert.concert.rok}</span>
                <button
                  onClick={() => setDossierArtist(timeMachineConcert.concert.artysta)}
                  className="font-semibold text-[var(--accent,#ff4d6d)]"
                >
                  Zobacz wspomnienie →
                </button>
              </div>
            </div>
          )}

          {/* Interaktywny Quiz z Twojej historii (0 tokenów AI) */}
          {currentQuestion && (
            <div className="fl-surface flex flex-col justify-between rounded-2xl border border-white/10 bg-[var(--bg-card)] p-5">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[var(--accent,#ff4d6d)]">
                    Sprawdź swoją pamięć
                  </span>
                  <span className="tabular-nums opacity-65">Wynik: {quizScore} pkt</span>
                </div>

                <h3 className="mt-2.5 font-display text-base font-bold leading-snug">
                  {currentQuestion.question}
                </h3>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {currentQuestion.options.map((opt) => {
                    const isPicked = selectedAnswer === opt;
                    const isCorrect = opt === currentQuestion.answer;
                    let cls =
                      "rounded-xl border border-white/15 bg-white/[0.02] px-3 py-2 text-left text-xs font-medium transition hover:bg-white/[0.06]";
                    if (selectedAnswer) {
                      if (isCorrect) {
                        cls =
                          "rounded-xl border border-emerald-500/60 bg-emerald-500/15 px-3 py-2 text-left text-xs font-semibold text-emerald-300";
                      } else if (isPicked) {
                        cls =
                          "rounded-xl border border-rose-500/60 bg-rose-500/15 px-3 py-2 text-left text-xs font-semibold text-rose-300";
                      }
                    }
                    return (
                      <button
                        key={opt}
                        disabled={Boolean(selectedAnswer)}
                        onClick={() => {
                          setSelectedAnswer(opt);
                          if (opt === currentQuestion.answer) setQuizScore((s) => s + 1);
                        }}
                        className={cls}
                      >
                        <span className="flex items-center justify-between gap-1">
                          <span className="truncate">{opt}</span>
                          {selectedAnswer && isCorrect && <IconCheck size={14} />}
                          {selectedAnswer && isPicked && !isCorrect && <IconX size={14} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedAnswer && (
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => {
                      setSelectedAnswer(null);
                      setQuizIndex((i) => i + 1);
                    }}
                    className="text-xs font-semibold text-[var(--accent,#ff4d6d)] hover:underline"
                  >
                    Następne pytanie →
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* 6. Nadchodzące koncerty (ukrywane gdy profilujemy konkretnego artystę) */}
      {!isFiltered && upcoming.length > 0 && (
        <section className="fl-surface rounded-2xl border border-white/10 bg-[var(--bg-card)] p-5">
          <h2 className="font-display text-base font-bold">
            Nadchodzące wyjazdy ({upcoming.length})
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {upcoming.slice(0, 4).map((u: any, idx: number) => (
              <div
                key={u.id || idx}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{u.artysta || u.event}</div>
                  <div className="truncate text-xs opacity-65">
                    {u.event ? `${u.event} · ` : ""}
                    {u.miasto} · {u.data}
                  </div>
                </div>
                <span className="ml-2 shrink-0 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold">
                  {u.status || "Plan"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 7. Hall of Fame (w tym Liczba kilometrów za artystą) */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div
          onClick={() => heroArtist && setDossierArtist(heroArtist.name)}
          className="fl-surface cursor-pointer rounded-2xl border border-white/10 bg-[var(--bg-card)] p-4"
        >
          <div className="text-xs opacity-60">Król Sceny</div>
          <div className="mt-1 truncate font-display text-lg font-bold">
            {heroArtist?.name || "—"}
          </div>
          <div className="text-xs opacity-70">{heroArtist ? `${heroArtist.count} koncertów` : ""}</div>
        </div>

        <div
          onClick={() => stats.topKmArtist && setDossierArtist(stats.topKmArtist.name)}
          className="fl-surface cursor-pointer rounded-2xl border border-white/10 bg-[var(--bg-card)] p-4"
        >
          <div className="text-xs opacity-60">Liczba kilometrów za artystą</div>
          <div className="mt-1 truncate font-display text-lg font-bold">
            {stats.topKmArtist?.name || "—"}
          </div>
          <div className="tabular-nums text-xs opacity-70">
            {stats.topKmArtist ? `${stats.topKmArtist.km.toLocaleString("pl-PL")} km` : ""}
          </div>
        </div>

        <div className="fl-surface rounded-2xl border border-white/10 bg-[var(--bg-card)] p-4">
          <div className="text-xs opacity-60">Rekordowy Rok</div>
          <div className="tabular-nums mt-1 font-display text-lg font-bold">
            {[...stats.yearSeries].sort((a, b) => b.koncerty - a.koncerty)[0]?.rok || "—"}
          </div>
          <div className="tabular-nums text-xs opacity-70">
            {[...stats.yearSeries].sort((a, b) => b.koncerty - a.koncerty)[0]
              ? `${[...stats.yearSeries].sort((a, b) => b.koncerty - a.koncerty)[0].koncerty} koncertów`
              : ""}
          </div>
        </div>
      </section>

      {/* 8. Wykresy Recharts */}
      {stats.yearSeries.length > 0 && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="fl-surface rounded-2xl border border-white/10 bg-[var(--bg-card)] p-4">
            <h3 className="mb-3 font-display text-sm font-bold">Koncerty w kolejnych latach</h3>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.yearSeries}>
                  <XAxis dataKey="rok" tick={{ fontSize: 11, fill: "currentColor" }} />
                  <YAxis tick={{ fontSize: 11, fill: "currentColor" }} width={28} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#141418",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: "12px",
                      fontSize: "12px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="koncerty"
                    stroke="var(--accent, #ff4d6d)"
                    fill="var(--accent, #ff4d6d)"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="fl-surface rounded-2xl border border-white/10 bg-[var(--bg-card)] p-4">
            <h3 className="mb-3 font-display text-sm font-bold">Top gatunki muzyczne</h3>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.genreSeries} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11, fill: "currentColor" }} />
                  <YAxis
                    dataKey="gatunek"
                    type="category"
                    tick={{ fontSize: 11, fill: "currentColor" }}
                    width={95}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#141418",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: "12px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar
                    dataKey="liczba"
                    fill="var(--accent, #ff4d6d)"
                    radius={[0, 8, 8, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}

      {/* Karta Artysty (Artist Dossier Bottom Sheet) */}
      <ArtistDossierSheet
        artistName={dossierArtist}
        onClose={() => setDossierArtist(null)}
        concerts={concerts}
        artistMeta={dossierArtist ? localCache[dossierArtist.toLowerCase()] : undefined}
        artistsCache={localCache}
        onUpdateCache={setLocalCache}
        onSelectArtistFilter={onSelectArtist}
        onOpenOtherArtist={(other) => setDossierArtist(other)}
        streamingPlatform={streamingPlatform}
      />
    </div>
  );
};

export default StartView;
