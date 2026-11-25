import { createClient } from "@supabase/supabase-js";

export interface ResolvedArtist {
  artist_key: string;
  name: string;
  image_url: string;
  genres: string[];
  popularity: number;
  spotify_url: string;
  apple_music_url: string;
  preview_url: string;
  updated_at?: string;
}

const LOCAL_CACHE_KEY = "fl_artists_portraits_v2";
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

const sbClient =
  supabaseUrl && supabaseAnon ? createClient(supabaseUrl, supabaseAnon) : null;

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function isValidImg(url?: string): boolean {
  if (!url) return false;
  if (url.includes("/artist//")) return false;
  return url.startsWith("http");
}

export function loadLocalArtistCache(): Record<string, ResolvedArtist> {
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalArtistCache(map: Record<string, ResolvedArtist>) {
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota errors
  }
}

// JSONP helper dla Deezer API bezpośrednio z przeglądarki (omija CORS, 0 tokenów)
function queryDeezerJsonp(name: string, limit = 5): Promise<any[]> {
  return new Promise((resolve) => {
    const cbName = `__dz_cb_${Math.random().toString(36).slice(2, 9)}`;
    const script = document.createElement("script");
    const timer = window.setTimeout(() => {
      cleanup();
      resolve([]);
    }, 4500);

    function cleanup() {
      window.clearTimeout(timer);
      delete (window as any)[cbName];
      script.remove();
    }

    (window as any)[cbName] = (payload: any) => {
      cleanup();
      resolve(Array.isArray(payload?.data) ? payload.data : []);
    };

    script.src = `https://api.deezer.com/search/artist?q=${encodeURIComponent(
      name
    )}&limit=${limit}&output=jsonp&callback=${cbName}`;
    script.onerror = () => {
      cleanup();
      resolve([]);
    };
    document.head.appendChild(script);
  });
}

async function queryTheAudioDbBrowser(name: string): Promise<any[]> {
  try {
    const res = await fetch(
      `https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encodeURIComponent(name)}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.artists) ? data.artists : [];
  } catch {
    return [];
  }
}

async function queryWikipediaBrowser(name: string): Promise<string[]> {
  const hints = [
    "muzyk", "raper", "piosenkar", "zespół", "wokalist", "producent", "dj",
    "band", "singer", "rapper", "musician", "producer", "songwriter", "duo"
  ];
  const found: string[] = [];
  for (const lang of ["pl", "en"]) {
    try {
      const sRes = await fetch(
        `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
          name
        )}&format=json&origin=*&srlimit=3`
      );
      if (!sRes.ok) continue;
      const hits = (await sRes.json())?.query?.search || [];
      for (const h of hits) {
        const sumRes = await fetch(
          `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(h.title)}`
        );
        if (!sumRes.ok) continue;
        const sum = await sumRes.json();
        const txt = `${sum.description || ""} ${sum.extract || ""}`.toLowerCase();
        const img = sum.originalimage?.source || sum.thumbnail?.source || "";
        if (hints.some((w) => txt.includes(w)) && isValidImg(img) && !img.endsWith(".svg")) {
          found.push(img);
        }
      }
    } catch {
      // ignore
    }
  }
  return found;
}

async function queryItunesAudioBrowser(name: string) {
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=song&limit=1`
    );
    if (!res.ok) return { preview_url: "", apple_music_url: "" };
    const track = (await res.json())?.results?.[0];
    return {
      preview_url: track?.previewUrl || "",
      apple_music_url: track?.artistViewUrl || track?.trackViewUrl || "",
    };
  } catch {
    return { preview_url: "", apple_music_url: "" };
  }
}

// Pełny 4-źródłowy resolver dla pojedynczego artysty w przeglądarce
export async function resolveSingleArtistBrowser(name: string): Promise<ResolvedArtist> {
  const cleanName = name.trim();
  const k = cleanName.toLowerCase();
  const target = norm(cleanName);

  // 1. Deezer JSONP (1000x1000 portret artysty)
  const dzItems = await queryDeezerJsonp(cleanName, 5);
  const exactDz = dzItems.find(
    (it) => norm(it.name || "") === target && isValidImg(it.picture_xl || it.picture_big)
  );
  const bestDz =
    exactDz ||
    dzItems
      .filter((it) => isValidImg(it.picture_xl || it.picture_big))
      .sort((a, b) => (b.nb_fan || 0) - (a.nb_fan || 0))[0];

  let image_url = bestDz?.picture_xl || bestDz?.picture_big || "";
  if (!isValidImg(image_url)) image_url = "";

  // 2. TheAudioDB
  const tadbItems = await queryTheAudioDbBrowser(cleanName);
  const tadb = tadbItems[0];
  if (!image_url && tadb) {
    const cand = tadb.strArtistThumb || tadb.strArtistFanart || "";
    if (isValidImg(cand)) image_url = cand;
  }

  // 3. Wikipedia PL/EN
  if (!image_url) {
    const wikiImgs = await queryWikipediaBrowser(cleanName);
    if (wikiImgs[0]) image_url = wikiImgs[0];
  }

  // 4. iTunes 30s audio preview + Apple Music link
  const audio = await queryItunesAudioBrowser(cleanName);

  return {
    artist_key: k,
    name: cleanName,
    image_url,
    genres: [tadb?.strGenre, tadb?.strStyle].filter(Boolean),
    popularity: bestDz?.nb_fan
      ? Math.min(100, Math.round(Math.log10(Math.max(10, bestDz.nb_fan)) * 16))
      : 0,
    spotify_url: `https://open.spotify.com/search/${encodeURIComponent(cleanName)}`,
    apple_music_url: audio.apple_music_url,
    preview_url: audio.preview_url,
    updated_at: new Date().toISOString(),
  };
}

// Zbiera do 8 kandydatów zdjęć do ręcznej podmiany w Artist Dossier
export async function fetchArtistImageCandidates(name: string): Promise<string[]> {
  const [dz, tadb, wiki] = await Promise.all([
    queryDeezerJsonp(name, 6),
    queryTheAudioDbBrowser(name),
    queryWikipediaBrowser(name),
  ]);

  const urls = new Set<string>();
  for (const item of dz) {
    const u = item.picture_xl || item.picture_big;
    if (isValidImg(u)) urls.add(u);
  }
  for (const item of tadb) {
    for (const u of [item.strArtistThumb, item.strArtistFanart, item.strArtistCutout]) {
      if (isValidImg(u)) urls.add(u);
    }
  }
  for (const u of wiki) {
    if (isValidImg(u)) urls.add(u);
  }
  return Array.from(urls).slice(0, 8);
}

// Zapisuje ręcznie wybrane zdjęcie do localStorage i Supabase
export async function saveArtistPhotoOverride(
  artistName: string,
  imageUrl: string,
  currentCache: Record<string, ResolvedArtist>
): Promise<Record<string, ResolvedArtist>> {
  const k = artistName.trim().toLowerCase();
  const prev = currentCache[k];
  const updated: ResolvedArtist = {
    artist_key: k,
    name: artistName.trim(),
    image_url: imageUrl.trim(),
    genres: prev?.genres || [],
    popularity: prev?.popularity || 0,
    spotify_url:
      prev?.spotify_url || `https://open.spotify.com/search/${encodeURIComponent(artistName.trim())}`,
    apple_music_url: prev?.apple_music_url || "",
    preview_url: prev?.preview_url || "",
    updated_at: new Date().toISOString(),
  };

  const nextCache = { ...currentCache, [k]: updated };
  saveLocalArtistCache(nextCache);

  if (sbClient) {
    try {
      await sbClient.functions.invoke("fetch-artist-meta", {
        body: { manual_artist: artistName.trim(), manual_image_url: imageUrl.trim() },
      });
    } catch {
      // localStorage already saved
    }
  }
  return nextCache;
}

// Batch resolver dla całej listy koncertów (Edge Function + fallback przeglądarkowy)
export async function resolveArtistsBatch(
  artistNames: string[],
  existingCache: Record<string, any> = {},
  onUpdate?: (merged: Record<string, ResolvedArtist>) => void
): Promise<Record<string, ResolvedArtist>> {
  const local = loadLocalArtistCache();
  const merged: Record<string, ResolvedArtist> = { ...local, ...existingCache };

  const unique = Array.from(
    new Set(artistNames.map((a) => (a || "").trim()).filter(Boolean))
  );

  const missing = unique.filter((name) => {
    const hit = merged[name.toLowerCase()];
    return !hit || !isValidImg(hit.image_url);
  });

  if (!missing.length) {
    onUpdate?.(merged);
    return merged;
  }

  // 1. Najpierw próbujemy Supabase Edge Function (wspólny cache w chmurze)
  if (sbClient) {
    try {
      const { data } = await sbClient.functions.invoke("fetch-artist-meta", {
        body: { artists: missing.slice(0, 30) },
      });
      if (data?.results) {
        for (const [k, val] of Object.entries<any>(data.results)) {
          if (val && isValidImg(val.image_url)) {
            merged[k] = val;
          }
        }
        saveLocalArtistCache(merged);
        onUpdate?.({ ...merged });
      }
    } catch {
      // przechodzimy do fallbacku w przeglądarce
    }
  }

  // 2. Dla wszystkich nadal brakujących — pobieramy bezpośrednio z przeglądarki (Deezer JSONP / TheAudioDB / Wiki)
  const stillMissing = missing.filter((name) => !isValidImg(merged[name.toLowerCase()]?.image_url));
  for (const name of stillMissing.slice(0, 24)) {
    const resolved = await resolveSingleArtistBrowser(name);
    merged[name.toLowerCase()] = resolved;
    saveLocalArtistCache(merged);
    onUpdate?.({ ...merged });
  }

  return merged;
}
