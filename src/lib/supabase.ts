import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://oxandbanjcrotsxckagy.supabase.co";

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || "WKLEJ_TUTAJ_SWOJ_SB_PUBLISHABLE_KEY";

let _client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return (
    typeof SUPABASE_URL === "string" &&
    SUPABASE_URL.startsWith("https://") &&
    typeof SUPABASE_ANON_KEY === "string" &&
    SUPABASE_ANON_KEY.length > 20 &&
    !SUPABASE_ANON_KEY.includes("WKLEJ_TUTAJ")
  );
}

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
  }
  return _client;
}

export async function resolveSignedUrl(
  bucket: string,
  pathOrUrl?: string | null
): Promise<string> {
  if (!pathOrUrl) return "";
  if (
    pathOrUrl.startsWith("http") ||
    pathOrUrl.startsWith("data:") ||
    pathOrUrl.startsWith("blob:")
  ) {
    return pathOrUrl;
  }
  const sb = getSupabase();
  if (!sb) return pathOrUrl;
  const { data } = await sb.storage.from(bucket).createSignedUrl(pathOrUrl, 86400);
  return data?.signedUrl || pathOrUrl;
}
