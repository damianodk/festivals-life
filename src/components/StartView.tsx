import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { supabase } from "../lib/supabase";
import { ArtistDossierSheet } from "./ArtistDossierSheet";

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

// Wbudowana baza współrzędnych miast koncertowych i festiwalowych (Polska + Europa)
const KNOWN_CITIES: Record<string, { lat: number; lng: number }> = {
  warszawa: { lat: 52.2297, lng: 21.0122 },
  warsaw: { lat: 52.2297, lng: 21.0122 },
  krakow: { lat: 50.0647, lng: 19.945 },
  cracow: { lat: 50.0647, lng: 19.945 },
  poznan: { lat: 52.4064, lng: 16.9252 },
  wroclaw: { lat: 51.1079, lng: 17.0385 },
  gdansk: { lat: 54.352, lng: 18.6466 },
  gdynia: { lat: 54.5189, lng: 18.5305 },
  sopot: { lat: 54.4416, lng: 18.5601 },
  trojmiasto: { lat: 54.4416, lng: 18.5601 },
  katowice: { lat: 50.2649, lng: 19.0238 },
  chorzow: { lat: 50.2975, lng: 18.9546 },
  lodz: { lat: 51.7592, lng: 19.456 },
  szczecin: { lat: 53.4285, lng: 14.5528 },
  bydgoszcz: { lat: 53.1235, lng: 18.0084 },
  torun: { lat: 53.0138, lng: 18.5984 },
  lublin: { lat: 51.2465, lng: 22.5684 },
  bialystok: { lat: 53.1325, lng: 23.1688 },
  rzeszow: { lat: 50.0412, lng: 21.9991 },
  olsztyn: { lat: 53.7784, lng: 20.4801 },
  kielce: { lat: 50.8661, lng: 20.6286 },
  opole: { lat: 50.6751, lng: 17.9213 },
  gliwice: { lat: 50.2945, lng: 18.6714 },
  zabrze: { lat: 50.3249, lng: 18.7857 },
  "bielsko-biala": { lat: 49.8224, lng: 19.0584 },
  czestochowa: { lat: 50.8118, lng: 19.1203 },
  radom: { lat: 51.4027, lng: 21.1471 },
  plock: { lat: 52.5463, lng: 19.7065 },
  "kostrzyn nad odra": { lat: 52.5878, lng: 14.6644 },
  kostrzyn: { lat: 52.5878, lng: 14.6644 },
  czaplinek: { lat: 53.5567, lng: 16.2333 },
  broczyno: { lat: 53.5311, lng: 16.265 },
  jarocin: { lat: 51.9727, lng: 17.5026 },
  ostroda: { lat: 53.6967, lng: 19.9647 },
  cieszanow: { lat: 50.2583, lng: 23.1333 },
  kolobrzeg: { lat: 54.1759, lng: 15.5833 },
  koszalin: { lat: 54.1944, lng: 16.1722 },
  "zielona gora": { lat: 51.9356, lng: 15.5062 },
  "gorzow wielkopolski": { lat: 52.7368, lng: 15.2288 },
  swinoujscie: { lat: 53.9105, lng: 14.2471 },
  slupsk: { lat: 54.4641, lng: 17.0285 },
  strzelinko: { lat: 54.4967, lng: 16.9686 },
  elblag: { lat: 54.1522, lng: 19.4088 },
  tarnow: { lat: 50.0121, lng: 20.9858 },
  "nowy sacz": { lat: 49.6218, lng: 20.697 },
  zakopane: { lat: 49.2992, lng: 19.9496 },
  bolkow: { lat: 50.9217, lng: 16.0997 },
  "aleksandrow lodzki": { lat: 51.8194, lng: 19.3044 },
  berlin: { lat: 52.52, lng: 13.405 },
  praga: { lat: 50.0755, lng: 14.4378 },
  prague: { lat: 50.0755, lng: 14.4378 },
  praha: { lat: 50.0755, lng: 14.4378 },
  wieden: { lat: 48.2082, lng: 16.3738 },
  vienna: { lat: 48.2082, lng: 16.3738 },
  wien: { lat: 48.2082, lng: 16.3738 },
  budapeszt: { lat: 47.4979, lng: 19.0402 },
  budapest: { lat: 47.4979, lng: 19.0402 },
  londyn: { lat: 51.5072, lng: -0.1276 },
  london: { lat: 51.5072, lng: -0.1276 },
  paryz: { lat: 48.8566, lng: 2.3522 },
  paris: { lat: 48.8566, lng: 2.3522 },
  amsterdam: { lat: 52.3676, lng: 4.9041 },
  rotterdam: { lat: 51.9244, lng: 4.4777 },
  utrecht: { lat: 52.0907, lng: 5.1214 },
  bruksela: { lat: 50.8503, lng: 4.3517 },
  brussels: { lat: 50.8503, lng: 4.3517 },
  werchter: { lat: 50.9706, lng: 4.685 },
  antwerpia: { lat: 51.2194, lng: 4.4025 },
  antwerp: { lat: 51.2194, lng: 4.4025 },
  hasselt: { lat: 50.9307, lng: 5.3325 },
  kopenhaga: { lat: 55.6761, lng: 12.5683 },
  copenhagen: { lat: 55.6761, lng: 12.5683 },
  roskilde: { lat: 55.6415, lng: 12.0803 },
  sztokholm: { lat: 59.3293, lng: 18.0686 },
  stockholm: { lat: 59.3293, lng: 18.0686 },
  oslo: { lat: 59.9139, lng: 10.7522 },
  helsinki: { lat: 60.1699, lng: 24.9384 },
  madryt: { lat: 40.4168, lng: -3.7038 },
  madrid: { lat: 40.4168, lng: -3.7038 },
  barcelona: { lat: 41.3874, lng: 2.1686 },
  lizbona: { lat: 38.7223, lng: -9.1393 },
  lisbon: { lat: 38.7223, lng: -9.1393 },
  mediolan: { lat: 45.4642, lng: 9.19 },
  milan: { lat: 45.4642, lng: 9.19 },
  rzym: { lat: 41.9028, lng: 12.4964 },
  rome: { lat: 41.9028, lng: 12.4964 },
  bolonia: { lat: 44.4949, lng: 11.3426 },
  bologna: { lat: 44.4949, lng: 11.3426 },
  monachium: { lat: 48.1351, lng: 11.582 },
  munich: { lat: 48.1351, lng: 11.582 },
  hamburg: { lat: 53.5511, lng: 9.9937 },
  kolonia: { lat: 50.9375, lng: 6.9603 },
  cologne: { lat: 50.9375, lng: 6.9603 },
  frankfurt: { lat: 50.1109, lng: 8.6821 },
  lipsk: { lat: 51.3397, lng: 12.3731 },
  leipzig: { lat: 51.3397, lng: 12.3731 },
  drezno: { lat: 51.0504, lng: 13.7373 },
  dresden: { lat: 51.0504, lng: 13.7373 },
  norymberga: { lat: 49.4521, lng: 11.0767 },
  nuremberg: { lat: 49.4521, lng: 11.0767 },
  nurburg: { lat: 50.3456, lng: 6.9522 },
  scheessel: { lat: 53.1706, lng: 9.4836 },
  nickelsdorf: { lat: 47.9394, lng: 17.0686 },
  ostrava: { lat: 49.8209, lng: 18.2625 },
  ostrawa: { lat: 49.8209, lng: 18.2625 },
  "hradec kralove": { lat: 50.2104, lng: 15.8252 },
  trencin: { lat: 48.8945, lng: 18.0444 },
  trenczyn: { lat: 48.8945, lng: 18.0444 },
  bratyslawa: { lat: 48.1486, lng: 17.1077 },
  bratislava: { lat: 48.1486, lng: 17.1077 },
  zagrzeb: { lat: 45.815, lng: 15.9819 },
  zagreb: { lat: 45.815, lng: 15.9819 },
  belgrad: { lat: 44.7866, lng: 20.4489 },
  belgrade: { lat: 44.7866, lng: 20.4489 },
  "novi sad": { lat: 45.2671, lng: 19.8335 },
  wilno: { lat: 54.6872, lng: 25.2797 },
  vilnius: { lat: 54.6872, lng: 25.2797 },
  ryga: { lat: 56.9496, lng: 24.1052 },
  riga: { lat: 56.9496, lng: 24.1052 },
  tallinn: { lat: 59.437, lng: 24.7536 },
  zurych: { lat: 47.3769, lng: 8.5417 },
  zurich: { lat: 47.3769, lng: 8.5417 },
  dublin: { lat: 53.3498, lng: -6.2603 },
  manchester: { lat: 53.4808, lng: -2.2426 },
  glasgow: { lat: 55.8642, lng: -4.2518 },
};

function normalizeCityName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l");
}

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

const CONCERT_TYPE_STORAGE_KEY = "festlife_concert_types_v1";

function loadTypeOverrides(): Record<string, "solowy" | "festiwal"> {
  try {
    const raw = localStorage.getItem(CONCERT_TYPE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getConcertKey(c: any, idx = 0): string {
  if (c.id !== undefined && c.id !== null) return String(c.id);
  return `${(c.artysta || "").trim()}_${(c.data || c.rok || "").trim()}_${(
    c.miasto || ""
  ).trim()}_${idx}`;
}

export function detectConcertKind(
  c: any,
  overrides: Record<string, "solowy" | "festiwal">,
  idx = 0
): "solowy" | "festiwal" {
  const k = getConcertKey(c, idx);
  if (overrides[k]) return overrides[k];

  const rawTyp = String(c.typ || c.type || c.rodzaj || "")
    .trim()
    .toLowerCase();
  if (rawTyp === "solowy" || rawTyp === "solo" || rawTyp === "klubowy") return "solowy";
  if (rawTyp === "festiwal" || rawTyp === "festival" || rawTyp === "fest") return "festiwal";

  const ev = String(c.event || "").trim().toLowerCase();
  const art = String(c.artysta || "").trim().toLowerCase();
  if (!ev || ev === art) return "solowy";

  if (
    ev.includes("fest") ||
    ev.includes("open'er") ||
    ev.includes("opener") ||
    ev.includes("orange") ||
    ev.includes("pol'and'rock") ||
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
    ev.includes("sbt")
  ) {
    return "festiwal";
  }

  return "solowy";
}

// Stabilny kontener wykresu bez pętli ResizeObserver (eliminuje migotanie i skakanie)
const StableChartBox: React.FC<{
  height?: number;
  children: (width: number) => React.ReactNode;
}> = ({ height = 220, children }) => {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number>(340);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;

    const updateWidth = () => {
      const next = Math.floor(el.getBoundingClientRect().width);
      if (next > 40) {
        setWidth((prev) => (Math.abs(next - prev) >= 4 ? next : prev));
      }
    };

    updateWidth();
    let rafId = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateWidth);
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={boxRef} style={{ width: "100%", height, minWidth: 0, overflow: "hidden" }}>
      {children(width)}
    </div>
  );
};

export const StartView: React.FC<any> = (props) => {
  const concerts: any[] = Array.isArray(props.concerts)
    ? props.concerts
    : Array.isArray(props.filteredConcerts)
    ? props.filteredConcerts
    : Array.isArray(props.filtered)
    ? props.filtered
    : Array.isArray(props.allConcerts)
    ? props.allConcerts
    : Array.isArray(props.items)
    ? props.items
    : [];

  const allConcerts: any[] = Array.isArray(props.allConcerts)
    ? props.allConcerts
    : concerts;

  const upcoming: any[] = Array.isArray(props.upcoming)
    ? props.upcoming
    : Array.isArray(props.upcomingConcerts)
    ? props.upcomingConcerts
    : [];

  const parentArtistsCache = props.artistsCache || props.artists;
  const rawCities =
    props.citiesCache ||
    props.cities ||
    props.coordsCache ||
    props.cityCoords ||
    props.locations;

  // Połączenie wbudowanej bazy miast + miast z propsów + localStorage
  const citiesMap = useMemo(() => {
    const map: Record<string, { lat: number; lng: number }> = { ...KNOWN_CITIES };
    try {
      const savedGeo = localStorage.getItem("festlife_cities_cache");
      if (savedGeo) {
        const parsed = JSON.parse(savedGeo);
        if (parsed && typeof parsed === "object") {
          for (const [k, v] of Object.entries<any>(parsed)) {
            if (v && Number(v.lat) && Number(v.lng)) {
              map[normalizeCityName(k)] = { lat: Number(v.lat), lng: Number(v.lng) };
            }
          }
        }
      }
    } catch {
      // ignore
    }

    if (Array.isArray(rawCities)) {
      for (const item of rawCities) {
        const name = normalizeCityName(
          String(item?.city || item?.miasto || item?.name || "")
        );
        if (name && Number(item?.lat) && Number(item?.lng)) {
          map[name] = { lat: Number(item.lat), lng: Number(item.lng) };
        }
      }
    } else if (rawCities && typeof rawCities === "object") {
      for (const [k, v] of Object.entries<any>(rawCities)) {
        if (v && Number(v.lat) && Number(v.lng)) {
          map[normalizeCityName(k)] = { lat: Number(v.lat), lng: Number(v.lng) };
        }
      }
    }
    return map;
  }, [rawCities]);

  // Domyślne miasto bazowe (z profilu lub Poznań)
  const hLat =
    Number(
      props.profile?.hometown_lat ??
        props.hometown?.lat ??
        props.hometownLat
    ) || 52.4064;
  const hLng =
    Number(
      props.profile?.hometown_lng ??
        props.hometown?.lng ??
        props.hometownLng
    ) || 16.9252;

  const activeArtist = props.activeArtist || props.artistFilter || "";
  const hasActiveFilters = Boolean(props.hasActiveFilters || activeArtist);
  const onSelectArtist =
    props.onSelectArtist || props.setArtistFilter || props.onFilterArtist;
  const onResetFilters = props.onResetFilters || props.resetFilters;
  const onOpenWrapped =
    props.onOpenWrapped || props.setWrappedOpen || props.onShowWrapped;
  const streamingPlatform =
    props.streamingPlatform || props.profile?.streaming_platform || "spotify";

  const [localCache, setLocalCache] = useState<Record<string, ResolvedArtist>>(() => ({
    ...loadLocalArtistCache(),
    ...(parentArtistsCache || {}),
  }));
  const [typeOverrides, setTypeOverrides] = useState<Record<string, "solowy" | "festiwal">>(() =>
    loadTypeOverrides()
  );
  const [typeEditorOpen, setTypeEditorOpen] = useState(false);
  const [typeSearch, setTypeSearch] = useState("");

  const [dossierArtist, setDossierArtist] = useState<string | null>(null);
  const [playingArtist, setPlayingArtist] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [memorySeed, setMemorySeed] = useState<number>(0);
  const [quizIndex, setQuizIndex] = useState<number>(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState<number>(0);

  // Nasłuch na aktualizacje typu koncertu z ArtistDossierSheet
  useEffect(() => {
    const handler = () => setTypeOverrides(loadTypeOverrides());
    window.addEventListener("festlife:concert-updated", handler);
    return () => window.removeEventListener("festlife:concert-updated", handler);
  }, []);

  // Synchronizacja cache artystów bez pętli re-renderów
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

  // Jednorazowe pobieranie metadanych (portrety + gatunki + audio)
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

    resolveArtistsBatch(sortedArtists, localCache, (merged) => {
      setLocalCache(merged);
    });
  }, [concerts]);

  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  const handleToggleConcertKind = async (
    concert: any,
    nextKind: "solowy" | "festiwal",
    idx = 0
  ) => {
    const key = getConcertKey(concert, idx);
    const nextOverrides = { ...typeOverrides, [key]: nextKind };
    setTypeOverrides(nextOverrides);
    try {
      localStorage.setItem(CONCERT_TYPE_STORAGE_KEY, JSON.stringify(nextOverrides));
    } catch {
      // ignore
    }
    window.dispatchEvent(new Event("festlife:concert-updated"));

    if (concert.id !== undefined && concert.id !== null) {
      const { error } = await supabase
        .from("concerts")
        .update({ typ: nextKind })
        .eq("id", concert.id);
      if (error) {
        await supabase
          .from("concerts")
          .update({ type: nextKind })
          .eq("id", concert.id);
      }
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

  // Pełne statystyki + dane do wszystkich wykresów
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

    let festivalCount = 0;
    let soloCount = 0;
    let totalKm = 0;

    concerts.forEach((c, idx) => {
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

      // Gatunki: sprawdzamy pola w bazie koncertów + fallback z metadanych artysty (Deezer/AudioDB)
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

      // Stosunek: Koncert solowy vs Festiwal
      const kind = detectConcertKind(c, typeOverrides, idx);
      if (kind === "festiwal") {
        festivalCount += 1;
      } else {
        soloCount += 1;
      }

      if (rating >= 1 && rating <= 5) {
        ratingCounts.set(rating, (ratingCounts.get(rating) || 0) + 1);
      }

      // Dystans w km (współrzędne z koncertu -> słownik miast -> baza wbudowana -> gotowe pole km)
      let dist = 0;
      if (Number(c.km) > 0) {
        dist = Math.round(Number(c.km));
      } else if (Number(c.distance) > 0) {
        dist = Math.round(Number(c.distance));
      } else if (Number(c.lat) && Number(c.lng)) {
        dist = haversineKm(hLat, hLng, Number(c.lat), Number(c.lng));
      } else if (city) {
        const cityCoords = citiesMap[normalizeCityName(city)];
        if (cityCoords && cityCoords.lat && cityCoords.lng) {
          dist = haversineKm(hLat, hLng, cityCoords.lat, cityCoords.lng);
        }
      }
      totalKm += dist;

      if (art) {
        const key = art.toLowerCase();
        const prev = artistCounts.get(key) || { name: art, count: 0, km: 0 };
        prev.count += 1;
        prev.km += dist;
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
  }, [concerts, citiesMap, hLat, hLng, localCache, typeOverrides]);

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
      .map((c, idx) => ({ c, idx }))
      .filter(({ c }) => {
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
      <div className="fl-surface rounded-3xl border border-white/10 bg-[var(--bg-card,#15151b)] p-6 text-center">
        <IconAlertCircle size={32} className="mx-auto text-[var(--accent,#ff4d6d)]" />
        <h2 className="mt-3 font-display text-lg font-bold">
          {allConcerts.length > 0
            ? "Brak koncertów dla wybranego filtra"
            : "Brak załadowanych koncertów na tym koncie"}
        </h2>
        <p className="mx-auto mt-1.5 max-w-md text-xs opacity-75">
          {allConcerts.length > 0
            ? "Wyczyść aktywne filtry, aby przywrócić pełne statystyki."
            : "Jeśli Twoje koncerty były przypisane do drugiego konta w Supabase, wyloguj się w zakładce Ja i zaloguj na właściwy adres."}
        </p>
        {allConcerts.length > 0 && onResetFilters && (
          <button
            onClick={onResetFilters}
            className="mt-4 rounded-full bg-[var(--accent,#ff4d6d)] px-4 py-2 text-xs font-semibold text-white"
          >
            Wyczyść filtry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Pasek aktywnego filtra artysty o stałym, niezmiennym stylu */}
      {isFiltered && (
        <div className="fl-surface flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-[var(--bg-card,#15151b)] px-4 py-3">
          <div className="min-w-0 text-xs">
            <span className="opacity-70">Aktywny filtr widoku: </span>
            <strong className="font-semibold text-[var(--accent,#ff4d6d)]">
              {activeArtist || "Wybrane wydarzenia"}
            </strong>
          </div>
          {onResetFilters && (
            <button
              onClick={onResetFilters}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-xs font-semibold hover:bg-white/10"
            >
              <IconFilterOff size={13} /> Pokaż cały raport
            </button>
          )}
        </div>
      )}

      {/* 1. Hero Card — Numer #1 */}
      {heroArtist && (
        <section className="fl-surface relative overflow-hidden rounded-3xl border border-white/10 bg-[var(--bg-card,#15151b)] p-5 sm:p-7">
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
                  <span>{isFiltered ? "Wybrany artysta" : "Twój Numer #1 na żywo"}</span>
                </div>
                <button
                  onClick={() => setDossierArtist(heroArtist.name)}
                  className="mt-1.5 block text-left font-display text-2xl font-extrabold tracking-tight hover:underline sm:text-4xl"
                >
                  {heroArtist.name}
                </button>
                <p className="mt-1 text-sm opacity-75">
                  Widziany <strong className="font-semibold">{heroArtist.count}×</strong>
                  {" · "}
                  <strong className="font-semibold">
                    {heroArtist.km.toLocaleString("pl-PL")} km
                  </strong>{" "}
                  trasy
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
                className="self-start rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-left hover:bg-white/[0.08] sm:self-center"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent,#ff4d6d)]">
                  <IconSparkles size={15} /> Wrapped Studio 9:16
                </div>
                <div className="mt-0.5 text-xs opacity-70">Stwórz kartę na Stories</div>
              </button>
            )}
          </div>
        </section>
      )}

      {/* 2. Skalibrowane KPI (z przywróconymi kilometrami) */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="fl-surface rounded-2xl border border-white/10 bg-[var(--bg-card,#15151b)] p-4">
          <div className="text-xs opacity-65">Koncerty</div>
          <div className="tabular-nums mt-1 font-display text-2xl font-extrabold sm:text-3xl">
            {stats.totalConcerts}
          </div>
        </div>
        <div className="fl-surface rounded-2xl border border-white/10 bg-[var(--bg-card,#15151b)] p-4">
          <div className="text-xs opacity-65">Artyści</div>
          <div className="tabular-nums mt-1 font-display text-2xl font-extrabold sm:text-3xl">
            {stats.uniqueArtists}
          </div>
        </div>
        <div className="fl-surface rounded-2xl border border-white/10 bg-[var(--bg-card,#15151b)] p-4">
          <div className="text-xs opacity-65">Festiwale i eventy</div>
          <div className="tabular-nums mt-1 font-display text-2xl font-extrabold sm:text-3xl">
            {stats.uniqueEvents}
          </div>
        </div>
        <div className="fl-surface rounded-2xl border border-white/10 bg-[var(--bg-card,#15151b)] p-4">
          <div className="text-xs opacity-65">Miasta / Kraje</div>
          <div className="tabular-nums mt-1 font-display text-2xl font-extrabold sm:text-3xl">
            {stats.uniqueCities}{" "}
            <span className="text-base font-normal opacity-50">/ {stats.uniqueCountries}</span>
          </div>
        </div>
        <div className="fl-surface col-span-2 rounded-2xl border border-white/10 bg-[var(--bg-card,#15151b)] p-4 sm:col-span-1">
          <div className="text-xs opacity-65">Przejechane kilometry</div>
          <div className="tabular-nums mt-1 font-display text-2xl font-extrabold sm:text-3xl">
            {stats.totalKm.toLocaleString("pl-PL")}{" "}
            <span className="text-sm font-normal opacity-60">km</span>
          </div>
        </div>
      </section>

      {/* 3. Pasek postępu */}
      <section className="fl-surface rounded-2xl border border-white/10 bg-[var(--bg-card,#15151b)] p-4">
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
            className="h-full rounded-full bg-[var(--accent,#ff4d6d)]"
            style={{ width: `${badgeMilestone.pct}%` }}
          />
        </div>
      </section>

      {/* 4. Galeria Top Artyści */}
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
                className="fl-surface group cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-[var(--bg-card,#15151b)]"
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

                  <span className="tabular-nums absolute left-2.5 top-2.5 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-bold text-white">
                    #{idx + 1}
                  </span>

                  {meta?.preview_url && (
                    <button
                      onClick={(e) => togglePreview(item.name, meta.preview_url, e)}
                      aria-label={`Odsłuchaj ${item.name}`}
                      className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent,#ff4d6d)] text-white shadow-md"
                    >
                      {isThisPlaying ? <IconPlayerPause size={15} /> : <IconPlayerPlay size={15} />}
                    </button>
                  )}
                </div>

                <div className="p-3">
                  <div className="truncate font-display text-sm font-bold">{item.name}</div>
                  <div className="tabular-nums mt-0.5 text-xs opacity-65">
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
            <div className="fl-surface flex flex-col justify-between rounded-2xl border border-white/10 bg-[var(--bg-card,#15151b)] p-5">
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
                <span>
                  Data: {timeMachineConcert.concert.data || timeMachineConcert.concert.rok}
                </span>
                <button
                  onClick={() => setDossierArtist(timeMachineConcert.concert.artysta)}
                  className="font-semibold text-[var(--accent,#ff4d6d)]"
                >
                  Zobacz wspomnienie →
                </button>
              </div>
            </div>
          )}

          {currentQuestion && (
            <div className="fl-surface flex flex-col justify-between rounded-2xl border border-white/10 bg-[var(--bg-card,#15151b)] p-5">
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
                      "rounded-xl border border-white/15 bg-white/[0.02] px-3 py-2 text-left text-xs font-medium hover:bg-white/[0.06]";
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

      {/* 6. Nadchodzące koncerty */}
      {!isFiltered && upcoming.length > 0 && (
        <section className="fl-surface rounded-2xl border border-white/10 bg-[var(--bg-card,#15151b)] p-5">
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

      {/* 7. Hall of Fame */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div
          onClick={() => heroArtist && setDossierArtist(heroArtist.name)}
          className="fl-surface cursor-pointer rounded-2xl border border-white/10 bg-[var(--bg-card,#15151b)] p-4"
        >
          <div className="text-xs opacity-60">Król Sceny</div>
          <div className="mt-1 truncate font-display text-lg font-bold">
            {heroArtist?.name || "—"}
          </div>
          <div className="text-xs opacity-70">
            {heroArtist ? `${heroArtist.count} koncertów` : ""}
          </div>
        </div>

        <div
          onClick={() => stats.topKmArtist && setDossierArtist(stats.topKmArtist.name)}
          className="fl-surface cursor-pointer rounded-2xl border border-white/10 bg-[var(--bg-card,#15151b)] p-4"
        >
          <div className="text-xs opacity-60">Liczba kilometrów za artystą</div>
          <div className="mt-1 truncate font-display text-lg font-bold">
            {stats.topKmArtist?.name || "—"}
          </div>
          <div className="tabular-nums text-xs opacity-70">
            {stats.topKmArtist ? `${stats.topKmArtist.km.toLocaleString("pl-PL")} km` : ""}
          </div>
        </div>

        <div className="fl-surface rounded-2xl border border-white/10 bg-[var(--bg-card,#15151b)] p-4">
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

      {/* 8. Pełny zestaw wykresów (stabilne wymiary, bez skakania) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Analityka koncertowa</h2>
          <span className="text-xs opacity-60">Wszystkie Twoje statystyki na jednym ekranie</span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Wykres 1: Koncerty solowe vs Festiwale + szybki edytor typów */}
          <div className="fl-surface min-w-0 rounded-2xl border border-white/10 bg-[var(--bg-card,#15151b)] p-4">
            <div className="mb-1 flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-sm font-bold">
                  Koncerty solowe vs Festiwale
                </h3>
                <p className="text-[11px] opacity-65">
                  Stosunek koncertów dedykowanych jednemu artyście do występów festiwalowych (
                  <strong>{stats.soloToFestRatio} : 1</strong>)
                </p>
              </div>
              <button
                onClick={() => setTypeEditorOpen((v) => !v)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-medium hover:bg-white/10"
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
                      className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs"
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
                      <div className="mt-0.5 pl-4 text-[11px] opacity-60">{entry.sub}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Szybki edytor wyboru: Koncert solowy / Festiwal */}
            {typeEditorOpen && (
              <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3">
                <input
                  type="text"
                  value={typeSearch}
                  onChange={(e) => setTypeSearch(e.target.value)}
                  placeholder="Szukaj artysty, wydarzenia lub miasta..."
                  className="w-full rounded-lg border border-white/15 bg-black/30 px-2.5 py-1.5 text-xs outline-none"
                />
                <div className="mt-2 max-h-52 space-y-1.5 overflow-y-auto pr-1">
                  {filteredConcertsForEditor.map(({ c, idx }) => {
                    const kind = detectConcertKind(c, typeOverrides, idx);
                    return (
                      <div
                        key={getConcertKey(c, idx)}
                        className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{c.artysta}</div>
                          <div className="truncate text-[11px] opacity-60">
                            {c.event || c.miejsce || c.miasto} · {c.data || c.rok}
                          </div>
                        </div>
                        <div className="flex shrink-0 rounded-lg border border-white/15 p-0.5 text-[11px]">
                          <button
                            onClick={() => handleToggleConcertKind(c, "solowy", idx)}
                            className={`rounded-md px-2 py-0.5 font-medium ${
                              kind === "solowy"
                                ? "bg-[var(--accent,#ff4d6d)] text-white"
                                : "opacity-65 hover:opacity-100"
                            }`}
                          >
                            Solowy
                          </button>
                          <button
                            onClick={() => handleToggleConcertKind(c, "festiwal", idx)}
                            className={`rounded-md px-2 py-0.5 font-medium ${
                              kind === "festiwal"
                                ? "bg-[#38bdf8] text-slate-950 font-semibold"
                                : "opacity-65 hover:opacity-100"
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
          <div className="fl-surface min-w-0 rounded-2xl border border-white/10 bg-[var(--bg-card,#15151b)] p-4">
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
                      width={100}
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
              <div className="flex h-[220px] items-center justify-center text-center text-xs opacity-60">
                Pobieranie gatunków muzycznych artystów...
              </div>
            )}
          </div>

          {/* Wykres 3: Koncerty w kolejnych latach */}
          {stats.yearSeries.length > 0 && (
            <div className="fl-surface min-w-0 rounded-2xl border border-white/10 bg-[var(--bg-card,#15151b)] p-4">
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
          <div className="fl-surface min-w-0 rounded-2xl border border-white/10 bg-[var(--bg-card,#15151b)] p-4">
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
            <div className="fl-surface min-w-0 rounded-2xl border border-white/10 bg-[var(--bg-card,#15151b)] p-4">
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
            <div className="fl-surface min-w-0 rounded-2xl border border-white/10 bg-[var(--bg-card,#15151b)] p-4">
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

      {/* Karta Artysty */}
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
