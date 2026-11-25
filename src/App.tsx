import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Toaster, toast } from "sonner";
import * as XLSX from "xlsx";
import {
  IconAdjustmentsHorizontal,
  IconCommand,
  IconDownload,
  IconHome,
  IconLogout,
  IconMap,
  IconMenu2,
  IconMusic,
  IconPalette,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSparkles,
  IconTicket,
  IconUpload,
  IconUser,
  IconUserPlus,
  IconX
} from "@tabler/icons-react";

import type {
  ArtistMeta,
  BucketItem,
  ClashSlot,
  Concert,
  EventMeta,
  FilterState,
  MainTab,
  PublicProfileSettings,
  PublicProfileSummary,
  StreamingProvider,
  ThemeId,
  TravelInfo,
  TripExpense,
  UpcomingConcert,
  UserSettings
} from "./types";

import { INITIAL_CONCERTS, INITIAL_COORDS, INITIAL_EVENTS_META } from "./data/initialData";
import { getSupabase, isSupabaseConfigured, resolveSignedUrl } from "./lib/supabase";
import { THEME_PROFILES } from "./lib/themes";
import { geocodeCityOnline, getCityCoords, sanitizeSlug } from "./lib/geo";
import { hapticTap } from "./lib/haptics";

import { AuthScreen } from "./components/AuthScreen";
import { StartView } from "./components/StartView";
import { MapView } from "./components/MapView";
import { AddView } from "./components/AddView";
import { EventsView } from "./components/EventsView";
import { ProfileView } from "./components/ProfileView";
import { CommandPalette } from "./components/CommandPalette";
import { WrappedStudioSheet } from "./components/WrappedStudioSheet";
import { SplitwiseSheet } from "./components/SplitwiseSheet";
import { ConcertMatchSheet, type MatchData } from "./components/ConcertMatchSheet";
import { OnboardingSheet } from "./components/OnboardingSheet";
import { BottomSheet } from "./components/ui/BottomSheet";

const STORAGE_KEY = "festivals_life_concerts_v6";
const UPCOMING_KEY = "festivals_life_upcoming_v6";
const META_KEY = "festivals_life_events_meta_v6";
const BUCKET_KEY = "festivals_life_bucket_v6";
const EXPENSES_KEY = "festivals_life_expenses_v6";
const CLASH_KEY = "festivals_life_clash_v6";
const TRAVEL_KEY = "festivals_life_travel_v6";
const SETTINGS_KEY = "festivals_life_settings_v6";
const COORDS_KEY = "festivals_life_coords_v6";
const ARTIST_META_CACHE_KEY = "festivals_life_artists_meta_v2";
const STREAMING_PROV_KEY = "festivals_life_streaming_prov_v1";
const THEME_KEY = "festivals_life_theme_v6";

const EMPTY_FILTERS: FilterState = { search: "", year: "", genre: "", who: "", crew: "" };

export default function App() {
  const [storageMode, setStorageMode] = useState<"loading" | "auth" | "supabase" | "offline" | "public">("loading");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [viewerUserForPublic, setViewerUserForPublic] = useState<any>(null);
  const [isFollowingCurrentPublic, setIsFollowingCurrentPublic] = useState(false);

  const [theme, setThemeState] = useState<ThemeId>(() => {
    const saved = localStorage.getItem(THEME_KEY) as ThemeId | null;
    return saved && THEME_PROFILES[saved] ? saved : "dark";
  });
  const [streamingProvider, setStreamingProviderState] = useState<StreamingProvider>(() => {
    return (localStorage.getItem(STREAMING_PROV_KEY) as StreamingProvider) || "spotify";
  });

  const [activeTab, setActiveTab] = useState<MainTab>("start");
  const [addSubTab, setAddSubTab] = useState<"concert" | "upcoming" | "database">("concert");
  const [focusedEventKey, setFocusedEventKey] = useState<string | null>(null);

  const [allConcerts, setAllConcerts] = useState<Concert[]>([]);
  const [upcomingConcerts, setUpcomingConcerts] = useState<UpcomingConcert[]>([]);
  const [eventsMeta, setEventsMeta] = useState<Record<string, EventMeta>>({ ...INITIAL_EVENTS_META });
  const [bucketList, setBucketList] = useState<BucketItem[]>([]);
  const [tripExpenses, setTripExpenses] = useState<TripExpense[]>([]);
  const [clashSlots, setClashSlots] = useState<ClashSlot[]>(() => {
    try { return JSON.parse(localStorage.getItem(CLASH_KEY) || "[]"); } catch { return []; }
  });
  const [travelMeta, setTravelMeta] = useState<Record<string, TravelInfo>>(() => {
    try { return JSON.parse(localStorage.getItem(TRAVEL_KEY) || "{}"); } catch { return {}; }
  });
  const [settings, setSettings] = useState<UserSettings>({
    hometown: "Poznań",
    hometown_coords: [52.4064, 16.9252]
  });
  const [cityCoords, setCityCoords] = useState<Record<string, [number, number]>>(() => {
    try { return { ...INITIAL_COORDS, ...JSON.parse(localStorage.getItem(COORDS_KEY) || "{}") }; } catch { return { ...INITIAL_COORDS }; }
  });
  const [artistsMetaCache, setArtistsMetaCache] = useState<Record<string, ArtistMeta>>(() => {
    try { return JSON.parse(localStorage.getItem(ARTIST_META_CACHE_KEY) || "{}"); } catch { return {}; }
  });
  const [publicProfile, setPublicProfile] = useState<PublicProfileSettings>({
    username: "",
    display_name: "",
    bio: "",
    is_public: false
  });
  const [followingList, setFollowingList] = useState<PublicProfileSummary[]>([]);

  // Filters & interactive sheets
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [wrappedOpen, setWrappedOpen] = useState(false);
  const [splitwiseKey, setSplitwiseKey] = useState<string | null>(null);
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  const [editingConcert, setEditingConcert] = useState<Concert | null>(null);
  const [prefillConcert, setPrefillConcert] = useState<Partial<Concert> | null>(null);
  const [playingPreviewArtist, setPlayingPreviewArtist] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const bootedRef = useRef(false);
  const artistsMetaCacheRef = useRef(artistsMetaCache);
  artistsMetaCacheRef.current = artistsMetaCache;

  const isPublicView = storageMode === "public";

  // Sync HTML data-theme attribute & meta theme-color
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_PROFILES[theme].bg);
  }, [theme]);

  const applyTheme = useCallback(
    (next: ThemeId) => {
      if (!THEME_PROFILES[next]) return;
      setThemeState(next);
      hapticTap(true);
      const sb = getSupabase();
      if (storageMode === "supabase" && sb && currentUser) {
        sb.from("profiles").update({ theme: next }).eq("id", currentUser.id).then(() => {});
      }
    },
    [storageMode, currentUser]
  );

  const saveStreamingProvider = useCallback((prov: StreamingProvider) => {
    setStreamingProviderState(prov);
    localStorage.setItem(STREAMING_PROV_KEY, prov);
    toast.success(`Platforma muzyczna: ${prov.toUpperCase()}`);
  }, []);

  // Hydrate following list via RPC
  const hydrateFollowing = useCallback(async (ids: string[]) => {
    const sb = getSupabase();
    if (!ids.length || !sb) {
      setFollowingList([]);
      return;
    }
    const { data } = await sb.rpc("list_public_profiles", { p_ids: ids });
    setFollowingList((data || []) as PublicProfileSummary[]);
  }, []);

  // Sync artist avatars from Edge Function (bez przebudowywania referencji funkcji przy zmianie cache)
  const syncArtistsFromEdge = useCallback(
    async (concertsSource: Concert[], manual = false) => {
      const sb = getSupabase();
      if (!sb) return;
      const currentCache = artistsMetaCacheRef.current;
      const byArt: Record<string, number> = {};
      concertsSource.forEach((c) => {
        if (c.artysta) byArt[c.artysta] = (byArt[c.artysta] || 0) + 1;
      });
      const topNames = Object.entries(byArt)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 24)
        .map((e) => e[0]);
      if (!topNames.length) return;

      const missing = manual
        ? topNames
        : topNames.filter((n) => {
            const url = currentCache[n.trim().toLowerCase()]?.image_url || "";
            return !url || !url.includes("scdn.co");
          });
      if (!missing.length) return;
      if (manual) toast.info(`Synchronizuję zdjęcia ze Spotify (${missing.length} artystów)...`);

      try {
        let toInvoke = missing;
        const nextCache = { ...currentCache };
        if (!manual) {
          const keys = missing.map((n) => n.trim().toLowerCase());
          const { data: cachedRows } = await sb.from("artists_cache").select("*").in("artist_key", keys);
          (cachedRows || []).forEach((r: any) => {
            if (r.image_url && r.image_url.includes("scdn.co")) nextCache[r.artist_key] = r;
          });
          toInvoke = missing.filter(
            (n) => !(nextCache[n.trim().toLowerCase()]?.image_url || "").includes("scdn.co")
          );
        }

        if (toInvoke.length) {
          const { data: fnData, error: fnErr } = await sb.functions.invoke("fetch-artist-meta", {
            body: { artists: toInvoke, force: manual }
          });
          if (fnErr) throw fnErr;
          if (fnData?.results) {
            Object.entries(fnData.results).forEach(([k, val]: any) => {
              nextCache[k] = val;
            });
          }
          if (manual && fnData?.spotify_ok === false) {
            toast.error("Brak połączenia ze Spotify API — sprawdź sekrety w Supabase.");
            return;
          }
        }
        setArtistsMetaCache(nextCache);
        try { localStorage.setItem(ARTIST_META_CACHE_KEY, JSON.stringify(nextCache)); } catch (_) {}
        if (manual) toast.success("Zaktualizowano zdjęcia artystów!");
      } catch (err: any) {
        if (manual) toast.error("Błąd synchronizacji: " + err.message);
      }
    },
    []
  );

  // Load authenticated user's Supabase data
  const loadUserFromSupabase = useCallback(
    async (user: any, checkOnboard = false) => {
      const sb = getSupabase();
      if (!sb) return;
      setCurrentUser(user);
      setStorageMode("supabase");

      const [profR, citiesR, conR, upR, metaR, blR, expR, artCacheR, folR] = await Promise.all([
        sb.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        sb.from("cities_cache").select("*"),
        sb.from("concerts").select("*").order("data", { ascending: true }),
        sb.from("upcoming_concerts").select("*").order("data", { ascending: true }),
        sb.from("events_meta").select("*"),
        sb.from("bucket_list").select("*").order("created_at", { ascending: false }),
        sb.from("trip_expenses").select("*").order("created_at", { ascending: false }),
        sb.from("artists_cache").select("*"),
        sb.from("follows").select("following_id").eq("follower_id", user.id)
      ]);

      let loadedUsername = "";
      if (profR.data) {
        setSettings({
          hometown: profR.data.hometown || "Poznań",
          hometown_coords: [profR.data.hometown_lat ?? 52.4064, profR.data.hometown_lng ?? 16.9252]
        });
        loadedUsername = profR.data.username || "";
        setPublicProfile({
          id: profR.data.id,
          username: loadedUsername,
          display_name: profR.data.display_name || "",
          bio: profR.data.bio || "",
          is_public: !!profR.data.is_public
        });
        if (profR.data.theme && THEME_PROFILES[profR.data.theme as ThemeId]) {
          setThemeState(profR.data.theme as ThemeId);
        }
      }

      if (citiesR.data?.length) {
        const merged = { ...INITIAL_COORDS };
        citiesR.data.forEach((r: any) => { merged[r.city] = [r.lat, r.lng]; });
        setCityCoords(merged);
      }

      const loadedConcerts: Concert[] = (conR.data || []).map((r: any) => ({
        ...r,
        cena: r.cena != null ? String(r.cena) : ""
      }));
      setAllConcerts(loadedConcerts);
      setUpcomingConcerts(
        (upR.data || []).map((r: any) => ({ ...r, cena: r.cena != null ? String(r.cena) : "" }))
      );
      setBucketList((blR.data || []) as BucketItem[]);
      setTripExpenses((expR.data || []) as TripExpense[]);

      await hydrateFollowing((folR.data || []).map((x: any) => x.following_id));

      if (artCacheR.data?.length) {
        setArtistsMetaCache((prev) => {
          const next = { ...prev };
          artCacheR.data.forEach((r: any) => {
            if (r.artist_key && (!r.image_url || r.image_url.includes("scdn.co"))) {
              next[r.artist_key] = r;
            }
          });
          try { localStorage.setItem(ARTIST_META_CACHE_KEY, JSON.stringify(next)); } catch (_) {}
          return next;
        });
      }

      const nextMeta: Record<string, EventMeta> = { ...INITIAL_EVENTS_META };
      for (const row of metaR.data || []) {
        const poster = row.poster_path ? await resolveSignedUrl("event-media", row.poster_path) : "";
        const photos = Array.isArray(row.photos) ? [...row.photos] : [];
        for (const ph of photos) {
          if (ph.path && !ph.url) ph.url = await resolveSignedUrl("event-media", ph.path);
        }
        nextMeta[row.event_key] = {
          poster_path: row.poster_path || "",
          poster,
          photos,
          lineup: Array.isArray(row.lineup) ? row.lineup : []
        };
      }
      setEventsMeta(nextMeta);

      if (checkOnboard && !loadedUsername && loadedConcerts.length === 0) {
        setOnboardingOpen(true);
      }
      syncArtistsFromEdge(loadedConcerts, false);
    },
    [hydrateFollowing, syncArtistsFromEdge]
  );

  // Load Public Profile (?u=slug)
  const loadPublicProfileBySlug = useCallback(async (slug: string): Promise<boolean> => {
    const sb = getSupabase();
    if (!sb) return false;
    try {
      const { data, error } = await sb.rpc("get_public_profile", { p_username: slug });
      if (error || !data?.profile) {
        toast.error(`Nie znaleziono publicznego profilu @${slug}`);
        return false;
      }
      const prof = data.profile;
      setStorageMode("public");
      setPublicProfile({
        id: prof.id,
        username: prof.username || slug,
        display_name: prof.display_name || "",
        bio: prof.bio || "",
        is_public: true
      });
      setSettings({
        hometown: prof.hometown || "Poznań",
        hometown_coords: [prof.hometown_lat ?? 52.4064, prof.hometown_lng ?? 16.9252]
      });
      if (prof.theme && THEME_PROFILES[prof.theme as ThemeId]) {
        setThemeState(prof.theme as ThemeId);
      }
      if (data.cities?.length) {
        const merged = { ...INITIAL_COORDS };
        data.cities.forEach((r: any) => { merged[r.city] = [r.lat, r.lng]; });
        setCityCoords(merged);
      }
      if (data.artists?.length) {
        const next: Record<string, ArtistMeta> = {};
        data.artists.forEach((r: any) => {
          if (r.artist_key && (!r.image_url || r.image_url.includes("scdn.co"))) next[r.artist_key] = r;
        });
        setArtistsMetaCache(next);
      }
      setAllConcerts(data.concerts || []);
      setUpcomingConcerts([]);
      setBucketList([]);
      setTripExpenses([]);

      const { data: sess } = await sb.auth.getSession();
      if (sess?.session?.user) {
        setViewerUserForPublic(sess.session.user);
        if (prof.id && prof.id !== sess.session.user.id) {
          const { data: fCheck } = await sb
            .from("follows")
            .select("following_id")
            .eq("follower_id", sess.session.user.id)
            .eq("following_id", prof.id)
            .maybeSingle();
          setIsFollowingCurrentPublic(!!fCheck);
        }
      }
      return true;
    } catch (_) {
      return false;
    }
  }, []);

  // Enter Offline Demo Mode
  const enterOfflineDemo = useCallback(() => {
    setStorageMode("offline");
    const savedCon = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || [...INITIAL_CONCERTS];
    setAllConcerts(savedCon);
    setUpcomingConcerts(JSON.parse(localStorage.getItem(UPCOMING_KEY) || "[]"));
    setEventsMeta({ ...INITIAL_EVENTS_META, ...JSON.parse(localStorage.getItem(META_KEY) || "{}") });
    setBucketList(JSON.parse(localStorage.getItem(BUCKET_KEY) || "[]"));
    setTripExpenses(JSON.parse(localStorage.getItem(EXPENSES_KEY) || "[]"));
    const savedSet = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    if (savedSet) setSettings(savedSet);
  }, []);

  // Bootstrap strictly once on mount (prevents continuous re-fetching loop)
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    const boot = async () => {
      const slug = new URLSearchParams(location.search).get("u")?.trim().toLowerCase() || "";
      if (slug && isSupabaseConfigured()) {
        const ok = await loadPublicProfileBySlug(slug);
        if (ok) return;
      }
      if (isSupabaseConfigured()) {
        const sb = getSupabase()!;
        const { data } = await sb.auth.getSession();
        if (data?.session?.user) {
          await loadUserFromSupabase(data.session.user, false);
        } else {
          setStorageMode("auth");
        }
        return;
      }
      enterOfflineDemo();
    };
    boot();
  }, [enterOfflineDemo, loadPublicProfileBySlug, loadUserFromSupabase]);

  // Filtering
  const filteredConcerts = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return allConcerts.filter((c) => {
      if (filters.year && String(c.rok) !== filters.year) return false;
      if (filters.genre && c.gatunek !== filters.genre) return false;
      if (filters.who && c.kto !== filters.who) return false;
      if (filters.crew && c.z_kim !== filters.crew) return false;
      if (q) {
        const hay = `${c.artysta} ${c.event} ${c.miasto} ${c.kraj} ${c.miejsce} ${c.gatunek} ${c.z_kim} ${c.uwagi}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allConcerts, filters]);

  const activeFilterParts = useMemo(() => {
    const parts: string[] = [];
    if (filters.search.trim()) parts.push(`„${filters.search.trim()}”`);
    if (filters.year) parts.push(`Rok: ${filters.year}`);
    if (filters.genre) parts.push(`Gatunek: ${filters.genre}`);
    if (filters.who) parts.push(`Kto: ${filters.who}`);
    if (filters.crew) parts.push(`Ekipa: ${filters.crew}`);
    return parts;
  }, [filters]);

  const filterOptions = useMemo(() => ({
    years: [...new Set(allConcerts.map((c) => c.rok).filter(Boolean) as number[])].sort((a, b) => b - a),
    genres: [...new Set(allConcerts.map((c) => c.gatunek).filter(Boolean))].sort(),
    whos: [...new Set(allConcerts.map((c) => c.kto).filter(Boolean))].sort(),
    crews: [...new Set(allConcerts.map((c) => c.z_kim).filter(Boolean))].sort()
  }), [allConcerts]);

  // Audio preview toggle
  const togglePreview = (artistName: string, url: string) => {
    const player = audioRef.current;
    if (!player || !url) return;
    if (playingPreviewArtist === artistName && !player.paused) {
      player.pause();
      player.currentTime = 0;
      setPlayingPreviewArtist("");
      return;
    }
    setPlayingPreviewArtist(artistName);
    player.src = url;
    player.play().catch(() => {});
    toast.info(`Odsłuch 30s: ${artistName}`);
  };

  // Helper: ensure city coordinates exist
  const ensureCityCoords = async (city: string, country = ""): Promise<[number, number] | null> => {
    const ex = getCityCoords(city, cityCoords);
    if (ex) return ex;
    const coords = await geocodeCityOnline(city, country);
    if (!coords) return null;
    const next = { ...cityCoords, [city]: coords };
    setCityCoords(next);
    localStorage.setItem(COORDS_KEY, JSON.stringify(next));
    const sb = getSupabase();
    if (storageMode === "supabase" && sb) {
      await sb.from("cities_cache").upsert({ city, country, lat: coords[0], lng: coords[1] }, { onConflict: "city" });
    }
    return coords;
  };

  // CRUD Concerts
  const saveConcert = async (rec: Omit<Concert, "id">, id?: number) => {
    if (rec.miasto) await ensureCityCoords(rec.miasto, rec.kraj);
    const sb = getSupabase();
    if (id) {
      if (storageMode === "supabase" && sb) {
        const { error } = await sb.from("concerts").update(rec).eq("id", id);
        if (error) { toast.error(error.message); return; }
      }
      const next = allConcerts.map((c) => (c.id === id ? { ...rec, id } : c));
      setAllConcerts(next);
      if (storageMode === "offline") localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      toast.success("Zaktualizowano koncert!");
    } else {
      let newId = Math.max(0, ...allConcerts.map((c) => c.id || 0)) + 1;
      if (storageMode === "supabase" && sb && currentUser) {
        const { data, error } = await sb.from("concerts").insert({ ...rec, user_id: currentUser.id }).select().single();
        if (error) { toast.error(error.message); return; }
        newId = data.id;
      }
      const next = [...allConcerts, { ...rec, id: newId }];
      setAllConcerts(next);
      if (storageMode === "offline") localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      toast.success("Dodano koncert do historii!");
      syncArtistsFromEdge(next, false);
    }
  };

  const deleteConcert = async (id: number) => {
    if (!confirm("Usunąć ten koncert?")) return;
    const sb = getSupabase();
    if (storageMode === "supabase" && sb) await sb.from("concerts").delete().eq("id", id);
    const next = allConcerts.filter((c) => c.id !== id);
    setAllConcerts(next);
    if (storageMode === "offline") localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    toast.success("Usunięto koncert.");
  };

  // CRUD Upcoming
  const saveUpcoming = async (
    item: Omit<UpcomingConcert, "id">,
    ticketFile: File | null,
    hotel: string,
    transport: string
  ) => {
    const sb = getSupabase();
    let ticketPath = item.ticket_file_path || "";
    if (ticketFile && storageMode === "supabase" && sb && currentUser) {
      const ext = (ticketFile.name.split(".").pop() || "pdf").toLowerCase();
      ticketPath = `${currentUser.id}/ticket_${Date.now()}.${ext}`;
      await sb.storage.from("tickets").upload(ticketPath, ticketFile);
    }
    if (item.miasto) await ensureCityCoords(item.miasto, item.kraj);

    const payload = { ...item, ticket_file_path: ticketPath };
    let newId = Math.max(0, ...upcomingConcerts.map((x) => x.id || 0)) + 1;
    if (storageMode === "supabase" && sb && currentUser) {
      const { data, error } = await sb.from("upcoming_concerts").insert({ ...payload, user_id: currentUser.id }).select().single();
      if (error) { toast.error(error.message); return; }
      newId = data.id;
    }
    const next = [...upcomingConcerts, { ...payload, id: newId }];
    setUpcomingConcerts(next);
    if (storageMode === "offline") localStorage.setItem(UPCOMING_KEY, JSON.stringify(next));
    if (hotel || transport) {
      const nextTm = { ...travelMeta, [String(newId)]: { hotel, transport } };
      setTravelMeta(nextTm);
      localStorage.setItem(TRAVEL_KEY, JSON.stringify(nextTm));
    }
    toast.success("Zapisano nadchodzący wyjazd!");
    setActiveTab("start");
  };

  const completeUpcoming = async (id: number) => {
    const u = upcomingConcerts.find((x) => x.id === id);
    if (!u || !confirm(`Przenieść „${u.artysta}” do historii?`)) return;
    await saveConcert({
      rok: u.rok, event: u.event, artysta: u.artysta, data: u.data, dzien: u.dzien,
      godzina: u.godzina, scena: "", miejsce: u.miejsce, miasto: u.miasto, district: "",
      kraj: u.kraj, gatunek: u.gatunek, podgatunek: "", kto: "Razem", z_kim: u.z_kim,
      ocena: 0, cena: u.cena !== "" && u.cena != null ? Number(u.cena) : null, uwagi: u.uwagi
    });
    const sb = getSupabase();
    if (storageMode === "supabase" && sb) await sb.from("upcoming_concerts").delete().eq("id", id);
    const nextUp = upcomingConcerts.filter((x) => x.id !== id);
    setUpcomingConcerts(nextUp);
    if (storageMode === "offline") localStorage.setItem(UPCOMING_KEY, JSON.stringify(nextUp));
  };

  const deleteUpcoming = async (id: number) => {
    if (!confirm("Usunąć z planów?")) return;
    const sb = getSupabase();
    if (storageMode === "supabase" && sb) await sb.from("upcoming_concerts").delete().eq("id", id);
    const nextUp = upcomingConcerts.filter((x) => x.id !== id);
    setUpcomingConcerts(nextUp);
    if (storageMode === "offline") localStorage.setItem(UPCOMING_KEY, JSON.stringify(nextUp));
    toast.success("Usunięto plan wyjazdu.");
  };

  // Event media & lineups
  const persistEventMeta = async (key: string, meta: EventMeta) => {
    const next = { ...eventsMeta, [key]: meta };
    setEventsMeta(next);
    const sb = getSupabase();
    if (storageMode === "supabase" && sb && currentUser) {
      await sb.from("events_meta").upsert(
        {
          user_id: currentUser.id,
          event_key: key,
          poster_path: meta.poster_path || "",
          photos: (meta.photos || []).map((p) => ({
            path: p.path || "",
            url: p.path ? "" : p.url,
            added_at: p.added_at
          })),
          lineup: meta.lineup || [],
          updated_at: new Date().toISOString()
        },
        { onConflict: "user_id,event_key" }
      );
    } else {
      localStorage.setItem(META_KEY, JSON.stringify(next));
    }
  };

  const uploadImage = async (file: File, prefix: string): Promise<{ path: string; url: string }> => {
    const sb = getSupabase();
    if (storageMode === "supabase" && sb && currentUser) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${currentUser.id}/${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error } = await sb.storage.from("event-media").upload(path, file);
      if (error) throw error;
      return { path, url: await resolveSignedUrl("event-media", path) };
    }
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res({ path: "", url: String(r.result || "") });
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  };

  const handleUploadEventPhotos = async (ek: string, files: File[]) => {
    toast.info(`Zapisuję ${files.length} zdjęć...`);
    const cur = eventsMeta[ek] || { poster: "", poster_path: "", photos: [], lineup: [] };
    const photos = [...(cur.photos || [])];
    for (const f of files) {
      const u = await uploadImage(f, "photo");
      photos.push({ path: u.path, url: u.url, added_at: new Date().toISOString() });
    }
    await persistEventMeta(ek, { ...cur, photos });
    toast.success("Zapisano zdjęcia!");
  };

  // Splitwise
  const addExpense = async (row: { event_key: string; title: string; amount_pln: number; paid_by: string }) => {
    const sb = getSupabase();
    if (storageMode === "supabase" && sb && currentUser) {
      const { data } = await sb.from("trip_expenses").insert({ ...row, user_id: currentUser.id }).select().single();
      if (data) setTripExpenses((prev) => [data, ...prev]);
    } else {
      const next = [{ ...row, id: Date.now() }, ...tripExpenses];
      setTripExpenses(next);
      localStorage.setItem(EXPENSES_KEY, JSON.stringify(next));
    }
    toast.success("Dodano wydatek!");
  };

  const deleteExpense = async (id: number) => {
    const sb = getSupabase();
    if (storageMode === "supabase" && sb) await sb.from("trip_expenses").delete().eq("id", id);
    const next = tripExpenses.filter((x) => x.id !== id);
    setTripExpenses(next);
    if (storageMode === "offline") localStorage.setItem(EXPENSES_KEY, JSON.stringify(next));
  };

  // Social & Match 1v1
  const openConcertMatchByUsername = async (username: string) => {
    const sb = getSupabase();
    if (!sb) return;
    toast.info(`Obliczam Concert Match z @${username}...`);
    const { data } = await sb.rpc("get_public_profile", { p_username: username });
    if (!data?.profile) {
      toast.error("Nie udało się pobrać profilu.");
      return;
    }
    setMatchData({
      nameA: publicProfile.display_name || "Ty",
      listA: allConcerts,
      nameB: data.profile.display_name || `@${data.profile.username}`,
      listB: data.concerts || []
    });
  };

  const openConcertMatchForCurrentPublic = async () => {
    const sb = getSupabase();
    if (!sb || !viewerUserForPublic) return;
    const { data: myConcerts } = await sb
      .from("concerts")
      .select("artysta,event,rok,kraj,miasto")
      .eq("user_id", viewerUserForPublic.id);
    setMatchData({
      nameA: "Ty",
      listA: (myConcerts || []) as Partial<Concert>[],
      nameB: publicProfile.display_name || `@${publicProfile.username}`,
      listB: allConcerts
    });
  };

  const toggleFollowCurrentPublic = async () => {
    const sb = getSupabase();
    if (!sb || !viewerUserForPublic || !publicProfile.id) return;
    if (isFollowingCurrentPublic) {
      await sb.from("follows").delete().eq("follower_id", viewerUserForPublic.id).eq("following_id", publicProfile.id);
      setIsFollowingCurrentPublic(false);
      toast.info(`Przestałeś obserwować @${publicProfile.username}`);
    } else {
      await sb.from("follows").insert({ follower_id: viewerUserForPublic.id, following_id: publicProfile.id });
      setIsFollowingCurrentPublic(true);
      toast.success(`Obserwujesz @${publicProfile.username}!`);
    }
  };

  // Export & Import
  const exportXLSX = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allConcerts), "Koncerty");
    XLSX.writeFile(wb, `Fest_Life_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Wyeksportowano Excel (.xlsx)!");
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      let imported: any[] = [];
      if (file.name.toLowerCase().endsWith(".json")) {
        imported = JSON.parse(await file.text());
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf);
        const ws = wb.Sheets[wb.SheetNames[0]];
        imported = XLSX.utils.sheet_to_json(ws);
      }
      if (imported.length && storageMode === "supabase" && currentUser) {
        const sb = getSupabase()!;
        const rows = imported.map(({ id, ...r }) => ({
          ...r,
          user_id: currentUser.id,
          data: r.data || null,
          cena: r.cena !== "" && r.cena != null ? Number(r.cena) : null
        }));
        const { data } = await sb.from("concerts").insert(rows).select();
        setAllConcerts((prev) => [...prev, ...((data || []) as Concert[])]);
        toast.success(`Zaimportowano ${rows.length} koncertów!`);
      } else if (imported.length) {
        const next = [...allConcerts, ...imported.map((r, i) => ({ ...r, id: Date.now() + i }))];
        setAllConcerts(next);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        toast.success(`Zaimportowano ${imported.length} koncertów!`);
      }
    } catch (err: any) {
      toast.error("Błąd importu: " + err.message);
    }
    e.target.value = "";
  };

  const openStreamingPlaylist = () => {
    const artists = [...new Set(filteredConcerts.map((c) => c.artysta).filter(Boolean))].slice(0, 6);
    const q = encodeURIComponent(artists.join(" "));
    if (streamingProvider === "spotify") window.open(`https://open.spotify.com/search/${q}`, "_blank");
    else if (streamingProvider === "apple") window.open(`https://music.apple.com/pl/search?term=${q}`, "_blank");
    else if (streamingProvider === "youtube") window.open(`https://music.youtube.com/search?q=${q}`, "_blank");
    else window.open(`https://listen.tidal.com/search?q=${q}`, "_blank");
  };

  const handleLogout = async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    setCurrentUser(null);
    setStorageMode("auth");
  };

  const navItems: { id: MainTab; label: string; icon: React.ReactNode; privateOnly?: boolean }[] = [
    { id: "start", label: "Start", icon: <IconHome size={18} stroke={1.75} /> },
    { id: "map", label: "Mapa", icon: <IconMap size={18} stroke={1.75} /> },
    { id: "add", label: "Dodaj", icon: <IconPlus size={18} stroke={1.9} />, privateOnly: true },
    { id: "events", label: "Eventy", icon: <IconTicket size={18} stroke={1.75} /> },
    { id: "me", label: "Ja", icon: <IconUser size={18} stroke={1.75} />, privateOnly: true }
  ];

  const visibleNavItems = isPublicView ? navItems.filter((n) => !n.privateOnly) : navItems;

  const goHomeReset = () => {
    hapticTap(true);
    setFilters(EMPTY_FILTERS);
    setActiveTab("start");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const switchTab = (tab: MainTab) => {
    hapticTap(true);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (storageMode === "loading") {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--bg)] text-[var(--text)]">
        <div className="flex flex-col items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] font-display text-lg font-extrabold">
            FL
          </div>
          <span className="font-mono text-xs text-[var(--text-muted)]">Ładowanie FEST LIFE...</span>
        </div>
      </div>
    );
  }

  if (storageMode === "auth") {
    return (
      <>
        <Toaster richColors position="bottom-right" theme={THEME_PROFILES[theme].isDarkMap ? "dark" : "light"} />
        <AuthScreen
          onSuccess={(user) => loadUserFromSupabase(user, true)}
          onOfflineDemo={enterOfflineDemo}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-24 text-[var(--text)] md:pb-12">
      <Toaster richColors position="bottom-right" theme={THEME_PROFILES[theme].isDarkMap ? "dark" : "light"} />
      <audio ref={audioRef} onEnded={() => setPlayingPreviewArtist("")} />
      <input
        ref={importInputRef}
        type="file"
        accept=".xlsx,.xls,.json"
        className="hidden"
        onChange={handleImportFile}
      />

      <div className="mx-auto max-w-[1320px] px-3.5 pt-3.5 sm:px-6 sm:pt-5">
        {/* MINIMALIST EDITORIAL TOPBAR */}
        <header className="mb-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goHomeReset}
            className="flex min-w-0 items-center gap-3 text-left"
            title="Wróć na Start i wyczyść filtry"
          >
            <div className="relative grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl border border-[var(--border-strong)] bg-[var(--surface)]">
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              <span className="font-display text-sm font-extrabold tracking-tight">FL</span>
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-base font-extrabold tracking-tight sm:text-lg">FEST LIFE</h1>
              <div className="flex items-center gap-1.5 truncate font-mono text-[11px] text-[var(--text-muted)]">
                <span
                  className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                    storageMode === "offline" ? "bg-amber-400" : "bg-emerald-400"
                  }`}
                />
                <span className="truncate">
                  {isPublicView
                    ? `@${publicProfile.username}`
                    : storageMode === "supabase"
                    ? currentUser?.email
                    : "Tryb lokalny"}
                </span>
              </div>
            </div>
          </button>

          {/* Desktop Center Nav Pill with Motion layoutId */}
          <nav className="hidden items-center gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1 md:flex">
            {visibleNavItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => (item.id === "start" ? goHomeReset() : switchTab(item.id))}
                  className={`relative flex items-center gap-2 rounded-xl px-4 py-2 font-display text-xs font-bold transition ${
                    active ? "text-[var(--accent-ink)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="desktopNavPill"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      className="absolute inset-0 rounded-xl bg-[var(--accent)]"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Right Action Cluster: Spotlight ⌘K + Radix Dropdown Menu */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCmdkOpen(true)}
              className="fl-btn !px-2.5 !py-2"
              title="Szybkie wyszukiwanie (Ctrl+K / ⌘K)"
            >
              <IconSearch size={16} stroke={1.75} />
              <span className="hidden items-center gap-1 font-mono text-[11px] text-[var(--text-muted)] lg:inline-flex">
                <IconCommand size={12} />K
              </span>
            </button>

            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button type="button" className="fl-btn !px-2.5 !py-2" aria-label="Menu">
                  <IconMenu2 size={17} stroke={1.75} />
                  <span className="hidden sm:inline text-xs">Menu</span>
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={8}
                  className="z-[1500] w-64 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-2 shadow-2xl"
                >
                  {!isPublicView && (
                    <DropdownMenu.Item
                      onSelect={() => { setAddSubTab("concert"); switchTab("add"); }}
                      className="flex cursor-pointer items-center gap-2.5 rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[var(--accent-ink)] outline-none"
                    >
                      <IconPlus size={15} stroke={2} /> Dodaj koncert
                    </DropdownMenu.Item>
                  )}

                  <DropdownMenu.Item
                    onSelect={() => setWrappedOpen(true)}
                    className="mt-1 flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium outline-none hover:bg-[var(--surface-2)]"
                  >
                    <IconSparkles size={15} stroke={1.75} /> Wrapped Studio 9:16
                  </DropdownMenu.Item>

                  <DropdownMenu.Item
                    onSelect={openStreamingPlaylist}
                    className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium outline-none hover:bg-[var(--surface-2)]"
                  >
                    <IconMusic size={15} stroke={1.75} /> Playlista ({streamingProvider})
                  </DropdownMenu.Item>

                  {!isPublicView && storageMode === "supabase" && (
                    <DropdownMenu.Item
                      onSelect={() => syncArtistsFromEdge(allConcerts, true)}
                      className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium outline-none hover:bg-[var(--surface-2)]"
                    >
                      <IconRefresh size={15} stroke={1.75} /> Synchronizuj zdjęcia Spotify
                    </DropdownMenu.Item>
                  )}

                  <DropdownMenu.Separator className="my-1.5 h-px bg-[var(--border)]" />
                  <div className="px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                    Motyw
                  </div>
                  <div className="grid grid-cols-2 gap-1 px-1 pb-1">
                    {(Object.keys(THEME_PROFILES) as ThemeId[]).map((tid) => (
                      <button
                        key={tid}
                        type="button"
                        onClick={() => applyTheme(tid)}
                        className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold ${
                          theme === tid
                            ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                            : "bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]"
                        }`}
                      >
                        <IconPalette size={12} stroke={1.75} />
                        <span className="truncate">{THEME_PROFILES[tid].label.split(" ")[0]}</span>
                      </button>
                    ))}
                  </div>

                  {!isPublicView && (
                    <>
                      <DropdownMenu.Separator className="my-1.5 h-px bg-[var(--border)]" />
                      <DropdownMenu.Item
                        onSelect={exportXLSX}
                        className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium outline-none hover:bg-[var(--surface-2)]"
                      >
                        <IconDownload size={15} stroke={1.75} /> Eksport Excel (.xlsx)
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onSelect={() => importInputRef.current?.click()}
                        className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium outline-none hover:bg-[var(--surface-2)]"
                      >
                        <IconUpload size={15} stroke={1.75} /> Import (.xlsx / .json)
                      </DropdownMenu.Item>
                      {storageMode === "supabase" && (
                        <DropdownMenu.Item
                          onSelect={handleLogout}
                          className="mt-1 flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-red-400 outline-none hover:bg-red-500/10"
                        >
                          <IconLogout size={15} stroke={1.75} /> Wyloguj się
                        </DropdownMenu.Item>
                      )}
                    </>
                  )}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </header>

        {/* PUBLIC PROFILE BANNER */}
        {isPublicView && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3">
            <div>
              <div className="font-display text-sm font-extrabold">
                {publicProfile.display_name || `@${publicProfile.username}`}{" "}
                <span className="font-mono text-xs text-[var(--accent)]">@{publicProfile.username}</span>
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                {publicProfile.bio || `Statystyki koncertowe z ${settings.hometown}`}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {viewerUserForPublic && publicProfile.id && publicProfile.id !== viewerUserForPublic.id && (
                <button type="button" onClick={toggleFollowCurrentPublic} className="fl-btn !text-xs">
                  <IconUserPlus size={14} stroke={1.75} />
                  {isFollowingCurrentPublic ? "Obserwujesz ✓" : "Obserwuj"}
                </button>
              )}
              {viewerUserForPublic && (
                <button type="button" onClick={openConcertMatchForCurrentPublic} className="fl-btn !text-xs">
                  Concert Match
                </button>
              )}
              <button type="button" onClick={() => setWrappedOpen(true)} className="fl-btn !text-xs">
                Wrapped
              </button>
              <button
                type="button"
                onClick={() => { location.href = location.origin + location.pathname; }}
                className="fl-btn fl-btn-primary !text-xs"
              >
                Moje konto / Zaloguj
              </button>
            </div>
          </div>
        )}

        {/* COMPACT SEARCH & FILTER BAR (hidden on Ja tab) */}
        {activeTab !== "me" && (
          <div className="mb-5 space-y-2">
            <div className="flex gap-2">
              <div className="relative flex flex-1 items-center">
                <IconSearch size={16} stroke={1.75} className="pointer-events-none absolute left-3.5 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                  placeholder="Szukaj artysty, festiwalu, miasta, ekipy..."
                  className="fl-input w-full !pl-10 !pr-9"
                />
                {filters.search && (
                  <button
                    type="button"
                    onClick={() => setFilters((f) => ({ ...f, search: "" }))}
                    className="absolute right-2.5 rounded-full p-1 text-[var(--text-muted)] hover:text-[var(--text)]"
                    aria-label="Wyczyść frazę"
                  >
                    <IconX size={14} />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setFilterSheetOpen(true)}
                className={`fl-btn ${activeFilterParts.length ? "!border-[var(--accent)]" : ""}`}
              >
                <IconAdjustmentsHorizontal size={16} stroke={1.75} />
                <span className="hidden sm:inline">Filtry</span>
                {activeFilterParts.length > 0 && (
                  <span className="rounded-full bg-[var(--accent)] px-1.5 font-mono text-[10px] font-bold text-[var(--accent-ink)]">
                    {activeFilterParts.length}
                  </span>
                )}
              </button>
            </div>

            {activeFilterParts.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[var(--text-muted)]">Filtr:</span>
                  <strong>{activeFilterParts.join(" • ")}</strong>
                  <span className="font-mono text-[11px] text-[var(--accent)]">({filteredConcerts.length})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                  className="fl-btn fl-btn-primary !px-2.5 !py-1 !text-[11px]"
                >
                  Widok ogólny
                </button>
              </div>
            )}
          </div>
        )}

        {/* MAIN VIEW WITH MOTION TRANSITION */}
        <AnimatePresence mode="wait">
          <motion.main
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {activeTab === "start" && (
              <StartView
                allConcerts={allConcerts}
                filteredConcerts={filteredConcerts}
                upcomingConcerts={upcomingConcerts}
                travelMeta={travelMeta}
                eventsMeta={eventsMeta}
                artistsMetaCache={artistsMetaCache}
                settings={settings}
                cityCoords={cityCoords}
                theme={theme}
                streamingProvider={streamingProvider}
                playingPreviewArtist={playingPreviewArtist}
                hasActiveFilters={activeFilterParts.length > 0}
                isPublicView={isPublicView}
                onSelectArtist={(artist: string) => setFilters((f) => ({ ...f, search: artist }))}
                onResetFilters={() => setFilters(EMPTY_FILTERS)}
                onOpenWrapped={() => setWrappedOpen(true)}
                onSaveConcert={saveConcert}
                onEditConcert={(c: Concert) => {
                  setEditingConcert(c);
                  setAddSubTab("concert");
                  switchTab("add");
                }}
                onUploadEventPhotos={handleUploadEventPhotos}
                onOpenEvent={(eventKey: string) => {
                  setFocusedEventKey(eventKey);
                  switchTab("events");
                }}
                onQuickSearch={(val: string) => setFilters((f) => ({ ...f, search: val }))}
                onQuickFilter={(key: keyof FilterState, val: string) =>
                  setFilters((f) => ({ ...f, [key]: f[key] === val ? "" : val }))
                }
                onTogglePreview={togglePreview}
                onOpenStreamingPlaylist={openStreamingPlaylist}
                onOpenTicket={async (path: string) => {
                  const u = await resolveSignedUrl("tickets", path);
                  if (u) window.open(u, "_blank");
                }}
                onCompleteUpcoming={completeUpcoming}
                onDeleteUpcoming={deleteUpcoming}
                onGoAddUpcoming={() => { setAddSubTab("upcoming"); switchTab("add"); }}
              />
            )}

            {activeTab === "map" && (
              <MapView
                concerts={filteredConcerts}
                settings={settings}
                cityCoords={cityCoords}
                theme={theme}
              />
            )}

            {activeTab === "add" && !isPublicView && (
              <AddView
                subTab={addSubTab}
                onSubTabChange={setAddSubTab}
                allConcerts={allConcerts}
                filteredConcerts={filteredConcerts}
                eventsMeta={eventsMeta}
                artistsMetaCache={artistsMetaCache}
                editingConcert={editingConcert}
                prefillConcert={prefillConcert}
                onClearEditing={() => { setEditingConcert(null); setPrefillConcert(null); }}
                onSaveConcert={saveConcert}
                onDeleteConcert={deleteConcert}
                onEditConcert={(c) => { setEditingConcert(c); setAddSubTab("concert"); }}
                onSaveUpcoming={saveUpcoming}
              />
            )}

            {activeTab === "events" && (
              <EventsView
                allConcerts={allConcerts}
                filteredConcerts={filteredConcerts}
                eventsMeta={eventsMeta}
                tripExpenses={tripExpenses}
                clashSlots={clashSlots}
                settings={settings}
                cityCoords={cityCoords}
                isPublicView={isPublicView}
                focusedEventKey={focusedEventKey}
                onClearFocusedEvent={() => setFocusedEventKey(null)}
                onQuickAddFromLineup={(ek, artist) => {
                  const [ev, yr] = ek.split("|");
                  const sample = allConcerts.find((c) => `${c.event}|${c.rok}` === ek);
                  setEditingConcert(null);
                  setPrefillConcert({
                    event: ev,
                    rok: Number(yr) || sample?.rok || null,
                    artysta: artist,
                    data: sample?.data || "",
                    dzien: sample?.dzien || "",
                    miejsce: sample?.miejsce || "",
                    miasto: sample?.miasto || "",
                    kraj: sample?.kraj || "Polska",
                    z_kim: sample?.z_kim || ""
                  });
                  setAddSubTab("concert");
                  switchTab("add");
                }}
                onUploadEventPhotos={handleUploadEventPhotos}
                onUploadEventPoster={async (ek, file) => {
                  toast.info("Zapisuję plakat...");
                  const cur = eventsMeta[ek] || { poster: "", poster_path: "", photos: [], lineup: [] };
                  const u = await uploadImage(file, "poster");
                  await persistEventMeta(ek, { ...cur, poster: u.url, poster_path: u.path });
                  toast.success("Zapisano plakat!");
                }}
                onRemovePoster={async (ek) => {
                  if (!confirm("Usunąć plakat?")) return;
                  const cur = eventsMeta[ek] || {};
                  await persistEventMeta(ek, { ...cur, poster: "", poster_path: "" });
                }}
                onRemovePhoto={async (ek, idx) => {
                  if (!confirm("Usunąć zdjęcie?")) return;
                  const cur = eventsMeta[ek] || {};
                  const photos = (cur.photos || []).filter((_, i) => i !== idx);
                  await persistEventMeta(ek, { ...cur, photos });
                }}
                onSaveLineup={async (ek, lineup) => {
                  const cur = eventsMeta[ek] || {};
                  await persistEventMeta(ek, { ...cur, lineup });
                  toast.success("Zapisano line-up!");
                }}
                onOpenSplitwise={(ek) => setSplitwiseKey(ek)}
                onSaveConcert={saveConcert}
                onEditConcert={(c) => { setEditingConcert(c); setAddSubTab("concert"); switchTab("add"); }}
                onDeleteConcert={deleteConcert}
                onFilterByCrew={(crew) => { setFilters((f) => ({ ...f, crew })); switchTab("start"); }}
                onAddClashSlot={(slot) => {
                  const next = [...clashSlots, slot];
                  setClashSlots(next);
                  localStorage.setItem(CLASH_KEY, JSON.stringify(next));
                }}
                onDeleteClashSlot={(idx) => {
                  const next = clashSlots.filter((_, i) => i !== idx);
                  setClashSlots(next);
                  localStorage.setItem(CLASH_KEY, JSON.stringify(next));
                }}
              />
            )}

            {activeTab === "me" && !isPublicView && (
              <ProfileView
                userEmail={currentUser?.email || ""}
                isCloud={storageMode === "supabase"}
                settings={settings}
                theme={theme}
                streamingProvider={streamingProvider}
                publicProfile={publicProfile}
                followingList={followingList}
                bucketList={bucketList}
                allConcerts={allConcerts}
                artistsMetaCache={artistsMetaCache}
                onSaveHometown={async (city) => {
                  const trimmed = city.trim();
                  if (!trimmed) return;
                  toast.info(`Szukam współrzędnych dla ${trimmed}...`);
                  const coords = await ensureCityCoords(trimmed);
                  if (!coords) { toast.error("Nie znaleziono miasta."); return; }
                  const nextSet: UserSettings = { hometown: trimmed, hometown_coords: coords };
                  setSettings(nextSet);
                  const sb = getSupabase();
                  if (storageMode === "supabase" && sb && currentUser) {
                    await sb.from("profiles").upsert({
                      id: currentUser.id,
                      hometown: trimmed,
                      hometown_lat: coords[0],
                      hometown_lng: coords[1],
                      updated_at: new Date().toISOString()
                    });
                  } else {
                    localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSet));
                  }
                  toast.success(`Hometown ustawiony: ${trimmed}!`);
                }}
                onThemeChange={applyTheme}
                onStreamingChange={saveStreamingProvider}
                onSyncArtists={() => syncArtistsFromEdge(allConcerts, true)}
                onSavePublicProfile={async (p) => {
                  const slug = sanitizeSlug(p.username);
                  if (p.is_public && slug.length < 3) {
                    toast.error("Nick musi mieć co najmniej 3 znaki.");
                    return;
                  }
                  const nextP = { ...p, username: slug };
                  setPublicProfile(nextP);
                  const sb = getSupabase();
                  if (storageMode === "supabase" && sb && currentUser) {
                    const { error } = await sb.from("profiles").upsert({
                      id: currentUser.id,
                      username: slug || null,
                      display_name: p.display_name,
                      bio: p.bio,
                      is_public: p.is_public,
                      updated_at: new Date().toISOString()
                    });
                    if (error) {
                      toast.error(error.message.includes("unique") ? "Ten nick jest już zajęty!" : error.message);
                      return;
                    }
                    toast.success(p.is_public ? "Profil publiczny aktywny!" : "Zapisano (profil prywatny).");
                  }
                }}
                onSearchProfiles={async (q) => {
                  const sb = getSupabase();
                  if (!sb) return [];
                  const { data } = await sb.rpc("search_public_profiles", { p_query: q });
                  return ((data || []) as PublicProfileSummary[]).filter(
                    (r) => !currentUser || r.id !== currentUser.id
                  );
                }}
                onFollow={async (targetId) => {
                  const sb = getSupabase();
                  if (!sb || !currentUser) return;
                  await sb.from("follows").insert({ follower_id: currentUser.id, following_id: targetId });
                  const { data: folR } = await sb.from("follows").select("following_id").eq("follower_id", currentUser.id);
                  await hydrateFollowing((folR || []).map((x: any) => x.following_id));
                  toast.success("Dodano do obserwowanych!");
                }}
                onUnfollow={async (targetId) => {
                  const sb = getSupabase();
                  if (!sb || !currentUser) return;
                  await sb.from("follows").delete().eq("follower_id", currentUser.id).eq("following_id", targetId);
                  setFollowingList((prev) => prev.filter((x) => x.id !== targetId));
                  toast.info("Usunięto z obserwowanych.");
                }}
                onOpenConcertMatch={openConcertMatchByUsername}
                onAddBucket={async (artist, notes) => {
                  const sb = getSupabase();
                  if (storageMode === "supabase" && sb && currentUser) {
                    const { data } = await sb.from("bucket_list").insert({ user_id: currentUser.id, artist, notes }).select().single();
                    if (data) setBucketList((prev) => [data as BucketItem, ...prev]);
                  } else {
                    const next = [{ id: Date.now(), artist, notes, seen: false }, ...bucketList];
                    setBucketList(next);
                    localStorage.setItem(BUCKET_KEY, JSON.stringify(next));
                  }
                  toast.success("Dodano do Bucket List!");
                }}
                onDeleteBucket={async (id) => {
                  const sb = getSupabase();
                  if (storageMode === "supabase" && sb) await sb.from("bucket_list").delete().eq("id", id);
                  const next = bucketList.filter((b) => b.id !== id);
                  setBucketList(next);
                  if (storageMode === "offline") localStorage.setItem(BUCKET_KEY, JSON.stringify(next));
                }}
                onOpenWrapped={() => setWrappedOpen(true)}
                onExportXLSX={exportXLSX}
                onTriggerImport={() => importInputRef.current?.click()}
                onLogout={handleLogout}
              />
            )}
          </motion.main>
        </AnimatePresence>
      </div>

      {/* NATIVE MOBILE BOTTOM TAB BAR */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-[1400] grid border-t border-[var(--border)] bg-[var(--surface)]/95 px-2 pt-1.5 backdrop-blur-lg pb-safe md:hidden"
        style={{ gridTemplateColumns: `repeat(${visibleNavItems.length}, 1fr)` }}
      >
        {visibleNavItems.map((item) => {
          const active = activeTab === item.id;
          const isAdd = item.id === "add";
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => (item.id === "start" ? goHomeReset() : switchTab(item.id))}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10px] font-semibold transition ${
                isAdd
                  ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                  : active
                  ? "text-[var(--accent)]"
                  : "text-[var(--text-muted)]"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* VAUL BOTTOM SHEET: FILTERS */}
      <BottomSheet
        open={filterSheetOpen}
        onOpenChange={setFilterSheetOpen}
        title="Filtry koncertów"
        description={`Pokazywanie ${filteredConcerts.length} z ${allConcerts.length} koncertów`}
        maxWidthClass="max-w-lg"
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Rok</label>
            <select
              className="fl-input w-full"
              value={filters.year}
              onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value }))}
            >
              <option value="">Wszystkie lata</option>
              {filterOptions.years.map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Gatunek</label>
            <select
              className="fl-input w-full"
              value={filters.genre}
              onChange={(e) => setFilters((f) => ({ ...f, genre: e.target.value }))}
            >
              <option value="">Wszystkie gatunki</option>
              {filterOptions.genres.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {!isPublicView && (
            <>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Kto</label>
                <select
                  className="fl-input w-full"
                  value={filters.who}
                  onChange={(e) => setFilters((f) => ({ ...f, who: e.target.value }))}
                >
                  <option value="">Wszyscy</option>
                  {filterOptions.whos.map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Z kim (Ekipa)</label>
                <select
                  className="fl-input w-full"
                  value={filters.crew}
                  onChange={(e) => setFilters((f) => ({ ...f, crew: e.target.value }))}
                >
                  <option value="">Wszystkie ekipy</option>
                  {filterOptions.crews.map((cr) => (
                    <option key={cr} value={cr}>{cr}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="fl-btn">
              Resetuj filtry
            </button>
            <button type="button" onClick={() => setFilterSheetOpen(false)} className="fl-btn fl-btn-primary">
              Pokaż ({filteredConcerts.length})
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* CMDK SPOTLIGHT PALETTE */}
      <CommandPalette
        open={cmdkOpen}
        onOpenChange={setCmdkOpen}
        concerts={allConcerts}
        isPublicView={isPublicView}
        onSelectSearch={(q) => { setFilters((f) => ({ ...f, search: q })); setActiveTab("start"); }}
        onNavigate={switchTab}
        onOpenWrapped={() => setWrappedOpen(true)}
        onResetFilters={() => setFilters(EMPTY_FILTERS)}
        onSetTheme={applyTheme}
      />

      {/* KONVA INTERACTIVE WRAPPED STUDIO (VAUL BOTTOM SHEET) */}
      <WrappedStudioSheet
        open={wrappedOpen}
        onOpenChange={setWrappedOpen}
        allConcerts={allConcerts}
        settings={settings}
        cityCoords={cityCoords}
        theme={theme}
      />

      {/* SPLITWISE BOTTOM SHEET */}
      <SplitwiseSheet
        eventKey={splitwiseKey}
        onClose={() => setSplitwiseKey(null)}
        allConcerts={allConcerts}
        tripExpenses={tripExpenses}
        onAddExpense={addExpense}
        onDeleteExpense={deleteExpense}
      />

      {/* CONCERT MATCH 1v1 BOTTOM SHEET */}
      <ConcertMatchSheet data={matchData} onClose={() => setMatchData(null)} />

      {/* ONBOARDING WIZARD BOTTOM SHEET */}
      <OnboardingSheet
        open={onboardingOpen}
        onOpenChange={setOnboardingOpen}
        initialHometown={settings.hometown}
        initialTheme={theme}
        initialStreaming={streamingProvider}
        onThemeChange={applyTheme}
        onStreamingChange={saveStreamingProvider}
        onComplete={async (ob) => {
          const slug = sanitizeSlug(ob.username);
          const coords = (await ensureCityCoords(ob.hometown)) || settings.hometown_coords;
          setSettings({ hometown: ob.hometown || "Poznań", hometown_coords: coords });
          setPublicProfile({ username: slug, display_name: ob.display_name, bio: "", is_public: ob.is_public });
          const sb = getSupabase();
          if (sb && currentUser) {
            const { error } = await sb.from("profiles").upsert({
              id: currentUser.id,
              username: slug || null,
              display_name: ob.display_name,
              hometown: ob.hometown || "Poznań",
              hometown_lat: coords[0],
              hometown_lng: coords[1],
              theme,
              is_public: ob.is_public,
              updated_at: new Date().toISOString()
            });
            if (error?.message.includes("unique")) {
              toast.error("Ten nick jest już zajęty — wybierz inny.");
              return false;
            }
          }
          toast.success("Profil skonfigurowany!");
          return true;
        }}
        onGoAddFirst={() => { setAddSubTab("concert"); switchTab("add"); }}
        onTriggerImport={() => importInputRef.current?.click()}
      />
    </div>
  );
}