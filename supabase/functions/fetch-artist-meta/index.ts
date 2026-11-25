import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function isValidDeezerArtistImg(url?: string): boolean {
  if (!url) return false;
  // Deezer returns /artist//hash when artist has no profile photo
  if (url.includes("/artist//")) return false;
  return url.startsWith("http");
}

async function fetchFromDeezer(name: string) {
  try {
    const res = await fetch(
      `https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=5`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const items: any[] = data?.data || [];
    if (!items.length) return null;

    const target = norm(name);
    const exact = items.find(
      (it) => norm(it.name || "") === target && isValidDeezerArtistImg(it.picture_xl || it.picture_big)
    );
    const withPhoto = items
      .filter((it) => isValidDeezerArtistImg(it.picture_xl || it.picture_big))
      .sort((a, b) => (b.nb_fan || 0) - (a.nb_fan || 0))[0];

    const best = exact || withPhoto || items[0];
    const img = best?.picture_xl || best?.picture_big || best?.picture_medium || "";
    return {
      image_url: isValidDeezerArtistImg(img) ? img : "",
      popularity: Math.min(100, Math.round(Math.log10(Math.max(10, best?.nb_fan || 10)) * 16)),
      deezer_url: best?.link || "",
    };
  } catch {
    return null;
  }
}

async function fetchFromTheAudioDB(name: string) {
  try {
    const res = await fetch(
      `https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encodeURIComponent(name)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const art = data?.artists?.[0];
    if (!art) return null;
    const img = art.strArtistThumb || art.strArtistFanart || art.strArtistCutout || "";
    const genres = [art.strGenre, art.strStyle].filter(Boolean);
    return {
      image_url: img,
      genres,
    };
  } catch {
    return null;
  }
}

async function fetchFromWikipedia(name: string) {
  const musicHints = [
    "muzyk", "raper", "piosenkar", "zespół", "wokalist", "producent", "dj",
    "band", "singer", "rapper", "musician", "record producer", "songwriter", "duo"
  ];
  for (const lang of ["pl", "en"]) {
    try {
      const searchRes = await fetch(
        `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
          name
        )}&format=json&origin=*&srlimit=3`
      );
      if (!searchRes.ok) continue;
      const searchData = await searchRes.json();
      const hits: any[] = searchData?.query?.search || [];

      for (const hit of hits) {
        const title = hit.title;
        const summaryRes = await fetch(
          `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
        );
        if (!summaryRes.ok) continue;
        const summary = await summaryRes.json();
        const text = `${summary.description || ""} ${summary.extract || ""}`.toLowerCase();
        const isMusic = musicHints.some((h) => text.includes(h));
        const img = summary.originalimage?.source || summary.thumbnail?.source || "";
        if (isMusic && img && !img.endsWith(".svg")) {
          return { image_url: img };
        }
      }
    } catch {
      // ignore and try next language
    }
  }
  return null;
}

async function fetchFromItunesAudio(name: string) {
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=song&limit=1`
    );
    if (!res.ok) return null;
    const track = (await res.json())?.results?.[0];
    if (!track) return null;
    return {
      apple_music_url: track.artistViewUrl || track.trackViewUrl || "",
      preview_url: track.previewUrl || "",
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { artists, force, manual_artist, manual_image_url } = await req.json();
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Ręczna korekta zdjęcia jednego artysty
    if (manual_artist && manual_image_url) {
      const k = manual_artist.trim().toLowerCase();
      const row = {
        artist_key: k,
        name: manual_artist.trim(),
        image_url: manual_image_url.trim(),
        updated_at: new Date().toISOString(),
      };
      await admin.from("artists_cache").upsert(row, { onConflict: "artist_key" });
      return new Response(JSON.stringify({ results: { [k]: row } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const list: string[] = Array.isArray(artists) ? artists.slice(0, 30) : [];
    if (!list.length) {
      return new Response(JSON.stringify({ results: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const keys = list.map((a) => a.trim().toLowerCase());
    const { data: existing } = await admin
      .from("artists_cache")
      .select("*")
      .in("artist_key", keys);

    const results: Record<string, any> = {};
    const cutoff = Date.now() - 45 * 24 * 60 * 60 * 1000;
    const toFetch: string[] = [];

    for (const rawName of list) {
      const k = rawName.trim().toLowerCase();
      const hit = (existing || []).find((r: any) => r.artist_key === k);
      if (
        !force &&
        hit &&
        hit.image_url &&
        !hit.image_url.includes("/artist//") &&
        new Date(hit.updated_at).getTime() > cutoff
      ) {
        results[k] = hit;
      } else {
        toFetch.push(rawName.trim());
      }
    }

    for (const name of toFetch) {
      const k = name.toLowerCase();
      const existingHit = (existing || []).find((r: any) => r.artist_key === k);

      // 1. Deezer Artist API (prawdziwe portrety 1000x1000)
      const dz = await fetchFromDeezer(name);
      let image_url = dz?.image_url || "";
      let popularity = dz?.popularity || 0;
      let genres: string[] = [];

      // 2. TheAudioDB (zdjęcie + gatunki)
      const tadb = await fetchFromTheAudioDB(name);
      if (!image_url && tadb?.image_url) image_url = tadb.image_url;
      if (tadb?.genres?.length) genres = tadb.genres;

      // 3. Wikipedia PL/EN (świetne dla polskich artystów)
      if (!image_url) {
        const wiki = await fetchFromWikipedia(name);
        if (wiki?.image_url) image_url = wiki.image_url;
      }

      // 4. Apple / iTunes (wyłącznie 30s audio preview + link Apple Music)
      const itunes = await fetchFromItunesAudio(name);

      const row = {
        artist_key: k,
        name,
        image_url,
        genres: genres.length ? genres : existingHit?.genres || [],
        popularity: popularity || existingHit?.popularity || 0,
        spotify_url: existingHit?.spotify_url || `https://open.spotify.com/search/${encodeURIComponent(name)}`,
        apple_music_url: itunes?.apple_music_url || existingHit?.apple_music_url || "",
        preview_url: itunes?.preview_url || existingHit?.preview_url || "",
        updated_at: new Date().toISOString(),
      };

      await admin.from("artists_cache").upsert(row, { onConflict: "artist_key" });
      results[k] = row;
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
