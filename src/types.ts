export type ThemeId = "dark" | "light" | "volcano" | "nasa";
export type StreamingProvider = "spotify" | "apple" | "youtube" | "tidal";
export type MainTab = "start" | "map" | "add" | "events" | "me";

export interface Concert {
  id: number;
  rok: number | null;
  event: string;
  artysta: string;
  data: string | null;
  dzien: string;
  godzina: string;
  scena: string;
  miejsce: string;
  miasto: string;
  district: string;
  kraj: string;
  gatunek: string;
  podgatunek: string;
  kto: string;
  z_kim: string;
  ocena?: number;
  cena?: string | number | null;
  uwagi: string;
}

export interface UpcomingConcert {
  id: number;
  rok: number | null;
  event: string;
  artysta: string;
  data: string | null;
  dzien: string;
  godzina: string;
  miejsce: string;
  miasto: string;
  kraj: string;
  gatunek: string;
  z_kim: string;
  status_biletu: string;
  cena?: string | number | null;
  ticket_file_path?: string;
  uwagi: string;
}

export interface TravelInfo {
  hotel: string;
  transport: string;
}

export interface EventPhoto {
  path?: string;
  url: string;
  added_at?: string;
}

export interface EventMeta {
  poster?: string;
  poster_path?: string;
  photos?: EventPhoto[];
  lineup?: string[];
}

export interface ArtistMeta {
  artist_key: string;
  name: string;
  image_url?: string;
  genres?: string[];
  popularity?: number;
  spotify_url?: string;
  apple_music_url?: string;
  preview_url?: string;
}

export interface BucketItem {
  id: number;
  artist: string;
  notes?: string;
  seen?: boolean;
}

export interface TripExpense {
  id: number;
  event_key: string;
  title: string;
  amount_pln: number;
  paid_by: string;
}

export interface ClashSlot {
  artist: string;
  stage: string;
  start: string;
  end: string;
}

export interface UserSettings {
  hometown: string;
  hometown_coords: [number, number];
}

export interface PublicProfileSettings {
  id?: string;
  username: string;
  display_name: string;
  bio: string;
  is_public: boolean;
}

export interface PublicProfileSummary {
  id: string;
  username: string;
  display_name?: string;
  hometown?: string;
}

export interface FilterState {
  search: string;
  year: string;
  genre: string;
  who: string;
  crew: string;
}
