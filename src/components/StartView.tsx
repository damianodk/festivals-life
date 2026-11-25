import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
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
  IconAlertCircle,
  IconEdit,
  IconFilterOff,
} from "@tabler/icons-react";
import {
  ResolvedArtist,
  loadLocalArtistCache,
  resolveArtistsBatch,
} from "../lib/artistResolver";
import { getCityCoords, haversineKm } from "../lib/geo";
import type { EventMeta } from "../types";
import { ArtistDossierSheet } from "./ArtistDossierSheet";

export type ConcertKind = "solowy" | "festiwal";

export const CONCERT_TYPE_STORAGE_KEY = "festlife_concert_types_v1";

export function loadTypeOverrides(): Record<string, ConcertKind> {
  try {
    const raw = localStorage.getItem(CONCERT_TYPE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getConcertCompositeKey(c: any): string {
  return `meta:${(c.artysta || "").trim().toLowerCase()}|${String(
    c.data || c.rok || ""
  ).trim()}|${(c.event || "").trim().toLowerCase()}|${(c.miasto || "")
    .trim()
    .toLowerCase()}`;
}

export function saveConcertKindLocal(c: any, kind: ConcertKind): Record<string, ConcertKind> {
  const current = loadTypeOverrides();
  const next = { ...current };
  if (c.id !== undefined && c.id !== null) {
    next[String(c.id)] = kind;
  }
  next[getConcertCompositeKey(c)] = kind;
  try {
    localStorage.setItem(CONCERT_TYPE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event("festlife:concert-updated"));
  return next;
}

export function inferKindFromFields(eventName?: string, artistName?: string): ConcertKind {
  const ev = String(eventName || "").trim().toLowerCase();
  const art = String(artistName || "").trim().toLowerCase();
  if (!ev || ev === art || /^koncert(\s+solowy)?$/i.test(ev)) return "solowy";

  if (
    ev.includes("fest") ||
    ev.includes("open'er") ||
    ev.includes("open’er") ||
    ev.includes("opener") ||
    ev.includes("orange") ||
    ev.includes("pol'and'rock") ||
    ev.includes("pol’and’rock") ||
    ev.includes("polandrock") ||
    ev.includes("woodstock") ||
    ev.includes("tauron") ||
    ev.includes("audioriver") ||
    ev.includes("mystic") ||
    ev.includes("sziget") ||
    ev.includes("primavera") ||
    ev.includes("coachella") ||
    ev.includes("glastonbury") ||
    ev.includes("rock am ring") ||
    ev.includes("rock im park") ||
    ev.includes("nova rock") ||
    ev.includes("colours") ||
    ev.includes("pohoda") ||
    ev.includes("roskilde") ||
    ev.includes("werchter") ||
    ev.includes("pukkelpop") ||
    ev.includes("jarocin") ||
    ev.includes("męskie granie") ||
    ev.includes("meskie granie") ||
    ev.includes("salt wave") ||
    ev.includes("sun festival") ||
    ev.includes("clout") ||
    ev.includes("sbt") ||
    ev.includes("tomorrowland") ||
    ev.includes("ultra") ||
    ev.includes("exit")
  ) {
    return "festiwal";
  }

  return "solowy";
}

export function detectConcertKind(
  c: any,
  overrides?: Record<string, ConcertKind>,
  eventsMeta?: Record<string, EventMeta>,
  allConcerts?: any[]
): ConcertKind {
  const map = overrides || loadTypeOverrides();
  if (c.id !== undefined && c.id !== null && map[String(c.id)]) {
    return map[String(c.id)];
  }
  const compKey = getConcertCompositeKey(c);
  if (map[compKey]) {
    return map[compKey];
  }

  // Sprawdź zapisane pole podgatunek (używane przez AddView i EventsView) lub typ/rodzaj
  const rawTyp = String(c.podgatunek || c.typ || c.type || c.rodzaj || "")
    .trim()
    .toLowerCase();
  if (rawTyp === "solowy" || rawTyp === "solo" || rawTyp === "koncert solowy" || rawTyp === "klubowy") {
    return "solowy";
  }
  if (rawTyp === "festiwal" || rawTyp === "festival" || rawTyp === "fest") {
    return "festiwal";
  }

  const ev = String(c.event || "").trim();
  if (!ev || /^koncert(\s+solowy)?$/i.test(ev)) return "solowy";

  if (eventsMeta) {
    const key = `${ev}|${c.rok || "?"}`;
    if ((eventsMeta[key]?.lineup?.length || 0) > 1) return "festiwal";
  }

  if (allConcerts && allConcerts.length > 0) {
    const sameEventArtists = new Set(
      allConcerts
        .filter(
          (other) =>
            String(other.event || "").trim().toLowerCase() === ev.toLowerCase() &&
            String(other.rok || "") === String(c.rok || "")
        )
        .map((other) => String(other.artysta || "").trim().toLowerCase())
        .filter(Boolean)
    );
    if (sameEventArtists.size > 1) return "festiwal";
  }

  return inferKindFromFields(c.event, c.artysta);
}

const MONTH_LABELS = [
  "Sty",
  "Lut",
  "Mar",
  "Kwi",
  "Maj",
  "Cze",
  "Lip",
  "Sie",
  "Wrz",
  "Paź",
  "Lis",
  "Gru",
];

const PIE_COLORS = ["#ff4d6d", "#38bdf8", "#a855f7", "#f59e0b"];

// Dodatkowa baza współrzędnych dla miast spoza słownika geo.ts
const EXTRA_CITIES: Record<string, [number, number]> = {
  warszawa: [52.2297, 21.0122],
  krakow: [50.0647, 19.945],
  poznan: [52.4064, 16.9252],
  wroclaw: [51.1079, 17.0385],
  gdansk: [54.352, 18.6466],
  gdynia: [54.5189, 18.5305],
  sopot: [54.4416, 18.5601],
  katowice: [50.2649, 19.0238],
  chorzow: [50.2975, 18.9546],
  lodz: [51.7592, 19.456],
  szczecin: [53.4285, 14.5528],
  bydgoszcz: [53.1235, 18.0084],
  torun: [53.0138, 18.5984],
  lublin: [51.2465, 22.5684],
  bialystok: [53.1325, 23.1688],
  rzeszow: [50.0412, 21.9991],
  olsztyn: [53.7784, 20.4801],
  gliwice: [50.2945, 18.6714],
  czaplinek: [53.5567, 16.2333],
  broczyno: [53.5311, 16.265],
  kostrzyn: [52.5878, 14.6644],
  "kostrzyn nad odra": [52.5878, 14.6644],
  jarocin: [51.9727, 17.5026],
  ostroda: [53.6967, 19.9647],
  cieszanow: [50.2583, 23.1333],
  berlin: [52.52, 13.405],
  praga: [50.0755, 14.4378],
  prague: [50.0755, 14.4378],
  wieden: [48.2082, 16.3738],
  vienna: [48.2082, 16.3738],
  budapeszt: [47.4979, 19.0402],
  budapest: [47.4979, 19.0402],
  londyn: [51.5072, -0.1276],
  london: [51.5072, -0.1276],
  paryz: [48.8566, 2.3522],
  paris: [48.8566, 2.3522],
  amsterdam: [52.3676, 4.9041],
  werchter: [50.9706, 4.685],
  roskilde: [55.6415, 12.0803],
  ostrava: [49.8209, 18.2625],
  ostrawa: [49.8209, 18.2625],
  "hradec kralove": [50.2104, 15.8252],
  trencin: [48.8945, 18.0444],
  nickelsdorf: [47.9394, 17.0686],
};

function resolveCoordsTuple(
  city: string,
  cityCoords?: Record<string, [number, number]>
): [number, number] | null {
  if (!city) return null;
  const fromGeo = getCityCoords(city, cityCoords || {});
  if (fromGeo && fromGeo.length === 2 && (fromGeo[0] !== 0 || fromGeo[1] !== 0)) {
    return fromGeo;
  }
  const norm = city
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l");
  return EXTRA_CITIES[norm] || null;
}

// Kontener wykresu bez ResizeObserver (brak pętli odświeżania i brak skakania)
const StableChartBox: React.FC<{
  height?: number;
  children: (width: number) => React.ReactNode;
}> = ({ height = 220, children }) => {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number>(360);

  useLayoutEffect(() => {
    const measure = () => {
      if (!boxRef.current) return;
      const w = Math.floor(boxRef.current.getBoundingClientRect().width);
      if (w > 60) {
        setWidth((prev) => (Math.abs(w - prev) >= 8 ? w : prev));
      }
    };
    measure();

    let timer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(measure, 220);
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div ref={boxRef} style={{ width: "100%", height, minWidth: 0, overflow: "hidden" }}>
      {children(width)}
    </div>
  );
};

export const StartView: React.FC<any> = (props) => {
  const rawConcerts: any[] = Array.isArray(props.filteredConcerts)
    ? props.filteredConcerts
    : Array.isArray(props.concerts)
    ? props.concerts
    : Array.isArray(props.allConcerts)
    ? props.allConcerts
    : [];

  // Stabilizacja referencji tablicy koncertów — chroni przed przeliczaniem przy każdym re-renderze App.tsx
  const concertsSig = `${rawConcerts.length}:${rawConcerts[0]?.id ?? ""}:${
    rawConcerts[rawConcerts.length - 1]?.id ?? ""
  }:${props.activeArtist || props.artistFilter || ""}:${props.hasActiveFilters ? "1" : "0"}`;
  const stableConcertsRef = useRef<{ sig: string; list: any[] }>({
    sig: "",
    list: rawConcerts,
  });
  if (stableConcertsRef.current.sig !== concertsSig) {
    stableConcertsRef.current = { sig: concertsSig, list: rawConcerts };
  }
  const concerts = stableConcertsRef.current.list;

  const allConcerts: any[] = Array.isArray(props.allConcerts)
    ? props.allConcerts
    : concerts;

  const upcoming: any[] = Array.isArray(props.upcomingConcerts)
    ? props.upcomingConcerts
    : Array.isArray(props.upcoming)
    ? props.upcoming
    : [];

  const eventsMeta: Record<string, EventMeta> | undefined = props.eventsMeta;
  const parentArtistsCache = props.artistsCache || props.artistsMetaCache || props.artists;
  const cityCoords: Record<string, [number, number]> | undefined =
    props.cityCoords || props.citiesCache;

  const homeCoords: [number, number] = useMemo(() => {
    if (Array.isArray(props.settings?.hometown_coords) && props.settings.hometown_coords.length === 2) {
      return [Number(props.settings.hometown_coords[0]), Number(props.settings.hometown_coords[1])];
    }
    if (Number(props.profile?.hometown_lat) && Number(props.profile?.hometown_lng)) {
      return [Number(props.profile.hometown_lat), Number(props.profile.hometown_lng)];
    }
    return [52.4064, 16.9252];
  }, [props.settings?.hometown_coords, props.profile?.hometown_lat, props.profile?.hometown_lng]);

  const activeArtist = props.activeArtist || props.artistFilter || "";
  const hasActiveFilters = Boolean(props.hasActiveFilters || props.hasActiveFilter || activeArtist);
  const onSelectArtist =
    props.onSelectArtist || props.onQuickSearch || props.setArtistFilter;
  const onResetFilters = props.onResetFilters || props.resetFilters;
  const onOpenWrapped =
    props.onOpenWrapped || props.setWrappedOpen || props.onShowWrapped;
  const streamingPlatform =
    props.streamingProvider ||
    props.streamingPlatform ||
    props.settings?.streaming_platform ||
    "spotify";

  const [localCache, setLocalCache] = useState<Record<string, ResolvedArtist>>(() => ({
    ...loadLocalArtistCache(),
    ...(parentArtistsCache || {}),
  }));
  const [typeOverrides, setTypeOverrides] = useState<Record<string, ConcertKind>>(() =>
    loadTypeOverrides()
  );
  const [typeEditorOpen, setTypeEditorOpen] = useState(false);
  const [typeSearch, setTypeSearch] = useState("");
  const [, setDataRevision] = useState(0);

  const [dossierArtist, setDossierArtist] = useState<string | null>(null);
  const [playingArtist, setPlayingArtist] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [memorySeed, setMemorySeed] = useState<number>(0);
  const [quizIndex, setQuizIndex] = useState<number>(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState<number>(0);

  useEffect(() => {
    const handler = () => {
      setTypeOverrides(loadTypeOverrides());
      setDataRevision((r) => r + 1);
    };
    window.addEventListener("festlife:concert-updated", handler);
    return () => window.removeEventListener("festlife:concert-updated", handler);
  }, []);

  // Synchronizacja cache z rodzica tylko raz na faktyczną zmianę kluczy
  const lastSyncedCacheSig = useRef<string>("");
  useEffect(() => {
    if (!parentArtistsCache || typeof parentArtistsCache !== "object") return;
    const keys = Object.keys(parentArtistsCache);
    if (!keys.length) return;
    const sig = `${keys.length}:${keys[0]}:${keys[keys.length - 1]}`;
    if (sig === lastSyncedCacheSig.current) return;
    lastSyncedCacheSig.current = sig;
    setLocalCache((prev) => ({ ...prev, ...parentArtistsCache }));
  }, [parentArtistsCache]);

  // Buforowane pobieranie metadanych artystów — zero dziesiątek re-renderów w tle!
  const resolvedBatchSig = useRef<string>("");
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

    const sig = `${sortedArtists.length}:${sortedArtists.slice(0, 5).join("|")}`;
    if (sig === resolvedBatchSig.current) return;
    resolvedBatchSig.current = sig;

    let pendingMerged: Record<string, ResolvedArtist> | null = null;
    const flushTimer = setInterval(() => {
      if (pendingMerged) {
        const snapshot = pendingMerged;
        pendingMerged = null;
        setLocalCache(snapshot);
      }
    }, 2500);

    resolveArtistsBatch(sortedArtists, localCache, (merged) => {
      pendingMerged = merged;
    });

    return () => {
      clearInterval(flushTimer);
      if (pendingMerged) {
        setLocalCache(pendingMerged);
      }
    };
  }, [concerts]);

  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  const handleToggleConcertKind = async (concert: any, nextKind: ConcertKind) => {
    const nextMap = saveConcertKindLocal(concert, nextKind);
    setTypeOverrides(nextMap);

    if (props.onSaveConcert && concert.id !== undefined && concert.id !== null) {
      const { id, ...rest } = concert;
      await props.onSaveConcert(
        {
          ...rest,
          podgatunek: nextKind === "festiwal" ? "Festiwal" : "Koncert solowy",
        },
        id
      );
    }
  };

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

  // Pełne statystyki + kilometry liczone identycznie jak w EventsView (getCityCoords + haversineKm)
  const stats = useMemo(() => {
    const artistCounts = new Map<string, { name: string; count: number; km: number }>();
    const cityCounts = new Map<string, number>();
    const countryCounts = new Map<string, number>();
    const eventSet = new Set<string>();
    const yearCounts = new Map<string, number>();
    const genreCounts = new Map<string, number>();
    const monthCounts = new Array<number>(12).fill(0);
    const ratingCounts = new Map<number, number>([
      [5, 0],
      [4, 0],
      [3, 0],
      [2, 0],
      [1, 0],
    ]);

    const countedTrips = new Set<string>();
    let festivalCount = 0;
    let soloCount = 0;
    let totalKm = 0;

    concerts.forEach((c) => {
      const art = (c.artysta || "").trim();
      const city = (c.miasto || "").trim();
      const country = (c.kraj || "").trim();
      const rawDate = String(c.data || "");
      const yr = String(c.rok || (rawDate.length >= 4 ? rawDate.slice(0, 4) : ""));
      const ev = (c.event || "").trim();
      const rating = Math.round(Number(c.ocena) || 0);

      if (city) cityCounts.set(city, (cityCounts.get(city) || 0) + 1);
      if (country) countryCounts.set(country, (countryCounts.get(country) || 0) + 1);
      if (ev) eventSet.add(ev);
      if (yr) yearCounts.set(yr, (yearCounts.get(yr) || 0) + 1);

      // Gatunki muzyczne (z rekordu koncertu + fallback z metadanych artysty)
      const artistMeta = art ? localCache[art.toLowerCase()] : undefined;
      const rawGenres: string[] = [];
      const concertGenreField = c.gatunek || c.genre || c.kategoria || c.styl;
      if (Array.isArray(concertGenreField)) {
        rawGenres.push(...concertGenreField.map(String));
      } else if (typeof concertGenreField === "string" && concertGenreField.trim()) {
        rawGenres.push(...concertGenreField.split(/[,;/]+/));
      } else if (Array.isArray(c.genres) && c.genres.length) {
        rawGenres.push(...c.genres.map(String));
      } else if (artistMeta?.genres?.length) {
        rawGenres.push(artistMeta.genres[0]);
      }

      for (const g of rawGenres) {
        const cleanG = g.trim();
        if (cleanG && cleanG.toLowerCase() !== "inne" && cleanG.toLowerCase() !== "other") {
          const normalizedG = cleanG.charAt(0).toUpperCase() + cleanG.slice(1);
          genreCounts.set(normalizedG, (genreCounts.get(normalizedG) || 0) + 1);
        }
      }

      // Miesiąc z daty YYYY-MM-DD
      const monthMatch = rawDate.match(/^\d{4}-(\d{2})/);
      if (monthMatch) {
        const mIdx = Number(monthMatch[1]) - 1;
        if (mIdx >= 0 && mIdx < 12) monthCounts[mIdx] += 1;
      }

      // Koncert solowy vs Festiwal
      const kind = detectConcertKind(c, typeOverrides, eventsMeta, allConcerts);
      if (kind === "festiwal") {
        festivalCount += 1;
      } else {
        soloCount += 1;
      }

      if (rating >= 1 && rating <= 5) {
        ratingCounts.set(rating, (ratingCounts.get(rating) || 0) + 1);
      }

      // Muzyczne kilometry (tam i z powrotem, dokładnie jak w EventsView)
      const coords = resolveCoordsTuple(city, cityCoords);
      let roundTripKm = 0;
      if (coords) {
        const oneWay = haversineKm(homeCoords[0], homeCoords[1], coords[0], coords[1]);
        if (oneWay > 15) {
          roundTripKm = Math.round(oneWay * 2);
        }
      }

      const tripKey = `${yr}|${ev}|${city.toLowerCase()}`;
      if (roundTripKm > 0 && !countedTrips.has(tripKey)) {
        countedTrips.add(tripKey);
        totalKm += roundTripKm;
      }

      if (art) {
        const key = art.toLowerCase();
        const prev = artistCounts.get(key) || { name: art, count: 0, km: 0 };
        prev.count += 1;
        prev.km += roundTripKm;
        artistCounts.set(key, prev);
      }
    });

    const topArtists = Array.from(artistCounts.values()).sort((a, b) => b.count - a.count);
    const topKmArtist = [...topArtists].sort((a, b) => b.km - a.km)[0];

    const yearSeries = Array.from(yearCounts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([rok, koncerty]) => ({ rok, koncerty }));

    const monthSeries = MONTH_LABELS.map((miesiac, idx) => ({
      miesiac,
      koncerty: monthCounts[idx],
    }));

    const typeSeries = [
      { name: "Koncerty solowe", value: soloCount },
      { name: "Festiwale", value: festivalCount },
    ].filter((d) => d.value > 0);

    const citySeries = Array.from(cityCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([miasto, liczba]) => ({ miasto, liczba }));

    const genreSeries = Array.from(genreCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([gatunek, liczba]) => ({ gatunek, liczba }));

    const ratingSeries = [5, 4, 3, 2, 1].map((stars) => ({
      ocena: `${stars} ★`,
      liczba: ratingCounts.get(stars) || 0,
    }));

    const soloToFestRatio =
      festivalCount > 0 ? (soloCount / festivalCount).toFixed(1) : `${soloCount}`;

    return {
      totalConcerts: concerts.length,
      uniqueArtists: artistCounts.size,
      uniqueCities: cityCounts.size,
      uniqueCountries: countryCounts.size,
      uniqueEvents: eventSet.size,
      totalKm,
      soloCount,
      festivalCount,
      soloToFestRatio,
      topArtists,
      topKmArtist,
      yearSeries,
      monthSeries,
      typeSeries,
      citySeries,
      genreSeries,
      ratingSeries,
      hasRatings: Array.from(ratingCounts.values()).some((v) => v > 0),
    };
  }, [concerts, allConcerts, eventsMeta, cityCoords, homeCoords, localCache, typeOverrides]);

  const badgeMilestone = useMemo(() => {
    const n = stats.totalConcerts;
    const steps = [10, 25, 50, 100, 150, 200, 250, 300, 500];
    const next = steps.find((s) => s > n) || n + 50;
    const prev = [...steps].reverse().find((s) => s <= n) || 0;
    const pct = Math.min(100, Math.round(((n - prev) / Math.max(1, next - prev)) * 100));
    return { current: n, next, pct, remaining: next - n };
  }, [stats.totalConcerts]);

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
      const opts = stats.yearSeries.slice(0, 4).map((y) => y.rok);
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

  const tooltipStyle = {
    backgroundColor: "#141418",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "12px",
    fontSize: "12px",
    color: "#f5f5f7",
  };

  const filteredConcertsForEditor = useMemo(() => {
    const q = typeSearch.trim().toLowerCase();
    return concerts
      .filter((c) => {
        if (!q) return true;
        return (
          String(c.artysta || "").toLowerCase().includes(q) ||
          String(c.event || "").toLowerCase().includes(q) ||
          String(c.miasto || "").toLowerCase().includes(q) ||
          String(c.data || c.rok || "").toLowerCase().includes(q)
        );
      })
      .slice(0, 40);
  }, [concerts, typeSearch]);

  if (!concerts.length) {
    return (
      <div className="fl-surface rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
        <IconAlertCircle size={32} className="mx-auto text-[var(--accent)]" />
        <h2 className="mt-3 font-display text-lg font-bold">
          {allConcerts.length > 0
            ? "Brak koncertów dla wybranego filtra"
            : "Brak załadowanych koncertów na tym koncie"}
        </h2>
        <p className="mx-auto mt-1.5 max-w-md text-xs text-[var(--text-muted)]">
          {allConcerts.length > 0
            ? "Wyczyść aktywne filtry, aby przywrócić pełne statystyki."
            : "Jeśli Twoje koncerty były przypisane do drugiego konta w Supabase, wyloguj się w zakładce Ja i zaloguj na właściwy adres."}
        </p>
        {allConcerts.length > 0 && onResetFilters && (
          <button
            onClick={onResetFilters}
            className="fl-btn fl-btn-primary mt-4 !text-xs"
          >
            Wyczyść filtry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Pasek aktywnego filtra artysty o stałym kolorze */}
      {isFiltered && (
        <div className="fl-surface flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3">
          <div className="min-w-0 text-xs">
            <span className="text-[var(--text-muted)]">Aktywny filtr widoku: </span>
            <strong className="font-semibold text-[var(--accent)]">
              {activeArtist || "Wybrane wydarzenia"}
            </strong>
          </div>
          {onResetFilters && (
            <button
              onClick={onResetFilters}
              className="fl-btn !px-3 !py-1 !text-xs shrink-0"
            >
              <IconFilterOff size={13} /> Pokaż cały raport
            </button>
          )}
        </div>
      )}

      {/* 1. Hero Card — Numer #1 */}
      {heroArtist && (
        <section className="fl-surface relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4 sm:gap-5">
              <button
                onClick={() => setDossierArtist(heroArtist.name)}
                className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-2)] sm:h-28 sm:w-28"
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
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-muted)]">
                  <IconTrophy size={13} className="text-[var(--accent)]" />
                  <span>{isFiltered ? "Wybrany artysta" : "Twój Numer #1 na żywo"}</span>
                </div>
                <button
                  onClick={() => setDossierArtist(heroArtist.name)}
                  className="mt-1.5 block text-left font-display text-2xl font-extrabold tracking-tight hover:underline sm:text-4xl"
                >
                  {heroArtist.name}
                </button>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Widziany <strong className="font-semibold text-[var(--text)]">{heroArtist.count}×</strong>
                  {" · "}
                  <strong className="font-semibold text-[var(--text)]">
                    {heroArtist.km.toLocaleString("pl-PL")} km
                  </strong>{" "}
                  trasy
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setDossierArtist(heroArtist.name)}
                    className="fl-btn fl-btn-primary !rounded-full !px-3.5 !py-1.5 !text-xs"
                  >
                    Profil artysty <IconArrowUpRight size={14} />
                  </button>
                  {heroMeta?.preview_url && (
                    <button
                      onClick={(e) => togglePreview(heroArtist.name, heroMeta.preview_url, e)}
                      className="fl-btn !rounded-full !px-3 !py-1.5 !text-xs"
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
                className="self-start rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-2)] px-4 py-3 text-left hover:opacity-90 sm:self-center"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)]">
                  <IconSparkles size={15} /> Wrapped Studio 9:16
                </div>
                <div className="mt-0.5 text-xs text-[var(--text-muted)]">Stwórz kartę na Stories</div>
              </button>
            )}
          </div>
        </section>
      )}

      {/* 2. Skalibrowane KPI */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="fl-surface rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-xs text-[var(--text-muted)]">Koncerty</div>
          <div className="tabular-nums mt-1 font-display text-2xl font-extrabold sm:text-3xl">
            {stats.totalConcerts}
          </div>
        </div>
        <div className="fl-surface rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-xs text-[var(--text-muted)]">Artyści</div>
          <div className="tabular-nums mt-1 font-display text-2xl font-extrabold sm:text-3xl">
            {stats.uniqueArtists}
          </div>
        </div>
        <div className="fl-surface rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-xs text-[var(--text-muted)]">Festiwale i eventy</div>
          <div className="tabular-nums mt-1 font-display text-2xl font-extrabold sm:text-3xl">
            {stats.uniqueEvents}
          </div>
        </div>
        <div className="fl-surface rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-xs text-[var(--text-muted)]">Miasta / Kraje</div>
          <div className="tabular-nums mt-1 font-display text-2xl font-extrabold sm:text-3xl">
            {stats.uniqueCities}{" "}
            <span className="text-base font-normal text-[var(--text-muted)]">/ {stats.uniqueCountries}</span>
          </div>
        </div>
        <div className="fl-surface col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:col-span-1">
          <div className="text-xs text-[var(--text-muted)]">Muzyczne kilometry</div>
          <div className="tabular-nums mt-1 font-display text-2xl font-extrabold sm:text-3xl">
            {stats.totalKm.toLocaleString("pl-PL")}{" "}
            <span className="text-sm font-normal text-[var(--text-muted)]">km</span>
          </div>
        </div>
      </section>

      {/* 3. Pasek postępu */}
      <section className="fl-surface rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">
            Kolejny próg: <strong>{badgeMilestone.next} koncertów</strong>
          </span>
          <span className="tabular-nums text-[var(--text-muted)]">
            Brakuje {badgeMilestone.remaining} ({badgeMilestone.pct}%)
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
          <div
            className="h-full rounded-full bg-[var(--accent)]"
            style={{ width: `${badgeMilestone.pct}%` }}
          />
        </div>
      </section>

      {/* 4. Galeria Top Artyści */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Twoi Top Artyści</h2>
          <span className="text-xs text-[var(--text-muted)]">Kliknij kartę, aby otworzyć profil i zdjęcia</span>
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
                className="fl-surface group cursor-pointer overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
              >
                <div className="relative aspect-square w-full overflow-hidden bg-[var(--surface-2)]">
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

                  <span className="tabular-nums absolute left-2.5 top-2.5 rounded-full bg-black/75 px-2 py-0.5 text-[11px] font-bold text-white">
                    #{idx + 1}
                  </span>

                  {meta?.preview_url && (
                    <button
                      onClick={(e) => togglePreview(item.name, meta.preview_url, e)}
                      aria-label={`Odsłuchaj ${item.name}`}
                      className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-ink,#fff)] shadow-md"
                    >
                      {isThisPlaying ? <IconPlayerPause size={15} /> : <IconPlayerPlay size={15} />}
                    </button>
                  )}
                </div>

                <div className="p-3">
                  <div className="truncate font-display text-sm font-bold">{item.name}</div>
                  <div className="tabular-nums mt-0.5 text-xs text-[var(--text-muted)]">
                    {item.count}{" "}
                    {item.count === 1 ? "koncert" : item.count < 5 ? "koncerty" : "koncertów"}
                    {item.km > 0 ? ` · ${item.km.toLocaleString("pl-PL")} km` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Wehikuł Czasu + Koncertowy Quiz */}
      {!isFiltered && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {timeMachineConcert?.concert && (
            <div className="fl-surface flex flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)]">
                    <IconClockHour4 size={15} />
                    {timeMachineConcert.isAnniversary ? "Rocznica koncertowa!" : "Wehikuł czasu"}
                  </span>
                  <button
                    onClick={() => setMemorySeed((s) => s + 1)}
                    className="fl-btn !rounded-full !px-2.5 !py-1 !text-[11px]"
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
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  {timeMachineConcert.concert.event || timeMachineConcert.concert.miejsce} ·{" "}
                  {timeMachineConcert.concert.miasto}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3 text-xs text-[var(--text-muted)]">
                <span>
                  Data: {timeMachineConcert.concert.data || timeMachineConcert.concert.rok}
                </span>
                <button
                  onClick={() => setDossierArtist(timeMachineConcert.concert.artysta)}
                  className="font-semibold text-[var(--accent)]"
                >
                  Zobacz wspomnienie →
                </button>
              </div>
            </div>
          )}

          {currentQuestion && (
            <div className="fl-surface flex flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[var(--accent)]">
                    Sprawdź swoją pamięć
                  </span>
                  <span className="tabular-nums text-[var(--text-muted)]">Wynik: {quizScore} pkt</span>
                </div>

                <h3 className="mt-2.5 font-display text-base font-bold leading-snug">
                  {currentQuestion.question}
                </h3>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {currentQuestion.options.map((opt) => {
                    const isPicked = selectedAnswer === opt;
                    const isCorrect = opt === currentQuestion.answer;
                    let cls =
                      "rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] px-3 py-2 text-left text-xs font-medium hover:opacity-90";
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
                    className="text-xs font-semibold text-[var(--accent)] hover:underline"
                  >
                    Następne pytanie →
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* 6. Nadchodzące koncerty */}
      {!isFiltered && upcoming.length > 0 && (
        <section className="fl-surface rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="font-display text-base font-bold">
            Nadchodzące wyjazdy ({upcoming.length})
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {upcoming.slice(0, 4).map((u: any, idx: number) => (
              <div
                key={u.id || idx}
                className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{u.artysta || u.event}</div>
                  <div className="truncate text-xs text-[var(--text-muted)]">
                    {u.event ? `${u.event} · ` : ""}
                    {u.miasto} · {u.data}
                  </div>
                </div>
                <span className="ml-2 shrink-0 rounded-full bg-[var(--surface)] px-2.5 py-0.5 text-[11px] font-semibold">
                  {u.status_biletu || u.status || "Plan"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 7. Hall of Fame */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div
          onClick={() => heroArtist && setDossierArtist(heroArtist.name)}
          className="fl-surface cursor-pointer rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
        >
          <div className="text-xs text-[var(--text-muted)]">Król Sceny</div>
          <div className="mt-1 truncate font-display text-lg font-bold">
            {heroArtist?.name || "—"}
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            {heroArtist ? `${heroArtist.count} koncertów` : ""}
          </div>
        </div>

        <div
          onClick={() => stats.topKmArtist && setDossierArtist(stats.topKmArtist.name)}
          className="fl-surface cursor-pointer rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
        >
          <div className="text-xs text-[var(--text-muted)]">Liczba kilometrów za artystą</div>
          <div className="mt-1 truncate font-display text-lg font-bold">
            {stats.topKmArtist?.name || "—"}
          </div>
          <div className="tabular-nums text-xs text-[var(--text-muted)]">
            {stats.topKmArtist ? `${stats.topKmArtist.km.toLocaleString("pl-PL")} km` : ""}
          </div>
        </div>

        <div className="fl-surface rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-xs text-[var(--text-muted)]">Rekordowy Rok</div>
          <div className="tabular-nums mt-1 font-display text-lg font-bold">
            {[...stats.yearSeries].sort((a, b) => b.koncerty - a.koncerty)[0]?.rok || "—"}
          </div>
          <div className="tabular-nums text-xs text-[var(--text-muted)]">
            {[...stats.yearSeries].sort((a, b) => b.koncerty - a.koncerty)[0]
              ? `${[...stats.yearSeries].sort((a, b) => b.koncerty - a.koncerty)[0].koncerty} koncertów`
              : ""}
          </div>
        </div>
      </section>

      {/* 8. Pełny zestaw wykresów (6 wykresów, bez skakania) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Analityka koncertowa</h2>
          <span className="text-xs text-[var(--text-muted)]">Wszystkie Twoje statystyki na jednym ekranie</span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Wykres 1: Koncerty solowe vs Festiwale */}
          <div className="fl-surface min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="mb-1 flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-sm font-bold">
                  Koncerty solowe vs Festiwale
                </h3>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Stosunek koncertów dedykowanych jednemu artyście do występów festiwalowych (
                  <strong className="text-[var(--text)]">{stats.soloToFestRatio} : 1</strong>)
                </p>
              </div>
              <button
                onClick={() => setTypeEditorOpen((v) => !v)}
                className="fl-btn !rounded-full !px-2.5 !py-1 !text-[11px] shrink-0"
              >
                <IconEdit size={12} /> {typeEditorOpen ? "Zamknij" : "Uzupełnij"}
              </button>
            </div>

            <div className="mt-2 flex flex-col items-center gap-4 sm:flex-row">
              <div className="w-full sm:w-1/2">
                <StableChartBox height={195}>
                  {(w) => (
                    <PieChart width={w} height={195}>
                      <Pie
                        data={stats.typeSeries}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={46}
                        outerRadius={74}
                        paddingAngle={3}
                        isAnimationActive={false}
                      >
                        {stats.typeSeries.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  )}
                </StableChartBox>
              </div>

              <div className="w-full space-y-2.5 sm:w-1/2">
                {[
                  {
                    label: "Koncert solowy",
                    sub: "Dedykowany jednemu artyście",
                    value: stats.soloCount,
                    color: PIE_COLORS[0],
                  },
                  {
                    label: "Festiwal",
                    sub: "Występ w ramach festiwalu",
                    value: stats.festivalCount,
                    color: PIE_COLORS[1],
                  },
                ].map((entry) => {
                  const pct = Math.round(
                    (entry.value / Math.max(1, stats.totalConcerts)) * 100
                  );
                  return (
                    <div
                      key={entry.label}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 font-semibold">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: entry.color }}
                          />
                          {entry.label}
                        </span>
                        <span className="tabular-nums font-bold">
                          {entry.value} ({pct}%)
                        </span>
                      </div>
                      <div className="mt-0.5 pl-4 text-[11px] text-[var(--text-muted)]">{entry.sub}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {typeEditorOpen && (
              <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <input
                  type="text"
                  value={typeSearch}
                  onChange={(e) => setTypeSearch(e.target.value)}
                  placeholder="Szukaj artysty, wydarzenia lub miasta..."
                  className="fl-input w-full !py-1.5 text-xs"
                />
                <div className="mt-2 max-h-52 space-y-1.5 overflow-y-auto pr-1">
                  {filteredConcertsForEditor.map((c, idx) => {
                    const kind = detectConcertKind(c, typeOverrides, eventsMeta, allConcerts);
                    return (
                      <div
                        key={c.id ?? idx}
                        className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{c.artysta}</div>
                          <div className="truncate text-[11px] text-[var(--text-muted)]">
                            {c.event || c.miejsce || c.miasto} · {c.data || c.rok}
                          </div>
                        </div>
                        <div className="flex shrink-0 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] p-0.5 text-[11px]">
                          <button
                            onClick={() => handleToggleConcertKind(c, "solowy")}
                            className={`rounded-md px-2 py-0.5 font-semibold ${
                              kind === "solowy"
                                ? "bg-[var(--accent)] text-[var(--accent-ink,#fff)]"
                                : "text-[var(--text-muted)] hover:text-[var(--text)]"
                            }`}
                          >
                            Solowy
                          </button>
                          <button
                            onClick={() => handleToggleConcertKind(c, "festiwal")}
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
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Wykres 2: Top Gatunki muzyczne */}
          <div className="fl-surface min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h3 className="mb-3 font-display text-sm font-bold">Top gatunki muzyczne</h3>
            {stats.genreSeries.length > 0 ? (
              <StableChartBox height={220}>
                {(w) => (
                  <BarChart width={w} height={220} data={stats.genreSeries} layout="vertical">
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "currentColor" }} />
                    <YAxis
                      dataKey="gatunek"
                      type="category"
                      tick={{ fontSize: 11, fill: "currentColor" }}
                      width={105}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar
                      dataKey="liczba"
                      name="Koncerty"
                      fill="var(--accent, #ff4d6d)"
                      radius={[0, 6, 6, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                )}
              </StableChartBox>
            ) : (
              <div className="flex h-[220px] items-center justify-center text-center text-xs text-[var(--text-muted)]">
                Uzupełnij gatunki w zakładce Dodaj lub otwórz profil artysty
              </div>
            )}
          </div>

          {/* Wykres 3: Koncerty w kolejnych latach */}
          {stats.yearSeries.length > 0 && (
            <div className="fl-surface min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h3 className="mb-3 font-display text-sm font-bold">Koncerty w kolejnych latach</h3>
              <StableChartBox height={220}>
                {(w) => (
                  <AreaChart width={w} height={220} data={stats.yearSeries}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="rok" tick={{ fontSize: 11, fill: "currentColor" }} />
                    <YAxis tick={{ fontSize: 11, fill: "currentColor" }} width={28} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area
                      type="monotone"
                      dataKey="koncerty"
                      name="Koncerty"
                      stroke="var(--accent, #ff4d6d)"
                      fill="var(--accent, #ff4d6d)"
                      fillOpacity={0.22}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                )}
              </StableChartBox>
            </div>
          )}

          {/* Wykres 4: Sezonowość (Miesiące) */}
          <div className="fl-surface min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h3 className="mb-3 font-display text-sm font-bold">
              Sezonowość — koncerty według miesięcy
            </h3>
            <StableChartBox height={220}>
              {(w) => (
                <BarChart width={w} height={220} data={stats.monthSeries}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="miesiac" tick={{ fontSize: 11, fill: "currentColor" }} />
                  <YAxis tick={{ fontSize: 11, fill: "currentColor" }} width={28} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar
                    dataKey="koncerty"
                    name="Koncerty"
                    fill="var(--accent, #ff4d6d)"
                    radius={[6, 6, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              )}
            </StableChartBox>
          </div>

          {/* Wykres 5: Top Miasta */}
          {stats.citySeries.length > 0 && (
            <div className="fl-surface min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h3 className="mb-3 font-display text-sm font-bold">Top miasta koncertowe</h3>
              <StableChartBox height={220}>
                {(w) => (
                  <BarChart width={w} height={220} data={stats.citySeries} layout="vertical">
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "currentColor" }} />
                    <YAxis
                      dataKey="miasto"
                      type="category"
                      tick={{ fontSize: 11, fill: "currentColor" }}
                      width={95}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar
                      dataKey="liczba"
                      name="Koncerty"
                      fill="#38bdf8"
                      radius={[0, 6, 6, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                )}
              </StableChartBox>
            </div>
          )}

          {/* Wykres 6: Rozkład ocen */}
          {stats.hasRatings && (
            <div className="fl-surface min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h3 className="mb-3 font-display text-sm font-bold">Rozkład Twoich ocen (1–5 ★)</h3>
              <StableChartBox height={220}>
                {(w) => (
                  <BarChart width={w} height={220} data={stats.ratingSeries}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="ocena" tick={{ fontSize: 11, fill: "currentColor" }} />
                    <YAxis tick={{ fontSize: 11, fill: "currentColor" }} width={28} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar
                      dataKey="liczba"
                      name="Liczba koncertów"
                      fill="#f59e0b"
                      radius={[6, 6, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                )}
              </StableChartBox>
            </div>
          )}
        </div>
      </section>

      {/* Karta Artysty z edycją koncertów i dodawaniem zdjęć wydarzeń */}
      <ArtistDossierSheet
        artistName={dossierArtist}
        onClose={() => setDossierArtist(null)}
        concerts={allConcerts}
        artistMeta={dossierArtist ? localCache[dossierArtist.toLowerCase()] : undefined}
        artistsCache={localCache}
        onUpdateCache={setLocalCache}
        onSelectArtistFilter={onSelectArtist}
        onOpenOtherArtist={(other) => setDossierArtist(other)}
        streamingPlatform={streamingPlatform}
        eventsMeta={eventsMeta}
        onSaveConcert={props.onSaveConcert}
        onEditConcert={props.onEditConcert}
        onUploadEventPhotos={props.onUploadEventPhotos}
        onOpenEvent={props.onOpenEvent}
        onConcertSaved={() => setDataRevision((r) => r + 1)}
      />
    </div>
  );
};

export default StartView;